import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  DockerProxy,
  FakeNeon,
  docker,
  removeTestContainers,
  runContainer,
  startAgent,
  waitFor,
} from './test-support/docker-harness.js';
import type { Scheduler } from './scheduler.js';
import { DOCKER_REQUEST_TIMEOUT_MS } from './collectors/docker.js';

// docs/alerts.md 8.2: what the agent reports, driven by a real Docker daemon.
// Covers task criteria 2-7. Only containers labelled neon-test=agent are used,
// and all are removed afterwards. Run with: npm run test:docker

let neon: FakeNeon;
let proxy: DockerProxy;
let agent: Scheduler | null = null;

beforeAll(() => {
  docker('pull', '-q', 'alpine');
  removeTestContainers();
});
afterAll(removeTestContainers);

beforeEach(async () => {
  neon = new FakeNeon();
  await neon.start();
  proxy = new DockerProxy();
  await proxy.restore();
});

afterEach(async () => {
  agent?.stop();
  agent = null;
  await neon.stop();
  await proxy.close();
  removeTestContainers();
});

async function startWatching() {
  agent = startAgent(neon, proxy);
  await agent.start();
  // The watcher's first connection prompts a sync.
  await waitFor('the first container sync', () => neon.containerPosts.length > 0);
}

/** Waits for a post in which `name` matches `expected`. */
function waitForState(name: string, expected: (c: NonNullable<ReturnType<FakeNeon['latestFor']>>) => boolean, what: string) {
  return waitFor(`${name}: ${what}`, () => {
    const c = neon.latestFor(name);
    return c && expected(c) ? c : undefined;
  });
}

// Criterion 2: any container event prompts a sync of the full list.
describe('Docker events prompt a full sync', () => {
  it('reports a stop, with Docker’s own stop request', async () => {
    const name = runContainer('neon-agent-stop', 'alpine', 'sleep', '600');
    await startWatching();
    await waitForState(name, (c) => c.status === 'running', 'running');

    docker('stop', '-t', '1', name);
    const c = await waitForState(name, (c) => c.status === 'exited', 'exited');
    expect(c).toMatchObject({ stopRequest: 'stop', oomKilled: false });
    expect(c.finishedAt).not.toBeNull();
  });

  it('reports pause and unpause', async () => {
    const name = runContainer('neon-agent-pause', 'alpine', 'sleep', '600');
    await startWatching();
    docker('pause', name);
    await waitForState(name, (c) => c.status === 'paused', 'paused');
    docker('unpause', name);
    await waitForState(name, (c) => c.status === 'running', 'running again');
  });

  it('reports a health check failing, then passing', async () => {
    // Healthy while /tmp/ok exists.
    const name = runContainer(
      'neon-agent-health',
      '--health-cmd', 'test -f /tmp/ok',
      '--health-interval', '1s',
      '--health-retries', '1',
      'alpine', 'sh', '-c', 'touch /tmp/ok; sleep 600',
    );
    await startWatching();
    await waitForState(name, (c) => c.health === 'healthy', 'healthy');

    docker('exec', name, 'rm', '/tmp/ok');
    await waitForState(name, (c) => c.health === 'unhealthy', 'unhealthy');

    docker('exec', name, 'touch', '/tmp/ok');
    await waitForState(name, (c) => c.health === 'healthy', 'healthy again');
  });

  it('reports a removed container by leaving it out', async () => {
    const name = runContainer('neon-agent-rm', 'alpine', 'sleep', '600');
    await startWatching();
    await waitForState(name, (c) => c.status === 'running', 'running');
    docker('rm', '-f', name);
    await waitFor(`${name} gone`, () => neon.containerPosts.length > 0 && !neon.latestFor(name));
  });
});

