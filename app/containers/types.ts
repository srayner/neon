export type ContainerStatus = 'running' | 'exited' | 'paused' | 'restarting';
export type ContainerHealth = 'healthy' | 'unhealthy' | 'starting' | 'none' | null | '';

export interface Container {
  id: number;
  containerId: string;
  name: string;
  image: string;
  status: ContainerStatus;
  health: ContainerHealth;
  ports: string;
  exitCode: number | null;
  startedAt: string | null;
  labels: Record<string, string>;
  networks: string[];
}
