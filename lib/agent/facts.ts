import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { createActivity } from '@/lib/activity';
import { formatUtc } from '@/lib/alerts/format';
import type { DockerGap } from '@neon/shared';

// Facts the agent reports about itself (docs/alerts.md section 2). Neon stores
// them; the alert rules that act on them come later (H2, H3).

/**
 * Stores whether the agent can reach Docker. The changed-at time moves only
 * when the value differs from the stored one, in the same statement, so two
 * heartbeats arriving together cannot both count as the change.
 */
export async function recordDockerReachable(serverId: number, reachable: boolean, at: Date): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "server"
    SET "docker_reachable" = ${reachable},
        "docker_reachable_changed_at" = CASE
          WHEN "docker_reachable" IS DISTINCT FROM ${reachable} THEN ${at}
          ELSE "docker_reachable_changed_at"
        END
    WHERE "id" = ${serverId}`;
}

/** A gap's times, or null when they are missing, not dates, or out of order. */
function parseGap(gap: unknown): { from: Date; to: Date } | null {
  const { from, to } = (gap ?? {}) as Partial<DockerGap>;
  if (typeof from !== 'string' || typeof to !== 'string') return null;
  const fromDate = new Date(from);
  const toDate = new Date(to);
  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime()) || toDate < fromDate) return null;
  return { from: fromDate, to: toDate };
}

/**
 * Records each gap in the agent's view of Docker as an activity entry. The
 * agent resends a gap until Neon accepts it, so:
 * - a gap already recorded is skipped (a unique index on server, from and to);
 * - an invalid gap is skipped, not rejected. Rejecting it would leave it at
 *   the head of the agent's queue for ever, holding back every later gap. A
 *   clock stepped back during the gap can make it end before it starts.
 */
export async function recordDockerGaps(
  serverId: number,
  gaps: unknown[],
): Promise<{ created: number; invalid: number }> {
  const parsed = gaps.map(parseGap).filter((g) => g !== null);
  let created = 0;
  for (const { from, to } of parsed) {
    try {
      await createActivity({
        type: 'warning',
        entityType: 'server',
        eventType: 'monitoring_gap',
        message: `Lost contact with Docker from ${formatUtc(from)} to ${formatUtc(to)}`,
        serverId,
        // Normalised, so the same gap sent in another format still matches.
        metadata: { from: from.toISOString(), to: to.toISOString() },
      });
      created++;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') continue;
      throw error;
    }
  }
  return { created, invalid: gaps.length - parsed.length };
}
