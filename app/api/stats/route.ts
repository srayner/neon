import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Get total servers count
    const totalServers = await prisma.server.count();

    // Get total containers count
    const totalContainers = await prisma.container.count();

    // Get average CPU usage across all servers
    const servers = await prisma.server.findMany({
      select: {
        currentCpuPercent: true,
      },
    });

    const validCpuValues = servers
      .map((s) => s.currentCpuPercent)
      .filter((cpu) => cpu !== null)
      .map((cpu) => Number(cpu));

    const avgCpu = validCpuValues.length > 0
      ? validCpuValues.reduce((sum, val) => sum + val, 0) / validCpuValues.length
      : 0;

    // Count active alerts (servers with high CPU or memory)
    const activeAlerts = await prisma.server.count({
      where: {
        OR: [
          { currentCpuPercent: { gte: 80 } },
          { currentMemoryPercent: { gte: 85 } },
        ],
      },
    });

    return NextResponse.json({
      totalServers,
      totalContainers,
      avgCpu: Math.round(avgCpu * 10) / 10, // Round to 1 decimal
      activeAlerts,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
