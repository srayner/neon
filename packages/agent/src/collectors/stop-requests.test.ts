import { describe, expect, it } from 'vitest';
import { StopRequests, type DockerEventLike } from './stop-requests.js';
import fixture from './stop-requests.fixture.json' with { type: 'json' };

// Task criterion 4: a stop or kill is told apart from a container exiting by
// itself. The sequences are recorded from a real Docker daemon by
// scripts/record-docker-events.ts, never written by hand.

interface Scenario {
  scenario: string;
  expected: 'stop' | 'kill' | null;
  events: DockerEventLike[];
}

const scenarios = fixture.scenarios as Scenario[];

describe(`stop requests (events recorded from Docker ${fixture.dockerVersion})`, () => {
  it('has a recording for every kind of exit', () => {
    expect(scenarios.map((s) => s.expected)).toEqual(expect.arrayContaining(['stop', 'kill', null]));
    for (const s of scenarios) expect(s.events.some((e) => e.Action === 'die'), s.scenario).toBe(true);
  });

  // What a sync prompted by the final exit sees: every event up to and
  // including the last "die".
  it.each(scenarios.map((s) => [s.scenario, s] as const))('%s', (_name, s) => {
    const lastDie = s.events.map((e) => e.Action).lastIndexOf('die');
    const tracker = new StopRequests();
    for (const event of s.events.slice(0, lastDie + 1)) tracker.record(event);

    expect(tracker.get(s.events[0].Actor!.ID!)).toBe(s.expected);
  });

  it('forgets a container once Docker removes it', () => {
    const rmf = scenarios.find((s) => s.events.some((e) => e.Action === 'destroy'))!;
    const tracker = new StopRequests();
    for (const event of rmf.events) tracker.record(event);
    expect(tracker.get(rmf.events[0].Actor!.ID!)).toBeNull();
    expect((tracker as unknown as { requests: Map<string, unknown> }).requests.size).toBe(0);
  });

  it('keeps containers apart', () => {
    const stop = scenarios.find((s) => s.expected === 'stop')!;
    const kill = scenarios.find((s) => s.expected === 'kill')!;
    const tracker = new StopRequests();
    for (const event of [...stop.events, ...kill.events]) tracker.record(event);
    expect(tracker.get(stop.events[0].Actor!.ID!)).toBe('stop');
    expect(tracker.get(kill.events[0].Actor!.ID!)).toBe('kill');
  });

  it('ignores events that are not about containers', () => {
    const tracker = new StopRequests();
    tracker.record({ Type: 'network', Action: 'kill', Actor: { ID: 'abc' } });
    expect(tracker.get('abc')).toBeNull();
  });
});