// Criterion 4: the facts Neon needs to say why a container stopped.
describe('why a container stopped', () => {
  it('docker kill is reported as a kill', async () => {
    const name = runContainer('neon-agent-kill', 'alpine', 'sleep', '600');
    await startWatching();
    await waitForState(name, (c) => c.status === 'running', 'running');
    docker('kill', name);
    const c = await waitForState(name, (c) => c.status === 'exited', 'exited');
    expect(c).toMatchObject({ stopRequest: 'kill', exitCode: 137, oomKilled: false });
  });

  it('a container exiting by itself has no stop request', async () => {
    await startWatching();
    const name = runContainer('neon-agent-crash', 'alpine', 'sh', '-c', 'sleep 1; exit 3');
    const c = await waitForState(name, (c) => c.status === 'exited', 'exited');
    expect(c).toMatchObject({ stopRequest: null, exitCode: 3, oomKilled: false });
  });

  it('an out-of-memory exit is reported as such', async () => {
    await startWatching();
    const name = runContainer('neon-agent-oom', '--memory', '8m', '--memory-swap', '8m', 'alpine', 'sh', '-c', 'tail /dev/zero');
    const c = await waitForState(name, (c) => c.status === 'exited', 'exited');
    expect(c).toMatchObject({ stopRequest: null, exitCode: 137, oomKilled: true });
  });

  it('a crash loop under a restart policy shows the restart count rising', async () => {
    await startWatching();
    const name = runContainer('neon-agent-loop', '--restart', 'on-failure', 'alpine', 'sh', '-c', 'sleep 0.5; exit 1');
    const counts = new Set<number>();
    await waitFor('three different restart counts', () => {
      for (const post of neon.containerPosts) {
        const c = post.containers.find((x) => x.name === name);
        if (c) counts.add(c.restartCount);
      }
      return counts.size >= 3;
    });
    const seen = [...counts];
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
    // Each crash exits by itself: no stop request.
    expect(neon.latestFor(name)?.stopRequest ?? null).toBeNull();
  });
});

// Criterion 3: a burst of events is coalesced, not one sync per event.
describe('bursts', () => {
  it('does not sync for health check runs that change nothing', async () => {
    const name = runContainer('neon-agent-quiet', '--health-cmd', 'true', '--health-interval', '1s', 'alpine', 'sleep', '600');
    await startWatching();
    await waitForState(name, (c) => c.health === 'healthy', 'healthy');
    await new Promise((r) => setTimeout(r, 1000));
    const syncs = proxy.listRequests;

    // About 5 health check runs, each sending exec_create/start/die.
    await new Promise((r) => setTimeout(r, 5000));
    expect(proxy.listRequests - syncs).toBe(0);
  });

  it('reports 20 containers started at once with at most 3 syncs', async () => {
    const names = Array.from({ length: 20 }, (_, i) => `neon-agent-burst-${i}`);
    for (const n of names) docker('create', '--name', n, '--label', 'neon-test=agent', 'alpine', 'sleep', '600');
    await startWatching();
    await waitFor('all 20 created', () => neon.latest().filter((c) => names.includes(c.name)).length === 20);
    // Let the create events' syncs finish before measuring.
    await new Promise((r) => setTimeout(r, 1000));
    const posts = neon.containerPosts.length;
    const syncs = proxy.listRequests;

    docker('start', ...names);
    await waitFor('all 20 running', () => names.every((n) => neon.latestFor(n)?.status === 'running'));
    await new Promise((r) => setTimeout(r, 1000)); // any follow-up syncs

    // Syncs are counted at Docker, so a sync that fails still counts.
    const burstSyncs = proxy.listRequests - syncs;
    const burstPosts = neon.containerPosts.length - posts;
    console.log(`[burst] 20 starts: ${burstSyncs} sync(s), ${burstPosts} post(s)`);
    expect(burstSyncs).toBeLessThanOrEqual(3);
    expect(burstPosts).toBe(burstSyncs);
  });
});

