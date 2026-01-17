import type { ServerMetrics } from '@neon/shared';

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
