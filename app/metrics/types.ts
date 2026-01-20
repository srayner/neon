export type TimeRange = '1h' | '6h' | '24h' | '7d' | '30d';

export interface MetricDataPoint {
  timestamp: string;
  cpuPercent: number;
  memoryPercent: number;
  diskPercent: number;
}

export interface MetricsHistoryResponse {
  serverId: number;
  serverName: string;
  timeRange: TimeRange;
  interval: string;
  dataPoints: MetricDataPoint[];
}
