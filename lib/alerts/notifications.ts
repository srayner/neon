import { prisma } from '@/lib/prisma';
import { sendNtfyAlert, type SendResult } from './ntfy';
import { formatNotification, ntfyPriority } from './format';

// Sends pending notifications (docs/alerts.md section 5, "Sending
// notifications"). Only the scheduled check calls this.

/** A notification not delivered this long after it was created is given up. */
export const GIVE_UP_AFTER_MS = 60 * 60 * 1000;

export type Sender = (title: string, body: string, priority: number) => Promise<SendResult>;

/** Whether a pending notification created at `createdAt` should be given up. */
export function isExpired(createdAt: Date, now: Date): boolean {
  return now.getTime() - createdAt.getTime() >= GIVE_UP_AFTER_MS;
}

/**
 * Sends every pending notification, oldest first. Stops at the first failed
 * send, so a resolved notification is never sent while its opening one is
 * still waiting to be retried; the rest wait for the next run. An opening
 * notification given up after an hour does not hold back its resolve: the
 * resolve is still sent, and says what resolved and when.
 */
export async function sendPendingNotifications(
  send: Sender = sendNtfyAlert,
  now: () => Date = () => new Date()
): Promise<void> {
  const pending = await prisma.alertNotification.findMany({
    where: { status: 'pending' },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    include: { alert: true },
  });

  for (const n of pending) {
    if (isExpired(n.createdAt, now())) {
      await prisma.alertNotification.update({
        where: { id: n.id },
        data: { status: 'failed' },
      });
      continue;
    }

    const { title, body } = formatNotification({
      code: n.alert.code,
      message: n.alert.message,
      kind: n.kind,
      at: n.kind === 'resolved' ? (n.alert.resolvedAt ?? n.alert.openedAt) : n.alert.openedAt,
    });
    const result = await send(title, body, ntfyPriority(n.severity));

    if (result.ok) {
      await prisma.alertNotification.update({
        where: { id: n.id },
        data: { status: 'sent', sentAt: now(), attempts: { increment: 1 } },
      });
    } else {
      await prisma.alertNotification.update({
        where: { id: n.id },
        data: { attempts: { increment: 1 }, lastError: result.error },
      });
      return;
    }
  }
}

export async function countFailedNotifications(): Promise<number> {
  return prisma.alertNotification.count({ where: { status: 'failed' } });
}
