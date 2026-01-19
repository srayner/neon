import Docker from 'dockerode';
import type { ContainerInfo, ContainerStatus, ContainerHealth } from '@neon/shared';

const docker = new Docker();

function mapDockerStatus(state: string): ContainerStatus {
  const lowerState = state.toLowerCase();
  if (lowerState === 'running') return 'running';
  if (lowerState === 'exited') return 'exited';
  if (lowerState === 'paused') return 'paused';
  if (lowerState === 'restarting') return 'restarting';
  return 'exited'; // Default fallback
}

function formatPorts(ports: Docker.Port[]): string {
  if (!ports || ports.length === 0) return '-';

  return ports
    .map((port) => {
      if (port.PublicPort && port.PrivatePort) {
        return `${port.PublicPort}:${port.PrivatePort}`;
      }
      return port.PrivatePort ? `${port.PrivatePort}` : '';
    })
    .filter(Boolean)
    .join(', ') || '-';
}

function getHealthStatus(container: Docker.ContainerInfo): ContainerHealth {
  const state = container.State;

  if (state.includes('(healthy)')) return 'healthy';
  if (state.includes('(unhealthy)')) return 'unhealthy';
  if (state.includes('(health: starting)')) return 'starting';

  return null;
}

/**
 * Collect all Docker containers on this host
 */
export async function collectContainers(): Promise<ContainerInfo[]> {
  try {
    const containers = await docker.listContainers({ all: true });

    return containers.map((container) => ({
      containerId: container.Id.substring(0, 12),
      name: container.Names[0]?.replace(/^\//, '') || 'unknown',
      image: container.Image,
      status: mapDockerStatus(container.State),
      health: getHealthStatus(container),
      ports: formatPorts(container.Ports),
      labels: container.Labels || {},
      networks: Object.keys(container.NetworkSettings?.Networks || {}),
    }));
  } catch (error) {
    // Docker might not be available
    if ((error as NodeJS.ErrnoException).code === 'ENOENT' ||
        (error as NodeJS.ErrnoException).code === 'EACCES' ||
        (error as NodeJS.ErrnoException).code === 'ECONNREFUSED') {
      console.warn('[Docker] Docker is not available or accessible');
      return [];
    }
    throw error;
  }
}

/**
 * Check if Docker is available
 */
export async function isDockerAvailable(): Promise<boolean> {
  try {
    await docker.ping();
    return true;
  } catch {
    return false;
  }
}

/**
 * Host OS information from Docker API
 */
export interface HostOsInfo {
  osName: string;
  osKernel: string;
  osArch: string;
}

/**
 * Get host OS information from Docker API
 * This returns the actual host OS, not the container OS
 */
export async function getHostOsInfo(): Promise<HostOsInfo | null> {
  try {
    const info = await docker.info();
    return {
      osName: info.OperatingSystem || 'Unknown',
      osKernel: info.KernelVersion || 'Unknown',
      osArch: info.Architecture || 'Unknown',
    };
  } catch {
    return null;
  }
}
