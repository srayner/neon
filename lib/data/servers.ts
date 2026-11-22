import { connection } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function listServers() {
  await connection();
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

  return servers.map((server) => ({
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
}

export type ServerSummary = Awaited<ReturnType<typeof listServers>>[number];

/** Returns null when no server has this id. */
export async function getServerDetail(serverId: number) {
  await connection();
  const server = await prisma.server.findUnique({
    where: { id: serverId },
    include: {
      containers: {
        orderBy: { name: 'asc' },
      },
      services: {
        include: {
          containers: true,
          dependsOn: {
            include: {
              dependsOn: {
                select: {
                  id: true,
                  name: true,
                  composeService: true,
                  status: true,
                },
              },
            },
          },
          dependedOnBy: {
            include: {
              service: {
                select: {
                  id: true,
                  name: true,
                  composeService: true,
                  status: true,
                },
              },
            },
          },
        },
        orderBy: { name: 'asc' },
      },
    },
  });

  if (!server) {
    return null;
  }

  return {
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
    osName: server.osName,
    osVersion: server.osVersion,
    osKernel: server.osKernel,
    osArch: server.osArch,
    dockerVersion: server.dockerVersion,
    containers: server.containers.map((c) => ({
      id: c.id,
      containerId: c.containerId,
      name: c.name,
      image: c.image,
      status: c.status,
      health: c.health,
      ports: c.ports,
    })),
    services: server.services.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      serviceType: s.serviceType,
      composeProject: s.composeProject,
      composeService: s.composeService,
      version: s.version,
      status: s.status,
      containers: s.containers.map((c) => ({
        id: c.id,
        containerId: c.containerId,
        name: c.name,
        status: c.status,
        health: c.health,
      })),
      dependsOn: s.dependsOn.map((d) => ({
        id: d.dependsOn.id,
        name: d.dependsOn.name,
        composeService: d.dependsOn.composeService,
        status: d.dependsOn.status,
        dependencyType: d.dependencyType,
        inferred: d.inferred,
      })),
      dependedOnBy: s.dependedOnBy.map((d) => ({
        id: d.service.id,
        name: d.service.name,
        composeService: d.service.composeService,
        status: d.service.status,
      })),
    })),
  };
}

export type ServerDetail = NonNullable<Awaited<ReturnType<typeof getServerDetail>>>;
