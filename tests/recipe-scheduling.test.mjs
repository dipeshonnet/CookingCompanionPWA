import test from 'node:test';
import assert from 'node:assert/strict';
import { APP_RECIPES } from '../recipes.js';
import { normalizeRecipeForStorage, validateRecipeSteps, hasCombinedCommands } from '../modules/recipe-domain.js';
import { createPlaySession, advancePlaySession, setAvailableCooks, buildRecipeSchedule, runningActions } from '../modules/play-engine.js';
import { getActiveTimerEntries } from '../modules/active-timer-summary.js';
import { toCloudRecords, mergePendingState } from '../modules/cloud-records.js';

const action = (id, duration = 10, dependsOn = [], attention = 'active', cook = 'Cook 1') => ({ id, title: `Prepare ${id}`, item: id, action: `Prepare ${id}.`, text: `Prepare ${id}.`, duration, dependsOn, attention, cook, stepType: 'Prep' });
const recipe = steps => ({ id: 'graph', title: 'Graph', stepSchemaVersion: 2, steps });
const get = (schedule, id) => schedule.steps.find(step => step.id === id);
const overlap = (a, b) => a.start < b.end && b.start < a.end;

test('all 108 curated recipes are valid single-action graphs with no unused branches', () => {
  assert.equal(APP_RECIPES.length, 108);
  for (const raw of APP_RECIPES) {
    const normalized = normalizeRecipeForStorage(raw);
    assert.equal(normalized.stepSchemaVersion, 2);
    const byId = new Map(normalized.steps.map(step => [step.id, step]));
    const ancestors = new Set();
    const visit = id => { if (ancestors.has(id)) return; ancestors.add(id); byId.get(id).dependsOn.forEach(visit); };
    visit(normalized.steps.at(-1).id);
    assert.equal(ancestors.size, normalized.steps.length, `${raw.title}: every action contributes to serving`);
    for (const step of normalized.steps) {
      assert.ok(step.title.length > 2 && !/^(step|task) \d/i.test(step.title));
      assert.equal(hasCombinedCommands(step.action), false, `${raw.title}: ${step.title}`);
    }
    for (const availableCooks of [1, 2]) {
      const schedule = buildRecipeSchedule(raw, { availableCooks });
      assert.equal(schedule.steps.length, normalized.steps.length);
      for (const step of schedule.steps) {
        for (const id of step.dependsOn) assert.ok(get(schedule, id).end <= step.start, `${raw.title}: prerequisite ${id}`);
        if (step.attention === 'active') {
          for (const other of schedule.steps) if (step !== other && step.assignedCook === other.assignedCook) assert.equal(overlap(step, other), false);
        }
      }
    }
  }
});

test('Poha has exact preparation times and independent chopping', () => {
  const poha = APP_RECIPES.find(r => r.id === 'handpicked-poha');
  const single = buildRecipeSchedule(poha);
  assert.deepEqual(['rinse', 'drain', 'soften', 'onion', 'chilli', 'coriander'].map(id => get(single, id).duration), [30, 15, 180, 90, 30, 60]);
  assert.equal(get(single, 'soften').start, 45);
  assert.equal(overlap(get(single, 'soften'), get(single, 'onion')), true);
  assert.equal(overlap(get(single, 'onion'), get(single, 'coriander')), false);
  assert.ok(['onion', 'chilli', 'coriander'].every(id => get(single, id).dependsOn.length === 0));
  const two = buildRecipeSchedule(poha, { availableCooks: 2 });
  assert.equal(overlap(get(two, 'onion'), get(two, 'coriander')), true);
  assert.ok(get(two, 'fold').start >= get(two, 'soften').end);
});

test('branching joins wait for all prerequisites regardless of cook order', () => {
  const session = createPlaySession(recipe([action('a', 5), action('b', 5), action('join', 3, ['a', 'b'])]), 1, 2);
  assert.equal(advancePlaySession(session, 0).started.length, 2);
  const events = advancePlaySession(session, 5000);
  assert.equal(events.completed.length, 2);
  assert.deepEqual(events.started.map(s => s.id), ['join']);
  assert.equal(events.started[0].timeLeft, 3);
  assert.equal(advancePlaySession(session, 8000).done, true);
});

test('multiple unattended waits run together without consuming the one cook', () => {
  const session = createPlaySession(recipe([action('setup'), action('rest', 60, ['setup'], 'passive'), action('soak', 30, ['setup'], 'passive'), action('chop', 20, ['setup'])]));
  advancePlaySession(session, 0);
  advancePlaySession(session, 10000);
  assert.equal(session.passiveRunning.length, 2);
  assert.equal(session.running['Cook 1'].id, 'chop');
  assert.equal(getActiveTimerEntries(session, [], []).length, 3);
  assert.equal(new Set(getActiveTimerEntries(session, [], []).map(t => t.id)).size, 3);
});

test('adding and removing a cook preserves in-flight work and retires Cook 2 after completion', () => {
  const session = createPlaySession(recipe([action('a', 30), action('b', 10), action('c', 10)]));
  advancePlaySession(session, 0);
  setAvailableCooks(session, 2);
  assert.equal(advancePlaySession(session, 1000).started[0].id, 'b');
  setAvailableCooks(session, 1);
  assert.equal(session.running['Cook 2'].id, 'b');
  assert.equal(advancePlaySession(session, 11000).started.length, 0);
  assert.equal(Object.hasOwn(session.running, 'Cook 2'), false);
  assert.equal(session.upcoming[0].id, 'c');
  advancePlaySession(session, 30000);
  assert.equal(session.running['Cook 1'].id, 'c');
});

