import { scaleRecipeForPortions, normalizePortions, formatIngredientAmount, RecipeActionLimitError } from './recipe-portions.js';
import { actionVideoHtml, inferActionType } from './action-types.js';
import { createPlaySession, advancePlaySession, setAvailableCooks, normalizeAvailableCooks } from './play-engine.js';
import { getAudioContext, playShortBeep, startPlayBackgroundMusic, stopPlayBackgroundMusic, speakPlayStep, ensurePlayStepVideo } from './play-media.js';
import { getExperienceTimerMultiplier } from './profile.js';
import { getAllRecipes, getVisibleRecipes, formatDurationLabel, processLabel } from './recipe-domain.js';
import { STATE, RUNTIME } from './state.js';
import { escapeHtml, formatTimerClock } from './utils.js';
import { renderActiveTimers } from './timers.js';
import { ingredientLabel } from './ingredient-images.js';
import { renderRecipeTimeline } from './recipe-timeline.js';
import { switchView } from './navigation.js';
import { saveStateToStorage } from './storage.js';

export { formatTimerClock } from './utils.js';

export function renderPlayRecipeView() {
  const select = document.getElementById('play-recipe-select');
  const selected = RUNTIME.playSession.recipeId || select.value;
  select.innerHTML = '<option value="">-- Select Recipe --</option>';
  for (const recipe of getVisibleRecipes()) {
    const option = document.createElement('option');
    option.value = recipe.id;
    option.textContent = `[${recipe.category}] ${recipe.title}`;
    select.appendChild(option);
  }
  if (RUNTIME.playSession.recipeId && ![...select.options].some(option => option.value === selected)) {
    const recipe = getAllRecipes().find(recipe => recipe.id === selected);
    select.appendChild(new Option(recipe ? `[${recipe.category}] ${recipe.title}` : 'Current cooking session', selected));
  }
  select.value = [...select.options].some(option => option.value === selected) ? selected : '';
  if (RUNTIME.playSession.recipeId) {
    document.getElementById('play-cook-count').value = String(RUNTIME.playSession.availableCooks);
    document.getElementById('play-portions').value = String(RUNTIME.playSession.portions || 1);
  }
  renderPlayBoards();
}

export function stepCardHtml(step, withTimer = false) {
  const video = withTimer && STATE.user.playStepVideo ? actionVideoHtml(step.actionType ?? inferActionType(step.action)) : '';
  return `<div class="play-step-card">
    <div class="play-step-title">${escapeHtml(step.title || step.action)}</div>
    <div class="play-step-text">${escapeHtml(step.action)}</div>${video}
    <div class="play-step-meta">${ingredientLabel(step.item)}</div>
    <div class="play-step-meta"><span>${escapeHtml(processLabel(step.cook))} · ${escapeHtml(step.stepType)} · ${step.attention === 'passive' ? 'Unattended' : 'Hands-on'}</span>
    <span ${withTimer ? 'data-play-countdown' : ''}>${withTimer ? formatTimerClock(step.timeLeft) : formatDurationLabel(step.duration)}</span></div>
    ${step.waitingReason ? `<p class="play-step-waiting">${escapeHtml(step.waitingReason)}</p>` : ''}
  </div>`;
}

function reconcileColumn(id, steps, timed, emptyText) {
  const column = document.getElementById(id);
  if (!column) return;
  // Timer-only changes preserve video elements and playback position.
  const signature = JSON.stringify([steps.map(step => [step.id, step.title, step.item, step.action, step.duration, step.cook, step.attention, step.actionType, step.waitingReason, step.videoUrl, step.videoLoading]), STATE.user.playStepVideo]);
  if (column.dataset.signature !== signature) {
    column.innerHTML = steps.length ? steps.map(step => stepCardHtml(step, timed)).join('') : `<p class="play-empty">${emptyText}</p>`;
    column.dataset.signature = signature;
  }
  if (timed) [...column.querySelectorAll('[data-play-countdown]')].forEach((countdown, index) => {
    const text = formatTimerClock(steps[index].timeLeft);
    if (countdown.textContent !== text) countdown.textContent = text;
  });
}

