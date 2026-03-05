import type { ServerMetrics, ProcessedContainerEvent } from '@neon/shared';

/**
 * Buffer for storing metrics when master is unreachable
 */
export class MetricsBuffer {
  private metrics: ServerMetrics[] = [];
  private maxSize: number;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  /**
   * Add metrics to the buffer
   */
  add(metrics: ServerMetrics): void {
    this.metrics.push(metrics);

    // Drop oldest if over max size
    if (this.metrics.length > this.maxSize) {
      const dropped = this.metrics.shift();
      console.warn(`[Buffer] Buffer full, dropped oldest metric from ${dropped?.timestamp}`);
    }
  }

  /**
   * Get all buffered metrics and clear the buffer
   */
  flush(): ServerMetrics[] {
    const flushed = [...this.metrics];
    this.metrics = [];
    return flushed;
  }

  /**
   * Get current buffer size
   */
  size(): number {
    return this.metrics.length;
  }

  /**
   * Check if buffer has data
   */
  hasData(): boolean {
    return this.metrics.length > 0;
  }
}

/**
 * Buffer for storing container events until next sync interval
 */
export class ContainerEventsBuffer {
  private events: ProcessedContainerEvent[] = [];
  private maxSize: number;

  constructor(maxSize: number = 500) {
    this.maxSize = maxSize;
  }

  /**
   * Add an event to the buffer
   */
  add(event: ProcessedContainerEvent): void {
    this.events.push(event);

    // Drop oldest if over max size (FIFO)
    if (this.events.length > this.maxSize) {
      const dropped = this.events.shift();
      console.warn(`[ContainerEventsBuffer] Buffer full, dropped oldest event: ${dropped?.action} for ${dropped?.containerName}`);
    }
  }

  /**
   * Get all buffered events and clear the buffer
   */
  flush(): ProcessedContainerEvent[] {
    const flushed = [...this.events];
    this.events = [];
    return flushed;
  }

  /**
   * Get current buffer size
   */
  size(): number {
    return this.events.length;
  }

  /**
   * Check if buffer has data
   */
  hasData(): boolean {
    return this.events.length > 0;
  }
}
