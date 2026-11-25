import { execFileSync } from 'child_process';
import { createServer as createHttpServer, type Server as HttpServer } from 'http';
import { createConnection, createServer, type Server, type Socket } from 'net';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import Docker from 'dockerode';
import type { AddressInfo } from 'net';
import type { ContainerInfo, DockerGap } from '@neon/shared';
import { MasterClient } from '../transport/client.js';
import { Scheduler } from '../scheduler.js';
import type { AgentConfig } from '../config.js';

// Shared by the real-Docker tests (*.docker.test.ts): a fake Neon that records
// what the agent sends, a proxy in front of the Docker socket that a test can
// cut and restore, and helpers for labelled test containers.

export const LABEL = 'neon-test=agent';
const DOCKER_SOCKET = '/var/run/docker.sock';

/** Runs the docker CLI against the real daemon (not through the proxy). */
export function docker(...args: string[]): string {
  return execFileSync('docker', args, { encoding: 'utf8' }).trim();
}

/** Starts a labelled test container and returns its name. */
export function runContainer(name: string, ...args: string[]): string {
  docker('run', '-d', '--name', name, '--label', LABEL, ...args);
  return name;
}

export function removeTestContainers(): void {
  const ids = docker('ps', '-aq', '--filter', `label=${LABEL}`).split('\n').filter(Boolean);
  if (ids.length) execFileSync('docker', ['rm', '-f', ...ids], { stdio: 'ignore' });
}

/** Waits until `check` returns a value, or fails with `what`. */
export async function waitFor<T>(what: string, check: () => T | undefined | null | false, timeoutMs = 20_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = check();
    if (value) return value;
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 100));
  }
}

/** A stand-in for Neon's agent API that records every request. */
export class FakeNeon {
  containerPosts: { at: number; containers: ContainerInfo[] }[] = [];
  heartbeats: { dockerReachable: boolean }[] = [];
  gapPosts: DockerGap[][] = [];
  acceptedGaps: DockerGap[] = [];
  /** How many of the next docker-gaps posts to reject with a 500. */
  rejectGaps = 0;
  private server: HttpServer;
  url = '';

  constructor() {
    this.server = createHttpServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        const data = body ? JSON.parse(body) : {};
        const reply = (status: number, json: unknown) => {
          res.writeHead(status, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(json));
        };
        switch (req.url) {
          case '/api/agent/register':
            return reply(200, { success: true, data: { serverId: 1, token: 'test-token' } });
          case '/api/agent/heartbeat':
            this.heartbeats.push(data);
            return reply(200, { success: true, data: { serverTime: new Date().toISOString(), tokenExpiresIn: 86_400 } });
          case '/api/agent/metrics':
            return reply(200, { success: true });
          case '/api/agent/containers':
            this.containerPosts.push({ at: Date.now(), containers: data.containers });
            return reply(200, { success: true });
          case '/api/agent/docker-gaps':
            this.gapPosts.push(data.gaps);
            if (this.rejectGaps > 0) {
              this.rejectGaps--;
              return reply(500, { success: false, error: 'test: Neon failing' });
            }
            this.acceptedGaps.push(...data.gaps);
            return reply(200, { success: true });
          default:
            return reply(404, { success: false, error: `unexpected ${req.url}` });
        }
      });
    });
  }

  async start(): Promise<void> {
    await new Promise<void>((r) => this.server.listen(0, '127.0.0.1', r));
    this.url = `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
  }

  async stop(): Promise<void> {
    this.server.closeAllConnections();
    await new Promise((r) => this.server.close(r));
  }

  /** The test containers in the latest container post. */
  latest(): ContainerInfo[] {
    const post = this.containerPosts.at(-1);
    return (post?.containers ?? []).filter((c) => c.labels['neon-test'] === 'agent');
  }

  latestFor(name: string): ContainerInfo | undefined {
    return this.latest().find((c) => c.name === name);
  }
}

/**
 * A Unix socket that forwards to the Docker socket, so a test can make Docker
 * go away or hang without touching the real daemon:
 * - cut() / restore(): Docker goes away (connections closed, none accepted).
 * - freeze() / thaw(): Docker hangs: open connections stop moving, new ones
 *   are accepted but not answered. thaw() lets everything through again.
 * - dropAndFreeze(): Docker restarts and comes back hung: open connections
 *   close, new ones are accepted but not answered, until thaw().
 */
export class DockerProxy {
  private dir = mkdtempSync(join(tmpdir(), 'neon-agent-test-'));
  readonly path = join(this.dir, 'docker.sock');
  private server: Server | null = null;
  private pairs = new Set<{ client: Socket; upstream: Socket }>();
  private frozen = false;
  /** Container list requests seen: one per sync, whether or not it succeeds. */
  listRequests = 0;

  async restore(): Promise<void> {
    this.server = createServer((client) => {
      const upstream = createConnection(DOCKER_SOCKET);
      const pair = { client, upstream };
      this.pairs.add(pair);
      for (const s of [client, upstream]) {
        s.on('error', () => {});
        s.on('close', () => {
          this.pairs.delete(pair);
          client.destroy();
          upstream.destroy();
        });
      }
      client.on('data', (chunk: Buffer) => {
        if (/^GET \/[^ ]*containers\/json/m.test(chunk.toString('latin1'))) this.listRequests++;
      });
      if (!this.frozen) this.connect(pair);
    });
    await new Promise<void>((r) => this.server!.listen(this.path, r));
  }

  private connect({ client, upstream }: { client: Socket; upstream: Socket }): void {
    client.pipe(upstream);
    upstream.pipe(client);
  }

  freeze(): void {
    this.frozen = true;
    for (const { client, upstream } of this.pairs) {
      client.unpipe(upstream);
      upstream.unpipe(client);
    }
  }

  dropAndFreeze(): void {
    this.frozen = true;
    for (const { client, upstream } of this.pairs) {
      client.destroy();
      upstream.destroy();
    }
    this.pairs.clear();
  }

  thaw(): void {
    this.frozen = false;
    for (const pair of this.pairs) this.connect(pair);
  }

  async cut(): Promise<void> {
    for (const { client, upstream } of this.pairs) {
      client.destroy();
      upstream.destroy();
    }
    this.pairs.clear();
    await new Promise((r) => (this.server ? this.server.close(r) : r(undefined)));
    this.server = null;
  }

  async close(): Promise<void> {
    await this.cut();
    rmSync(this.dir, { recursive: true, force: true });
  }
}

/** An agent talking to `neon`, and to Docker through `proxy`. */
export function startAgent(neon: FakeNeon, proxy: DockerProxy, overrides: Partial<AgentConfig> = {}) {
  const config: AgentConfig = {
    serverName: 'docker-test',
    masterUrl: neon.url,
    agentSecret: 'test',
    // Long intervals: in these tests only Docker events prompt a sync.
    metricsIntervalSeconds: 3600,
    containersIntervalSeconds: 3600,
    heartbeatIntervalSeconds: 3600,
    bufferEnabled: false,
    bufferMaxSize: 1,
    retryAttempts: 1,
    retryDelayMs: 0,
    ...overrides,
  };
  const scheduler = new Scheduler(config, new MasterClient(config, 'test'), new Docker({ socketPath: proxy.path }));
  return scheduler;
}
