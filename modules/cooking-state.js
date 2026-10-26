import { normalizePortions } from './recipe-portions.js';
import { normalizeAvailableCooks } from './play-engine.js';

export function emptyPlaySession() {
  return { recipeId: '', availableCooks: 1, startedAt: null, upcoming: [], running: { 'Cook 1': null }, passiveRunning: [], completed: [], intervalId: null };
}

// Store deadlines and recipe progress, never browser handles or temporary media URLs.
export function serializeCookingState(activeTimers, playSession) {
  const active = timer => ({
    id: timer.id, title: timer.title, stepIndex: timer.stepIndex, cookName: timer.cookName,
    attention: timer.attention, stepLabel: timer.stepLabel,
    totalDuration: timer.totalDuration, deadline: timer.deadline
  });
  const step = ({ timeLeft, lastBeep, videoUrl, videoLoading, ...saved }) => saved;
  return JSON.parse(JSON.stringify({
    activeTimers: activeTimers.map(active),
    playSession: playSession.recipeId ? {
      recipeId: playSession.recipeId, portions: normalizePortions(playSession.portions), ...(playSession.ingredients ? { ingredients: playSession.ingredients } : {}), availableCooks: playSession.availableCooks, startedAt: playSession.startedAt,
      upcoming: playSession.upcoming.map(step), completed: playSession.completed.map(step),
      running: Object.fromEntries(Object.entries(playSession.running).map(([cook, action]) => [cook, action ? step(action) : null])),
      passiveRunning: (playSession.passiveRunning || []).map(step)
    } : null
  }));
}

export function restoreCookingState(saved = {}, now = Date.now()) {
  const activeTimers = (Array.isArray(saved?.activeTimers) ? saved.activeTimers : [])
    .filter(timer => timer && typeof timer.id === 'string' && Number.isFinite(timer.deadline) && Number.isFinite(timer.totalDuration) && timer.totalDuration > 0)
    .map(timer => ({ ...timer, timeLeft: Math.max(0, Math.ceil((timer.deadline - now) / 1000)), lastBeep: null, intervalId: null }));
  const stored = saved?.playSession;
  const validStep = step => step && typeof step.id === 'string' && Number.isFinite(step.duration) && step.duration > 0 && Array.isArray(step.dependsOn);
  const running = Object.values(stored?.running || {}).filter(Boolean);
  if (!stored || typeof stored.recipeId !== 'string' || !stored.recipeId ||
      !Array.isArray(stored.upcoming) || !Array.isArray(stored.completed) || !Array.isArray(stored.passiveRunning) ||
      ![...stored.upcoming, ...stored.completed, ...running, ...stored.passiveRunning].every(validStep) ||
      ![...running, ...stored.passiveRunning].every(step => Number.isFinite(step.deadline))) {
    return { activeTimers, playSession: emptyPlaySession() };
  }
  const step = (action, status) => ({ ...action,
    timeLeft: status === 'running' ? Math.max(0, Math.ceil((action.deadline - now) / 1000)) : status === 'completed' ? 0 : action.duration,
    lastBeep: null, videoUrl: '', videoLoading: false
  });
  const playSession = {
    recipeId: stored.recipeId, portions: normalizePortions(stored.portions), ...(Array.isArray(stored.ingredients) ? { ingredients: stored.ingredients } : {}), availableCooks: normalizeAvailableCooks(stored.availableCooks), startedAt: stored.startedAt ?? null,
    upcoming: stored.upcoming.map(action => step(action, 'upcoming')),
    completed: stored.completed.map(action => step(action, 'completed')),
    running: { 'Cook 1': null, ...Object.fromEntries(Object.entries(stored.running || {}).filter(([cook]) => ['Cook 1', 'Cook 2'].includes(cook)).map(([cook, action]) => [cook, action ? step(action, 'running') : null])) },
    passiveRunning: stored.passiveRunning.map(action => step(action, 'running')), intervalId: null
  };
  return { activeTimers, playSession };
}
