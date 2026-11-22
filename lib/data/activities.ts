import { connection } from 'next/server';
import { prisma } from '@/lib/prisma';

/** The fields the agent stores in an activity's metadata JSON. */
export interface ActivityMetadata {
  exitCode?: number;
  signal?: string;
  restartCount?: number;
  isCrashLoop?: boolean;
}

function formatRelativeTime(date: Date): string {
  const diffMins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

/** Newest first. `limit` is capped at 50. */
export async function listRecentActivities(limit: number) {
  await connection();
  const activities = await prisma.activity.findMany({
    include: {
      server: { select: { name: true } },
      container: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 50),
  });

  return activities.map((a) => ({
    id: a.id,
    type: a.type,
    eventType: a.eventType,
    message: a.message,
    time: formatRelativeTime(a.createdAt),
    createdAt: a.createdAt.toISOString(),
    metadata: a.metadata as ActivityMetadata | null,
  }));
}