// Criteria 5-7: losing and regaining Docker.
describe('losing Docker', () => {
  it('reconnects, resyncs, reports the gap, and keeps it until Neon accepts it', async () => {
    const name = runContainer('neon-agent-gap', 'alpine', 'sleep', '600');
    await startWatching();
    await waitForState(name, (c) => c.status === 'running', 'running');

    neon.rejectGaps = 1;
    await proxy.cut();
    const lostAt = Date.now();
    // docker() blocks the event loop; let the agent see the loss first.
    await new Promise((r) => setTimeout(r, 200));
    // Missed while cut off: only a resync after reconnecting can show it.
    docker('stop', '-t', '1', name);
    await new Promise((r) => setTimeout(r, 1500));
    const postsBefore = neon.containerPosts.length;
    await proxy.restore();
    const restoredAt = Date.now();

    await waitForState(name, (c) => c.status === 'exited', 'exited after reconnecting');
    expect(neon.containerPosts.length).toBeGreaterThan(postsBefore);

    // The first send fails; the gap stays queued and goes with the next heartbeat.
    await waitFor('the first gap post', () => neon.gapPosts.length >= 1);
    expect(neon.acceptedGaps).toEqual([]);
    await (agent as unknown as { sendHeartbeat(): Promise<void> }).sendHeartbeat();
    const [gap] = await waitFor('the gap accepted', () => neon.acceptedGaps.length === 1 && neon.acceptedGaps);
    expect(neon.gapPosts).toHaveLength(2);
    expect(neon.gapPosts[1]).toEqual(neon.gapPosts[0]);

    const from = Date.parse(gap.from);
    const to = Date.parse(gap.to);
    expect(from).toBeGreaterThanOrEqual(lostAt - 1000);
    expect(from).toBeLessThanOrEqual(lostAt + 500);
    expect(to).toBeGreaterThanOrEqual(restoredAt);
    expect(to).toBeLessThan(restoredAt + 5000);

    // Still watching: a new event after reconnecting is reported.
    docker('start', name);
    await waitForState(name, (c) => c.status === 'running', 'running after reconnecting');
  });

  it('reports Docker reachability on every heartbeat', async () => {
    await startWatching();
    const beat = (agent as unknown as { sendHeartbeat(): Promise<void> }).sendHeartbeat.bind(agent);
    expect(neon.heartbeats.at(-1)?.dockerReachable).toBe(true);

    await proxy.cut();
    await beat();
    expect(neon.heartbeats.at(-1)?.dockerReachable).toBe(false);

    await proxy.restore();
    await beat();
    expect(neon.heartbeats.at(-1)?.dockerReachable).toBe(true);
  });

  it('starts syncing once Docker becomes reachable, if it was not at start', async () => {
    await proxy.cut();
    const name = runContainer('neon-agent-late', 'alpine', 'sleep', '600');
    agent = startAgent(neon, proxy);
    await agent.start();
    expect(neon.heartbeats.at(-1)?.dockerReachable).toBe(false);
    expect(neon.containerPosts).toHaveLength(0);

    await proxy.restore();
    await waitForState(name, (c) => c.status === 'running', 'running once Docker is reachable');
    const [gap] = await waitFor('a gap from start', () => neon.acceptedGaps.length === 1 && neon.acceptedGaps);
    expect(Date.parse(gap.to)).toBeGreaterThan(Date.parse(gap.from));
  });

  it('gives up on a hung Docker instead of holding up heartbeats and syncs', async () => {
    await startWatching();
    const beat = (agent as unknown as { sendHeartbeat(): Promise<void> }).sendHeartbeat.bind(agent);
    const limit = DOCKER_REQUEST_TIMEOUT_MS + 2000;

    proxy.freeze();
    let started = Date.now();
    await beat();
    expect(Date.now() - started).toBeLessThan(limit);
    expect(neon.heartbeats.at(-1)?.dockerReachable).toBe(false);

    // A sync gives up too, so later syncs are not queued behind it for ever.
    const posts = neon.containerPosts.length;
    started = Date.now();
    await agent!.syncContainers();
    expect(Date.now() - started).toBeLessThan(limit);
    expect(neon.containerPosts).toHaveLength(posts);

    proxy.thaw();
    await beat();
    expect(neon.heartbeats.at(-1)?.dockerReachable).toBe(true);
    const name = runContainer('neon-agent-thawed', 'alpine', 'sleep', '600');
    await waitForState(name, (c) => c.status === 'running', 'running once Docker answers again');
  });

  it('keeps retrying when Docker comes back hung after a restart', async () => {
    await startWatching();
    proxy.dropAndFreeze();
    // Longer than one connection attempt: a retry that waited for ever would never end.
    await new Promise((r) => setTimeout(r, DOCKER_REQUEST_TIMEOUT_MS + 1000));
    proxy.thaw();

    const name = runContainer('neon-agent-restarted', 'alpine', 'sleep', '600');
    await waitForState(name, (c) => c.status === 'running', 'running once Docker answers again');
    await waitFor('the gap reported', () => neon.acceptedGaps.length === 1);
  });
});
