/**
 * Wraps `task` so that at most one run is in progress, and calls made during
 * a run share one more run after it, which starts once it ends. A burst of
 * Docker events therefore causes at most two container syncs in a row, not
 * one per event, and each later run still sees every change made before it
 * started.
 *
 * The returned promise settles when the run that covers this call finishes.
 */
export function coalesce(task: () => Promise<void>): () => Promise<void> {
  let running: Promise<void> | null = null;
  let queued: Promise<void> | null = null;

  const start = (): Promise<void> => {
    const run = task().finally(() => {
      if (running === run) running = null;
    });
    running = run;
    return run;
  };

  return () => {
    if (queued) return queued;
    if (running) {
      queued = running
        .catch(() => {})
        .then(() => {
          queued = null;
          return start();
        });
      return queued;
    }
    return start();
  };
}