test('adding back a retiring cook resumes its slot without duplicating work', () => {
  const session = createPlaySession(recipe([action('a'), action('b'), action('c')]), 1, 2);
  advancePlaySession(session, 0);
  setAvailableCooks(session, 1);
  setAvailableCooks(session, 2);
  assert.equal(advancePlaySession(session, 1000).started.length, 0);
  assert.equal(runningActions(session).length, 2);
  assert.equal(advancePlaySession(session, 10000).started[0].id, 'c');
});

test('experience affects only hands-on work and is frozen into the session', () => {
  const r = recipe([action('chop', 10), action('rest', 30, [], 'passive')]);
  const session = createPlaySession(r, 2);
  assert.deepEqual(session.upcoming.map(s => s.duration), [20, 30]);
  r.steps[0].duration = 100;
  advancePlaySession(session, 0);
  assert.equal(session.running['Cook 1'].duration, 20);
});

test('suspended callbacks never skip future tasks or shorten their full durations', () => {
  const session = createPlaySession(recipe([action('a', 5), action('b', 10, ['a']), action('c', 10, ['b'])]));
  advancePlaySession(session, 0);
  advancePlaySession(session, 60000);
  assert.deepEqual(session.completed.map(s => s.id), ['a']);
  assert.equal(session.running['Cook 1'].id, 'b');
  assert.equal(session.running['Cook 1'].timeLeft, 10);
  assert.equal(session.upcoming[0].id, 'c');
});

test('live projections preserve actual history, recalculate future work, and do not mutate the session', () => {
  const r = recipe([action('a', 10), action('b', 20), action('c', 10, ['a'])]);
  const session = createPlaySession(r);
  advancePlaySession(session, 100000);
  advancePlaySession(session, 110000);
  const before = JSON.stringify(session);
  const one = buildRecipeSchedule(r, { session, now: 115000 });
  assert.equal(JSON.stringify(session), before);
  assert.equal(get(one, 'a').start, 0);
  assert.equal(get(one, 'a').end, 10);
  assert.equal(get(one, 'b').start, 10);
  setAvailableCooks(session, 2);
  advancePlaySession(session, 115000);
  const two = buildRecipeSchedule(r, { session, now: 115000 });
  assert.equal(get(two, 'a').end, 10);
  assert.equal(get(two, 'b').start, 10);
  assert.equal(get(two, 'c').start, 15);
  assert.ok(two.duration < one.duration);
});

test('malformed graph data is rejected before playback or normalization', () => {
  const bad = [
    [action('a'), action('a')],
    [action('a', 10, ['missing'])],
    [action('a', 10, ['a'])],
    [action('a', 10, ['b']), action('b', 10, ['a'])],
    [action('a', 0)], [action('a', -1)], [action('a', Infinity)], [action('a', NaN)],
    [{ ...action('a'), duration: '5' }], [{ ...action('a'), title: '' }],
    [{ ...action('a'), attention: 'sometimes' }], [{ ...action('a'), dependsOn: 'a' }]
  ];
  for (const steps of bad) {
    assert.throws(() => validateRecipeSteps(steps));
    assert.throws(() => createPlaySession(recipe(steps)));
    assert.throws(() => normalizeRecipeForStorage(recipe(steps)));
  }
});

test('legacy recipes keep original instructions and use conservative sequential dependencies', () => {
  const original = { id: 'legacy', title: 'Legacy', cookCount: 4, steps: [{ cook: 'Cook 1', text: 'Rinse, drain, and soften.', duration: 30 }, { cook: 'Cook 4', text: 'Chop onion.', duration: 20 }] };
  const normalized = normalizeRecipeForStorage(original);
  assert.equal(normalized.steps[0].text, original.steps[0].text);
  assert.deepEqual(normalized.steps[1].dependsOn, ['action-1']);
  assert.deepEqual(normalized.steps.map(s => s.attention), ['active', 'active']);
  assert.deepEqual(normalizeRecipeForStorage(normalized), normalized);
  const schedule = buildRecipeSchedule(original, { availableCooks: 2 });
  assert.equal(schedule.steps[1].start, schedule.steps[0].end);
});

test('graph metadata survives JSON, storage normalization, cloud records and merges', () => {
  const r = normalizeRecipeForStorage(recipe([action('a'), action('b', 30, ['a'], 'passive')]));
  const restored = normalizeRecipeForStorage(JSON.parse(JSON.stringify(r)));
  assert.deepEqual(restored, r);
  const payload = { customRecipes: [restored], user: {}, pantry: [], scheduledMeals: {} };
  assert.deepEqual(toCloudRecords(payload).get('recipes/graph'), r);
  assert.deepEqual(mergePendingState(payload, payload, payload).customRecipes[0], r);
});

test('compound-command warnings distinguish ingredient lists from successive operations', () => {
  for (const text of ['Rinse the rice, then drain.', 'Chop onion and slice chilli.', 'Heat oil. Add onion.', 'Steam broccoli; chop onion.']) assert.equal(hasCombinedCommands(text), true, text);
  for (const text of ['Mix onion, chilli and coriander in a bowl.', 'Stir until thick and creamy.', 'Boil until tender.']) assert.equal(hasCombinedCommands(text), false, text);
});
