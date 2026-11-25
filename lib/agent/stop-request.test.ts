import { describe, expect, it } from 'vitest';
import { stopRequestToStore } from './stop-request';

// A stop request belongs to one exit. The agent forgets requests when it
// restarts, so a null for the exit already stored must not erase it.

const t1 = '2026-11-25T21:35:39.248Z';
const t2 = '2026-11-25T22:10:00.000Z';
const stored = (stopRequest: string | null, finishedAt: string | null = t1) => ({
  finishedAt: finishedAt ? new Date(finishedAt) : null,
  stopRequest,
});

describe('stopRequestToStore', () => {
  it.each([
    ['same exit, agent restarted and reports null: keep stop', stored('stop'), { finishedAt: t1, stopRequest: null }, 'stop'],
    ['same exit, agent restarted and reports null: keep kill', stored('kill'), { finishedAt: t1, stopRequest: null }, 'kill'],
    ['same exit, same time in another ISO form: keep', stored('stop'), { finishedAt: '2026-11-25T21:35:39.248+00:00', stopRequest: null }, 'stop'],
    ['new exit with no request: null', stored('stop'), { finishedAt: t2, stopRequest: null }, null],
    ['new exit with a request: the new request', stored('stop'), { finishedAt: t2, stopRequest: 'kill' }, 'kill'],
    ['a reported request always wins', stored(null), { finishedAt: t1, stopRequest: 'stop' }, 'stop'],
    ['nothing stored yet: what is reported', undefined, { finishedAt: t1, stopRequest: null }, null],
    ['never exited (no finishedAt): null', stored('stop', null), { finishedAt: null, stopRequest: null }, null],
  ] as const)('%s', (_label, before, reported, expected) => {
    expect(stopRequestToStore(before, reported)).toBe(expected);
  });
});
