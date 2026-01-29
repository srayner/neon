import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAgentToken, extractBearerToken } from "@/lib/auth/jwt";
import { createActivity } from "@/lib/activity";
import type {
  ContainersReportRequest,
  ApiResponse,
  ContainerStatus,
  ContainerInfo,
} from "@neon/shared";
import type { ServiceStatus, ServiceType } from "@prisma/client";

// Map shared ContainerStatus to Prisma ContainerStatus enum
function mapContainerStatus(
  status: ContainerStatus,
): "running" | "exited" | "paused" | "restarting" {
  switch (status) {
    case "running":
      return "running";
    case "exited":
      return "exited";
    case "paused":
      return "paused";
    case "restarting":
      return "restarting";
    default:
      return "exited";
  }
}

// Docker Compose label keys
const COMPOSE_PROJECT_LABEL = "com.docker.compose.project";
const COMPOSE_SERVICE_LABEL = "com.docker.compose.service";
const COMPOSE_DEPENDS_ON_LABEL = "com.docker.compose.depends_on";

// Neon label keys
const NEON_TYPE_LABEL = "neon.type";
const NEON_NAME_LABEL = "neon.name";
const NEON_DESCRIPTION_LABEL = "neon.description";
const NEON_DEPENDS_ON_LABEL = "neon.depends_on";
const NEON_DEPENDS_ON_OPTIONAL_LABEL = "neon.depends_on.optional";

// Valid service types
const VALID_SERVICE_TYPES: ServiceType[] = [
  "application",
  "database",
  "website",
  "agent",
  "infrastructure",
];

function parseServiceType(value: string | undefined): ServiceType | null {
  if (!value) return null;
  const normalized = value.toLowerCase() as ServiceType;
  return VALID_SERVICE_TYPES.includes(normalized) ? normalized : null;
}

// Parse comma-separated dependency list
function parseDependencyList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Group containers into services based on Docker Compose labels
interface ServiceGroup {
  name: string;
  description: string | null;
  serviceType: ServiceType | null;
  composeProject: string | null;
  composeService: string | null;
  containers: ContainerInfo[];
  dependsOn: string[]; // Required dependencies (compose service names)
  dependsOnOptional: string[]; // Optional dependencies
}

function groupContainersIntoServices(
  containers: ContainerInfo[],
): ServiceGroup[] {
  const serviceMap = new Map<string, ServiceGroup>();

  for (const container of containers) {
    const composeProject = container.labels[COMPOSE_PROJECT_LABEL] || null;
    const composeService = container.labels[COMPOSE_SERVICE_LABEL] || null;

    let serviceKey: string;
    let defaultName: string;

    if (composeProject && composeService) {
      // Docker Compose container - group by project+service
      serviceKey = `compose:${composeProject}:${composeService}`;
      defaultName = composeService;
    } else {
      // Standalone container - each container is its own service
      serviceKey = `standalone:${container.containerId}`;
      defaultName = container.name;
    }

    // Extract neon labels
    const neonName = container.labels[NEON_NAME_LABEL] || null;
    const neonDescription = container.labels[NEON_DESCRIPTION_LABEL] || null;
    const neonType = parseServiceType(container.labels[NEON_TYPE_LABEL]);

    // Parse dependencies from neon labels
    const neonDependsOn = parseDependencyList(
      container.labels[NEON_DEPENDS_ON_LABEL],
    );
    const neonDependsOnOptional = parseDependencyList(
      container.labels[NEON_DEPENDS_ON_OPTIONAL_LABEL],
    );

    // Parse implicit dependencies from docker-compose depends_on label
    // Format: "service1:condition,service2:condition"
    const composeDependsOnRaw =
      container.labels[COMPOSE_DEPENDS_ON_LABEL] || "";
    const composeDependsOn = composeDependsOnRaw
      .split(",")
      .map((s) => s.split(":")[0].trim())
      .filter(Boolean);

    if (!serviceMap.has(serviceKey)) {
      serviceMap.set(serviceKey, {
        name: neonName || defaultName,
        description: neonDescription,
        serviceType: neonType,
        composeProject,
        composeService,
        containers: [],
        dependsOn: [...neonDependsOn, ...composeDependsOn],
        dependsOnOptional: neonDependsOnOptional,
      });
    } else {
      // Merge labels from additional containers (first one wins for name/description/type)
      const existing = serviceMap.get(serviceKey)!;
      if (!existing.name && neonName) existing.name = neonName;
      if (!existing.description && neonDescription)
        existing.description = neonDescription;
      if (!existing.serviceType && neonType) existing.serviceType = neonType;
      // Merge dependencies (dedupe)
      existing.dependsOn = [
        ...new Set([
          ...existing.dependsOn,
          ...neonDependsOn,
          ...composeDependsOn,
        ]),
      ];
      existing.dependsOnOptional = [
        ...new Set([...existing.dependsOnOptional, ...neonDependsOnOptional]),
      ];
    }

    serviceMap.get(serviceKey)!.containers.push(container);
  }

  return Array.from(serviceMap.values());
}

