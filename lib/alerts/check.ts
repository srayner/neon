import { sendPendingNotifications } from './notifications';

// The scheduled check (docs/alerts.md section 5), started from
// instrumentation.ts. Later tasks add the heartbeat check (H1) to each run.

export const CHECK_INTERVAL_MS = 30_000;

/**
 * Runs `run` repeatedly, starting each run `intervalMs` after the previous one
 * finished, so runs can never overlap however long one takes. An error in a
 * run is reported and the next run still happens. Returns a stop function.
 */
export function startRepeating(
  run: () => Promise<void>,
  intervalMs: number,
  onError: (error: unknown) => void
): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout>;

  const tick = async () => {
    try {
      await run();
    } catch (error) {
      onError(error);
    }
    if (!stopped) timer = setTimeout(tick, intervalMs);
  };

  timer = setTimeout(tick, intervalMs);
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}

export function startAlertCheck(): () => void {
  console.log(`[Alerts] Scheduled check started (every ${CHECK_INTERVAL_MS / 1000}s)`);
  return startRepeating(
    () => sendPendingNotifications(),
    CHECK_INTERVAL_MS,
    (error) => console.error('[Alerts] Scheduled check failed:', error)
  );
}
