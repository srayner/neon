import si from 'systeminformation';
import type { ServerInfo, ServerMetrics } from '@neon/shared';

/**
 * Collect static server information (called once at startup)
 */
export async function getServerInfo(serverName: string): Promise<ServerInfo> {
  const [cpu, mem, disk, os] = await Promise.all([
    si.cpu(),
    si.mem(),
    si.fsSize(),
    si.osInfo(),
  ]);

  const totalDiskGb = disk.reduce((sum, d) => sum + d.size, 0) / (1024 ** 3);

  return {
    name: serverName,
    hostname: os.hostname,
    cpuCores: cpu.cores,
    totalMemoryGb: parseFloat((mem.total / (1024 ** 3)).toFixed(2)),
    totalDiskGb: parseFloat(totalDiskGb.toFixed(2)),
  };
}

/**
 * Collect current server metrics
 */
export async function collectMetrics(): Promise<ServerMetrics> {
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
  const diskPercent = totalDiskSize > 0 ? (totalDiskUsed / totalDiskSize) * 100 : 0;

  // Convert to GB
  const memoryUsedGb = mem.used / (1024 ** 3);
  const memoryTotalGb = mem.total / (1024 ** 3);
  const diskUsedGb = totalDiskUsed / (1024 ** 3);
  const diskTotalGb = totalDiskSize / (1024 ** 3);

  // Network stats (first interface with activity, or first available)
  const activeNetwork = networkStats.find(n => n.rx_bytes > 0 || n.tx_bytes > 0) || networkStats[0];
  const networkRxBytes = activeNetwork?.rx_bytes || 0;
  const networkTxBytes = activeNetwork?.tx_bytes || 0;

  return {
    timestamp: new Date().toISOString(),
    cpuPercent: parseFloat(cpuPercent.toFixed(2)),
    memoryPercent: parseFloat(memoryPercent.toFixed(2)),
    diskPercent: parseFloat(diskPercent.toFixed(2)),
    memoryUsedGb: parseFloat(memoryUsedGb.toFixed(2)),
    memoryTotalGb: parseFloat(memoryTotalGb.toFixed(2)),
    diskUsedGb: parseFloat(diskUsedGb.toFixed(2)),
    diskTotalGb: parseFloat(diskTotalGb.toFixed(2)),
    networkRxBytes,
    networkTxBytes,
  };
}
