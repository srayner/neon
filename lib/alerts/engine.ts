import { Prisma, type ActivityType, type AlertSeverity, type EntityType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ALERT_CATALOGUE, type ConditionCode, type EventCode } from './catalogue';

// The alert engine: opens and resolves conditions and records events, as
// defined in docs/alerts.md section 5. Each change writes the alert record,
// its pending notification and its activity entry in one transaction.
// Notifications are sent only by the scheduled check (notifications.ts).

/** What an alert is about. `key` is "" for the server itself. */
export interface AlertSubject {
  serverId: number;
  key: string;
  entityType: EntityType;
  containerId?: number;
  serviceId?: number;
}

interface OpenParams {
  code: ConditionCode;
  subject: AlertSubject;
  /** No time in it: the notification adds the time (format.ts). */
  message: string;
  /** When the problem started. */
  at: Date;
}

interface ResolveParams {
  code: ConditionCode;
  subject: AlertSubject;
  /** When the problem cleared. */
  at: Date;
}

interface EventParams {
  code: EventCode;
  subject: AlertSubject;
  message: string;
  at: Date;
}

const ACTIVITY_TYPE: Record<AlertSeverity, ActivityType> = {
  critical: 'critical',
  warning: 'warning',
  info: 'info',
};

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function activityFields(subject: AlertSubject) {
  return {
    entityType: subject.entityType,
    serverId: subject.serverId,
    containerId: subject.containerId,
    serviceId: subject.serviceId,
  };
}

/**
 * Opens a condition. Returns the new alert, or null if the same alert is
 * already open for this subject (the database's partial unique index decides,
 * so two simultaneous opens still give one alert).
 */
export async function openAlert({ code, subject, message, at }: OpenParams) {
  const { severity } = ALERT_CATALOGUE[code];
  try {
    return await prisma.$transaction(async (tx) => {
      const alert = await tx.alert.create({
        data: {
          code,
          kind: 'condition',
          severity,
          serverId: subject.serverId,
          subjectKey: subject.key,
          message,
          status: 'open',
          openedAt: at,
          notifications: {
            create: { kind: 'opened', severity, createdAt: new Date() },
          },
        },
      });
      await tx.activity.create({
        data: {
          ...activityFields(subject),
          type: ACTIVITY_TYPE[severity],
          eventType: 'alert_opened',
          message,
          alertId: alert.id,
          createdAt: at,
        },
      });
      return alert;
    });
  } catch (error) {
    if (isUniqueViolation(error)) return null;
    throw error;
  }
}

/**
 * Resolves the open condition for this subject. Returns the resolved alert,
 * or null if none was open.
 */
export async function resolveAlert({ code, subject, at }: ResolveParams) {
  return prisma.$transaction(async (tx) => {
    const open = await tx.alert.findFirst({
      where: { code, serverId: subject.serverId, subjectKey: subject.key, status: 'open' },
    });
    if (!open) return null;

    // Only the caller that flips it from open resolves it.
    const { count } = await tx.alert.updateMany({
      where: { id: open.id, status: 'open' },
      data: { status: 'resolved', resolvedAt: at },
    });
    if (count === 0) return null;

    await tx.alertNotification.create({
      data: { alertId: open.id, kind: 'resolved', severity: 'info', createdAt: new Date() },
    });
    await tx.activity.create({
      data: {
        ...activityFields(subject),
        type: 'success',
        eventType: 'alert_resolved',
        message: `Resolved: ${open.message}`,
        alertId: open.id,
        createdAt: at,
      },
    });
    return { ...open, status: 'resolved' as const, resolvedAt: at };
  });
}

/** Records an event: stored as resolved straight away, one notification. */
export async function recordEvent({ code, subject, message, at }: EventParams) {
  const { severity } = ALERT_CATALOGUE[code];
  return prisma.$transaction(async (tx) => {
    const alert = await tx.alert.create({
      data: {
        code,
        kind: 'event',
        severity,
        serverId: subject.serverId,
        subjectKey: subject.key,
        message,
        status: 'resolved',
        openedAt: at,
        resolvedAt: at,
        notifications: {
          create: { kind: 'opened', severity, createdAt: new Date() },
        },
      },
    });
    await tx.activity.create({
      data: {
        ...activityFields(subject),
        type: ACTIVITY_TYPE[severity],
        eventType: 'alert_event',
        message,
        alertId: alert.id,
        createdAt: at,
      },
    });
    return alert;
  });
}
