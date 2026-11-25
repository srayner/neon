import type { ServerInfo, ServerMetrics, ContainerInfo, DockerGap } from './metrics.js';

/**
 * Agent registration request - sent when agent starts
 */
export interface AgentRegistrationRequest {
  serverName: string;
  serverInfo: ServerInfo;
  agentVersion: string;
}

/**
 * Agent registration response - contains auth token
 */
export interface AgentRegistrationResponse {
  serverId: number;
  token: string;
}

/**
 * Metrics report request - sent periodically
 */
export interface MetricsReportRequest {
  metrics: ServerMetrics[];
}

/**
 * Containers report request - sent periodically
 */
export interface ContainersReportRequest {
  containers: ContainerInfo[];
}

/**
 * Agent heartbeat request
 */
export interface AgentHeartbeatRequest {
  timestamp: string;
  agentVersion: string;
  dockerReachable: boolean;
}

/**
 * Agent heartbeat response
 */
export interface AgentHeartbeatResponse {
  serverTime: string;
  tokenExpiresIn: number; // seconds until token expires
}

/**
 * Docker gaps report request - sent until Neon accepts them
 */
export interface DockerGapsReportRequest {
  gaps: DockerGap[];
}

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}
