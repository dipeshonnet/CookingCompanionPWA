import { STATE, RUNTIME } from './state.js';
import { getAllRecipes } from './recipe-domain.js';
import { escapeHtml, formatTimerClock } from './utils.js';

export function getActiveTimerEntries(session, individualTimers, recipes) {
  const title = recipes.find(recipe => recipe.id === session.recipeId)?.title || 'Playing recipe';
  const playing = Object.entries(session.running).filter(([, step]) => step).map(([cook, step]) => ({
    id: `play:${cook}`, source: 'play', title, cookName: cook,
    stepIndex: step.order, stepLabel: step.item, action: step.action,
    totalDuration: step.duration, timeLeft: step.timeLeft
  }));
  return [...playing, ...individualTimers.map(timer => ({ ...timer, source: 'individual' }))];
}

export function getRemainingTimerFraction(timer) {
  if (!Number.isFinite(timer.totalDuration) || timer.totalDuration <= 0 || !Number.isFinite(timer.timeLeft)) return 0;
  return Math.min(1, Math.max(0, timer.timeLeft / timer.totalDuration));
}

export function renderFloatingTimers(entries = getActiveTimerEntries(RUNTIME.playSession, STATE.activeTimers, getAllRecipes())) {
  const button = document.getElementById('floating-active-timers');
  if (!button) return;
  const visible = STATE.user.loggedIn && entries.length > 0;
  button.hidden = !visible;
  document.body.classList.toggle('has-floating-timers', visible);
  if (!visible) return;

  const titles = [...new Set(entries.map(timer => timer.title))];
  const title = titles.length === 1 ? titles[0] : 'Cooking timers';
  document.getElementById('floating-timer-title').textContent = title;
  document.getElementById('floating-timer-count').textContent = `${entries.length} active timer${entries.length === 1 ? '' : 's'}`;
  button.setAttribute('aria-label', `Open Play Recipe, ${entries.length} active timer${entries.length === 1 ? '' : 's'}`);
  const rows = document.getElementById('floating-timer-rows');
  const signature = JSON.stringify(entries.map(timer => [timer.id, timer.title, timer.cookName, timer.stepIndex, timer.stepLabel, timer.action]));
  if (rows.dataset.signature !== signature) {
    rows.innerHTML = entries.map(timer => `<span class="floating-timer-row" data-cook="${escapeHtml(timer.cookName)}" title="${escapeHtml(`Step ${timer.stepIndex + 1}: ${timer.stepLabel || timer.title}${timer.action ? ` - ${timer.action}` : ''}`)}">
      <span class="floating-timer-label"><strong>${escapeHtml(timer.cookName)}</strong><span>${escapeHtml(timer.stepLabel || `Step ${timer.stepIndex + 1}`)}</span></span>
      <span class="floating-timer-clock" data-timer-clock aria-live="off"></span>
      <progress max="1" aria-label="${escapeHtml(timer.cookName)} time remaining"></progress>
    </span>`).join('');
    rows.dataset.signature = signature;
  }
  [...rows.children].forEach((row, index) => {
    const text = formatTimerClock(entries[index].timeLeft);
    const clock = row.querySelector('[data-timer-clock]');
    if (clock.textContent !== text) clock.textContent = text;
    row.querySelector('progress').value = getRemainingTimerFraction(entries[index]);
  });
}
