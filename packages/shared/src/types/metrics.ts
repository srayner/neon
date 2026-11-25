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
  heartbeatIntervalSeconds: number; // How often this agent sends heartbeats
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
  finishedAt: string | null; // ISO 8601, when it last exited
  exitCode: number | null; // Exit code of the last exit
  oomKilled: boolean; // The last exit was the kernel's out-of-memory killer
  restartCount: number; // Docker's count of restarts under the restart policy
  stopRequest: StopRequest; // Only set while the container is not running
}

/**
 * A request to stop a container that Docker reported before the container
 * exited: "stop" (docker stop), "kill" (docker kill, docker rm -f) or null
 * (none seen: it exited by itself, or the agent was not watching).
 */
export type StopRequest = "stop" | "kill" | null;

/**
 * A period when the agent could not see Docker's events, so changes may have
 * been missed.
 */
export interface DockerGap {
  from: string; // ISO 8601
  to: string; // ISO 8601
}
