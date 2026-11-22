import { NextRequest, NextResponse } from 'next/server';
import { listContainers } from '@/lib/data/containers';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const serverIdParam = searchParams.get('serverId');

    if (!serverIdParam) {
      return NextResponse.json(
        { error: 'serverId is required' },
        { status: 400 }
      );
    }

    const serverId = parseInt(serverIdParam, 10);

    if (isNaN(serverId)) {
      return NextResponse.json(
        { error: 'serverId must be a valid number' },
        { status: 400 }
      );
    }

    return NextResponse.json(await listContainers(serverId));
  } catch (error) {
    console.error('Error fetching containers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch containers' },
      { status: 500 }
    );
  }
}
