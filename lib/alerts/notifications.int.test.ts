import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { openAlert, resolveAlert } from './engine';
import { sendPendingNotifications, GIVE_UP_AFTER_MS, type Sender } from './notifications';
import { removeTestAlerts, seededServerId, TEST_SUBJECT_PREFIX, testSubject } from '@/test/alert-helpers';

// docs/alerts.md section 5, "Sending notifications". The send loop takes every
// pending notification in the database, so these tests need a database with no
// pending notifications of its own; they stop if there are any.

let serverId: number;

beforeAll(async () => {
  serverId = await seededServerId();
});
beforeEach(async () => {
  const foreign = await prisma.alertNotification.count({
    where: { status: 'pending', alert: { subjectKey: { not: { startsWith: TEST_SUBJECT_PREFIX } } } },
  });
  if (foreign > 0) {
    throw new Error(
      `The database has ${foreign} real pending notification(s); the send-loop tests would send them. ` +
        'Let a running Neon send them (or mark them failed) first.'
    );
  }
});
afterEach(removeTestAlerts);
afterAll(() => prisma.$disconnect());

const at = new Date('2026-11-24T14:02:00Z');

/** A fake ntfy that records what it was sent, failing when told to. */
function fakeSender(fail: (title: string) => string | null = () => null) {
  const sent: { title: string; body: string; priority: number }[] = [];
  const send: Sender = async (title, body, priority) => {
    const error = fail(title);
    if (error) return { ok: false, error };
    sent.push({ title, body, priority });
    return { ok: true };
  };
  return { send, sent };
}

describe('sendPendingNotifications', () => {
  it('sends oldest first, by when each notification was created', async () => {
    const a = await openAlert({ code: 'C1', subject: testSubject(serverId), message: 'atlas down', at });
    const b = await openAlert({ code: 'C3', subject: testSubject(serverId), message: 'zinc unhealthy', at });
    // Make A's notification the newer one, so id order and age order disagree.
    await prisma.alertNotification.updateMany({
      where: { alertId: a!.id },
      data: { createdAt: new Date(Date.now() + 1000) },
    });
    const { send, sent } = fakeSender();

    await sendPendingNotifications(send);

    expect(sent.map((s) => s.body.split(' at ')[0])).toEqual(['zinc unhealthy', 'atlas down']);
    expect(b).not.toBeNull();
  });

  it('marks delivered notifications sent, with the priority from severity', async () => {
    const subject = testSubject(serverId);
    const alert = await openAlert({ code: 'C1', subject, message: 'atlas down', at });
    await resolveAlert({ code: 'C1', subject, at: new Date('2026-11-24T14:09:00Z') });
    const { send, sent } = fakeSender();

    await sendPendingNotifications(send);

    expect(sent).toEqual([
      { title: 'C1 Container down', body: 'atlas down at 14:02 UTC on 24 Nov 2026', priority: 5 },
      {
        title: 'Resolved: C1 Container down',
        body: 'Resolved: atlas down at 14:09 UTC on 24 Nov 2026',
        priority: 2,
      },
    ]);
    const rows = await prisma.alertNotification.findMany({ where: { alertId: alert!.id } });
    expect(rows.map((n) => [n.status, n.attempts, n.sentAt !== null])).toEqual([
      ['sent', 1, true],
      ['sent', 1, true],
    ]);

    // A second run sends nothing more.
    await sendPendingNotifications(send);
    expect(sent).toHaveLength(2);
  });

  it('keeps a failed send pending with the error, and sends nothing after it', async () => {
    const subject = testSubject(serverId);
    const alert = await openAlert({ code: 'C1', subject, message: 'atlas down', at });
    await resolveAlert({ code: 'C1', subject, at });
    const { send, sent } = fakeSender(() => 'Could not reach the ntfy server.');

    await sendPendingNotifications(send);
    await sendPendingNotifications(send);

    expect(sent).toEqual([]);
    const rows = await prisma.alertNotification.findMany({
      where: { alertId: alert!.id },
      orderBy: { id: 'asc' },
    });
    // The resolve was never tried: it must not arrive before the opening one.
    expect(rows.map((n) => [n.kind, n.status, n.attempts, n.lastError])).toEqual([
      ['opened', 'pending', 2, 'Could not reach the ntfy server.'],
      ['resolved', 'pending', 0, null],
    ]);
  });

  it('gives up on notifications over an hour old, and still sends the rest', async () => {
    const old = await openAlert({ code: 'C1', subject: testSubject(serverId), message: 'atlas down', at });
    await openAlert({ code: 'C1', subject: testSubject(serverId), message: 'zinc down', at });
    await prisma.alertNotification.updateMany({
      where: { alertId: old!.id },
      data: { createdAt: new Date(Date.now() - GIVE_UP_AFTER_MS - 1000) },
    });
    const { send, sent } = fakeSender();

    await sendPendingNotifications(send);

    expect(sent.map((s) => s.body.split(' at ')[0])).toEqual(['zinc down']);
    const oldRow = await prisma.alertNotification.findFirstOrThrow({ where: { alertId: old!.id } });
    expect(oldRow).toMatchObject({ status: 'failed', attempts: 0 });
  });

  it('keeps notifications pending when ntfy is not configured', async () => {
    const saved = { url: process.env.NTFY_URL, topic: process.env.NTFY_TOPIC, token: process.env.NTFY_TOKEN };
    delete process.env.NTFY_URL;
    delete process.env.NTFY_TOPIC;
    delete process.env.NTFY_TOKEN;
    try {
      const alert = await openAlert({ code: 'C1', subject: testSubject(serverId), message: 'atlas down', at });

      // The real sender, with nothing configured: must not throw.
      await expect(sendPendingNotifications()).resolves.toBeUndefined();

      const row = await prisma.alertNotification.findFirstOrThrow({ where: { alertId: alert!.id } });
      expect(row).toMatchObject({ status: 'pending', attempts: 1, lastError: 'ntfy is not configured.' });
    } finally {
      if (saved.url !== undefined) process.env.NTFY_URL = saved.url;
      if (saved.topic !== undefined) process.env.NTFY_TOPIC = saved.topic;
      if (saved.token !== undefined) process.env.NTFY_TOKEN = saved.token;
    }
  });
});
