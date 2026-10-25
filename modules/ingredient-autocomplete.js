import { ingredientSuggestions } from './ingredient-catalogue.js';
import { HANDPICKED_RECIPES } from '../recipes.js';
import { STATE } from './state.js';

export function setupIngredientAutocomplete(input, category) {
  const ghost = document.getElementById('pantry-ingredient-suggestion');
  const status = document.getElementById('pantry-ingredient-status');
  let completion = '';
  let dismissed = false;

  const clear = () => {
    completion = '';
    ghost.replaceChildren();
    status.textContent = '';
  };
  const update = () => {
    clear();
    if (dismissed || document.activeElement !== input || input.selectionStart !== input.value.length || input.selectionEnd !== input.value.length) return;
    const suggestion = ingredientSuggestions(category.value, input.value, STATE.pantry, [...HANDPICKED_RECIPES, ...STATE.customRecipes])[0];
    if (!suggestion) return;
    completion = input.value + suggestion.slice(input.value.length);
    const typed = document.createElement('span');
    typed.className = 'ingredient-autocomplete-prefix';
    typed.textContent = input.value;
    ghost.append(typed, document.createTextNode(suggestion.slice(input.value.length)));
    ghost.scrollLeft = input.scrollLeft;
    status.textContent = `${completion}. Press Enter or right arrow to complete.`;
  };
  input.addEventListener('input', () => { dismissed = false; update(); });
  input.addEventListener('focus', () => { dismissed = false; update(); });
  input.addEventListener('blur', clear);
  input.addEventListener('click', update);
  input.addEventListener('keyup', update);
  input.addEventListener('scroll', () => { ghost.scrollLeft = input.scrollLeft; });
  category.addEventListener('change', () => { dismissed = false; update(); });
  document.addEventListener('selectionchange', () => { if (document.activeElement === input) update(); });

  return event => {
    if (event.isComposing || event.keyCode === 229) return true;
    if (event.key === 'Escape') { dismissed = true; clear(); return true; }
    if ((event.key === 'Enter' || event.key === 'ArrowRight') && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
      update();
      if (completion) {
        event.preventDefault();
        input.value = completion;
        input.setSelectionRange(input.value.length, input.value.length);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      }
    }
    return false;
  };
}