// Calculate service status based on container states
function calculateServiceStatus(containers: ContainerInfo[]): ServiceStatus {
  if (containers.length === 0) return "down";

  const runningCount = containers.filter((c) => c.status === "running").length;
  const healthyCount = containers.filter(
    (c) => c.health === "healthy" || c.health === null,
  ).length;

  if (runningCount === 0) {
    return "down";
  }

  if (
    runningCount === containers.length &&
    healthyCount === containers.length
  ) {
    return "healthy";
  }

  return "degraded";
}

/**
 * Extract a clean version number from Docker image tags
 * Examples:
 *   ["mysql:8.0.15", "mysql:8", "mysql:latest"] -> "8.0.15"
 *   ["nginx:1.25.3-alpine", "nginx:latest"] -> "1.25.3"
 *   ["redis:7.2-bookworm", "redis:7", "redis:latest"] -> "7.2"
 */
function extractVersionFromTags(imageTags: string[]): string | null {
  if (!imageTags || imageTags.length === 0) return null;

  // Extract tag portions (after the colon)
  const tags = imageTags
    .map((t) => t.split(":")[1])
    .filter(Boolean)
    .filter((t) => t !== "latest");

  if (tags.length === 0) return null;

  // Score each tag by specificity (more version segments = more specific)
  const scoredTags = tags.map((tag) => {
    // Extract version number pattern, ignoring any suffix
    const versionMatch = tag.match(/^v?(\d+(?:\.\d+)*)/);
    if (!versionMatch) return { score: 0, version: null };

    const version = versionMatch[1];
    const segments = version.split(".").length;

    return { score: segments, version };
  });

  // Sort by score descending (most specific first)
  scoredTags.sort((a, b) => b.score - a.score);

  // Return the most specific version
  const best = scoredTags.find((t) => t.version);
  return best?.version || null;
}

