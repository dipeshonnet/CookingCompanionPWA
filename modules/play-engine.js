import { normalizeStep, recipeProcessCount, processKeys } from './recipe-domain.js';

export function createPlaySession(recipe, multiplier = 1) {
  const count = recipeProcessCount(recipe);
  return {
    recipeId: recipe.id, intervalId: null, completed: [], running: Object.fromEntries(processKeys(count).map(key => [key, null])),
    upcoming: recipe.steps.map((raw, order) => {
      const step = normalizeStep(raw, order, count);
      const duration = Math.max(1, Math.round(step.duration * multiplier));
      return { ...step, order, duration, timeLeft: duration, deadline: null, lastBeep: null, videoUrl: '', videoLoading: false };
    })
  };
}

export function advancePlaySession(session, now) {
  const events = { started: [], completed: [], beep: false, done: false };
  for (const cook of Object.keys(session.running)) {
    const active = session.running[cook];
    if (active) {
      active.timeLeft = Math.max(0, Math.ceil((active.deadline - now) / 1000));
      if (active.timeLeft === 0) {
        session.completed.push(active);
        session.running[cook] = null;
        events.completed.push(active);
      }
    }
    if (!session.running[cook]) {
      const index = session.upcoming.findIndex(step => step.cook === cook);
      if (index >= 0) {
        const [step] = session.upcoming.splice(index, 1);
        step.deadline = now + step.duration * 1000;
        session.running[cook] = step;
        events.started.push(step);
      }
    }
    const step = session.running[cook];
    if (step && step.timeLeft >= 1 && step.timeLeft <= 3 && step.lastBeep !== step.timeLeft) {
      events.beep = true;
      step.lastBeep = step.timeLeft;
    }
  }
  events.done = session.upcoming.length === 0 && Object.values(session.running).every(step => !step);
  return events;
}
