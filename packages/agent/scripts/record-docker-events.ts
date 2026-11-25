/**
 * Records the Docker event sequences that the stop-request unit tests replay
 * (docs/alerts.md 8.2: sequences come from a real Docker daemon, never written
 * by hand). Re-run after a Docker upgrade and commit the new fixture:
 *
 *   npx tsx packages/agent/scripts/record-docker-events.ts
 *
 * Uses only throwaway alpine containers labelled neon-test=record, removed at
 * the end.
 */
import { execFileSync } from 'child_process';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import Docker from 'dockerode';

const docker = new Docker();
const LABEL = 'neon-test=record';
const OUT = fileURLToPath(new URL('../src/collectors/stop-requests.fixture.json', import.meta.url));

function sh(...args: string[]): string {
  return execFileSync('docker', args, { encoding: 'utf8' }).trim();
}
function run(name: string, ...args: string[]): string {
  return sh('run', '-d', '--name', name, '--label', LABEL, ...args);
}
/** Removes containers, ignoring ones already gone (docker rm -f removes its own). */
function remove(...names: string[]): void {
  try {
    execFileSync('docker', ['rm', '-f', ...names], { stdio: 'ignore' });
  } catch {
    // already removed
  }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Each scenario ends with the container no longer running, and says what a
// correct tracker reports for that exit.
const scenarios: { name: string; expected: 'stop' | 'kill' | null; act: (n: string) => Promise<void> }[] = [
  { name: 'docker stop', expected: 'stop', act: async (n) => { run(n, 'alpine', 'sh', '-c', 'trap "exit 0" TERM; sleep 600 & wait'); await sleep(500); sh('stop', n); } },
  { name: 'docker stop, timeout then SIGKILL', expected: 'stop', act: async (n) => { run(n, 'alpine', 'sleep', '600'); sh('stop', '-t', '1', n); } },
  { name: 'docker kill', expected: 'kill', act: async (n) => { run(n, 'alpine', 'sleep', '600'); sh('kill', n); } },
  { name: 'docker rm -f', expected: 'kill', act: async (n) => { run(n, 'alpine', 'sleep', '600'); sh('rm', '-f', n); } },
  { name: 'crash (exit 3)', expected: null, act: async (n) => { run(n, 'alpine', 'sh', '-c', 'sleep 1; exit 3'); await sleep(2500); } },
  { name: 'out of memory', expected: null, act: async (n) => { run(n, '--memory', '8m', '--memory-swap', '8m', 'alpine', 'sh', '-c', 'tail /dev/zero'); await sleep(4000); } },
  { name: 'docker restart, then crash', expected: null, act: async (n) => { run(n, 'alpine', 'sh', '-c', 'sleep 3; exit 2'); sh('restart', '-t', '1', n); await sleep(4500); } },
  { name: 'docker stop, start, then crash', expected: null, act: async (n) => { run(n, 'alpine', 'sh', '-c', 'sleep 2; exit 4'); sh('stop', '-t', '1', n); sh('start', n); await sleep(3500); } },
];

async function main() {
  const version = (await docker.version()).Version;
  const recorded = [];

  for (const [i, scenario] of scenarios.entries()) {
    const name = `neon-record-${i}`;
    const abort = new AbortController();
    const events: unknown[] = [];
    const stream = await docker.getEvents({ filters: { label: [LABEL], type: ['container'] }, abortSignal: abort.signal });
    stream.on('data', (chunk: Buffer) => {
      for (const line of chunk.toString().split('\n').filter(Boolean)) {
        const e = JSON.parse(line);
        const { name: n, exitCode, signal, health_status } = e.Actor.Attributes;
        events.push({ Type: e.Type, Action: e.Action, Actor: { ID: e.Actor.ID, Attributes: { name: n, exitCode, signal, health_status } } });
      }
    });
    stream.on('error', () => {});
    await sleep(300);
    await scenario.act(name);
    await sleep(500);
    abort.abort();
    remove(name);
    recorded.push({ scenario: scenario.name, expected: scenario.expected, events });
    console.log(`${scenario.name}: ${events.map((e) => (e as { Action: string }).Action).join(', ')}`);
  }

  writeFileSync(OUT, JSON.stringify({ dockerVersion: version, recordedAt: new Date().toISOString(), scenarios: recorded }, null, 2) + '\n');
  console.log(`Wrote ${OUT} (Docker ${version})`);
}

main().catch((error) => {
  console.error(error);
  remove(...scenarios.map((_, i) => `neon-record-${i}`));
  process.exit(1);
});