export function renderPlayBoards() {
  const session = RUNTIME.playSession;
  const recipes = session.recipeId ? getAllRecipes() : getVisibleRecipes();
  const source = recipes.find(recipe => recipe.id === (session.recipeId || document.getElementById('play-recipe-select')?.value));
  const portions = session.recipeId ? (session.portions || 1) : normalizePortions(document.getElementById('play-portions')?.value);
  let recipe = null, portionError = '';
  try { recipe = source ? scaleRecipeForPortions(source, portions) : null; }
  catch (error) {
    if (!(error instanceof RecipeActionLimitError)) throw error;
    portionError = error.message;
  }
  const portionInput = document.getElementById('play-portions');
  portionInput.value = String(portions);
  portionInput.disabled = Boolean(session.recipeId);
  document.querySelectorAll('[data-portion-target="play-portions"]').forEach(button => { button.disabled = Boolean(session.recipeId) || (button.dataset.portionDelta === '-1' && portions === 1); });
  // Only a running session owns frozen quantities; empty legacy snapshots
  // must not hide the selected recipe's ingredients.
  const ingredients = session.recipeId && session.ingredients?.length ? session.ingredients : recipe?.ingredients || [];
  const ingredientList = document.getElementById('play-portion-ingredients');
  ingredientList.innerHTML = ingredients.map(ing => `<li>${escapeHtml(formatIngredientAmount(ing))} ${escapeHtml(ing.name)}</li>`).join('');
  ingredientList.hidden = ingredients.length === 0;
  const emptyIngredients = document.getElementById('play-ingredients-empty');
  emptyIngredients.hidden = ingredients.length > 0;
  emptyIngredients.textContent = source || session.recipeId ? 'No ingredients have been added to this recipe.' : 'Choose a recipe to see its ingredients.';
  document.getElementById('play-portion-note').textContent = portionError || (session.recipeId ? `Cooking for ${portions} ${portions === 1 ? 'person' : 'people'}. Reset cooking to change portions.` : recipe?.timingIsOriginal ? 'Actions without portion-specific timing rules keep their original estimates.' : '1 portion serves 1 person.');
  const byId = new Map([...(recipe?.steps || []), ...session.upcoming, ...session.completed].map(step => [step.id, step]));
  const completed = new Set(session.completed.map(step => step.id));
  const upcoming = session.upcoming.map(step => {
    const missing = step.dependsOn.filter(id => !completed.has(id));
    return { ...step, waitingReason: missing.length ? `Waiting for: ${missing.map(id => byId.get(id)?.title || id).join(', ')}` : 'Waiting for an available cook.' };
  });
  reconcileColumn('play-col-upcoming', upcoming, false, 'No upcoming actions.');
  const container = document.getElementById('play-process-columns');
  const keys = Object.keys(session.running);
  const signature = JSON.stringify(keys);
  if (container.dataset.signature !== signature) {
    container.innerHTML = keys.map((key, index) => `<div class="glass-card play-column"><div class="card-title-bar"><h2>${escapeHtml(key)}</h2></div><div id="play-col-cook${index + 1}" class="play-column-list"></div></div>`).join('');
    container.dataset.signature = signature;
  }
  keys.forEach((key, index) => reconcileColumn(`play-col-cook${index + 1}`, session.running[key] ? [session.running[key]] : [], true, `${key} is available.`));
  reconcileColumn('play-col-unattended', session.passiveRunning || [], true, 'No unattended actions.');
  reconcileColumn('play-col-completed', session.completed, false, 'No completed actions yet.');
  const note = document.getElementById('play-cook-status');
  if (note) note.textContent = session.availableCooks === 1 && session.running['Cook 2'] ? 'Cook 2 will leave after their current action finishes.' : '';
  document.getElementById('play-recipe-select').disabled = Boolean(session.intervalId || (session.recipeId && session.upcoming.length));
  document.getElementById('play-recipe-start-btn').disabled = Boolean(session.recipeId || portionError);
  const availableCooks = normalizeAvailableCooks(document.getElementById('play-cook-count')?.value);
  renderRecipeTimeline('play-recipe-timeline', recipe, { availableCooks, multiplier: getExperienceTimerMultiplier(), ...(session.recipeId ? { session, now: Date.now() } : {}) });
  renderActiveTimers();
}

