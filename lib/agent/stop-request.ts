import type { StopRequest } from '@neon/shared';

interface Exit {
  finishedAt: Date | null;
  stopRequest: string | null;
}

/**
 * The stop request to store for a container's latest exit.
 *
 * The agent remembers stop requests only in memory, so after it restarts it
 * reports null for an exit it saw before. A null for the exit already stored
 * (same finishedAt) therefore means "not known", and the stored value stays.
 * A different exit gets exactly what the agent reports.
 */
export function stopRequestToStore(stored: Exit | undefined, reported: { finishedAt: string | null; stopRequest: StopRequest }): string | null {
  if (reported.stopRequest !== null) return reported.stopRequest;
  const sameExit =
    stored?.finishedAt != null &&
    reported.finishedAt != null &&
    stored.finishedAt.getTime() === new Date(reported.finishedAt).getTime();
  return sameExit ? stored.stopRequest : null;
}
