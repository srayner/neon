import { describe, expect, it } from 'vitest';
import { coalesce } from './coalesce.js';

// Task criterion 3: at most one container sync runs at a time, and events
// during a sync cause exactly one more sync afterwards.

/** A task whose runs finish only when the test says so. */
function controllable() {
  const finishers: (() => void)[] = [];
  let running = 0;
  let maxRunning = 0;
  const task = () =>
    new Promise<void>((resolve) => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      finishers.push(() => {
        running--;
        resolve();
      });
    });
  const flush = () => new Promise((r) => setTimeout(r, 0));
  return {
    task,
    runs: () => finishers.length,
    maxRunning: () => maxRunning,
    finish: async (n: number) => {
      finishers[n]();
      await flush();
    },
  };
}

describe('coalesce', () => {
  it('runs once for a single call', async () => {
    const c = controllable();
    const sync = coalesce(c.task);
    const done = sync();
    expect(c.runs()).toBe(1);
    await c.finish(0);
    await done;
    expect(c.runs()).toBe(1);
  });

  it('turns any number of calls during a run into exactly one more run', async () => {
    const c = controllable();
    const sync = coalesce(c.task);
    sync();
    const during = Array.from({ length: 20 }, () => sync());
    expect(c.runs()).toBe(1);

    await c.finish(0);
    expect(c.runs()).toBe(2);
    await c.finish(1);
    await Promise.all(during);

    expect(c.runs()).toBe(2);
    expect(c.maxRunning()).toBe(1);
  });

  it('starts a new run for a call after the last one finished', async () => {
    const c = controllable();
    const sync = coalesce(c.task);
    sync();
    await c.finish(0);
    sync();
    expect(c.runs()).toBe(2);
  });

  it('runs the queued sync even when the run before it fails', async () => {
    let calls = 0;
    const sync = coalesce(async () => {
      calls++;
      if (calls === 1) throw new Error('Docker unreachable');
    });
    const first = sync();
    const second = sync();
    await expect(first).rejects.toThrow('Docker unreachable');
    await second;
    expect(calls).toBe(2);
  });
});
