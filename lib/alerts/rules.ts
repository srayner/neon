// The alert rules from docs/alerts.md section 7.1: shared by every server,
// stored in the database, defaults apply until changed.

export interface AlertRules {
  crashLoopCount: number;
  crashLoopWindowMinutes: number;
  missedHeartbeats: number;
  highUsageMinutes: number;
}

export const DEFAULT_ALERT_RULES: AlertRules = {
  crashLoopCount: 3,
  crashLoopWindowMinutes: 5,
  missedHeartbeats: 5,
  highUsageMinutes: 10,
};

export const ALERT_RULE_FIELDS: {
  key: keyof AlertRules;
  label: string;
  unit: string;
  help: string;
}[] = [
  {
    key: 'crashLoopCount',
    label: 'Crash loop: number of crashes',
    unit: 'crashes',
    help: 'A crash loop (C2) opens when a service crashes this many times within the window.',
  },
  {
    key: 'crashLoopWindowMinutes',
    label: 'Crash loop: time window',
    unit: 'minutes',
    help: 'C2 resolves when the service has stayed up for this long.',
  },
  {
    key: 'missedHeartbeats',
    label: 'Missed heartbeats before a server is offline',
    unit: 'heartbeats',
    help: "Server offline (H1) opens after this many of the server's heartbeat intervals pass with none received.",
  },
  {
    key: 'highUsageMinutes',
    label: 'How long memory or CPU must stay high',
    unit: 'minutes',
    help: 'Memory high (R2) and CPU high (R3) open and resolve only after this long above or below the threshold.',
  },
];

// The largest value a PostgreSQL integer column holds.
const MAX_VALUE = 2_147_483_647;

export type ValidationResult =
  | { ok: true; rules: AlertRules }
  | { ok: false; errors: Partial<Record<keyof AlertRules, string>> };

/** Every rule must be a whole number of at least 1. */
export function validateAlertRules(input: unknown): ValidationResult {
  const source = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
  const errors: Partial<Record<keyof AlertRules, string>> = {};
  const rules = {} as AlertRules;

  for (const { key } of ALERT_RULE_FIELDS) {
    const value = source[key];
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      errors[key] = 'Must be a whole number.';
    } else if (value < 1) {
      errors[key] = 'Must be at least 1.';
    } else if (value > MAX_VALUE) {
      errors[key] = 'Too large.';
    } else {
      rules[key] = value;
    }
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, rules };
}
