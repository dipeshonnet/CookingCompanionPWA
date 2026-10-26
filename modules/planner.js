import { normalizeMealSelection, normalizePortions, scaleRecipeForPortions, formatIngredientAmount, RecipeActionLimitError } from './recipe-portions.js';
import { initLucide } from './navigation.js';
import { getAllRecipes, getVisibleRecipes } from './recipe-domain.js';
import { renderDashboard } from './recipe-views.js';
import { STATE } from './state.js';
import { saveStateToStorage } from './storage.js';
import { buildShoppingList } from './units.js';
import { escapeHtml } from './utils.js';
import { ingredientLabel } from './ingredient-images.js';

const WEEK_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MEAL_SLOTS = ["Breakfast", "Lunch", "Dinner"];

export function renderPlannerView() {
  const grid = document.getElementById("meal-planner-week-grid");
  grid.innerHTML = "";

  WEEK_DAYS.forEach(day => {
    const dayCard = document.createElement("div");
    dayCard.className = "planner-day-card";
    dayCard.innerHTML = `<span class="planner-day-name">${day}</span>`;

    MEAL_SLOTS.forEach(slot => {
      const slotDiv = document.createElement("div");
      slotDiv.className = "planner-slot";
      
      const key = `${day}-${slot}`;
      const selection = normalizeMealSelection(STATE.scheduledMeals[key]);
      const scheduledRecipeId = selection?.recipeId;
      
      let slotBody = "";
      if (scheduledRecipeId) {
        const recipe = getAllRecipes().find(r => r.id === scheduledRecipeId);
        const name = recipe ? recipe.title : "Unknown Recipe";
        slotBody = `<button type="button" class="planner-meal">${escapeHtml(name)} <small>· ${selection.portions} ${selection.portions === 1 ? 'person' : 'people'}</small></button>`;
      } else {
        slotBody = `<button type="button" class="planner-meal-empty">+ Add</button>`;
      }

      slotDiv.innerHTML = `
        <span class="planner-slot-label">${slot}</span>
        ${slotBody}
      `;
      slotDiv.querySelector('button').addEventListener('click', () => openScheduleDropdown(day, slot));
      dayCard.appendChild(slotDiv);
    });

    grid.appendChild(dayCard);
  });

  renderPlannerShoppingList();
}

export function openScheduleDropdown(day, slot) {
  STATE.currentSelectedSlot = `${day}-${slot}`;
  
  const dropdown = document.getElementById("select-meal-recipe-dropdown");
  dropdown.innerHTML = "";

  // Add clean option
  const defaultOpt = document.createElement("option");
  defaultOpt.value = "";
  defaultOpt.innerText = "-- Select Recipe --";
  dropdown.appendChild(defaultOpt);

  getVisibleRecipes().filter(recipe => recipe.category === slot).forEach(recipe => {
    const opt = document.createElement("option");
    opt.value = recipe.id;
    opt.innerText = recipe.title;
    dropdown.appendChild(opt);
  });

  // Prefill current if any
  const selection = normalizeMealSelection(STATE.scheduledMeals[STATE.currentSelectedSlot]);
  const current = selection?.recipeId;
  document.getElementById("schedule-portions").value = String(selection?.portions || 1);
  document.querySelector('[data-portion-target="schedule-portions"][data-portion-delta="-1"]').disabled = !selection || selection.portions === 1;
  if (current) {
    // Preserve a matching assignment even when a new diet filter hides it.
    if (![...dropdown.options].some(option => option.value === current)) {
      const recipe = getAllRecipes().find(recipe => recipe.id === current);
      if (recipe?.category === slot) {
        dropdown.appendChild(new Option(`${recipe.title} (outside diet preference)`, current));
      }
    }
    dropdown.value = [...dropdown.options].some(option => option.value === current) ? current : '';
  }

  document.getElementById("select-meal-modal").style.display = "flex";
}

export function saveScheduledMealSelection() {
  if (!STATE.currentSelectedSlot) return;

  const rId = document.getElementById("select-meal-recipe-dropdown").value;
  
  if (rId) {
    const selection = { recipeId: rId, portions: normalizePortions(document.getElementById("schedule-portions").value) };
    const recipe = getAllRecipes().find(recipe => recipe.id === rId);
    if (!recipe) return;
    try { scaleRecipeForPortions(recipe, selection.portions); }
    catch (error) { alert(error.message); return; }
    STATE.scheduledMeals[STATE.currentSelectedSlot] = selection;
  } else {
    delete STATE.scheduledMeals[STATE.currentSelectedSlot];
  }

  saveStateToStorage();
  document.getElementById("select-meal-modal").style.display = "none";
  renderPlannerView();
  renderDashboard();
}

export function renderPlannerShoppingList() {
  const listContainer = document.getElementById("planner-shopping-list");
  listContainer.innerHTML = "";

  // Collect scheduled recipes
  const activeIds = Object.values(STATE.scheduledMeals);
  if (activeIds.length === 0) {
    listContainer.innerHTML = `<p class="empty-state" style="color: var(--text-dim); text-align: center; padding: 20px;">No meals scheduled. Your shopping list is empty!</p>`;
    return;
  }

  let recipes;
  try {
    recipes = activeIds.map(normalizeMealSelection).filter(Boolean).map(selection => {
      const recipe = getAllRecipes().find(recipe => recipe.id === selection.recipeId);
      return recipe ? scaleRecipeForPortions(recipe, selection.portions) : null;
    }).filter(Boolean);
  } catch (error) {
    if (!(error instanceof RecipeActionLimitError)) throw error;
    listContainer.textContent = `Shopping list unavailable: ${error.message} Update the affected meal selection.`;
    return;
  }
  const requiredList = buildShoppingList(recipes, STATE.pantry);

  if (requiredList.length === 0) {
    listContainer.innerHTML = `<p class="empty-state" style="color: var(--success); text-align: center; padding: 20px; font-weight: 600;"><i data-lucide="check-circle" style="display:inline; vertical-align: middle; margin-right: 6px;"></i> All items fully stocked in Pantry!</p>`;
    initLucide();
    return;
  }

  requiredList.forEach(ing => {
    const item = document.createElement("li");
    item.className = "ingredient-item";
    item.style.cursor = "pointer";
    item.style.transition = "opacity var(--transition-fast)";
    item.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <input type="checkbox" style="accent-color: var(--accent);">
        ${ingredientLabel(ing.name)}
      </div>
      <span style="color: var(--text-muted);">${escapeHtml(formatIngredientAmount(ing))}</span>
    `;

    // Toggle cross-off state on selection
    const chk = item.querySelector("input");
    item.addEventListener("click", () => {
      chk.checked = !chk.checked;
      item.style.opacity = chk.checked ? "0.35" : "1";
      item.style.textDecoration = chk.checked ? "line-through" : "none";
    });
    chk.addEventListener("click", (e) => {
      e.stopPropagation();
      item.style.opacity = chk.checked ? "0.35" : "1";
      item.style.textDecoration = chk.checked ? "line-through" : "none";
    });

    listContainer.appendChild(item);
  });
  initLucide();
}
