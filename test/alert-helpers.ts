import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import type { AlertSubject } from '@/lib/alerts/engine';

// Shared by the alert integration tests. Every test subject's key starts with
// this prefix, so teardown removes exactly what the tests created (alerts,
// and through the foreign keys their notifications and activity entries).
export const TEST_SUBJECT_PREFIX = 'vitest-';

/** A seeded server (scripts/seed-servers.ts). */
export async function seededServerId(): Promise<number> {
  const server = await prisma.server.findUnique({ where: { name: 'staging-01' } });
  if (!server) throw new Error('Seeded server "staging-01" is missing: the seed did not run.');
  return server.id;
}

export function testSubject(serverId: number): AlertSubject {
  return {
    serverId,
    key: `${TEST_SUBJECT_PREFIX}${randomUUID()}`,
    entityType: 'service',
  };
}

export async function removeTestAlerts(): Promise<void> {
  await prisma.alert.deleteMany({ where: { subjectKey: { startsWith: TEST_SUBJECT_PREFIX } } });
}
