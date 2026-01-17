import cron from 'node-cron';
import type { AgentConfig } from './config.js';
import { MasterClient } from './transport/client.js';
import { MetricsBuffer } from './transport/buffer.js';
import { collectMetrics, getServerInfo } from './collectors/metrics.js';
import { collectContainers, isDockerAvailable } from './collectors/docker.js';

/**
 * Scheduler manages periodic collection and reporting tasks
 */
export class Scheduler {
  private config: AgentConfig;
  private client: MasterClient;
  private buffer: MetricsBuffer;
  private tasks: cron.ScheduledTask[] = [];
  private dockerAvailable: boolean = false;

  constructor(config: AgentConfig, client: MasterClient) {
    this.config = config;
    this.client = client;
    this.buffer = new MetricsBuffer(config.bufferMaxSize);
  }

  /**
   * Start all scheduled tasks
   */
  async start(): Promise<void> {
    // Check Docker availability
    this.dockerAvailable = await isDockerAvailable();
    if (this.dockerAvailable) {
      console.log('[Scheduler] Docker is available');
    } else {
      console.log('[Scheduler] Docker is not available - container sync disabled');
    }

    // Register with master
    await this.registerWithMaster();

    // Run initial collection immediately
    await this.collectAndSendMetrics();
    if (this.dockerAvailable) {
      await this.collectAndSendContainers();
    }

    // Schedule periodic tasks
    this.scheduleMetrics();
    this.scheduleContainers();
    this.scheduleHeartbeat();

    console.log('[Scheduler] All tasks scheduled');
  }

  /**
   * Stop all scheduled tasks
   */
  stop(): void {
    for (const task of this.tasks) {
      task.stop();
    }
    this.tasks = [];
    console.log('[Scheduler] All tasks stopped');
  }

  private async registerWithMaster(): Promise<void> {
    console.log('[Scheduler] Registering with master...');
    const serverInfo = await getServerInfo(this.config.serverName);
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

  private scheduleMetrics(): void {
    const cronExpr = `*/${this.config.metricsIntervalSeconds} * * * * *`;
    const task = cron.schedule(cronExpr, async () => {
      await this.collectAndSendMetrics();
    });
    this.tasks.push(task);
    console.log(`[Scheduler] Metrics collection scheduled every ${this.config.metricsIntervalSeconds}s`);
  }

  private scheduleContainers(): void {
    if (!this.dockerAvailable) return;

    const cronExpr = `*/${this.config.containersIntervalSeconds} * * * * *`;
    const task = cron.schedule(cronExpr, async () => {
      await this.collectAndSendContainers();
    });
    this.tasks.push(task);
    console.log(`[Scheduler] Container sync scheduled every ${this.config.containersIntervalSeconds}s`);
  }

  private scheduleHeartbeat(): void {
    const cronExpr = `*/${this.config.heartbeatIntervalSeconds} * * * * *`;
    const task = cron.schedule(cronExpr, async () => {
      await this.sendHeartbeat();
    });
    this.tasks.push(task);
    console.log(`[Scheduler] Heartbeat scheduled every ${this.config.heartbeatIntervalSeconds}s`);
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

  private async collectAndSendContainers(): Promise<void> {
    try {
      const containers = await collectContainers();
      console.log(`[Scheduler] Collected ${containers.length} containers`);

      if (await this.ensureRegistered()) {
        try {
          await this.client.sendContainers(containers);
        } catch (error) {
          console.warn('[Scheduler] Failed to send containers:', (error as Error).message);
        }
      }
    } catch (error) {
      console.error('[Scheduler] Error collecting containers:', (error as Error).message);
    }
  }

  private async sendHeartbeat(): Promise<void> {
    try {
      if (await this.ensureRegistered()) {
        const { tokenExpiresIn } = await this.client.heartbeat();

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
  }
}
