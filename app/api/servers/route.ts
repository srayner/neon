import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const servers = await prisma.server.findMany({
      include: {
        _count: {
          select: {
            containers: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    // Transform data for frontend
    const serversData = servers.map((server) => ({
      id: server.id,
      name: server.name,
      hostname: server.hostname,
      ipAddress: server.ipAddress,
      status: server.status,
      containerCount: server._count.containers,
      cpu: server.currentCpuPercent ? Number(server.currentCpuPercent) : undefined,
      memory: server.currentMemoryPercent ? Number(server.currentMemoryPercent) : undefined,
      disk: server.currentDiskPercent ? Number(server.currentDiskPercent) : undefined,
      cpuCores: server.cpuCores,
      totalMemoryGb: server.totalMemoryGb ? Number(server.totalMemoryGb) : undefined,
      totalDiskGb: server.totalDiskGb ? Number(server.totalDiskGb) : undefined,
      lastMetricsAt: server.lastMetricsAt,
    }));

    return NextResponse.json(serversData);
  } catch (error) {
    console.error('Error fetching servers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch servers' },
      { status: 500 }
    );
  }
}
