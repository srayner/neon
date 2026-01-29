import Docker from "dockerode";
import type {
  ContainerInfo,
  ContainerStatus,
  ContainerHealth,
} from "@neon/shared";

const docker = new Docker();

function mapDockerStatus(state: string): ContainerStatus {
  const lowerState = state.toLowerCase();
  if (lowerState === "running") return "running";
  if (lowerState === "exited") return "exited";
  if (lowerState === "paused") return "paused";
  if (lowerState === "restarting") return "restarting";
  return "exited"; // Default fallback
}

function formatPorts(ports: Docker.Port[]): string {
  if (!ports || ports.length === 0) return "-";

  return (
    ports
      .map((port) => {
        if (port.PublicPort && port.PrivatePort) {
          return `${port.PublicPort}:${port.PrivatePort}`;
        }
        return port.PrivatePort ? `${port.PrivatePort}` : "";
      })
      .filter(Boolean)
      .join(", ") || "-"
  );
}

/**
 * Get image tags for a given image ID
 */
async function getImageTags(imageId: string): Promise<string[]> {
  try {
    const image = docker.getImage(imageId);
    const imageInfo = await image.inspect();
    return imageInfo.RepoTags || [];
  } catch {
    return [];
  }
}

interface ContainerStateInfo {
  startedAt: string | null;
  exitCode: number | null;
  health: ContainerHealth;
}

/**
 * Get container state details via inspect (startedAt, exitCode)
 */
async function getContainerStateInfo(containerId: string): Promise<ContainerStateInfo> {
  try {
    const details = await docker.getContainer(containerId).inspect();
    let startedAt = details.State.StartedAt || null;
    // Docker returns "0001-01-01T00:00:00Z" for never-started containers
    if (startedAt?.startsWith("0001-01-01")) {
      startedAt = null;
    }
    const exitCode = details.State.ExitCode ?? null;

    // Extract health from inspect data (only available via inspect, not listContainers)
    const healthStatus = details.State.Health?.Status;
    let health: ContainerHealth = null;
    if (healthStatus === "healthy") health = "healthy";
    else if (healthStatus === "unhealthy") health = "unhealthy";
    else if (healthStatus === "starting") health = "starting";

    return { startedAt, exitCode, health };
  } catch {
    return { startedAt: null, exitCode: null, health: null };
  }
}

/**
 * Collect all Docker containers on this host
 */
export async function collectContainers(): Promise<ContainerInfo[]> {
  try {
    const containers = await docker.listContainers({ all: true });

    // Collect image tags for all unique images
    const imageIds = [...new Set(containers.map((c) => c.ImageID).filter(Boolean))];
    const imageTagsMap = new Map<string, string[]>();

    await Promise.all(
      imageIds.map(async (imageId) => {
        const tags = await getImageTags(imageId);
        imageTagsMap.set(imageId, tags);
      })
    );

    // Get detailed info for each container (for startedAt, exitCode)
    return Promise.all(
      containers.map(async (container) => {
        const stateInfo = await getContainerStateInfo(container.Id);

        return {
          containerId: container.Id.substring(0, 12),
          name: container.Names[0]?.replace(/^\//, "") || "unknown",
          image: container.Image,
          imageId: container.ImageID || null,
          imageTags: imageTagsMap.get(container.ImageID) || [],
          status: mapDockerStatus(container.State),
          health: stateInfo.health,
          ports: formatPorts(container.Ports),
          labels: container.Labels || {},
          networks: Object.keys(container.NetworkSettings?.Networks || {}),
          startedAt: stateInfo.startedAt,
          exitCode: stateInfo.exitCode,
        };
      })
    );
  } catch (error) {
    // Docker might not be available
    if (
      (error as NodeJS.ErrnoException).code === "ENOENT" ||
      (error as NodeJS.ErrnoException).code === "EACCES" ||
      (error as NodeJS.ErrnoException).code === "ECONNREFUSED"
    ) {
      console.warn("[Docker] Docker is not available or accessible");
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
  dockerVersion: string;
}

/**
 * Get host OS information from Docker API
 * This returns the actual host OS, not the container OS
 */
export async function getHostOsInfo(): Promise<HostOsInfo | null> {
  try {
    const info = await docker.info();
    return {
      osName: info.OperatingSystem || "Unknown",
      osKernel: info.KernelVersion || "Unknown",
      osArch: info.Architecture || "Unknown",
      dockerVersion: info.ServerVersion || "Unknown",
    };
  } catch {
    return null;
  }
}
