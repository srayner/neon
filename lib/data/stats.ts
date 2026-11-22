import { connection } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function getStats() {
  await connection();
  const totalServers = await prisma.server.count();
  const totalContainers = await prisma.container.count();

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

  // Servers with high CPU or memory
  const activeAlerts = await prisma.server.count({
    where: {
      OR: [
        { currentCpuPercent: { gte: 80 } },
        { currentMemoryPercent: { gte: 85 } },
      ],
    },
  });

  return {
    totalServers,
    totalContainers,
    avgCpu: Math.round(avgCpu * 10) / 10, // Round to 1 decimal
    activeAlerts,
  };
}
