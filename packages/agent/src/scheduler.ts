import type Docker from 'dockerode';
import type { DockerGap } from '@neon/shared';
import type { AgentConfig } from './config.js';
import { MasterClient } from './transport/client.js';
import { MetricsBuffer } from './transport/buffer.js';
import { collectMetrics, getServerInfo } from './collectors/metrics.js';
import { collectContainers, isDockerAvailable } from './collectors/docker.js';
import { DockerWatcher } from './collectors/docker-watcher.js';
import { StopRequests } from './collectors/stop-requests.js';
import { repeat } from './schedule.js';
import { coalesce } from './coalesce.js';

/**
 * Collects facts and reports them to Neon (docs/alerts.md section 2). It
 * decides nothing: severity and alerts are Neon's.
 */
export class Scheduler {
  private config: AgentConfig;
  private client: MasterClient;
  private docker: Docker;
  private buffer: MetricsBuffer;
  private stopRequests = new StopRequests();
  private watcher: DockerWatcher;
  private stopSchedules: (() => void)[] = [];
  /** Gaps not yet accepted by Neon, oldest first. */
  private pendingGaps: DockerGap[] = [];

  /** Reads and sends the full container list; calls during a sync share the next one. */
  readonly syncContainers = coalesce(() => this.collectAndSendContainers());
  /** Sends pending gaps; one send at a time, so a gap is never removed twice. */
  private readonly flushGaps = coalesce(() => this.sendPendingGaps());

  constructor(config: AgentConfig, client: MasterClient, docker: Docker) {
    this.config = config;
    this.client = client;
    this.docker = docker;
    this.buffer = new MetricsBuffer(config.bufferMaxSize);
    this.watcher = new DockerWatcher({
      docker,
      onEvent: (event) => this.stopRequests.record(event),
      onChange: () => void this.syncContainers(),
      onGap: (gap) => {
        this.pendingGaps.push(gap);
        void this.flushGaps();
      },
    });
  }

  /**
   * Start all scheduled tasks
   */
  async start(): Promise<void> {
    await this.registerWithMaster();

    await this.collectAndSendMetrics();
    await this.sendHeartbeat();
    // Its first connection prompts the first container sync. If Docker can't
    // be reached it keeps trying, and syncs once it can.
    this.watcher.start();

    this.schedule('Metrics collection', this.config.metricsIntervalSeconds, () => this.collectAndSendMetrics());
    this.schedule('Container sync', this.config.containersIntervalSeconds, () => this.syncContainers());
    this.schedule('Heartbeat', this.config.heartbeatIntervalSeconds, () => this.sendHeartbeat());

    console.log('[Scheduler] All tasks scheduled');
  }

  /**
   * Stop all scheduled tasks
   */
  stop(): void {
    for (const stop of this.stopSchedules) stop();
    this.stopSchedules = [];
    this.watcher.stop();
    console.log('[Scheduler] All tasks stopped');
  }

  private schedule(name: string, seconds: number, task: () => Promise<void>): void {
    this.stopSchedules.push(repeat(seconds * 1000, task, name));
    console.log(`[Scheduler] ${name} scheduled every ${seconds}s`);
  }

  private async registerWithMaster(): Promise<void> {
    console.log('[Scheduler] Registering with master...');
    const serverInfo = await getServerInfo(this.config.serverName, this.docker, this.config.heartbeatIntervalSeconds);
    await this.client.register(serverInfo);
  }

  private async ensureRegistered(): Promise<boolean> {
    if (!this.client.isRegistered()) {
      try {
        await this.registerWithMaster();
        return true;
      } catch (error) {
        console.error('[Scheduler] Failed to register:', (error as Error).message);
        return false;
      }
    }
    return true;
  }

  private async collectAndSendMetrics(): Promise<void> {
    try {
      // Collect metrics
      const metrics = await collectMetrics();
      console.log(`[Scheduler] Collected metrics: CPU ${metrics.cpuPercent}%, Memory ${metrics.memoryPercent}%`);

      // Try to send (including any buffered metrics)
      if (await this.ensureRegistered()) {
        try {
          // Flush buffer first if we have buffered data
          const bufferedMetrics = this.buffer.flush();
          const allMetrics = [...bufferedMetrics, metrics];

          if (bufferedMetrics.length > 0) {
            console.log(`[Scheduler] Sending ${bufferedMetrics.length} buffered + 1 new metrics`);
          }

          await this.client.sendMetrics(allMetrics);
        } catch (error) {
          console.warn('[Scheduler] Failed to send metrics, buffering:', (error as Error).message);
          if (this.config.bufferEnabled) {
            this.buffer.add(metrics);
            console.log(`[Scheduler] Buffered metrics (${this.buffer.size()} total)`);
          }
        }
      } else {
        // Not registered, buffer the metrics
        if (this.config.bufferEnabled) {
          this.buffer.add(metrics);
          console.log(`[Scheduler] Buffered metrics (${this.buffer.size()} total)`);
        }
      }
    } catch (error) {
      console.error('[Scheduler] Error collecting metrics:', (error as Error).message);
    }
  }

  /**
   * Nothing to buffer on failure: the next sync sends the whole current state.
   */
  private async collectAndSendContainers(): Promise<void> {
    try {
      const containers = await collectContainers(this.docker, this.stopRequests);
      console.log(`[Scheduler] Collected ${containers.length} containers`);

      if (await this.ensureRegistered()) {
        await this.client.sendContainers(containers);
      }
    } catch (error) {
      console.warn('[Scheduler] Container sync failed:', (error as Error).message);
    }
  }

  private async sendPendingGaps(): Promise<void> {
    if (this.pendingGaps.length === 0) return;
    if (!(await this.ensureRegistered())) return;

    const batch = this.pendingGaps.slice();
    try {
      await this.client.sendDockerGaps(batch);
      // Gaps added while sending stay for the next flush.
      this.pendingGaps.splice(0, batch.length);
      console.log(`[Scheduler] Sent ${batch.length} Docker gap(s)`);
    } catch (error) {
      console.warn(`[Scheduler] Failed to send ${batch.length} Docker gap(s), will retry:`, (error as Error).message);
    }
  }

  private async sendHeartbeat(): Promise<void> {
    try {
      const dockerReachable = await isDockerAvailable(this.docker);
      if (await this.ensureRegistered()) {
        const { tokenExpiresIn } = await this.client.heartbeat(dockerReachable);

        // Re-register if token is expiring soon (within 1 hour)
        if (tokenExpiresIn < 3600) {
          console.log('[Scheduler] Token expiring soon, re-registering...');
          this.client.clearRegistration();
          await this.registerWithMaster();
        }
      }
    } catch (error) {
      console.warn('[Scheduler] Heartbeat failed:', (error as Error).message);
    }
    // Retry gaps Neon has not yet accepted.
    await this.flushGaps();
  }
}
