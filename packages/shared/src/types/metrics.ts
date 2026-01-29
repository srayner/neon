/**
 * Static server information - collected once at registration
 */
export interface ServerInfo {
  name: string;
  hostname: string;
  cpuCores: number;
  totalMemoryGb: number;
  totalDiskGb: number;
  osName: string;
  osVersion: string;
  osKernel: string;
  osArch: string;
  dockerVersion: string | null;
}

/**
 * Server metrics snapshot - collected periodically
 */
export interface ServerMetrics {
  timestamp: string; // ISO 8601
  cpuPercent: number;
  memoryPercent: number;
  diskPercent: number;
  memoryUsedGb: number;
  memoryTotalGb: number;
  diskUsedGb: number;
  diskTotalGb: number;
  networkRxBytes: number;
  networkTxBytes: number;
}

/**
 * Container status enum matching Prisma schema
 */
export type ContainerStatus = "running" | "exited" | "paused" | "restarting";

/**
 * Container health status
 */
export type ContainerHealth = "healthy" | "unhealthy" | "starting" | null;

/**
 * Docker container information
 */
export interface ContainerInfo {
  containerId: string;
  name: string;
  image: string;
  imageId: string | null;
  imageTags: string[];
  status: ContainerStatus;
  health: ContainerHealth;
  ports: string;
  labels: Record<string, string>;
  networks: string[];
  startedAt: string | null; // ISO 8601 timestamp
  exitCode: number | null; // Exit code when status is "exited"
}
