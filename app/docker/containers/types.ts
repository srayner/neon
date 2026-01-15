export type ContainerStatus = 'running' | 'exited' | 'paused' | 'restarting';
export type ContainerHealth = 'healthy' | 'unhealthy' | 'starting' | 'none' | null | '';

export interface Container {
  id: string;
  name: string;
  image: string;
  status: ContainerStatus;
  health: ContainerHealth;
  ports: string;
}
