import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { openAlert, recordEvent, resolveAlert } from './engine';
import { removeTestAlerts, seededServerId, testSubject } from '@/test/alert-helpers';

// docs/alerts.md section 5: conditions, events and the alert record.
// Runs against the dev database; each test removes what it created.

let serverId: number;

beforeAll(async () => {
  serverId = await seededServerId();
});
afterEach(removeTestAlerts);
afterAll(() => prisma.$disconnect());

const at = new Date('2026-11-24T14:02:00Z');

async function stored(alertId: number) {
  return prisma.alert.findUniqueOrThrow({
    where: { id: alertId },
    include: {
      notifications: { orderBy: { id: 'asc' } },
      activities: { orderBy: { id: 'asc' } },
    },
  });
}

describe('opening a condition', () => {
  it('stores an open alert with one pending notification and an activity entry', async () => {
    const subject = testSubject(serverId);
    const alert = await openAlert({ code: 'C1', subject, message: 'atlas down', at });

    expect(alert).not.toBeNull();
    const row = await stored(alert!.id);
    expect(row).toMatchObject({
      code: 'C1',
      kind: 'condition',
      severity: 'critical',
      serverId,
      subjectKey: subject.key,
      message: 'atlas down',
      status: 'open',
      openedAt: at,
      resolvedAt: null,
    });
    expect(row.notifications).toEqual([
      expect.objectContaining({ kind: 'opened', severity: 'critical', status: 'pending', attempts: 0 }),
    ]);
    expect(row.activities).toEqual([
      expect.objectContaining({
        type: 'critical',
        eventType: 'alert_opened',
        message: 'atlas down',
        serverId,
        createdAt: at,
      }),
    ]);
  });

  it('does nothing when the same alert is already open for the subject', async () => {
    const subject = testSubject(serverId);
    const first = await openAlert({ code: 'C1', subject, message: 'atlas down', at });
    const again = await openAlert({ code: 'C1', subject, message: 'atlas down again', at });

    expect(again).toBeNull();
    const alerts = await prisma.alert.findMany({ where: { subjectKey: subject.key } });
    expect(alerts.map((a) => a.id)).toEqual([first!.id]);
    const row = await stored(first!.id);
    expect(row.notifications).toHaveLength(1);
    expect(row.activities).toHaveLength(1);
  });

  it('opens the same alert separately for a different subject', async () => {
    const a = await openAlert({ code: 'C1', subject: testSubject(serverId), message: 'atlas down', at });
    const b = await openAlert({ code: 'C1', subject: testSubject(serverId), message: 'zinc down', at });

    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(b!.id).not.toBe(a!.id);
  });

  it('gives one alert when two opens race (database-enforced)', async () => {
    const subject = testSubject(serverId);
    const results = await Promise.all(
      Array.from({ length: 5 }, () => openAlert({ code: 'C1', subject, message: 'atlas down', at }))
    );

    expect(results.filter((r) => r !== null)).toHaveLength(1);
    expect(await prisma.alert.count({ where: { subjectKey: subject.key } })).toBe(1);
    expect(
      await prisma.alertNotification.count({ where: { alert: { subjectKey: subject.key } } })
    ).toBe(1);
  });
});

describe('resolving a condition', () => {
  it('marks it resolved, adds an Info notification and a resolved activity entry', async () => {
    const subject = testSubject(serverId);
    const opened = await openAlert({ code: 'C3', subject, message: 'atlas unhealthy', at });
    const resolvedAt = new Date('2026-11-24T14:09:00Z');

    const resolved = await resolveAlert({ code: 'C3', subject, at: resolvedAt });

    expect(resolved?.id).toBe(opened!.id);
    const row = await stored(opened!.id);
    expect(row).toMatchObject({ status: 'resolved', resolvedAt });
    expect(row.notifications.map((n) => [n.kind, n.severity, n.status])).toEqual([
      ['opened', 'warning', 'pending'],
      ['resolved', 'info', 'pending'],
    ]);
    expect(row.activities.map((a) => [a.eventType, a.type, a.createdAt])).toEqual([
      ['alert_opened', 'warning', at],
      ['alert_resolved', 'success', resolvedAt],
    ]);

    // Resolved, the same alert can open again for the subject.
    expect(await openAlert({ code: 'C3', subject, message: 'atlas unhealthy', at: resolvedAt })).not.toBeNull();
  });

  it('does nothing when nothing is open', async () => {
    const subject = testSubject(serverId);
    // An open alert for another subject, and a resolved one for this subject, must stay as they are.
    const other = await openAlert({ code: 'C1', subject: testSubject(serverId), message: 'zinc down', at });
    await openAlert({ code: 'C1', subject, message: 'atlas down', at });
    await resolveAlert({ code: 'C1', subject, at });
    const before = await prisma.alertNotification.count({ where: { alert: { serverId } } });

    expect(await resolveAlert({ code: 'C1', subject, at })).toBeNull();

    expect(await prisma.alertNotification.count({ where: { alert: { serverId } } })).toBe(before);
    expect((await stored(other!.id)).status).toBe('open');
  });
});

describe('recording an event', () => {
  it('stores it resolved straight away, with one notification at its severity', async () => {
    const subject = testSubject(serverId);
    const event = await recordEvent({ code: 'H3', subject, message: 'atlas monitoring gap of 4 minutes', at });

    const row = await stored(event.id);
    expect(row).toMatchObject({
      code: 'H3',
      kind: 'event',
      severity: 'warning',
      status: 'resolved',
      openedAt: at,
      resolvedAt: at,
    });
    expect(row.notifications.map((n) => [n.kind, n.severity, n.status])).toEqual([
      ['opened', 'warning', 'pending'],
    ]);
    expect(row.activities.map((a) => [a.eventType, a.type])).toEqual([['alert_event', 'warning']]);
  });
});

describe('storage', () => {
  it('stores times in UTC, whatever the database session time zone', async () => {
    const subject = testSubject(serverId);
    const before = new Date();
    const alert = await openAlert({ code: 'C1', subject, message: 'atlas down', at });

    // Read the raw columns in a session set to a zone far from UTC: a
    // timestamp without time zone must come back unchanged.
    const [raw] = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL TIME ZONE 'Asia/Tokyo'`);
      return tx.$queryRaw<{ opened_at: string; notified: string; activity: string }[]>`
        SELECT a.opened_at::text AS opened_at,
               n.created_at::text AS notified,
               act.created_at::text AS activity
        FROM alert a
        JOIN alert_notification n ON n.alert_id = a.id
        JOIN activity act ON act.alert_id = a.id
        WHERE a.id = ${alert!.id}`;
    });

    expect(raw.opened_at).toBe('2026-11-24 14:02:00');
    expect(raw.activity).toBe('2026-11-24 14:02:00');
    // The notification's created time is "now", written by Neon in UTC.
    const notified = new Date(raw.notified.replace(' ', 'T') + 'Z');
    expect(Math.abs(notified.getTime() - before.getTime())).toBeLessThan(10_000);
  });
});
