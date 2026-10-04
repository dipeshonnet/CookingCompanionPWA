import test from 'node:test';
import assert from 'node:assert/strict';
import { getActiveTimerEntries, getRemainingTimerFraction } from '../modules/active-timer-summary.js';
import { formatTimerClock } from '../modules/utils.js';

const idleSession = () => ({ recipeId: '', running: { 'Cook 1': null, 'Cook 2': null } });
const step = { order: 2, item: 'Rice', action: 'Simmer', duration: 120, timeLeft: 90 };

test('active timer summary includes both cooks and individual timers without mutating state', () => {
  const session = { recipeId: 'soup', running: { 'Cook 1': step, 'Cook 2': { ...step, order: 3, timeLeft: 30 } } };
  const individual = [{ id: 'tea-0', title: 'Tea', cookName: 'Cook 1', stepIndex: 0, totalDuration: 60, timeLeft: 20 }];
  const before = JSON.stringify({ session, individual });
  const entries = getActiveTimerEntries(session, individual, [{ id: 'soup', title: 'Rice Soup' }]);
  assert.equal(entries.length, 3);
  assert.deepEqual(entries.map(timer => timer.cookName), ['Cook 1', 'Cook 2', 'Cook 1']);
  assert.deepEqual(entries.map(timer => timer.timeLeft), [90, 30, 20]);
  assert.deepEqual(entries.map(timer => timer.source), ['play', 'play', 'individual']);
  assert.equal(entries[0].title, 'Rice Soup');
  assert.equal(entries[0].stepIndex, 2);
  assert.equal(JSON.stringify({ session, individual }), before);
});

test('idle, reset and completed sessions have no active timer entries', () => {
  assert.deepEqual(getActiveTimerEntries(idleSession(), [], []), []);
  assert.deepEqual(getActiveTimerEntries({ ...idleSession(), recipeId: 'soup', completed: [step] }, [], []), []);
});

test('single cook summaries do not add idle cooks or lose deleted recipe sessions', () => {
  const entries = getActiveTimerEntries({ recipeId: 'deleted', running: { 'Cook 1': step, 'Cook 2': null } }, [], []);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].title, 'Playing recipe');
  assert.equal(entries[0].stepLabel, 'Rice');
});

test('timer progress is constrained and cannot divide by zero', () => {
  assert.equal(getRemainingTimerFraction({ totalDuration: 120, timeLeft: 90 }), 0.75);
  assert.equal(getRemainingTimerFraction({ totalDuration: 1, timeLeft: 2 }), 1);
  assert.equal(getRemainingTimerFraction({ totalDuration: 1, timeLeft: -1 }), 0);
  for (const totalDuration of [0, -1, NaN, Infinity]) assert.equal(getRemainingTimerFraction({ totalDuration, timeLeft: 10 }), 0);
});

test('countdown formatting handles long recipes and invalid values', () => {
  assert.equal(formatTimerClock(5), '00:05');
  assert.equal(formatTimerClock(65), '01:05');
  assert.equal(formatTimerClock(6000), '100:00');
  for (const value of [-1, NaN, Infinity, undefined]) assert.equal(formatTimerClock(value), '00:00');
});
