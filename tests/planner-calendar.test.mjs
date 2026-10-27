import test from 'node:test';
import assert from 'node:assert/strict';
import { dateKey, parseDate, weekDates, migrateWeeklyMeals, futureMeals } from '../modules/planner-calendar.js';
import { mergePendingState, toCloudRecords } from '../modules/cloud-records.js';

test('calendar weeks start Monday and cross month and year boundaries', () => {
  assert.deepEqual(weekDates(new Date(2027, 0, 3)).map(dateKey), ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03']);
  assert.equal(parseDate('2026-02-30'), null);
  assert.equal(parseDate('garbage'), null);
  assert.equal(dateKey(parseDate('2028-02-29')), '2028-02-29');
});

test('legacy rotation becomes dated once and never overrides a dated meal', () => {
  const monday = { recipeId: 'r1', portions: 2 };
  const dated = { recipeId: 'r2', portions: 3 };
  const result = migrateWeeklyMeals({ 'Monday-Lunch': monday, 'Tuesday-Dinner': monday, '2026-10-27-Dinner': dated }, new Date(2026, 9, 27));
  assert.deepEqual(result, { '2026-10-26-Lunch': monday, '2026-10-27-Dinner': dated });
  assert.deepEqual(migrateWeeklyMeals(result, new Date(2026, 10, 5)), result);
});

test('shopping includes only days after today, across every saved week', () => {
  assert.deepEqual(futureMeals({ '2026-10-26-Lunch': 'past', '2026-10-27-Lunch': 'today', '2026-10-28-Dinner': 'tomorrow', '2026-11-10-Breakfast': 'later', 'Monday-Lunch': 'undated', '2026-02-30-Lunch': 'invalid', '2026-11-10-Other': 'invalid-slot' }, new Date(2026, 9, 27)), ['tomorrow', 'later']);
});

test('dated weeks and portions round trip through account records and merge independently', () => {
  const original = { user: {}, scheduledMeals: { '2026-10-28-Dinner': { recipeId: 'r1', portions: 2 }, '2026-11-04-Dinner': { recipeId: 'r2', portions: 4 } } };
  const local = structuredClone(original);
  delete local.scheduledMeals['2026-10-28-Dinner'];
  const records = toCloudRecords(original);
  assert.deepEqual(records.get('meals/2026-11-04-Dinner'), { recipeId: 'r2', portions: 4 });
  assert.deepEqual(mergePendingState(original, original, local).scheduledMeals, { '2026-11-04-Dinner': { recipeId: 'r2', portions: 4 } });
});
