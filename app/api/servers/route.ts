import { NextResponse } from 'next/server';
import { listServers } from '@/lib/data/servers';

export async function GET() {
  try {
    return NextResponse.json(await listServers());
  } catch (error) {
    console.error('Error fetching servers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch servers' },
      { status: 500 }
    );
  }
}
