import { normalizeStep } from './recipe-domain.js';

export const COOKS = ['Cook 1', 'Cook 2'];

export function createPlaySession(recipe, multiplier = 1) {
  return {
    recipeId: recipe.id, intervalId: null, completed: [], running: { 'Cook 1': null, 'Cook 2': null },
    upcoming: recipe.steps.map((raw, order) => {
      const step = normalizeStep(raw, order, recipe.cookCount);
      const duration = Math.max(1, Math.round(step.duration * multiplier));
      return { ...step, order, duration, timeLeft: duration, deadline: null, lastBeep: null, videoUrl: '', videoLoading: false };
    })
  };
}

export function advancePlaySession(session, now) {
  const events = { started: [], completed: [], beep: false, done: false };
  for (const cook of COOKS) {
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
  events.done = session.upcoming.length === 0 && COOKS.every(cook => !session.running[cook]);
  return events;
}
