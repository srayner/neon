import Docker from "dockerode";
import type {
  ContainerInfo,
  ContainerStatus,
  ContainerHealth,
} from "@neon/shared";
import type { StopRequests } from "./stop-requests.js";

/**
 * Every one-off request to Docker gives up after this long. A hung Docker
 * daemon must not hold up the heartbeat or a container sync for ever: each
 * waits for the previous run to finish before the next starts. The event
 * stream has no timeout; it is long-lived, and quiet is normal.
 */
export const DOCKER_REQUEST_TIMEOUT_MS = 5000;

const giveUp = () => AbortSignal.timeout(DOCKER_REQUEST_TIMEOUT_MS);

// dockerode 5 accepts { abortSignal } on ping and info (lib/docker.js), but
// @types/dockerode 4 only declares the no-argument forms.
type WithAbort = (options: { abortSignal: AbortSignal }) => Promise<unknown>;
const ping = (docker: Docker) => (docker.ping as unknown as WithAbort).call(docker, { abortSignal: giveUp() });
const info = (docker: Docker) =>
  (docker.info as unknown as WithAbort).call(docker, { abortSignal: giveUp() }) as Promise<Record<string, string | undefined>>;

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

/** Every image's tags by image ID, in one request. */
async function getImageTags(docker: Docker): Promise<Map<string, string[]>> {
  const images = await docker.listImages({ abortSignal: giveUp() });
  return new Map(images.map((image) => [image.Id, image.RepoTags ?? []]));
}

interface ContainerStateInfo {
  startedAt: string | null;
  finishedAt: string | null;
  exitCode: number | null;
  oomKilled: boolean;
  restartCount: number;
  health: ContainerHealth;
}

/** Docker's "0001-01-01T00:00:00Z" means never (not started, or not exited). */
function dockerTime(value: string | undefined): string | null {
  return value && !value.startsWith("0001-01-01") ? value : null;
}

/**
 * Get container state details via inspect (only inspect has these).
 *
 * @returns null when the container was removed between listing and
 * inspecting. Any other failure throws, failing the whole sync: reporting
 * defaults instead would tell Neon a restart count of 0 and no
 * out-of-memory kill as if they were facts. The next sync tries again.
 */
async function getContainerStateInfo(docker: Docker, containerId: string): Promise<ContainerStateInfo | null> {
  let details: Docker.ContainerInspectInfo;
  try {
    details = await docker.getContainer(containerId).inspect({ abortSignal: giveUp() });
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode === 404) return null;
    throw error;
  }

  // Health is only available via inspect, not listContainers
  const healthStatus = details.State.Health?.Status;
  let health: ContainerHealth = null;
  if (healthStatus === "healthy") health = "healthy";
  else if (healthStatus === "unhealthy") health = "unhealthy";
  else if (healthStatus === "starting") health = "starting";

  return {
    startedAt: dockerTime(details.State.StartedAt),
    finishedAt: dockerTime(details.State.FinishedAt),
    exitCode: details.State.ExitCode ?? null,
    oomKilled: details.State.OOMKilled ?? false,
    restartCount: details.RestartCount ?? 0,
    health,
  };
}

/**
 * Collect all Docker containers on this host. Throws when Docker can't be
 * reached or a request fails: an empty or partly made-up list would tell Neon
 * things that aren't true.
 */
export async function collectContainers(docker: Docker, stopRequests: StopRequests): Promise<ContainerInfo[]> {
  const [containers, imageTags] = await Promise.all([
    docker.listContainers({ all: true, abortSignal: giveUp() }),
    getImageTags(docker),
  ]);

  const collected = await Promise.all(
    containers.map(async (container): Promise<ContainerInfo | null> => {
      const stateInfo = await getContainerStateInfo(docker, container.Id);
      if (!stateInfo) return null;
      const status = mapDockerStatus(container.State);

      return {
        containerId: container.Id.substring(0, 12),
        name: container.Names[0]?.replace(/^\//, "") || "unknown",
        image: container.Image,
        imageId: container.ImageID || null,
        imageTags: imageTags.get(container.ImageID) ?? [],
        status,
        health: stateInfo.health,
        ports: formatPorts(container.Ports),
        labels: container.Labels || {},
        networks: Object.keys(container.NetworkSettings?.Networks || {}),
        startedAt: stateInfo.startedAt,
        finishedAt: stateInfo.finishedAt,
        exitCode: stateInfo.exitCode,
        oomKilled: stateInfo.oomKilled,
        restartCount: stateInfo.restartCount,
        // A request seen while it still runs (docker stop's first kill) is
        // not yet an exit.
        stopRequest: status === "running" || status === "paused" ? null : stopRequests.get(container.Id),
      };
    })
  );
  // A container removed mid-sync is left out, as it is gone.
  return collected.filter((c) => c !== null);
}

/**
 * Check if Docker is available
 */
export async function isDockerAvailable(docker: Docker): Promise<boolean> {
  try {
    await ping(docker);
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
export async function getHostOsInfo(docker: Docker): Promise<HostOsInfo | null> {
  try {
    const hostInfo = await info(docker);
    return {
      osName: hostInfo.OperatingSystem || "Unknown",
      osKernel: hostInfo.KernelVersion || "Unknown",
      osArch: hostInfo.Architecture || "Unknown",
      dockerVersion: hostInfo.ServerVersion || "Unknown",
    };
  } catch {
    return null;
  }
}
