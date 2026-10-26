import { STATE, RUNTIME } from './state.js';
import { getAllRecipes, processLabel } from './recipe-domain.js';
import { escapeHtml, formatTimerClock } from './utils.js';
import { actionVideoSource, inferActionType } from './action-types.js';

export function getActiveTimerEntries(session, individualTimers, recipes) {
  const title = recipes.find(recipe => recipe.id === session.recipeId)?.title || 'Playing recipe';
  const playing = Object.entries(session.running).filter(([, step]) => step).map(([cook, step]) => ({
    id: `play:${cook}`, source: 'play', title, cookName: cook,
    stepIndex: step.order, stepLabel: step.title || step.item, action: step.action, actionType: step.actionType, attention: step.attention,
    totalDuration: step.duration, timeLeft: step.timeLeft
  }));
  const passive = (session.passiveRunning || []).map(step => ({
    id: `play:passive:${step.id}`, source: 'play', title, cookName: 'Unattended', attention: 'passive',
    stepIndex: step.order, stepLabel: step.title || step.item, action: step.action, actionType: step.actionType, totalDuration: step.duration, timeLeft: step.timeLeft
  }));
  return [...playing, ...passive, ...individualTimers.map(timer => ({ ...timer, source: 'individual' }))];
}

export function timerOwnerLabel(timer) {
  return timer.attention === 'passive' ? 'Unattended' : timer.source === 'play' ? timer.cookName : processLabel(timer.cookName);
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
  if (!visible) {
    document.getElementById('floating-timer-rows')?.replaceChildren();
    return;
  }

  const titles = [...new Set(entries.map(timer => timer.title))];
  const title = titles.length === 1 ? titles[0] : 'Cooking timers';
  document.getElementById('floating-timer-title').textContent = title;
  document.getElementById('floating-timer-count').textContent = `${entries.length} active timer${entries.length === 1 ? '' : 's'}`;
  button.setAttribute('aria-label', `Open Play Recipe, ${entries.length} active timer${entries.length === 1 ? '' : 's'}`);
  const rows = document.getElementById('floating-timer-rows');
  const showPreviews = STATE.user.playStepVideo !== false && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const existing = new Map([...rows.children].map(row => [row.dataset.timerId, row]));
  entries.forEach((timer, index) => {
    const src = showPreviews && timer.source === 'play' ? actionVideoSource(timer.actionType ?? inferActionType(timer.action)) : '';
    const signature = JSON.stringify([timer.title, timer.cookName, timer.stepIndex, timer.stepLabel, timer.action, timer.attention, src]);
    let row = existing.get(timer.id);
    existing.delete(timer.id);
    if (!row) {
      row = document.createElement('span');
      row.dataset.timerId = timer.id;
    }
    // Keep other cooks' images and countdowns intact when only one action changes.
    if (row.dataset.signature !== signature) {
      row.className = `floating-timer-row${src ? ' has-action-preview' : ''}`;
      row.dataset.cook = timer.cookName;
      row.title = `Step ${timer.stepIndex + 1}: ${timer.stepLabel || timer.title}${timer.action ? ` - ${timer.action}` : ''}`;
      row.innerHTML = `${src ? `<img class="floating-timer-preview" src="${src}" width="56" height="35" alt="" aria-hidden="true" decoding="async">` : ''}
      <span class="floating-timer-label"><strong>${escapeHtml(timerOwnerLabel(timer))}</strong><span>${escapeHtml(timer.stepLabel || `Step ${timer.stepIndex + 1}`)}</span></span>
      <span class="floating-timer-clock" data-timer-clock aria-live="off"></span>
      <progress max="1" aria-label="${escapeHtml(timerOwnerLabel(timer))} time remaining"></progress>
      `;
      row.dataset.signature = signature;
    }
    if (rows.children[index] !== row) rows.insertBefore(row, rows.children[index] || null);
  });
  existing.forEach(row => row.remove());
  [...rows.children].forEach((row, index) => {
    const text = formatTimerClock(entries[index].timeLeft);
    const clock = row.querySelector('[data-timer-clock]');
    if (clock.textContent !== text) clock.textContent = text;
    row.querySelector('progress').value = getRemainingTimerFraction(entries[index]);
  });
}
