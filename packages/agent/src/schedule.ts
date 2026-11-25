/**
 * Runs `task` every `intervalMs`, counting from when the previous run
 * finished, so a slow run (a timeout talking to Neon or Docker) never overlaps
 * the next. The first run is `intervalMs` after the call.
 *
 * Errors are the task's own business: one that escapes is logged and the
 * schedule carries on.
 *
 * @returns a function that stops the schedule
 */
export function repeat(intervalMs: number, task: () => Promise<void>, name = 'task'): () => void {
  let timer: NodeJS.Timeout | null = null;
  let stopped = false;

  const run = async () => {
    try {
      await task();
    } catch (error) {
      console.error(`[Schedule] ${name} failed:`, (error as Error).message);
    }
    if (!stopped) timer = setTimeout(run, intervalMs);
  };

  timer = setTimeout(run, intervalMs);
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
