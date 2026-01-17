import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAgentToken, extractBearerToken } from '@/lib/auth/jwt';
import type { ContainersReportRequest, ApiResponse, ContainerStatus } from '@neon/shared';

// Map shared ContainerStatus to Prisma ContainerStatus enum
function mapContainerStatus(status: ContainerStatus): 'running' | 'exited' | 'paused' | 'restarting' {
  switch (status) {
    case 'running':
      return 'running';
    case 'exited':
      return 'exited';
    case 'paused':
      return 'paused';
    case 'restarting':
      return 'restarting';
    default:
      return 'exited';
  }
}

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

    // Parse request body
    const body: ContainersReportRequest = await request.json();
    const { containers } = body;

    if (!containers || !Array.isArray(containers)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Missing containers array' },
        { status: 400 }
      );
    }

    console.log(`[Agent Containers] Receiving ${containers.length} container(s) from ${serverName}`);

    // Upsert each container
    for (const container of containers) {
      await prisma.container.upsert({
        where: {
          serverId_containerId: {
            serverId,
            containerId: container.containerId,
          },
        },
        update: {
          name: container.name,
          image: container.image,
          status: mapContainerStatus(container.status),
          health: container.health,
          ports: container.ports,
        },
        create: {
          serverId,
          containerId: container.containerId,
          name: container.name,
          image: container.image,
          status: mapContainerStatus(container.status),
          health: container.health,
          ports: container.ports,
        },
      });
    }

    // Delete containers that are no longer present
    const currentContainerIds = containers.map((c) => c.containerId);
    const deleteResult = await prisma.container.deleteMany({
      where: {
        serverId,
        containerId: {
          notIn: currentContainerIds.length > 0 ? currentContainerIds : ['__none__'],
        },
      },
    });

    console.log(
      `[Agent Containers] Synced ${containers.length} container(s), deleted ${deleteResult.count} for ${serverName}`
    );

    return NextResponse.json<ApiResponse>({
      success: true,
    });
  } catch (error) {
    console.error('[Agent Containers] Error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to sync containers' },
      { status: 500 }
    );
  }
}
