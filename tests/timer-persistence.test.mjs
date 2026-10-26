import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlaySession, advancePlaySession } from '../modules/play-engine.js';
import { serializeCookingState, restoreCookingState, emptyPlaySession } from '../modules/cooking-state.js';
import { diffCloudRecords, toCloudRecords, mergePendingState } from '../modules/cloud-records.js';

const recipe = { id: 'soup', title: 'Soup', stepSchemaVersion: 2, steps: [
  { id: 'chop', title: 'Chop', item: 'Carrots', action: 'Chop carrots', cook: 'Cook 1', attention: 'active', dependsOn: [], duration: 120 },
  { id: 'wait', title: 'Simmer', item: 'Soup', action: 'Simmer soup', attention: 'passive', dependsOn: [], duration: 180 },
  { id: 'serve', title: 'Serve', item: 'Soup', action: 'Serve soup', cook: 'Cook 1', attention: 'active', dependsOn: ['chop', 'wait'], duration: 30 }
] };
const timer = { id: 'tea', title: 'Tea', stepIndex: 0, cookName: 'Cook 1', stepLabel: 'Steep', attention: 'passive', totalDuration: 60, deadline: 61000, timeLeft: 60, intervalId: 41 };

test('cooking snapshots preserve deadlines and progress without browser handles or media', () => {
  const session = createPlaySession(recipe, 1, 2);
  advancePlaySession(session, 1000);
  session.intervalId = 42;
  session.running['Cook 1'].videoUrl = 'blob:private';
  session.running['Cook 1'].videoLoading = true;
  const saved = serializeCookingState([timer], session);
  assert.doesNotMatch(JSON.stringify(saved), /intervalId|videoUrl|videoLoading|timeLeft|lastBeep|blob:/);
  const restored = restoreCookingState(saved, 31000);
  assert.equal(restored.activeTimers[0].timeLeft, 30);
  assert.equal(restored.activeTimers[0].deadline, timer.deadline);
  assert.equal(restored.playSession.running['Cook 1'].timeLeft, 90);
  assert.equal(restored.playSession.passiveRunning[0].timeLeft, 150);
  assert.equal(restored.playSession.upcoming[0].id, 'serve');
  assert.equal(restored.playSession.availableCooks, 2);
  assert.equal(restored.playSession.intervalId, null);
  assert.equal(restored.playSession.running['Cook 1'].videoUrl, '');
});

test('expired saved timers complete on return and future recipe actions retain their full time', () => {
  const session = createPlaySession(recipe);
  advancePlaySession(session, 1000);
  const restored = restoreCookingState(serializeCookingState([timer], session), 200000);
  assert.equal(restored.activeTimers[0].timeLeft, 0);
  const events = advancePlaySession(restored.playSession, 200000);
  assert.deepEqual(events.completed.map(s => s.id).sort(), ['chop', 'wait']);
  assert.equal(restored.playSession.running['Cook 1'].id, 'serve');
  assert.equal(restored.playSession.running['Cook 1'].timeLeft, 30);
  assert.equal(restored.playSession.running['Cook 1'].deadline, 230000);
});

test('clock ticks do not produce cloud writes, but cancellation deletes the cooking record', () => {
  const session = createPlaySession(recipe);
  advancePlaySession(session, 1000);
  const before = toCloudRecords({ cooking: serializeCookingState([timer], session) });
  advancePlaySession(session, 31000);
  assert.deepEqual(diffCloudRecords(before, toCloudRecords({ cooking: serializeCookingState([{ ...timer, timeLeft: 30 }], session) })), []);
  assert.deepEqual(diffCloudRecords(before, toCloudRecords({ cooking: serializeCookingState([], emptyPlaySession()) })), [{ path: 'app/cooking', remove: true }]);
});

test('offline merge retains remote timers for unrelated edits and applies explicit cancellations', () => {
  const base = { user: {}, pantry: [], customRecipes: [], scheduledMeals: {} };
  const remote = { ...base, cooking: serializeCookingState([timer], emptyPlaySession()) };
  const local = { ...base, pantry: [{ id: 'rice', name: 'Rice' }], cooking: serializeCookingState([], emptyPlaySession()) };
  const merged = mergePendingState(remote, base, local);
  assert.equal(merged.cooking.activeTimers[0].id, 'tea');
  assert.equal(merged.pantry[0].id, 'rice');
  const canceled = mergePendingState(remote, remote, { ...remote, cooking: local.cooking });
  assert.equal(canceled.cooking, undefined);
});

test('legacy and invalid cooking caches restore to an idle session', () => {
  for (const saved of [undefined, null, {}, { activeTimers: 'bad', playSession: { recipeId: 'broken' } }]) {
    assert.deepEqual(restoreCookingState(saved), { activeTimers: [], playSession: emptyPlaySession() });
  }
});
