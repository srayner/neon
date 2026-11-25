import { randomUUID } from 'crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signAgentToken } from '@/lib/auth/jwt';
import { POST as register } from './register/route';
import { POST as heartbeat } from './heartbeat/route';
import { POST as dockerGaps } from './docker-gaps/route';
import { POST as containersReport } from './containers/route';

// docs/alerts.md section 2: the facts an agent reports about itself, stored by
// Neon. Runs against the dev database on a server created for this file and
// deleted afterwards (its activity entries go with it).

// Secrets for this process only; the routes sign and verify with the same one.
process.env.JWT_SECRET = `vitest-${randomUUID()}`;
process.env.AGENT_SECRET = `vitest-${randomUUID()}`;

const serverName = `vitest-agent-facts-${randomUUID()}`;
let serverId: number;
let token: string;

const serverInfo = {
  name: serverName,
  hostname: 'vitest-host',
  cpuCores: 4,
  totalMemoryGb: 8,
  totalDiskGb: 100,
  osName: 'Ubuntu 24.04',
  osVersion: '24.04',
  osKernel: '6.8.0',
  osArch: 'x64',
  dockerVersion: '29.6.2',
  heartbeatIntervalSeconds: 45,
};

function post(path: string, body: unknown, headers: Record<string, string>) {
  return new NextRequest(`http://localhost:3005/api/agent/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

const asAgent = () => ({ Authorization: `Bearer ${token}` });

async function registerWith(info: Record<string, unknown>) {
  const res = await register(
    post('register', { serverName, serverInfo: info, agentVersion: 'test' }, { 'X-Agent-Secret': process.env.AGENT_SECRET! }),
  );
  expect(res.status).toBe(200);
  return prisma.server.findUniqueOrThrow({ where: { name: serverName } });
}

beforeAll(async () => {
  const server = await registerWith(serverInfo);
  serverId = server.id;
  token = await signAgentToken({ serverId, serverName });
});

afterAll(async () => {
  await prisma.server.deleteMany({ where: { name: serverName } });
  await prisma.$disconnect();
});

// Registration (docs/alerts.md 7.3: H1 uses each server's own interval).
describe('registering', () => {
  it('stores the heartbeat interval the agent sends', async () => {
    const server = await registerWith({ ...serverInfo, heartbeatIntervalSeconds: 90 });
    expect(server.heartbeatIntervalSeconds).toBe(90);
  });

  it.each([
    ['missing (older agent)', undefined],
    ['not a whole number', 1.5],
    ['zero', 0],
    ['text', '60'],
  ])('stores no interval when it is %s', async (_label, value) => {
    const server = await registerWith({ ...serverInfo, heartbeatIntervalSeconds: value });
    expect(server.heartbeatIntervalSeconds).toBeNull();
  });
});

// Docker reachability arrives on every heartbeat; the changed-at time moves
// only when the value changes.
describe('heartbeat Docker reachability', () => {
  async function beat(body: Record<string, unknown>) {
    const res = await heartbeat(post('heartbeat', { timestamp: new Date().toISOString(), agentVersion: 'test', ...body }, asAgent()));
    expect(res.status).toBe(200);
    return prisma.server.findUniqueOrThrow({ where: { id: serverId } });
  }

  it('records the value, and the time only when it changes', async () => {
    const first = await beat({ dockerReachable: true });
    expect(first.dockerReachable).toBe(true);
    expect(first.dockerReachableChangedAt).toBeInstanceOf(Date);

    const same = await beat({ dockerReachable: true });
    expect(same.dockerReachableChangedAt).toEqual(first.dockerReachableChangedAt);

    const lost = await beat({ dockerReachable: false });
    expect(lost.dockerReachable).toBe(false);
    expect(lost.dockerReachableChangedAt!.getTime()).toBeGreaterThan(first.dockerReachableChangedAt!.getTime());
  });

  it('leaves the stored value alone when an older agent leaves it out', async () => {
    const before = await beat({ dockerReachable: true });
    const after = await beat({});
    expect(after.dockerReachable).toBe(true);
    expect(after.dockerReachableChangedAt).toEqual(before.dockerReachableChangedAt);
  });
});

// Gaps in the agent's view of Docker become activity entries, once each.
describe('Docker gaps', () => {
  const gapActivities = () =>
    prisma.activity.findMany({
      where: { serverId, eventType: 'monitoring_gap' },
      orderBy: { id: 'asc' },
    });

  async function send(gaps: unknown) {
    return dockerGaps(post('docker-gaps', { gaps }, asAgent()));
  }

  it('records each gap with its times, and a resent gap only once', async () => {
    const gaps = [
      { from: '2026-11-25T14:02:00.000Z', to: '2026-11-25T14:05:30.000Z' },
      { from: '2026-11-25T15:00:00.000Z', to: '2026-11-25T15:00:10.000Z' },
    ];
    expect((await send(gaps)).status).toBe(200);
    // Resent after a lost reply, the first in another ISO form of the same time.
    expect((await send([{ from: '2026-11-25T14:02:00+00:00', to: '2026-11-25T14:05:30Z' }, gaps[1]])).status).toBe(200);

    const rows = await gapActivities();
    expect(rows.map((r) => [r.type, r.entityType, r.message, r.metadata])).toEqual([
      ['warning', 'server', 'Lost contact with Docker from 14:02 UTC on 25 Nov 2026 to 14:05 UTC on 25 Nov 2026', gaps[0]],
      ['warning', 'server', 'Lost contact with Docker from 15:00 UTC on 25 Nov 2026 to 15:00 UTC on 25 Nov 2026', gaps[1]],
    ]);
  });

  it('records a gap sent twice at once only once', async () => {
    const gap = { from: '2026-11-25T16:00:00.000Z', to: '2026-11-25T16:01:00.000Z' };
    const results = await Promise.all([send([gap]), send([gap])]);
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect((await gapActivities()).filter((r) => (r.metadata as { from: string }).from === gap.from)).toHaveLength(1);
  });

  let validGapHour = 0;

  // An invalid gap is skipped, not rejected: the agent resends a rejected
  // batch for ever, so one bad gap would hold back every later one.
  it.each([
    ['a gap without "to"', { from: '2026-11-25T17:00:00Z' }],
    ['a time that is not a date', { from: 'yesterday', to: '2026-11-25T17:00:00Z' }],
    ['a gap ending before it starts (clock stepped back)', { from: '2026-11-25T17:00:00Z', to: '2026-11-25T16:00:00Z' }],
    ['not an object', 'gap'],
  ])('accepts a batch with %s, recording only the valid gaps', async (_label, bad) => {
    const before = (await gapActivities()).length;
    // A different valid gap for each row of the table.
    const hour = String(++validGapHour).padStart(2, '0');
    const valid = { from: `2026-11-26T${hour}:00:00.000Z`, to: `2026-11-26T${hour}:01:00.000Z` };
    expect((await send([bad, valid])).status).toBe(200);

    const rows = await gapActivities();
    expect(rows).toHaveLength(before + 1);
    expect(rows.at(-1)!.metadata).toEqual(valid);
  });

  it('rejects a request with no gaps array', async () => {
    const before = (await gapActivities()).length;
    expect((await send(undefined)).status).toBe(400);
    expect(await gapActivities()).toHaveLength(before);
  });

  it('rejects a request without a valid token', async () => {
    const res = await dockerGaps(post('docker-gaps', { gaps: [] }, { Authorization: 'Bearer not-a-token' }));
    expect(res.status).toBe(401);
  });
});

// An exit's stop request survives an agent restart (the agent forgets it).
describe('container stop requests', () => {
  const exited = (overrides: Record<string, unknown>) => ({
    containerId: 'vitestexit01',
    name: 'vitest-exit',
    image: 'alpine:3.20',
    imageId: null,
    imageTags: ['alpine:3.20'],
    status: 'exited',
    health: null,
    ports: '-',
    labels: {},
    networks: [],
    startedAt: '2026-11-25T21:00:00.000Z',
    finishedAt: '2026-11-25T21:35:39.248Z',
    exitCode: 137,
    oomKilled: false,
    restartCount: 0,
    stopRequest: 'stop',
    ...overrides,
  });

  async function report(container: Record<string, unknown>) {
    expect((await containersReport(post('containers', { containers: [container] }, asAgent()))).status).toBe(200);
    return prisma.container.findUniqueOrThrow({
      where: { serverId_containerId: { serverId, containerId: 'vitestexit01' } },
    });
  }

  it('keeps the stored request for the same exit, and clears it for a new one', async () => {
    expect((await report(exited({}))).stopRequest).toBe('stop');
    // Agent restarted: same exit, request forgotten.
    expect((await report(exited({ stopRequest: null }))).stopRequest).toBe('stop');
    // A later exit by itself.
    const crashed = await report(exited({ stopRequest: null, finishedAt: '2026-11-25T22:10:00.000Z', exitCode: 1 }));
    expect(crashed).toMatchObject({ stopRequest: null, exitCode: 1, oomKilled: false, restartCount: 0 });
  });
});