export function resetPlayRecipeSession() {
  clearInterval(RUNTIME.playSession.intervalId);
  stopPlayBackgroundMusic();
  window.speechSynthesis?.cancel();
  RUNTIME.playSession = { recipeId: '', availableCooks: 1, startedAt: null, upcoming: [], running: { 'Cook 1': null }, passiveRunning: [], completed: [], intervalId: null };
  saveStateToStorage();
  const select = document.getElementById('play-recipe-select');
  if (select) { select.value = ''; select.disabled = false; }
  const cooks = document.getElementById('play-cook-count');
  if (cooks) cooks.value = '1';
  document.getElementById('play-portions').value = '1';
  renderPlayBoards();
}

export function changePlayRecipe() {
  const id = document.getElementById('play-recipe-select').value;
  const cooks = document.getElementById('play-cook-count').value;
  resetPlayRecipeSession();
  document.getElementById('play-recipe-select').value = id;
  document.getElementById('play-cook-count').value = cooks;
  document.querySelector('.play-ingredients').open = true;
  renderPlayBoards();
}

export function updatePlayCookCount() {
  const count = document.getElementById('play-cook-count').value;
  if (RUNTIME.playSession.recipeId) {
    setAvailableCooks(RUNTIME.playSession, count);
    saveStateToStorage();
    runPlayRecipeTick();
  } else renderPlayBoards();
}

export function startGuidedRecipe(recipe, availableCooks = 1, portions = 1) {
  document.getElementById('recipe-modal').style.display = 'none';
  resetPlayRecipeSession();
  switchView('play');
  document.getElementById('play-recipe-select').value = recipe.id;
  document.getElementById('play-cook-count').value = String(normalizeAvailableCooks(availableCooks));
  document.getElementById('play-portions').value = String(normalizePortions(portions));
  startPlayRecipeSession();
}

export function startPlayRecipeSession() {
  const id = document.getElementById('play-recipe-select')?.value;
  const recipe = getVisibleRecipes().find(recipe => recipe.id === id);
  if (!recipe?.steps?.length) { alert('Choose a recipe with playable actions.'); return; }
  const availableCooks = normalizeAvailableCooks(document.getElementById('play-cook-count')?.value);
  let session;
  const portions = normalizePortions(document.getElementById('play-portions').value);
  try { session = createPlaySession(scaleRecipeForPortions(recipe, portions), getExperienceTimerMultiplier(), availableCooks); }
  catch (error) { alert(error.message); return; }
  resetPlayRecipeSession();
  document.getElementById('play-recipe-select').value = id;
  document.getElementById('play-cook-count').value = String(availableCooks);
  getAudioContext();
  document.getElementById('play-portions').value = String(portions);
  RUNTIME.playSession = session;
  document.querySelector('.play-ingredients').open = true;
  startPlayBackgroundMusic();
  runPlayRecipeTick();
  if (session.upcoming.length || Object.values(session.running).some(Boolean) || session.passiveRunning.length) session.intervalId = setInterval(runPlayRecipeTick, 250);
}

export function resumePlayRecipeSession() {
  const session = RUNTIME.playSession;
  clearInterval(session.intervalId);
  session.intervalId = null;
  if (!session.recipeId) return;
  // Expired actions finish now; subsequent hands-on actions start on return.
  runPlayRecipeTick();
  if (session.upcoming.length || Object.values(session.running).some(Boolean) || session.passiveRunning.length) {
    session.intervalId = setInterval(runPlayRecipeTick, 250);
  }
}

export function runPlayRecipeTick() {
  try {
    const events = advancePlaySession(RUNTIME.playSession, Date.now());
    if (events.started.length || events.completed.length) saveStateToStorage();
    for (const step of events.started) { speakPlayStep(step); ensurePlayStepVideo(step); }
    if (events.beep) playShortBeep();
    if (events.done) {
      clearInterval(RUNTIME.playSession.intervalId);
      RUNTIME.playSession.intervalId = null;
      stopPlayBackgroundMusic();
    }
  } catch (error) {
    clearInterval(RUNTIME.playSession.intervalId);
    RUNTIME.playSession.intervalId = null;
    stopPlayBackgroundMusic();
    alert(error.message);
  }
  renderPlayBoards();
}
