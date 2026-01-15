import si from 'systeminformation';
import { prisma } from './prisma';
import { Decimal } from '@prisma/client/runtime/library';

const serverName = process.env.SERVER_NAME || 'unknown';

/**
 * Ensure server exists in database, create if not
 */
async function ensureServerExists() {
  let server = await prisma.server.findUnique({
    where: { name: serverName },
  });

  if (!server) {
    console.log(`[Server Metrics] Creating server record for: ${serverName}`);

    // Get static system info
    const [cpu, mem, disk, os] = await Promise.all([
      si.cpu(),
      si.mem(),
      si.fsSize(),
      si.osInfo(),
    ]);

    const totalDiskGb = disk.reduce((sum, d) => sum + d.size, 0) / (1024 ** 3);

    server = await prisma.server.create({
      data: {
        name: serverName,
        hostname: os.hostname,
        cpuCores: cpu.cores,
        totalMemoryGb: new Decimal(mem.total / (1024 ** 3)),
        totalDiskGb: new Decimal(totalDiskGb),
        status: 'online',
      },
    });

    console.log(`[Server Metrics] Server created: ${server.name}`);
  }

  return server;
}

/**
 * Collect and store server metrics
 */
export async function collectServerMetrics() {
  try {
    console.log('[Server Metrics] Collecting metrics...');

    // Ensure server exists
    const server = await ensureServerExists();

    // Get current metrics
    const [cpuLoad, mem, disk, networkStats] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
      si.networkStats(),
    ]);

    // Calculate percentages
    const cpuPercent = cpuLoad.currentLoad;
    const memoryPercent = (mem.used / mem.total) * 100;

    const totalDiskSize = disk.reduce((sum, d) => sum + d.size, 0);
    const totalDiskUsed = disk.reduce((sum, d) => sum + d.used, 0);
    const diskPercent = (totalDiskUsed / totalDiskSize) * 100;

    // Convert to GB
    const memoryUsedGb = mem.used / (1024 ** 3);
    const memoryTotalGb = mem.total / (1024 ** 3);
    const diskUsedGb = totalDiskUsed / (1024 ** 3);
    const diskTotalGb = totalDiskSize / (1024 ** 3);

    // Network stats (first interface)
    const network = networkStats[0] || {};
    const networkRxBytes = network.rx_bytes || 0;
    const networkTxBytes = network.tx_bytes || 0;

    // Store metric record
    await prisma.serverMetric.create({
      data: {
        serverId: server.id,
        cpuPercent: new Decimal(cpuPercent.toFixed(2)),
        memoryPercent: new Decimal(memoryPercent.toFixed(2)),
        diskPercent: new Decimal(diskPercent.toFixed(2)),
        memoryUsedGb: new Decimal(memoryUsedGb.toFixed(2)),
        memoryTotalGb: new Decimal(memoryTotalGb.toFixed(2)),
        diskUsedGb: new Decimal(diskUsedGb.toFixed(2)),
        diskTotalGb: new Decimal(diskTotalGb.toFixed(2)),
        networkRxBytes: BigInt(networkRxBytes),
        networkTxBytes: BigInt(networkTxBytes),
      },
    });

    // Update server's current metrics
    await prisma.server.update({
      where: { id: server.id },
      data: {
        currentCpuPercent: new Decimal(cpuPercent.toFixed(2)),
        currentMemoryPercent: new Decimal(memoryPercent.toFixed(2)),
        currentDiskPercent: new Decimal(diskPercent.toFixed(2)),
        lastMetricsAt: new Date(),
      },
    });

    console.log(
      `[Server Metrics] Collected: CPU ${cpuPercent.toFixed(1)}%, Memory ${memoryPercent.toFixed(1)}%, Disk ${diskPercent.toFixed(1)}%`
    );

    return {
      cpuPercent,
      memoryPercent,
      diskPercent,
    };
  } catch (error) {
    console.error('[Server Metrics] Error collecting metrics:', error);
    throw error;
  }
}

/**
 * Get current server ID (used by docker-sync)
 */
export async function getCurrentServerId(): Promise<number> {
  const server = await ensureServerExists();
  return server.id;
}
