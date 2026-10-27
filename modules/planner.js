import { normalizeMealSelection, normalizePortions, scaleRecipeForPortions, formatIngredientAmount, RecipeActionLimitError } from './recipe-portions.js';
import { initLucide } from './navigation.js';
import { getAllRecipes, getVisibleRecipes } from './recipe-domain.js';
import { renderDashboard } from './recipe-views.js';
import { STATE } from './state.js';
import { saveStateToStorage } from './storage.js';
import { buildShoppingList } from './units.js';
import { escapeHtml } from './utils.js';
import { ingredientLabel } from './ingredient-images.js';
import { WEEK_DAYS, MEAL_SLOTS, dateKey, parseDate, weekStart, weekDates, migrateWeeklyMeals, futureMeals } from './planner-calendar.js';

let selectedWeek = null;

export function setupPlannerCalendar() {
  document.getElementById('planner-week-date').addEventListener('change', event => {
    const date = parseDate(event.target.value);
    if (date) selectedWeek = weekStart(date);
    renderPlannerView();
  });
  document.querySelectorAll('[data-planner-week]').forEach(button => button.addEventListener('click', () => {
    const offset = button.dataset.plannerWeek;
    if (offset === 'today') selectedWeek = weekStart();
    else {
      selectedWeek = weekStart(selectedWeek || new Date());
      selectedWeek.setDate(selectedWeek.getDate() + Number(offset) * 7);
    }
    renderPlannerView();
  }));
}

export function renderPlannerView() {
  const migrated = migrateWeeklyMeals(STATE.scheduledMeals);
  if (JSON.stringify(migrated) !== JSON.stringify(STATE.scheduledMeals)) {
    STATE.scheduledMeals = migrated;
    saveStateToStorage();
  }
  const dates = weekDates(selectedWeek || new Date());
  const today = dateKey();
  document.getElementById('planner-week-date').value = dateKey(dates[0]);
  const formatDate = date => date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  document.getElementById('planner-week-range').textContent = `${formatDate(dates[0])} – ${formatDate(dates[6])}`;
  const grid = document.getElementById("meal-planner-week-grid");
  grid.innerHTML = "";

  const labels = document.createElement('div');
  labels.className = 'planner-row-labels';
  labels.setAttribute('aria-hidden', 'true');
  labels.innerHTML = '<span class="planner-calendar-corner">Meal</span>' + MEAL_SLOTS.map(slot => `<span class="planner-row-label">${slot}</span>`).join('');
  grid.appendChild(labels);

  WEEK_DAYS.forEach((day, index) => {
    const date = dateKey(dates[index]);
    const dayCard = document.createElement("div");
    dayCard.className = "planner-day-card";
    dayCard.classList.toggle('planner-day-past', date < today);
    dayCard.classList.toggle('planner-day-today', date === today);
    dayCard.setAttribute('role', 'group');
    dayCard.setAttribute('aria-label', `${day}, ${formatDate(dates[index])}`);
    dayCard.innerHTML = `<span class="planner-day-name" ${date === today ? 'aria-current="date"' : ''}>${day}<small>${formatDate(dates[index])}${date === today ? ' · Today' : ''}</small></span>`;

    MEAL_SLOTS.forEach(slot => {
      const slotDiv = document.createElement("div");
      slotDiv.className = "planner-slot";
      
      const key = `${date}-${slot}`;
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
      slotDiv.querySelector('button').addEventListener('click', () => openScheduleDropdown(date, slot));
      slotDiv.querySelector('button').setAttribute('aria-label', `${day}, ${formatDate(dates[index])}, ${slot}: ${scheduledRecipeId ? 'Edit ' + slotDiv.querySelector('button').textContent : 'Add meal'}`);
      dayCard.appendChild(slotDiv);
    });

    grid.appendChild(dayCard);
  });

  renderPlannerShoppingList();
}

export function openScheduleDropdown(day, slot) {
  if (WEEK_DAYS.includes(day)) day = dateKey(weekDates(selectedWeek || new Date())[WEEK_DAYS.indexOf(day)]);
  STATE.currentSelectedSlot = `${day}-${slot}`;
  const date = parseDate(day);
  document.getElementById('schedule-meal-context').textContent = `${date ? date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : day} · ${slot}`;
  
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
  const activeIds = futureMeals(STATE.scheduledMeals);
  if (activeIds.length === 0) {
    listContainer.innerHTML = `<p class="empty-state" style="color: var(--text-dim); text-align: center; padding: 20px;">No meals planned after today. Add a future meal to build your shopping list.</p>`;
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
