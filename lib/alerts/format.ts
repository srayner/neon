import type { AlertSeverity, NotificationKind } from '@prisma/client';
import { ALERT_CATALOGUE, type AlertCode } from './catalogue';

// ntfy priority by severity (docs/alerts.md section 4).
const NTFY_PRIORITY: Record<AlertSeverity, number> = {
  critical: 5,
  warning: 3,
  info: 2,
};

export function ntfyPriority(severity: AlertSeverity): number {
  return NTFY_PRIORITY[severity];
}

/** "14:02 UTC on 24 Nov 2026": the time a change happened, always in UTC. */
export function formatUtc(at: Date): string {
  const time = at.toLocaleTimeString('en-GB', {
    timeZone: 'UTC',
    hour: '2-digit',
    minute: '2-digit',
  });
  const date = at.toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return `${time} UTC on ${date}`;
}

interface NotificationInput {
  code: string;
  message: string;
  kind: NotificationKind;
  /** When the change happened: the alert's opened time, or its resolved time. */
  at: Date;
}

/**
 * The ntfy title and body. The stored message has no time in it; the body
 * adds when the change happened, in UTC, so a late notification can't mislead.
 */
export function formatNotification(n: NotificationInput): { title: string; body: string } {
  const title = ALERT_CATALOGUE[n.code as AlertCode]?.title ?? n.code;
  const prefix = n.kind === 'resolved' ? 'Resolved: ' : '';
  return {
    title: `${prefix}${n.code} ${title}`,
    body: `${prefix}${n.message} at ${formatUtc(n.at)}`,
  };
}
