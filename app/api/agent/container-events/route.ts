import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAgentToken, extractBearerToken } from "@/lib/auth/jwt";
import { createActivity } from "@/lib/activity";
import type {
  ContainerEventsReportRequest,
  ApiResponse,
  ContainerEventAction,
  ContainerEventSeverity,
  ProcessedContainerEvent,
} from "@neon/shared";
import type { ActivityType, EventType, Prisma } from "@prisma/client";

/**
 * Map container event severity to ActivityType
 */
function mapSeverityToActivityType(severity: ContainerEventSeverity): ActivityType {
  switch (severity) {
    case "critical":
      return "critical";
    case "error":
      return "warning"; // Map error to warning since we don't have error ActivityType
    case "warning":
      return "warning";
    case "info":
      return "info";
    default:
      return "info";
  }
}

/**
 * Map container event action to EventType
 */
function mapActionToEventType(
  action: ContainerEventAction,
  isCrashLoop: boolean,
  exitCode: number | null
): EventType {
  if (isCrashLoop) {
    return "crash_loop";
  }

  switch (action) {
    case "create":
      return "created";
    case "start":
      return "manual_restart"; // Container started
    case "stop":
      return "stopped";
    case "die":
      // Check if it was a crash (non-zero exit) or graceful stop
      return exitCode !== 0 && exitCode !== null ? "crashed" : "stopped";
    case "kill":
      return "killed";
    case "restart":
      return "restart";
    case "pause":
      return "paused";
    case "unpause":
      return "unpaused";
    case "destroy":
      return "removed";
    case "health_status":
      return "health_change";
    default:
      return "status_change";
  }
}

/**
 * Generate descriptive message for container event
 */
function generateEventMessage(event: ProcessedContainerEvent): string {
  const name = event.containerName;

  if (event.isCrashLoop) {
    return `Container ${name} is in a crash loop (${event.restartCount} restarts in 5 minutes)`;
  }

  switch (event.action) {
    case "create":
      return `Container ${name} created`;
    case "start":
      return `Container ${name} started`;
    case "stop":
      if (event.exitCode === 0 || event.exitCode === null) {
        return `Container ${name} stopped`;
      }
      return `Container ${name} stopped with exit code ${event.exitCode}`;
    case "die":
      if (event.exitCode !== 0 && event.exitCode !== null) {
        const signalInfo = event.signal ? ` (signal: ${event.signal})` : "";
        return `Container ${name} crashed with exit code ${event.exitCode}${signalInfo}`;
      }
      return `Container ${name} exited`;
    case "kill":
      const signal = event.signal || "SIGKILL";
      return `Container ${name} killed with ${signal}`;
    case "restart":
      if (event.restartCount > 1) {
        return `Container ${name} restarted (${event.restartCount} times in 5 minutes)`;
      }
      return `Container ${name} restarted automatically`;
    case "pause":
      return `Container ${name} paused`;
    case "unpause":
      return `Container ${name} unpaused`;
    case "destroy":
      return `Container ${name} removed`;
    case "health_status":
      if (event.healthStatus === "healthy") {
        return `Container ${name} is now healthy`;
      } else if (event.healthStatus === "unhealthy") {
        return `Container ${name} is now unhealthy`;
      }
      return `Container ${name} health status: ${event.healthStatus}`;
    default:
      return `Container ${name}: ${event.action}`;
  }
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
    const body: ContainerEventsReportRequest = await request.json();
    const { events } = body;

    if (!events || !Array.isArray(events)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Missing events array" },
        { status: 400 },
      );
    }

    if (events.length === 0) {
      return NextResponse.json<ApiResponse>({ success: true });
    }

    console.log(
      `[Agent Container Events] Receiving ${events.length} event(s) from ${serverName}`,
    );

    // Get all containers for this server to resolve container IDs
    const containers = await prisma.container.findMany({
      where: { serverId },
      select: { id: true, containerId: true },
    });
    const containerMap = new Map(containers.map((c) => [c.containerId, c.id]));

    // Process each event
    let processedCount = 0;
    let skippedCount = 0;

    for (const event of events) {
      // Find container in database
      const dbContainerId = containerMap.get(event.containerId);

      // Create activity
      const activityType = mapSeverityToActivityType(event.severity);
      const eventType = mapActionToEventType(event.action, event.isCrashLoop, event.exitCode);
      const message = generateEventMessage(event);

      // Build metadata (essential only)
      const metadata: Record<string, string | number | boolean> = {};
      if (event.exitCode !== null) {
        metadata.exitCode = event.exitCode;
      }
      if (event.signal) {
        metadata.signal = event.signal;
      }
      if (event.restartCount > 0) {
        metadata.restartCount = event.restartCount;
      }
      if (event.isCrashLoop) {
        metadata.isCrashLoop = true;
      }

      try {
        await createActivity({
          type: activityType,
          entityType: "container",
          eventType,
          message,
          serverId,
          containerId: dbContainerId,
          metadata: metadata as Prisma.InputJsonValue,
        });
        processedCount++;
      } catch (error) {
        console.error(
          `[Agent Container Events] Failed to create activity for ${event.containerName}:`,
          (error as Error).message,
        );
        skippedCount++;
      }
    }

    console.log(
      `[Agent Container Events] Processed ${processedCount} event(s), skipped ${skippedCount} for ${serverName}`,
    );

    return NextResponse.json<ApiResponse>({
      success: true,
    });
  } catch (error) {
    console.error("[Agent Container Events] Error:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Failed to process container events" },
      { status: 500 },
    );
  }
}