export async function POST(request: NextRequest) {
  try {
    // Verify JWT token
    const token = extractBearerToken(request.headers.get("authorization"));
    if (!token) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Missing authorization token" },
        { status: 401 },
      );
    }

    const payload = await verifyAgentToken(token);
    if (!payload) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Invalid or expired token" },
        { status: 401 },
      );
    }

    const { serverId, serverName } = payload;

    // Parse request body
    const body: ContainersReportRequest = await request.json();
    const { containers } = body;

    if (!containers || !Array.isArray(containers)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Missing containers array" },
        { status: 400 },
      );
    }

    console.log(
      `[Agent Containers] Receiving ${containers.length} container(s) from ${serverName}`,
    );

    // Fetch existing containers for restart/stop detection
    const existingContainers = await prisma.container.findMany({
      where: { serverId },
      select: {
        id: true,
        containerId: true,
        name: true,
        status: true,
        startedAt: true,
        exitCode: true,
      },
    });
    const existingContainerMap = new Map(
      existingContainers.map((c) => [c.containerId, c]),
    );

    // Group containers into services
    const serviceGroups = groupContainersIntoServices(containers);

    // Track service IDs for cleanup and dependency resolution
    const activeServiceIds: number[] = [];
    const serviceByComposeService = new Map<string, number>(); // composeService -> serviceId
    let restartCount = 0;

    // Upsert services and containers
    for (const serviceGroup of serviceGroups) {
      // Find or create the service
      // Note: Using findFirst + create/update because Prisma's upsert has issues with nullable fields in composite unique constraints
      let service = await prisma.service.findFirst({
        where: {
          serverId,
          composeProject: serviceGroup.composeProject,
          composeService: serviceGroup.composeService,
        },
      });

      // Extract version from the first container's image tags
      const primaryContainer = serviceGroup.containers[0];
      const version = primaryContainer
        ? extractVersionFromTags(primaryContainer.imageTags)
        : null;

      const serviceData = {
        name: serviceGroup.name,
        description: serviceGroup.description,
        serviceType: serviceGroup.serviceType,
        version,
        status: calculateServiceStatus(serviceGroup.containers),
      };

      if (service) {
        service = await prisma.service.update({
          where: { id: service.id },
          data: serviceData,
        });
      } else {
        service = await prisma.service.create({
          data: {
            serverId,
            composeProject: serviceGroup.composeProject,
            composeService: serviceGroup.composeService,
            ...serviceData,
          },
        });
      }

      activeServiceIds.push(service.id);

      // Track for dependency resolution
      if (serviceGroup.composeService) {
        serviceByComposeService.set(serviceGroup.composeService, service.id);
      }

      // Upsert containers for this service
      for (const container of serviceGroup.containers) {
        const existing = existingContainerMap.get(container.containerId);

        // Container state change detection
        if (existing) {
          const wasRunning = existing.status === "running";
          const wasExited = existing.status === "exited";
          const isNowRunning = container.status === "running";
          const isNowExited = container.status === "exited";

          // Detect stop/crash: running → exited
          if (wasRunning && isNowExited) {
            const exitCode = container.exitCode;
            if (exitCode === 0) {
              // Graceful stop (exit code 0)
              await createActivity({
                type: "info",
                entityType: "container",
                eventType: "stopped",
                message: `Container ${container.name} stopped`,
                serverId,
                containerId: existing.id,
                metadata: { exitCode },
              });
            } else {
              // Crash (non-zero exit code)
              await createActivity({
                type: "warning",
                entityType: "container",
                eventType: "crashed",
                message: `Container ${container.name} crashed with exit code ${exitCode}`,
                serverId,
                containerId: existing.id,
                metadata: { exitCode },
              });
            }
            restartCount++;
          }

          // Detect restarts: start time changed while running or starting from exited
          if (existing.startedAt && container.startedAt) {
            const existingStartedAt = new Date(existing.startedAt);
            const containerStartedAt = new Date(container.startedAt);
            const hasNewStartTime =
              existingStartedAt.getTime() !== containerStartedAt.getTime();

            if (hasNewStartTime) {
              if (wasRunning && isNowRunning) {
                // Auto-restart: container was running and restarted (crash/policy)
                await createActivity({
                  type: "warning",
                  entityType: "container",
                  eventType: "restart",
                  message: `Container ${container.name} restarted`,
                  serverId,
                  containerId: existing.id,
                  metadata: {
                    previousStartedAt: existingStartedAt.toISOString(),
                    newStartedAt: containerStartedAt.toISOString(),
                  },
                });
                restartCount++;
              } else if (wasExited && isNowRunning) {
                // Manual restart: container was stopped, now started again
                await createActivity({
                  type: "info",
                  entityType: "container",
                  eventType: "manual_restart",
                  message: `Container ${container.name} was started`,
                  serverId,
                  containerId: existing.id,
                  metadata: {
                    previousStartedAt: existingStartedAt.toISOString(),
                    newStartedAt: containerStartedAt.toISOString(),
                  },
                });
                restartCount++;
              }
            }
          }
        }

        await prisma.container.upsert({
          where: {
            serverId_containerId: {
              serverId,
              containerId: container.containerId,
            },
          },
          update: {
            name: container.name,
            image: container.image,
            imageId: container.imageId,
            imageTags: container.imageTags,
            status: mapContainerStatus(container.status),
            health: container.health,
            exitCode: container.exitCode,
            ports: container.ports,
            labels: container.labels,
            networks: container.networks,
            serviceId: service.id,
            startedAt: container.startedAt
              ? new Date(container.startedAt)
              : null,
          },
          create: {
            serverId,
            containerId: container.containerId,
            name: container.name,
            image: container.image,
            imageId: container.imageId,
            imageTags: container.imageTags,
            status: mapContainerStatus(container.status),
            health: container.health,
            exitCode: container.exitCode,
            ports: container.ports,
            labels: container.labels,
            networks: container.networks,
            serviceId: service.id,
            startedAt: container.startedAt
              ? new Date(container.startedAt)
              : null,
          },
        });
      }
    }

    // Process dependencies after all services are created
    // First, clear existing dependencies for this server's services
    await prisma.serviceDependency.deleteMany({
      where: {
        service: { serverId },
      },
    });

    // Create dependency records
    let dependencyCount = 0;
    for (const serviceGroup of serviceGroups) {
      if (!serviceGroup.composeService) continue;

      const serviceId = serviceByComposeService.get(
        serviceGroup.composeService,
      );
      if (!serviceId) continue;

      // Process required dependencies
      for (const depName of serviceGroup.dependsOn) {
        const depServiceId = serviceByComposeService.get(depName);
        if (depServiceId && depServiceId !== serviceId) {
          await prisma.serviceDependency.create({
            data: {
              serviceId,
              dependsOnId: depServiceId,
              dependencyType: "requires",
              inferred: !serviceGroup.containers.some((c) =>
                c.labels[NEON_DEPENDS_ON_LABEL]?.includes(depName),
              ),
            },
          });
          dependencyCount++;
        }
      }

      // Process optional dependencies
      for (const depName of serviceGroup.dependsOnOptional) {
        const depServiceId = serviceByComposeService.get(depName);
        if (depServiceId && depServiceId !== serviceId) {
          await prisma.serviceDependency.create({
            data: {
              serviceId,
              dependsOnId: depServiceId,
              dependencyType: "optional",
              inferred: false,
            },
          });
          dependencyCount++;
        }
      }
    }

    // Delete containers that are no longer present
    const currentContainerIds = containers.map((c) => c.containerId);
    const deleteContainersResult = await prisma.container.deleteMany({
      where: {
        serverId,
        containerId: {
          notIn:
            currentContainerIds.length > 0 ? currentContainerIds : ["__none__"],
        },
      },
    });

    // Delete services that are no longer present
    const deleteServicesResult = await prisma.service.deleteMany({
      where: {
        serverId,
        id: {
          notIn: activeServiceIds.length > 0 ? activeServiceIds : [-1],
        },
      },
    });

    console.log(
      `[Agent Containers] Synced ${containers.length} container(s) in ${serviceGroups.length} service(s) ` +
        `with ${dependencyCount} dependencies, ${restartCount} restart(s) detected, deleted ${deleteContainersResult.count} container(s) ` +
        `and ${deleteServicesResult.count} service(s) for ${serverName}`,
    );

    return NextResponse.json<ApiResponse>({
      success: true,
    });
  } catch (error) {
    console.error("[Agent Containers] Error:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Failed to sync containers" },
      { status: 500 },
    );
  }
}
