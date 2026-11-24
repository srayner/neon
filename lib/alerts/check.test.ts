import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startRepeating } from "./check";
import { GIVE_UP_AFTER_MS, isExpired } from "./notifications";

// docs/alerts.md section 5: the scheduled check.
describe("startRepeating", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("never starts a run while the previous one is still going", async () => {
    let running = 0;
    let maxRunning = 0;
    let runs = 0;
    // Each run takes 50s, longer than the 30s interval.
    const run = async () => {
      runs++;
      running++;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((r) => setTimeout(r, 50_000));
      running--;
    };

    const stop = startRepeating(run, 30_000, () => {});
    await vi.advanceTimersByTimeAsync(30_000); // first run starts
    await vi.advanceTimersByTimeAsync(49_000); // still running at 79s
    expect(runs).toBe(1);
    await vi.advanceTimersByTimeAsync(1_000 + 30_000); // ends at 80s, next at 110s
    expect(runs).toBe(2);
    stop();

    expect(maxRunning).toBe(1);
  });

  it("keeps running after a run throws", async () => {
    const errors: unknown[] = [];
    let runs = 0;
    const stop = startRepeating(
      async () => {
        runs++;
        throw new Error("database down");
      },
      30_000,
      (e) => errors.push(e)
    );

    await vi.advanceTimersByTimeAsync(90_000);
    stop();

    expect(runs).toBe(3);
    expect(errors).toHaveLength(3);
  });
});

// docs/alerts.md section 5: give up on a notification 1 hour after it was created.
describe("isExpired", () => {
  const created = new Date("2026-11-24T14:00:00Z");

  it.each([
    [0, false],
    [GIVE_UP_AFTER_MS - 1000, false],
    [GIVE_UP_AFTER_MS, true],
    [GIVE_UP_AFTER_MS + 60_000, true],
  ])("%i ms after creation → %s", (elapsed, expired) => {
    expect(isExpired(created, new Date(created.getTime() + elapsed))).toBe(expired);
  });
});
