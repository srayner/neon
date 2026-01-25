import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function formatRelativeTime(date: Date): string {
  const diffMins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

export async function GET(request: NextRequest) {
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '10', 10);

  const activities = await prisma.activity.findMany({
    include: {
      server: { select: { name: true } },
      container: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 50),
  });

  return NextResponse.json(activities.map(a => ({
    id: a.id,
    type: a.type,
    message: a.message,
    time: formatRelativeTime(a.createdAt),
    createdAt: a.createdAt.toISOString(),
  })));
}
