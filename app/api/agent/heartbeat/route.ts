import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAgentToken, extractBearerToken, getTokenExpiresIn } from '@/lib/auth/jwt';
import type { AgentHeartbeatResponse, ApiResponse } from '@neon/shared';

export async function POST(request: NextRequest) {
  try {
    // Verify JWT token
    const token = extractBearerToken(request.headers.get('authorization'));
    if (!token) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Missing authorization token' },
        { status: 401 }
      );
    }

    const payload = await verifyAgentToken(token);
    if (!payload) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const { serverId, serverName } = payload;

    // Update server status to online
    await prisma.server.update({
      where: { id: serverId },
      data: {
        status: 'online',
      },
    });

    const tokenExpiresIn = getTokenExpiresIn(payload);

    console.log(`[Agent Heartbeat] Heartbeat from ${serverName} (token expires in ${tokenExpiresIn}s)`);

    return NextResponse.json<ApiResponse<AgentHeartbeatResponse>>({
      success: true,
      data: {
        serverTime: new Date().toISOString(),
        tokenExpiresIn,
      },
    });
  } catch (error) {
    console.error('[Agent Heartbeat] Error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Heartbeat failed' },
      { status: 500 }
    );
  }
}
