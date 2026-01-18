import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signAgentToken, validateAgentSecret } from '@/lib/auth/jwt';
import { Decimal } from '@prisma/client/runtime/library';
import type { AgentRegistrationRequest, AgentRegistrationResponse, ApiResponse } from '@neon/shared';

export async function POST(request: NextRequest) {
  try {
    // Validate agent secret
    const agentSecret = request.headers.get('x-agent-secret');
    if (!validateAgentSecret(agentSecret)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid or missing agent secret' },
        { status: 401 }
      );
    }

    // Parse request body
    const body: AgentRegistrationRequest = await request.json();
    const { serverName, serverInfo, agentVersion } = body;

    if (!serverName || !serverInfo) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Missing required fields: serverName, serverInfo' },
        { status: 400 }
      );
    }

    console.log(`[Agent Register] Registering agent: ${serverName} (v${agentVersion})`);

    // Upsert server record
    const server = await prisma.server.upsert({
      where: { name: serverName },
      update: {
        hostname: serverInfo.hostname,
        cpuCores: serverInfo.cpuCores,
        totalMemoryGb: new Decimal(serverInfo.totalMemoryGb.toFixed(2)),
        totalDiskGb: new Decimal(serverInfo.totalDiskGb.toFixed(2)),
        osName: serverInfo.osName,
        osVersion: serverInfo.osVersion,
        osKernel: serverInfo.osKernel,
        osArch: serverInfo.osArch,
        status: 'online',
      },
      create: {
        name: serverName,
        hostname: serverInfo.hostname,
        cpuCores: serverInfo.cpuCores,
        totalMemoryGb: new Decimal(serverInfo.totalMemoryGb.toFixed(2)),
        totalDiskGb: new Decimal(serverInfo.totalDiskGb.toFixed(2)),
        osName: serverInfo.osName,
        osVersion: serverInfo.osVersion,
        osKernel: serverInfo.osKernel,
        osArch: serverInfo.osArch,
        status: 'online',
      },
    });

    // Generate JWT token
    const token = await signAgentToken({
      serverId: server.id,
      serverName: server.name,
    });

    console.log(`[Agent Register] Agent registered successfully: ${serverName} (id: ${server.id})`);

    return NextResponse.json<ApiResponse<AgentRegistrationResponse>>({
      success: true,
      data: {
        serverId: server.id,
        token,
      },
    });
  } catch (error) {
    console.error('[Agent Register] Error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Registration failed' },
      { status: 500 }
    );
  }
}
