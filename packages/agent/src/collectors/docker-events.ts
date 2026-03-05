import Docker from "dockerode";
import type {
  ContainerEvent,
  ContainerEventAction,
  ContainerEventSeverity,
  ContainerHealth,
  ProcessedContainerEvent,
} from "@neon/shared";

const docker = new Docker();

// Track container restart times for crash loop detection
interface RestartTracker {
  timestamps: number[];
}

// Container state tracking
interface ContainerState {
  status: string;
  health: ContainerHealth | null;
}

// Track recent stop/kill events to suppress redundant die events
interface RecentStopEvent {
  timestamp: number;
  action: "stop" | "kill";
}

// Crash loop detection settings
const CRASH_LOOP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const CRASH_LOOP_THRESHOLD = 3; // 3+ restarts = crash loop

export type EventCallback = (event: ProcessedContainerEvent) => void;

/**
 * Docker Event Monitor - subscribes to Docker events stream and processes container events
 */
// Time window to consider a die event as part of a stop/kill sequence
const STOP_DIE_WINDOW_MS = 5000; // 5 seconds

export class DockerEventMonitor {
  private eventStream: NodeJS.ReadableStream | null = null;
  private abortController: AbortController | null = null;
  private restartTrackers: Map<string, RestartTracker> = new Map();
  private containerStates: Map<string, ContainerState> = new Map();
  private recentStops: Map<string, RecentStopEvent> = new Map();
  private eventCallback: EventCallback;
  private running: boolean = false;

  constructor(eventCallback: EventCallback) {
    this.eventCallback = eventCallback;
  }

  /**
   * Start monitoring Docker events
   */
  async start(): Promise<void> {
    if (this.running) {
      console.warn("[DockerEvents] Already running");
      return;
    }

    try {
      // Initialize container states from current containers
      await this.initializeContainerStates();

      // Create abort controller for cleanup
      this.abortController = new AbortController();

      // Subscribe to Docker events stream
      this.eventStream = await docker.getEvents({
        filters: {
          type: ["container"],
          event: [
            "create",
            "start",
            "stop",
            "die",
            "kill",
            "restart",
            "pause",
            "unpause",
            "destroy",
            "health_status",
          ],
        },
        abortSignal: this.abortController.signal,
      });

      this.running = true;

      this.eventStream.on("data", (chunk: Buffer) => {
        try {
          const event = JSON.parse(chunk.toString());
          this.handleDockerEvent(event);
        } catch (error) {
          console.error("[DockerEvents] Failed to parse event:", error);
        }
      });

      this.eventStream.on("error", (error: Error) => {
        // Ignore abort errors (expected on stop)
        if (error.name === "AbortError") {
          return;
        }
        console.error("[DockerEvents] Stream error:", error.message);
        this.running = false;
      });

      this.eventStream.on("end", () => {
        console.log("[DockerEvents] Stream ended");
        this.running = false;
      });

      console.log("[DockerEvents] Docker event monitoring started");
    } catch (error) {
      console.error("[DockerEvents] Failed to start:", (error as Error).message);
      throw error;
    }
  }

  /**
   * Stop monitoring Docker events
   */
  stop(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.eventStream = null;
    this.running = false;
    console.log("[DockerEvents] Docker event monitoring stopped");
  }

  /**
   * Check if monitor is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Initialize container states from current running containers
   */
  private async initializeContainerStates(): Promise<void> {
    try {
      const containers = await docker.listContainers({ all: true });
      for (const container of containers) {
        const id = container.Id.substring(0, 12);
        this.containerStates.set(id, {
          status: container.State.toLowerCase(),
          health: null, // Will be updated on health events
        });
      }
      console.log(`[DockerEvents] Initialized state for ${containers.length} containers`);
    } catch (error) {
      console.warn("[DockerEvents] Failed to initialize container states:", (error as Error).message);
    }
  }

  /**
   * Handle a Docker event
   */
  private handleDockerEvent(event: DockerEventData): void {
    const action = event.Action as ContainerEventAction;

    // Filter to only container events we care about
    if (!this.isRelevantAction(action)) {
      return;
    }

    const containerId = event.Actor?.ID?.substring(0, 12) || "";
    const containerName = event.Actor?.Attributes?.name || "unknown";
    const image = event.Actor?.Attributes?.image || "unknown";
    const now = Date.now();

    // Track stop/kill events for deduplication
    if (action === "stop") {
      // Stop is the canonical event for docker stop - track it and clear any pending kills
      this.recentStops.set(containerId, { timestamp: now, action: "stop" });
    } else if (action === "kill") {
      // Track kill but don't emit - we'll handle it on the die event if no stop follows
      const existing = this.recentStops.get(containerId);
      if (!existing || existing.action !== "stop") {
        this.recentStops.set(containerId, { timestamp: now, action: "kill" });
      }
      // Don't emit kill events directly - they're intermediate signals
      return;
    }

    // Handle die events
    if (action === "die") {
      const recentEvent = this.recentStops.get(containerId);
      if (recentEvent && now - recentEvent.timestamp < STOP_DIE_WINDOW_MS) {
        if (recentEvent.action === "stop") {
          // Die after stop - skip (stop event already emitted)
          this.recentStops.delete(containerId);
          return;
        } else if (recentEvent.action === "kill") {
          // Die after kill (docker kill command) - emit as "killed" instead of die
          this.recentStops.delete(containerId);
          // Continue processing but we'll use the kill info
        }
      }
    }

    // Extract exit code and signal from event attributes
    const exitCode = event.Actor?.Attributes?.exitCode
      ? parseInt(event.Actor.Attributes.exitCode, 10)
      : null;
    const signal = event.Actor?.Attributes?.signal || null;

    // Extract health status for health_status events
    let healthStatus: ContainerHealth | null = null;
    if (action === "health_status") {
      const healthAttr = event.Actor?.Attributes?.health_status;
      if (healthAttr === "healthy") healthStatus = "healthy";
      else if (healthAttr === "unhealthy") healthStatus = "unhealthy";
      else if (healthAttr === "starting") healthStatus = "starting";
    }

    // Create base container event
    const containerEvent: ContainerEvent = {
      containerId,
      containerName,
      image,
      action,
      timestamp: new Date(event.time * 1000).toISOString(),
      exitCode,
      signal,
      healthStatus,
    };

    // Track restarts and detect crash loops
    const { restartCount, isCrashLoop } = this.trackRestart(containerId, action, exitCode);

    // Calculate severity
    const severity = this.calculateSeverity(action, exitCode, restartCount, isCrashLoop, healthStatus);

    // Update container state
    this.updateContainerState(containerId, action, healthStatus);

    // Create processed event
    const processedEvent: ProcessedContainerEvent = {
      ...containerEvent,
      severity,
      restartCount,
      isCrashLoop,
    };

    // Invoke callback
    this.eventCallback(processedEvent);
  }

