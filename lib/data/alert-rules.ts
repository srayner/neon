import { prisma } from '@/lib/prisma';
import { DEFAULT_ALERT_RULES, type AlertRules } from '@/lib/alerts/rules';

// The rules live in a single row (id 1). No row means the defaults apply.
const RULES_ID = 1;

export async function getAlertRules(): Promise<AlertRules> {
  const row = await prisma.alertRules.findUnique({ where: { id: RULES_ID } });
  if (!row) return { ...DEFAULT_ALERT_RULES };
  return {
    crashLoopCount: row.crashLoopCount,
    crashLoopWindowMinutes: row.crashLoopWindowMinutes,
    missedHeartbeats: row.missedHeartbeats,
    highUsageMinutes: row.highUsageMinutes,
  };
}

/** `rules` must already be validated (validateAlertRules). */
export async function saveAlertRules(rules: AlertRules): Promise<void> {
  await prisma.alertRules.upsert({
    where: { id: RULES_ID },
    create: { id: RULES_ID, ...rules },
    update: rules,
  });
}
