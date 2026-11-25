import type { StopRequest } from '@neon/shared';

/** The parts of a Docker event this tracker reads. */
export interface DockerEventLike {
  Type?: string;
  Action: string;
  Actor?: { ID?: string };
}

/**
 * Remembers, per container, whether Docker reported a request to stop it
 * since it last started. This is how a stop or kill is told apart from a
 * container exiting by itself: the exit code alone can't (137 is both a
 * `docker kill` and an out-of-memory kill).
 *
 * Docker 29 sends, in order (see stop-requests.fixture.json):
 * - docker stop:  kill (signal 15), [kill (signal 9) if it times out], stop, die
 * - docker kill:  kill (signal 9), die
 * - docker rm -f: kill (signal 9), die, destroy
 * - a crash or out-of-memory: die only (out-of-memory adds "oom" before it)
 *
 * So every request arrives before the exit, and no time window is needed.
 *
 * Known limit: `docker kill -s HUP` (a signal the container handles without
 * exiting) is recorded as a kill, so a later exit by itself before the next
 * start is reported as killed.
 */
export class StopRequests {
  private requests = new Map<string, Exclude<StopRequest, null>>();

  record(event: DockerEventLike): void {
    const id = event.Actor?.ID;
    if (event.Type && event.Type !== 'container') return;
    if (!id) return;

    switch (event.Action) {
      case 'kill':
        // docker stop sends kill first, then stop, which overwrites it.
        this.requests.set(id, 'kill');
        break;
      case 'stop':
        this.requests.set(id, 'stop');
        break;
      case 'start':
      case 'destroy':
        this.requests.delete(id);
        break;
    }
  }

  /** The request recorded for a container (by its full Docker ID). */
  get(containerId: string): StopRequest {
    return this.requests.get(containerId) ?? null;
  }
}
