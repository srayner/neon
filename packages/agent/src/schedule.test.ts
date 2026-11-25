import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { repeat } from './schedule.js';

// Agent schedules (task criterion 9): each task runs at its configured
// interval, counted from the end of the previous run, never overlapping.

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('repeat', () => {
  it.each([60, 300, 900])('runs a %i second task every %i seconds', async (seconds) => {
    const runs: number[] = [];
    const stop = repeat(seconds * 1000, async () => {
      runs.push(Date.now());
    });
    const start = Date.now();

    await vi.advanceTimersByTimeAsync(seconds * 1000 * 3);
    stop();

    expect(runs.map((t) => (t - start) / 1000)).toEqual([seconds, seconds * 2, seconds * 3]);
  });

  it('waits for a slow run to finish before counting the next interval', async () => {
    let running = 0;
    let maxRunning = 0;
    const starts: number[] = [];
    const stop = repeat(1000, async () => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      starts.push(Date.now());
      await new Promise((r) => setTimeout(r, 2500)); // longer than the interval
      running--;
    });
    const start = Date.now();

    await vi.advanceTimersByTimeAsync(10_000);
    stop();

    expect(maxRunning).toBe(1);
    // Starts at 1 s, then 2.5 s of work + 1 s gap each time.
    expect(starts.map((t) => (t - start) / 1000)).toEqual([1, 4.5, 8]);
  });

  it('carries on after a run throws', async () => {
    let calls = 0;
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const stop = repeat(1000, async () => {
      calls++;
      if (calls === 1) throw new Error('Neon unreachable');
    });

    await vi.advanceTimersByTimeAsync(3000);
    stop();

    expect(calls).toBe(3);
    expect(error).toHaveBeenCalledTimes(1);
  });

  it('runs nothing after it is stopped', async () => {
    const task = vi.fn(async () => {});
    const stop = repeat(1000, task);
    await vi.advanceTimersByTimeAsync(1000);
    stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(task).toHaveBeenCalledTimes(1);
  });
});