  /**
   * Check if action is relevant
   */
  private isRelevantAction(action: string): action is ContainerEventAction {
    const relevantActions = [
      "create", "start", "stop", "die", "kill",
      "restart", "pause", "unpause", "destroy", "health_status",
    ];
    return relevantActions.includes(action);
  }

  /**
   * Track container restarts and detect crash loops
   */
  private trackRestart(
    containerId: string,
    action: ContainerEventAction,
    exitCode: number | null
  ): { restartCount: number; isCrashLoop: boolean } {
    const now = Date.now();

    // Only track die events with non-zero exit codes (crashes) and restart events
    if (action !== "die" && action !== "restart") {
      const tracker = this.restartTrackers.get(containerId);
      const recentRestarts = tracker
        ? tracker.timestamps.filter((t) => now - t < CRASH_LOOP_WINDOW_MS)
        : [];
      return {
        restartCount: recentRestarts.length,
        isCrashLoop: recentRestarts.length >= CRASH_LOOP_THRESHOLD,
      };
    }

    // Get or create tracker
    let tracker = this.restartTrackers.get(containerId);
    if (!tracker) {
      tracker = { timestamps: [] };
      this.restartTrackers.set(containerId, tracker);
    }

    // Add current timestamp for crashes and restarts
    if (action === "die" && exitCode !== 0) {
      tracker.timestamps.push(now);
    } else if (action === "restart") {
      tracker.timestamps.push(now);
    }

    // Clean up old timestamps
    tracker.timestamps = tracker.timestamps.filter(
      (t) => now - t < CRASH_LOOP_WINDOW_MS
    );

    const restartCount = tracker.timestamps.length;
    const isCrashLoop = restartCount >= CRASH_LOOP_THRESHOLD;

    return { restartCount, isCrashLoop };
  }

  /**
   * Calculate event severity based on action, exit code, and restart count
   */
  private calculateSeverity(
    action: ContainerEventAction,
    exitCode: number | null,
    restartCount: number,
    isCrashLoop: boolean,
    healthStatus: ContainerHealth | null
  ): ContainerEventSeverity {
    // Crash loop = critical
    if (isCrashLoop) {
      return "critical";
    }

    // Multiple restarts = warning
    if (restartCount >= 2) {
      return "warning";
    }

    switch (action) {
      case "create":
        return "info";

      case "start":
        return "info";

      case "stop":
        // Graceful stop (exit code 0) = info
        return exitCode === 0 || exitCode === null ? "info" : "warning";

      case "die":
        // Crash (non-zero exit code) = error, graceful = info
        return exitCode !== 0 && exitCode !== null ? "error" : "info";

      case "kill":
        // Killed = warning (could be forced termination)
        return "warning";

      case "restart":
        // Auto-restart = warning
        return "warning";

      case "pause":
        return "info";

      case "unpause":
        return "info";

      case "destroy":
        return "info";

      case "health_status":
        if (healthStatus === "unhealthy") {
          return "warning";
        }
        return "info";

      default:
        return "info";
    }
  }

  /**
   * Update tracked container state
   */
  private updateContainerState(
    containerId: string,
    action: ContainerEventAction,
    healthStatus: ContainerHealth | null
  ): void {
    let state = this.containerStates.get(containerId);
    if (!state) {
      state = { status: "unknown", health: null };
      this.containerStates.set(containerId, state);
    }

    switch (action) {
      case "create":
        state.status = "created";
        break;
      case "start":
        state.status = "running";
        break;
      case "stop":
      case "die":
        state.status = "exited";
        break;
      case "pause":
        state.status = "paused";
        break;
      case "unpause":
        state.status = "running";
        break;
      case "destroy":
        this.containerStates.delete(containerId);
        this.restartTrackers.delete(containerId);
        return;
      case "health_status":
        if (healthStatus) {
          state.health = healthStatus;
        }
        break;
    }
  }

  /**
   * Clear restart tracker for a container (e.g., after successful run)
   */
  clearRestartTracker(containerId: string): void {
    this.restartTrackers.delete(containerId);
  }
}

/**
 * Docker event data structure
 */
interface DockerEventData {
  Type: string;
  Action: string;
  Actor: {
    ID: string;
    Attributes: {
      name?: string;
      image?: string;
      exitCode?: string;
      signal?: string;
      health_status?: string;
      [key: string]: string | undefined;
    };
  };
  time: number;
  timeNano: number;
}
