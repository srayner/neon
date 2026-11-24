import { connection } from 'next/server';
import { getNtfyPublicSettings } from '@/lib/alerts/ntfy';
import { countFailedNotifications } from '@/lib/alerts/notifications';
import { getAlertRules } from '@/lib/data/alert-rules';

export async function getSettings() {
  // Read at request time: the production image is built without these env vars.
  await connection();
  const [alertRules, failedNotifications] = await Promise.all([
    getAlertRules(),
    countFailedNotifications(),
  ]);
  return {
    backupRoot: process.env.BACKUP_ROOT || null,
    ntfy: getNtfyPublicSettings(),
    alertRules,
    failedNotifications,
  };
}
