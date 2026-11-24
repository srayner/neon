import type { AlertKind, AlertSeverity } from '@prisma/client';

// Every alert ID in docs/alerts.md section 6, with its kind and fixed
// severity. Callers name an ID; the kind and severity always come from here.
export const ALERT_CATALOGUE = {
  C1: { kind: 'condition', severity: 'critical', title: 'Container down' },
  C2: { kind: 'condition', severity: 'critical', title: 'Crash loop' },
  C3: { kind: 'condition', severity: 'warning', title: 'Unhealthy' },
  C4: { kind: 'condition', severity: 'info', title: 'Paused' },
  C5: { kind: 'event', severity: 'info', title: 'Container removed' },
  C6: { kind: 'event', severity: 'info', title: 'New container' },
  C7: { kind: 'event', severity: 'info', title: 'Service version changed' },
  H1: { kind: 'condition', severity: 'critical', title: 'Server offline' },
  H2: { kind: 'condition', severity: 'critical', title: 'Docker unreachable' },
  H3: { kind: 'event', severity: 'warning', title: 'Monitoring gap' },
  H4: { kind: 'event', severity: 'info', title: 'OS version changed' },
  H5: { kind: 'event', severity: 'info', title: 'Docker version changed' },
  H6: { kind: 'event', severity: 'info', title: 'New server' },
  R1: { kind: 'condition', severity: 'warning', title: 'Disk nearly full' },
  R2: { kind: 'condition', severity: 'warning', title: 'Memory high' },
  R3: { kind: 'condition', severity: 'warning', title: 'CPU high' },
  S1: { kind: 'condition', severity: 'warning', title: 'Security issues found' },
  S2: { kind: 'event', severity: 'info', title: 'Security issues changed' },
} as const satisfies Record<
  string,
  { kind: AlertKind; severity: AlertSeverity; title: string }
>;

export type AlertCode = keyof typeof ALERT_CATALOGUE;
export type ConditionCode = {
  [K in AlertCode]: (typeof ALERT_CATALOGUE)[K]['kind'] extends 'condition' ? K : never;
}[AlertCode];
export type EventCode = Exclude<AlertCode, ConditionCode>;
