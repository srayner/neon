import { connection } from 'next/server';
import { getNtfyPublicSettings } from '@/lib/alerts/ntfy';

export async function getSettings() {
  // Read at request time: the production image is built without these env vars.
  await connection();
  return {
    backupRoot: process.env.BACKUP_ROOT || null,
    ntfy: getNtfyPublicSettings(),
  };
}
