import type Docker from "dockerode";
import type { DockerGap } from "@neon/shared";
import type { DockerEventLike } from "./stop-requests.js";
import { DOCKER_REQUEST_TIMEOUT_MS } from "./docker.js";

// Container actions that can change what the container list shows. Docker
// also sends exec_create/exec_start/exec_die for every health check run (and
// every docker exec), which change nothing; reading the list for each would
// mean a full sync per health check per container. Docker 29 sends health as
// "health_status: healthy" etc., so that one is matched by prefix.
const STATE_ACTIONS = new Set([
  "create", "start", "restart", "stop", "kill", "die", "oom",
  "pause", "unpause", "destroy", "rename", "update",
]);

/** Whether a container event may have changed the container list. */
export function changesState(action: string): boolean {
  return STATE_ACTIONS.has(action) || action.startsWith("health_status");
}

export interface DockerWatcherOptions {
  docker: Docker;
  /** Every container event, as Docker sent it. */
  onEvent: (event: DockerEventLike) => void;
  /** Something may have changed: read the containers again. */
  onChange: () => void;
  /** The watcher could not see Docker's events for this period. */
  onGap: (gap: DockerGap) => void;
  initialRetryMs?: number;
  maxRetryMs?: number;
}

/**
 * Watches Docker's container events. An event that may change a container's
 * state is only a prompt to read the containers' current state again
 * (docs/alerts.md section 2); the agent never forwards events as facts.
 *
 * When the event stream ends or errors (e.g. the Docker daemon restarts), it
 * retries, waiting 1 s, then 2 s, and so on up to 30 s between attempts. When
 * it connects again it reports the gap and prompts a full read, since changes
 * during the gap were missed. If Docker can't be reached when the agent
 * starts, the gap runs from the first failed attempt.
 */
export class DockerWatcher {
  private readonly options: Required<DockerWatcherOptions>;
  private abort: AbortController | null = null;
  private retryTimer: NodeJS.Timeout | null = null;
  private retryMs: number;
  private lostAt: Date | null = null;
  private stopped = false;

  constructor(options: DockerWatcherOptions) {
    this.options = { initialRetryMs: 1000, maxRetryMs: 30_000, ...options };
    this.retryMs = this.options.initialRetryMs;
  }

  start(): void {
    this.stopped = false;
    void this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.abort?.abort();
    this.abort = null;
  }

  private async connect(): Promise<void> {
    const abort = new AbortController();
    // Give up on a connection Docker doesn't answer (a hung daemon), so the
    // retries carry on. Once the stream is open, quiet is normal: no timeout.
    const giveUp = setTimeout(() => abort.abort(), DOCKER_REQUEST_TIMEOUT_MS);
    let stream: NodeJS.ReadableStream;
    try {
      stream = await this.options.docker.getEvents({
        filters: { type: ["container"] },
        abortSignal: abort.signal,
      });
    } catch (error) {
      clearTimeout(giveUp);
      if (this.stopped) return;
      console.warn("[DockerWatcher] Cannot reach Docker:", (error as Error).message);
      this.lostAt ??= new Date();
      this.scheduleRetry();
      return;
    }
    clearTimeout(giveUp);
    if (this.stopped) {
      abort.abort();
      return;
    }

    this.abort = abort;
    this.retryMs = this.options.initialRetryMs;
    if (this.lostAt) {
      const gap = { from: this.lostAt.toISOString(), to: new Date().toISOString() };
      this.lostAt = null;
      console.log(`[DockerWatcher] Watching Docker again; missed events from ${gap.from} to ${gap.to}`);
      this.options.onGap(gap);
    } else {
      console.log("[DockerWatcher] Watching Docker events");
    }
    this.options.onChange();

    // "end", "close" and "error" can all fire for one loss; act once.
    let ended = false;
    const lost = (reason: string) => {
      if (ended) return;
      ended = true;
      if (this.stopped) return;
      console.warn(`[DockerWatcher] Lost Docker events (${reason}); retrying`);
      this.lostAt = new Date();
      this.abort = null;
      this.scheduleRetry();
    };

    // Docker sends one JSON object per line; a chunk may hold several lines,
    // or part of one.
    let pending = "";
    stream.on("data", (chunk: Buffer) => {
      pending += chunk.toString();
      const lines = pending.split("\n");
      pending = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line) as DockerEventLike;
          this.options.onEvent(event);
          if (changesState(event.Action)) this.options.onChange();
        } catch (error) {
          console.error("[DockerWatcher] Unreadable event:", (error as Error).message);
        }
      }
    });
    stream.on("end", () => lost("stream ended"));
    stream.on("close", () => lost("stream closed"));
    stream.on("error", (error: Error) => lost(error.message));
  }

  private scheduleRetry(): void {
    const wait = this.retryMs;
    this.retryMs = Math.min(this.retryMs * 2, this.options.maxRetryMs);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.connect();
    }, wait);
  }
}
