import Docker from 'dockerode';
import { prisma } from './prisma';
import { ContainerStatus } from '@prisma/client';
import { getCurrentServerId } from './server-metrics';

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

function getHealthStatus(container: Docker.ContainerInfo): string | null {
  // Docker health status can be in State.Health.Status
  const state = container.State;

  if (state.includes('(healthy)')) return 'healthy';
  if (state.includes('(unhealthy)')) return 'unhealthy';
  if (state.includes('(health: starting)')) return 'starting';

  // No health check configured
  return null;
}

export async function syncDockerContainers() {
  try {
    console.log('[Docker Sync] Starting sync...');

    // Get current server ID
    const serverId = await getCurrentServerId();

    // List all containers (including stopped ones)
    const containers = await docker.listContainers({ all: true });

    console.log(`[Docker Sync] Found ${containers.length} containers`);

    // Prepare container data
    const containerData = containers.map((container) => {
      const containerId = container.Id.substring(0, 12); // Use short ID
      const name = container.Names[0]?.replace(/^\//, '') || 'unknown';
      const image = container.Image;
      const status = mapDockerStatus(container.State);
      const health = getHealthStatus(container);
      const ports = formatPorts(container.Ports);

      return {
        containerId,
        serverId,
        name,
        image,
        status,
        health,
        ports,
      };
    });

    // Upsert containers into database
    for (const container of containerData) {
      await prisma.container.upsert({
        where: {
          serverId_containerId: {
            serverId: container.serverId,
            containerId: container.containerId,
          },
        },
        update: {
          name: container.name,
          image: container.image,
          status: container.status,
          health: container.health,
          ports: container.ports,
        },
        create: container,
      });
    }

    // Get current container IDs for this server
    const currentContainerIds = containerData.map((c) => c.containerId);

    // Delete containers that no longer exist on this server
    const deleteResult = await prisma.container.deleteMany({
      where: {
        serverId,
        containerId: {
          notIn: currentContainerIds,
        },
      },
    });

    console.log(`[Docker Sync] Synced ${containerData.length} containers, deleted ${deleteResult.count} old containers`);
    console.log('[Docker Sync] Sync completed successfully');

    return { synced: containerData.length, deleted: deleteResult.count };
  } catch (error) {
    console.error('[Docker Sync] Error syncing containers:', error);
    throw error;
  }
}
