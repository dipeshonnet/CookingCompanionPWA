import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { APP_RECIPES } from '../recipes.js';
import { formatDurationLabel } from '../modules/recipe-domain.js';
import { buildRecipeSchedule } from '../modules/play-engine.js';
import { scaleRecipeForPortions } from '../modules/recipe-portions.js';
import { clientFiles } from '../tools/client-files.mjs';

test('durations use days, hours, minutes and seconds at unit boundaries', () => {
  for (const [seconds, expected] of [
    [0, 'No timer'], [30, '30 sec'], [60, '1 min'], [3599, '59 min 59 sec'],
    [3600, '1 hr'], [1129 * 60 + 30, '18 hr 49 min 30 sec'],
    [86400, '1 day'], [2 * 86400 + 3 * 3600 + 4 * 60, '2 days 3 hr 4 min']
  ]) assert.equal(formatDurationLabel(seconds), expected);
});

test('Idli uses a packaged finished-dish photo and includes overnight preparation in total time', async () => {
  const idli = APP_RECIPES.find(recipe => recipe.title === 'Idli');
  await access(idli.image);
  assert.ok((await clientFiles()).includes(idli.image), 'photo must be available offline');
  assert.match(idli.imageCredit, /Zeel Patel/);
  const schedule = buildRecipeSchedule(scaleRecipeForPortions(idli, 1));
  assert.ok(schedule.duration > 18 * 3600, 'total includes soaking and fermentation');
  assert.match(formatDurationLabel(schedule.duration), /^18 hr /);
});
