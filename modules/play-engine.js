import { normalizeRecipeForStorage } from './recipe-domain.js';

export const normalizeAvailableCooks = value => Number(value) === 2 ? 2 : 1;

export function createPlaySession(recipe, multiplier = 1, availableCooks = 1) {
  const normalized = normalizeRecipeForStorage(recipe);
  const count = normalizeAvailableCooks(availableCooks);
  const factor = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
  return {
    recipeId: recipe.id, portions: recipe.portions || normalized.servings, ingredients: structuredClone(normalized.ingredients), availableCooks: count, startedAt: null, intervalId: null,
    completed: [], passiveRunning: [], running: { 'Cook 1': null, ...(count === 2 ? { 'Cook 2': null } : {}) },
    upcoming: normalized.steps.map((step, order) => {
      const duration = Math.max(1, Math.round(step.duration * (step.attention === 'passive' ? 1 : factor)));
      return { ...step, order, duration, timeLeft: duration, assignedCook: null, startedAt: null, completedAt: null, deadline: null, lastBeep: null, videoUrl: '', videoLoading: false };
    })
  };
}

export function setAvailableCooks(session, value) {
  session.availableCooks = normalizeAvailableCooks(value);
  if (session.availableCooks === 2 && !Object.hasOwn(session.running, 'Cook 2')) session.running['Cook 2'] = null;
  if (session.availableCooks === 1 && !session.running['Cook 2']) delete session.running['Cook 2'];
}

export function runningActions(session) {
  return [...Object.values(session.running).filter(Boolean), ...(session.passiveRunning || [])];
}

export function advancePlaySession(session, now) {
  const events = { started: [], completed: [], beep: false, done: false };
  if (!session.recipeId) return events;
  if (session.startedAt === null) session.startedAt = now;
  session.passiveRunning ||= [];
  // Complete all expired actions before evaluating joins, independent of cook order.
  for (const step of runningActions(session)) {
    step.timeLeft = Math.max(0, Math.ceil((step.deadline - now) / 1000));
    if (!step.timeLeft) {
      step.completedAt = now;
      session.completed.push(step);
      if (step.assignedCook) session.running[step.assignedCook] = null;
      else session.passiveRunning = session.passiveRunning.filter(action => action.id !== step.id);
      events.completed.push(step);
    }
  }
  setAvailableCooks(session, session.availableCooks);
  const finished = new Set(session.completed.map(step => step.id));
  const ready = step => step.dependsOn.every(id => finished.has(id));
  const start = (step, cook) => {
    session.upcoming.splice(session.upcoming.indexOf(step), 1);
    step.startedAt = now;
    step.deadline = now + step.duration * 1000;
    step.assignedCook = cook;
    if (cook) session.running[cook] = step;
    else session.passiveRunning.push(step);
    events.started.push(step);
  };
  for (const step of [...session.upcoming]) if (step.attention === 'passive' && ready(step)) start(step, null);
  for (let index = 1; index <= session.availableCooks; index++) {
    const cook = `Cook ${index}`;
    if (!session.running[cook]) {
      const step = session.upcoming.find(step => step.attention !== 'passive' && ready(step));
      if (step) start(step, cook);
    }
  }
  for (const step of runningActions(session)) {
    if (step.timeLeft >= 1 && step.timeLeft <= 3 && step.lastBeep !== step.timeLeft) {
      events.beep = true;
      step.lastBeep = step.timeLeft;
    }
  }
  events.done = !session.upcoming.length && !runningActions(session).length;
  if (session.upcoming.length && !runningActions(session).length) throw new Error('No action can start. Check recipe prerequisites.');
  return events;
}

// Project the same engine at exact deadlines without mutating the live session.
export function buildRecipeSchedule(recipe, { availableCooks = 1, multiplier = 1, session = null, now = 0 } = {}) {
  const projected = session ? structuredClone({ ...session, intervalId: null }) : createPlaySession(recipe, multiplier, availableCooks);
  let clock = session ? now : 0;
  const origin = projected.startedAt ?? clock;
  const actualIds = new Set(session ? [...session.completed, ...runningActions(session)].map(step => step.id) : []);
  const completedIds = new Set(session?.completed.map(step => step.id) || []);
  const rows = new Map();
  const remember = () => {
    for (const step of [...projected.completed, ...runningActions(projected)]) {
      rows.set(step.id, { ...step, start: (step.startedAt - origin) / 1000, end: ((step.completedAt ?? step.deadline) - origin) / 1000,
        status: completedIds.has(step.id) ? 'completed' : actualIds.has(step.id) ? 'running' : 'upcoming' });
    }
  };
  remember();
  for (let iterations = 0; iterations <= 501; iterations++) {
    const events = advancePlaySession(projected, clock);
    remember();
    if (events.done) break;
    const deadlines = runningActions(projected).map(step => step.deadline);
    if (!deadlines.length) throw new Error('Unable to project recipe timeline.');
    clock = Math.min(...deadlines);
  }
  const steps = [...rows.values()].sort((a, b) => a.order - b.order);
  return { steps, duration: Math.max(0, ...steps.map(step => step.end)), elapsed: session ? Math.max(0, (now - origin) / 1000) : 0 };
}
