import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const serverId = parseInt(id, 10);

    if (isNaN(serverId)) {
      return NextResponse.json(
        { error: 'Invalid server ID' },
        { status: 400 }
      );
    }

    const server = await prisma.server.findUnique({
      where: { id: serverId },
      include: {
        containers: {
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!server) {
      return NextResponse.json(
        { error: 'Server not found' },
        { status: 404 }
      );
    }

    const serverData = {
      id: server.id,
      name: server.name,
      hostname: server.hostname,
      ipAddress: server.ipAddress,
      status: server.status,
      cpuCores: server.cpuCores,
      totalMemoryGb: server.totalMemoryGb ? Number(server.totalMemoryGb) : undefined,
      totalDiskGb: server.totalDiskGb ? Number(server.totalDiskGb) : undefined,
      cpu: server.currentCpuPercent ? Number(server.currentCpuPercent) : undefined,
      memory: server.currentMemoryPercent ? Number(server.currentMemoryPercent) : undefined,
      disk: server.currentDiskPercent ? Number(server.currentDiskPercent) : undefined,
      lastMetricsAt: server.lastMetricsAt,
      createdAt: server.createdAt,
      containers: server.containers.map((c) => ({
        id: c.id,
        containerId: c.containerId,
        name: c.name,
        image: c.image,
        status: c.status,
        health: c.health,
        ports: c.ports,
      })),
    };

    return NextResponse.json(serverData);
  } catch (error) {
    console.error('Error fetching server:', error);
    return NextResponse.json(
      { error: 'Failed to fetch server' },
      { status: 500 }
    );
  }
}
