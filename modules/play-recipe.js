import { createPlaySession, advancePlaySession } from './play-engine.js';
import { getAudioContext, playShortBeep, startPlayBackgroundMusic, stopPlayBackgroundMusic, speakPlayStep, ensurePlayStepVideo } from './play-media.js';
import { getExperienceTimerMultiplier } from './profile.js';
import { getVisibleRecipes, formatDurationLabel } from './recipe-domain.js';
import { STATE, RUNTIME } from './state.js';
import { escapeHtml, formatTimerClock } from './utils.js';
import { renderActiveTimers } from './timers.js';

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
  select.value = selected;
  renderPlayBoards();
}

export function stepCardHtml(step, withTimer = false) {
  const video = withTimer && STATE.user.playStepVideo
    ? step.videoUrl ? `<video src="${escapeHtml(step.videoUrl)}" autoplay loop muted playsinline style="width:100%;border-radius:8px;margin-top:8px"></video>`
      : '<div class="play-step-meta">Automatic AI video generation is disabled in this deployment.</div>'
    : '';
  return `<div class="play-step-card">
    <div class="play-step-title">Step ${step.order + 1} - ${escapeHtml(step.item)}</div>
    <div class="play-step-text">${escapeHtml(step.action)}</div>${video}
    <div class="play-step-meta"><span>${escapeHtml(step.cook)} &middot; ${escapeHtml(step.stepType)}</span>
    <span ${withTimer ? 'data-play-countdown' : ''}>${withTimer ? formatTimerClock(step.timeLeft) : formatDurationLabel(step.duration)}</span></div>
  </div>`;
}

function reconcileColumn(id, steps, timed, emptyText) {
  const column = document.getElementById(id);
  if (!column) return;
  // Timer-only changes preserve video elements and playback position.
  const signature = JSON.stringify([steps.map(step => [step.order, step.item, step.action, step.duration, step.cook, step.videoUrl, step.videoLoading]), STATE.user.playStepVideo]);
  if (column.dataset.signature !== signature) {
    column.innerHTML = steps.length ? steps.map(step => stepCardHtml(step, timed)).join('') : `<p class="play-empty">${emptyText}</p>`;
    column.dataset.signature = signature;
  }
  if (timed && steps[0]) {
    const countdown = column.querySelector('[data-play-countdown]');
    const text = formatTimerClock(steps[0].timeLeft);
    if (countdown.textContent !== text) countdown.textContent = text;
  }
}

export function renderPlayBoards() {
  const session = RUNTIME.playSession;
  reconcileColumn('play-col-upcoming', session.upcoming, false, 'No upcoming steps.');
  reconcileColumn('play-col-cook1', session.running['Cook 1'] ? [session.running['Cook 1']] : [], true, 'Cook 1 is idle.');
  reconcileColumn('play-col-cook2', session.running['Cook 2'] ? [session.running['Cook 2']] : [], true, 'Cook 2 is idle.');
  reconcileColumn('play-col-completed', session.completed, false, 'No completed items yet.');
  renderActiveTimers();
}

export function resetPlayRecipeSession() {
  clearInterval(RUNTIME.playSession.intervalId);
  stopPlayBackgroundMusic();
  window.speechSynthesis?.cancel();
  RUNTIME.playSession = { recipeId: '', upcoming: [], running: { 'Cook 1': null, 'Cook 2': null }, completed: [], intervalId: null };
  const select = document.getElementById('play-recipe-select');
  if (select) select.value = '';
  renderPlayBoards();
}

export function startPlayRecipeSession() {
  const id = document.getElementById('play-recipe-select')?.value;
  const recipe = getVisibleRecipes().find(recipe => recipe.id === id);
  if (!recipe?.steps?.length) { alert('Choose a recipe with playable steps.'); return; }
  resetPlayRecipeSession();
  document.getElementById('play-recipe-select').value = id;
  getAudioContext();
  RUNTIME.playSession = createPlaySession(recipe, getExperienceTimerMultiplier());
  startPlayBackgroundMusic();
  runPlayRecipeTick();
  RUNTIME.playSession.intervalId = setInterval(runPlayRecipeTick, 250);
}

export function runPlayRecipeTick() {
  const events = advancePlaySession(RUNTIME.playSession, Date.now());
  for (const step of events.started) { speakPlayStep(step); ensurePlayStepVideo(step); }
  if (events.beep) playShortBeep();
  if (events.done) {
    clearInterval(RUNTIME.playSession.intervalId);
    RUNTIME.playSession.intervalId = null;
    stopPlayBackgroundMusic();
  }
  renderPlayBoards();
}
