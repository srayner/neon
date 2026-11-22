import { NextRequest, NextResponse } from 'next/server';
import { listRecentActivities } from '@/lib/data/activities';

export async function GET(request: NextRequest) {
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '10', 10);

  return NextResponse.json(await listRecentActivities(limit));
}
