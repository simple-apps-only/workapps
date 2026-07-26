import test from 'node:test';
import assert from 'node:assert/strict';
import { parseQueryTime } from './time.js';

test('UTC wall-clock input remains UTC', () => {
  assert.equal(
    parseQueryTime('2026-07-15T12:00:00', 'UTC').toISOString(),
    '2026-07-15T12:00:00.000Z',
  );
});

test('Pacific wall-clock input observes PST in winter', () => {
  assert.equal(
    parseQueryTime('2026-01-15T12:00:00', 'America/Los_Angeles').toISOString(),
    '2026-01-15T20:00:00.000Z',
  );
});

test('Pacific wall-clock input observes PDT in summer', () => {
  assert.equal(
    parseQueryTime('2026-07-15T12:00:00', 'America/Los_Angeles').toISOString(),
    '2026-07-15T19:00:00.000Z',
  );
});

test('relative times represent the same instant in either timezone', () => {
  const now = new Date('2026-07-15T20:00:00.000Z');
  assert.equal(
    parseQueryTime('now-1h', 'UTC', now).toISOString(),
    '2026-07-15T19:00:00.000Z',
  );
  assert.equal(
    parseQueryTime('now-1h', 'America/Los_Angeles', now).toISOString(),
    '2026-07-15T19:00:00.000Z',
  );
});

test('rejects a nonexistent Pacific time during the spring DST transition', () => {
  assert.throws(
    () => parseQueryTime('2026-03-08T02:30:00', 'America/Los_Angeles'),
    /does not exist/,
  );
});
