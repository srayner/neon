import cron from 'node-cron';
import type { AgentConfig } from './config.js';
import { MasterClient } from './transport/client.js';
import { MetricsBuffer, ContainerEventsBuffer } from './transport/buffer.js';
import { collectMetrics, getServerInfo } from './collectors/metrics.js';
import { collectContainers, isDockerAvailable } from './collectors/docker.js';
import { DockerEventMonitor } from './collectors/docker-events.js';

/**
 * Scheduler manages periodic collection and reporting tasks
 */
export class Scheduler {
  private config: AgentConfig;
  private client: MasterClient;
  private buffer: MetricsBuffer;
  private eventsBuffer: ContainerEventsBuffer;
  private eventMonitor: DockerEventMonitor | null = null;
  private tasks: cron.ScheduledTask[] = [];
  private dockerAvailable: boolean = false;

  constructor(config: AgentConfig, client: MasterClient) {
    this.config = config;
    this.client = client;
    this.buffer = new MetricsBuffer(config.bufferMaxSize);
    this.eventsBuffer = new ContainerEventsBuffer(config.containerEventsBufferMaxSize);
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

      // Start Docker event monitoring if enabled
      if (this.config.containerEventsEnabled) {
        await this.startEventMonitor();
      }
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
    // Stop cron tasks
    for (const task of this.tasks) {
      task.stop();
    }
    this.tasks = [];

    // Stop event monitor
    if (this.eventMonitor) {
      this.eventMonitor.stop();
      this.eventMonitor = null;
    }

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

          // Also flush container events alongside container sync
          await this.flushContainerEvents();
        } catch (error) {
          console.warn('[Scheduler] Failed to send containers:', (error as Error).message);
        }
      }
    } catch (error) {
      console.error('[Scheduler] Error collecting containers:', (error as Error).message);
    }
  }

  /**
   * Start Docker event monitor
   */
  private async startEventMonitor(): Promise<void> {
    try {
      this.eventMonitor = new DockerEventMonitor((event) => {
        this.eventsBuffer.add(event);
        console.log(`[Scheduler] Buffered container event: ${event.action} for ${event.containerName} (severity: ${event.severity})`);
      });

      await this.eventMonitor.start();
    } catch (error) {
      console.error('[Scheduler] Failed to start Docker event monitor:', (error as Error).message);
      this.eventMonitor = null;
    }
  }

  /**
   * Flush buffered container events to master
   */
  private async flushContainerEvents(): Promise<void> {
    if (!this.eventsBuffer.hasData()) {
      return;
    }

    try {
      const events = this.eventsBuffer.flush();
      console.log(`[Scheduler] Flushing ${events.length} container event(s)`);

      await this.client.sendContainerEvents(events);
    } catch (error) {
      console.warn('[Scheduler] Failed to send container events:', (error as Error).message);
      // Note: Events are lost if send fails - this is acceptable per design
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
