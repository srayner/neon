import { describe, expect, it } from 'vitest';
import type Docker from 'dockerode';
import { collectContainers, getHostOsInfo, isDockerAvailable } from './docker.js';
import { StopRequests } from './stop-requests.js';

// What the container list reports when Docker fails part-way through a sync.
// A stand-in Docker client: a real daemon can't be made to fail one inspect.

function listed(id: string, name: string) {
  return { Id: id, Names: [`/${name}`], Image: 'alpine:3.20', ImageID: 'sha256:img', State: 'exited', Ports: [], Labels: {}, NetworkSettings: { Networks: {} } };
}

function inspected(restartCount: number) {
  return {
    RestartCount: restartCount,
    State: { StartedAt: '2026-11-25T21:00:00Z', FinishedAt: '2026-11-25T21:30:00Z', ExitCode: 1, OOMKilled: true },
  };
}

/** A Docker client whose inspect of each container does what `inspect` says. */
function fakeDocker(inspect: Record<string, () => Promise<unknown>>): Docker {
  return {
    listContainers: async () => Object.keys(inspect).map((id) => listed(id, `app-${id}`)),
    listImages: async () => [{ Id: 'sha256:img', RepoTags: ['alpine:3.20'] }],
    getContainer: (id: string) => ({ inspect: inspect[id] }),
  } as unknown as Docker;
}

const dockerError = (statusCode: number) => Object.assign(new Error(`HTTP ${statusCode}`), { statusCode });

describe('collectContainers when Docker fails part-way', () => {
  it('reports the facts Docker gives', async () => {
    const docker = fakeDocker({ a: async () => inspected(12) });
    const [c] = await collectContainers(docker, new StopRequests());
    expect(c).toMatchObject({ name: 'app-a', restartCount: 12, oomKilled: true, exitCode: 1, imageTags: ['alpine:3.20'] });
  });

  it('leaves out a container removed between listing and inspecting', async () => {
    const docker = fakeDocker({
      a: async () => inspected(12),
      gone: async () => {
        throw dockerError(404);
      },
    });
    const containers = await collectContainers(docker, new StopRequests());
    expect(containers.map((c) => c.name)).toEqual(['app-a']);
  });

  it.each([
    ['a server error', dockerError(500)],
    ['a timeout', Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })],
  ])('fails the sync on %s, rather than report made-up facts', async (_label, error) => {
    const docker = fakeDocker({
      a: async () => inspected(12),
      b: async () => {
        throw error;
      },
    });
    await expect(collectContainers(docker, new StopRequests())).rejects.toBe(error);
  });
});

// A hung Docker daemon must not hold up a sync or a heartbeat for ever. The
// real-Docker test proves a sync gives up; it can't tell which request did,
// since a sync fails as soon as any one of them gives up. So: every one-off
// request carries an abort signal (the event stream is the only exception).
describe('every one-off Docker request can give up', () => {
  it('lists, inspects, pings and reads host info with an abort signal', async () => {
    const signals: Record<string, unknown> = {};
    const record = (name: string, result: unknown) => async (opts?: { abortSignal?: unknown }) => {
      signals[name] = opts?.abortSignal;
      return result;
    };
    const docker = {
      listContainers: record('listContainers', [listed('a', 'app-a')]),
      listImages: record('listImages', []),
      getContainer: () => ({ inspect: record('inspect', inspected(0)) }),
      ping: record('ping', 'OK'),
      info: record('info', {}),
    } as unknown as Docker;

    await collectContainers(docker, new StopRequests());
    await isDockerAvailable(docker);
    await getHostOsInfo(docker);

    expect(Object.keys(signals).sort()).toEqual(['info', 'inspect', 'listContainers', 'listImages', 'ping']);
    for (const [name, signal] of Object.entries(signals)) expect(signal, name).toBeInstanceOf(AbortSignal);
  });
});
