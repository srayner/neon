import { prisma } from '../lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';

async function seedServers() {
  console.log('[Seed] Seeding fake servers...');

  // Check if we already have fake servers
  const existingServers = await prisma.server.findMany({
    where: {
      name: {
        in: ['production-01', 'production-02', 'staging-01'],
      },
    },
  });

  if (existingServers.length > 0) {
    console.log('[Seed] Fake servers already exist, skipping...');
    return;
  }

  // Create fake servers
  const servers = [
    {
      name: 'production-01',
      hostname: 'prod-01.example.com',
      ipAddress: '10.0.1.10',
      status: 'online' as const,
      cpuCores: 8,
      totalMemoryGb: new Decimal(32),
      totalDiskGb: new Decimal(500),
      currentCpuPercent: new Decimal(45.2),
      currentMemoryPercent: new Decimal(62.3),
      currentDiskPercent: new Decimal(38.7),
      lastMetricsAt: new Date(),
    },
    {
      name: 'production-02',
      hostname: 'prod-02.example.com',
      ipAddress: '10.0.1.11',
      status: 'online' as const,
      cpuCores: 8,
      totalMemoryGb: new Decimal(32),
      totalDiskGb: new Decimal(500),
      currentCpuPercent: new Decimal(78.5),
      currentMemoryPercent: new Decimal(85.1),
      currentDiskPercent: new Decimal(72.4),
      lastMetricsAt: new Date(),
    },
    {
      name: 'staging-01',
      hostname: 'staging-01.example.com',
      ipAddress: '10.0.2.10',
      status: 'online' as const,
      cpuCores: 4,
      totalMemoryGb: new Decimal(16),
      totalDiskGb: new Decimal(250),
      currentCpuPercent: new Decimal(23.1),
      currentMemoryPercent: new Decimal(41.2),
      currentDiskPercent: new Decimal(28.5),
      lastMetricsAt: new Date(),
    },
  ];

  for (const server of servers) {
    const created = await prisma.server.create({
      data: server,
    });

    console.log(`[Seed] Created server: ${created.name}`);

    // Create some historical metrics (last 10 minutes, every minute)
    const now = new Date();
    for (let i = 10; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 60 * 1000);

      // Add some variation to metrics
      const cpuVariation = (Math.random() - 0.5) * 10;
      const memVariation = (Math.random() - 0.5) * 5;
      const diskVariation = (Math.random() - 0.5) * 2;

      const cpuPercent = Math.max(0, Math.min(100, Number(server.currentCpuPercent) + cpuVariation));
      const memPercent = Math.max(0, Math.min(100, Number(server.currentMemoryPercent) + memVariation));
      const diskPercent = Math.max(0, Math.min(100, Number(server.currentDiskPercent) + diskVariation));

      const memUsedGb = (Number(server.totalMemoryGb) * memPercent) / 100;
      const diskUsedGb = (Number(server.totalDiskGb) * diskPercent) / 100;

      await prisma.serverMetric.create({
        data: {
          serverId: created.id,
          timestamp,
          cpuPercent: new Decimal(cpuPercent.toFixed(2)),
          memoryPercent: new Decimal(memPercent.toFixed(2)),
          diskPercent: new Decimal(diskPercent.toFixed(2)),
          memoryUsedGb: new Decimal(memUsedGb.toFixed(2)),
          memoryTotalGb: server.totalMemoryGb,
          diskUsedGb: new Decimal(diskUsedGb.toFixed(2)),
          diskTotalGb: server.totalDiskGb,
        },
      });
    }

    console.log(`[Seed] Created 11 metrics for ${created.name}`);
  }

  // Create fake containers for fake servers
  const prod01 = await prisma.server.findUnique({ where: { name: 'production-01' } });
  const prod02 = await prisma.server.findUnique({ where: { name: 'production-02' } });
  const staging = await prisma.server.findUnique({ where: { name: 'staging-01' } });

  const fakeContainers = [
    // Production 01
    { serverId: prod01!.id, containerId: 'abc123def456', name: 'nginx-proxy', image: 'nginx:1.25-alpine', status: 'running' as const, health: 'healthy', ports: '80:80, 443:443' },
    { serverId: prod01!.id, containerId: 'def456ghi789', name: 'api-prod', image: 'node:20-alpine', status: 'running' as const, health: 'healthy', ports: '3000:3000' },
    { serverId: prod01!.id, containerId: 'ghi789jkl012', name: 'postgres-main', image: 'postgres:16', status: 'running' as const, health: 'healthy', ports: '5432:5432' },
    { serverId: prod01!.id, containerId: 'jkl012mno345', name: 'redis-cache', image: 'redis:7.2-alpine', status: 'running' as const, health: 'healthy', ports: '6379:6379' },
    { serverId: prod01!.id, containerId: 'mno345pqr678', name: 'worker-jobs', image: 'python:3.12-slim', status: 'running' as const, health: null, ports: '-' },
    { serverId: prod01!.id, containerId: 'pqr678stu901', name: 'elasticsearch', image: 'elasticsearch:8.11', status: 'running' as const, health: 'healthy', ports: '9200:9200' },
    { serverId: prod01!.id, containerId: 'stu901vwx234', name: 'kibana', image: 'kibana:8.11', status: 'running' as const, health: 'healthy', ports: '5601:5601' },
    { serverId: prod01!.id, containerId: 'vwx234yza567', name: 'prometheus', image: 'prom/prometheus:latest', status: 'running' as const, health: null, ports: '9090:9090' },

    // Production 02
    { serverId: prod02!.id, containerId: 'aaa111bbb222', name: 'web-app', image: 'nginx:1.25-alpine', status: 'running' as const, health: 'healthy', ports: '8080:80' },
    { serverId: prod02!.id, containerId: 'bbb222ccc333', name: 'api-v2', image: 'node:20-alpine', status: 'running' as const, health: 'starting', ports: '3001:3000' },
    { serverId: prod02!.id, containerId: 'ccc333ddd444', name: 'mongodb', image: 'mongo:7.0', status: 'restarting' as const, health: 'unhealthy', ports: '27017:27017' },
    { serverId: prod02!.id, containerId: 'ddd444eee555', name: 'rabbitmq', image: 'rabbitmq:3.12-management', status: 'running' as const, health: 'healthy', ports: '5672:5672, 15672:15672' },

    // Staging
    { serverId: staging!.id, containerId: 'zzz999yyy888', name: 'staging-api', image: 'node:20-alpine', status: 'running' as const, health: null, ports: '3000:3000' },
    { serverId: staging!.id, containerId: 'yyy888xxx777', name: 'staging-db', image: 'postgres:16', status: 'exited' as const, health: 'none', ports: '5432:5432' },
  ];

  for (const container of fakeContainers) {
    await prisma.container.create({ data: container });
  }

  console.log(`[Seed] Created ${fakeContainers.length} fake containers`);
  console.log('[Seed] Seeding complete!');
}

seedServers()
  .catch((error) => {
    console.error('[Seed] Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
