import { normalizePortions } from './recipe-portions.js';
import { renderPlayBoards } from './play-recipe.js';

export function setupPortionControls() {
  document.querySelectorAll('[data-portion-target]').forEach(button => {
    button.addEventListener('click', () => {
      const input = document.getElementById(button.dataset.portionTarget);
      if (input.disabled) return;
      input.value = String(Math.max(1, normalizePortions(input.value) + Number(button.dataset.portionDelta)));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });
  for (const id of ['play-portions', 'schedule-portions']) {
    const input = document.getElementById(id);
    input.addEventListener('change', () => {
      input.value = String(normalizePortions(input.value));
      document.querySelector(`[data-portion-target="${id}"][data-portion-delta="-1"]`).disabled = Number(input.value) === 1;
      if (id === 'play-portions') {
        try { renderPlayBoards(); }
        catch (error) { input.value = '1'; alert(error.message); renderPlayBoards(); }
      }
    });
  }
  document.getElementById('select-meal-recipe-dropdown').addEventListener('change', () => {
    const input = document.getElementById('schedule-portions');
    input.value = '1';
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
