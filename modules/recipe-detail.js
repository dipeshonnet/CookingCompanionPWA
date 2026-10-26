import { renderPantryView } from './ingredients.js';
import { ingredientLabel, ingredientThumbnail } from './ingredient-images.js';
import { initLucide } from './navigation.js';
import { renderPlannerView } from './planner.js';
import { normalizeRecipeForStorage, formatDurationLabel, processLabel, getRecipeById, isPersonalRecipe } from './recipe-domain.js';
import { revertPersonalRecipe } from './recipe-personalization.js';
import { renderDashboard, renderExploreRecipes } from './recipe-views.js';
import { STATE, RUNTIME } from './state.js';
import { saveStateToStorage } from './storage.js';
import { startCookingTimer, playSynthesizedChime } from './timers.js';
import { convertQuantity, findPantryMatch } from './units.js';
import { escapeHtml } from './utils.js';
import { renderRecipeTimeline } from './recipe-timeline.js';
import { getExperienceTimerMultiplier } from './profile.js';

export function showRecipeDetailsModal(recipe) {
  const displayRecipe = normalizeRecipeForStorage(getRecipeById(recipe.id) || recipe);
  RUNTIME.activeModalRecipe = displayRecipe;
  RUNTIME.activeModalServingsCount = displayRecipe.servings;
  RUNTIME.activeModalServingsMultiplier = 1.0;

  document.getElementById("modal-image").src = displayRecipe.image;
  document.getElementById("modal-title").innerText = displayRecipe.title;
  document.getElementById("modal-description").innerText = displayRecipe.description;
  
  document.getElementById("modal-prep").innerText = `Prep: ${displayRecipe.prepTime}m`;
  document.getElementById("modal-cook").innerText = `Cook: ${displayRecipe.cookTime}m`;
  document.getElementById("modal-servings").innerText = RUNTIME.activeModalServingsCount;
  document.getElementById("modal-rating").innerText = displayRecipe.rating || 'Not rated';
  document.getElementById('modal-personal-version').hidden = !isPersonalRecipe(displayRecipe);
  document.getElementById('modal-btn-revert-recipe').hidden = !isPersonalRecipe(displayRecipe);
  document.getElementById('modal-image-credit').textContent = displayRecipe.imageCredit || '';

  updateRecipeModalIngredientsAndButtons();

  // Steps fill with optional Timers
  const stepContainer = document.getElementById("modal-steps");
  stepContainer.innerHTML = "";
  displayRecipe.steps.forEach((step, idx) => {
    const card = document.createElement("div");
    card.className = "step-card";
    
    card.innerHTML = `
      <div class="step-card-header">
        <span class="step-card-num">${escapeHtml(step.title)}</span>
        <span style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
          ${displayRecipe.cookCount > 1 ? `<span class="cook-pill">${escapeHtml(processLabel(step.cook))}</span>` : ""}
          <span class="step-duration-pill">${formatDurationLabel(step.duration)}</span>
          <span class="cook-pill">${step.attention === 'passive' ? 'Unattended' : 'Hands-on'}</span>
          ${step.duration > 0 ? `
            <button class="step-card-btn-timer" type="button">
              <i data-lucide="play" style="width: 12px; height: 12px;"></i> Start Timer
            </button>
          ` : ""}
        </span>
      </div>
      <p class="step-detail-text"><span class="step-detail-item">${ingredientThumbnail(step.item)} ${escapeHtml(step.item)}:</span> ${escapeHtml(step.action)}</p>
    `;

    const timerBtn = card.querySelector(".step-card-btn-timer");
    if (timerBtn) {
      timerBtn.addEventListener("click", () => {
        startCookingTimer(displayRecipe.title, idx, step.duration, step.cook, step.title, { action: step.action, attention: step.attention });
      });
    }

    stepContainer.appendChild(card);
  });

  const parallelBtn = document.getElementById("modal-btn-start-parallel-timers");
  if (parallelBtn) {
    const hasTimedSteps = displayRecipe.steps.some(step => step.duration > 0);
    parallelBtn.style.display = hasTimedSteps ? "inline-flex" : "none";
  }

  const cookSelect = document.getElementById('modal-cook-count');
  cookSelect.value = '1';
  const renderTimeline = () => renderRecipeTimeline('modal-recipe-timeline', displayRecipe, { availableCooks: Number(cookSelect.value), multiplier: getExperienceTimerMultiplier() });
  cookSelect.onchange = renderTimeline;
  renderTimeline();

  document.getElementById("recipe-modal").style.display = "flex";
  initLucide();
}

export function handleRevertRecipe() {
  const recipe = RUNTIME.activeModalRecipe;
  if (!isPersonalRecipe(recipe) || !confirm('Revert to default? Your saved changes to this recipe will be removed from your account. Likes and meal assignments will be kept.')) return;
  if (!revertPersonalRecipe(recipe.id)) return;
  renderDashboard();
  renderExploreRecipes();
  renderPlannerView();
  showRecipeDetailsModal(getRecipeById(recipe.id));
}

export function updateRecipeModalIngredientsAndButtons() {
  if (!RUNTIME.activeModalRecipe) return;

  const ingContainer = document.getElementById("modal-ingredients");
  ingContainer.innerHTML = "";

  RUNTIME.activeModalRecipe.ingredients.forEach(ing => {
    const item = document.createElement("li");
    item.className = "ingredient-item";

    const requiredQty = ing.amount * RUNTIME.activeModalServingsMultiplier;

    // Find pantry match
    const pantryMatch = findPantryMatch(STATE.pantry, ing);

    let checkIcon = "";
    let stockLabel = "";

    if (pantryMatch) {
      if (convertQuantity(pantryMatch.quantity, pantryMatch.unit, ing.unit) >= requiredQty) {
        checkIcon = `<i data-lucide="check-circle" style="color: var(--success); width: 14px; height: 14px; display:inline; vertical-align:middle;"></i>`;
        stockLabel = `<span style="color: var(--success); font-size: 11px; margin-left: 8px;">[In Stock]</span>`;
      } else {
        checkIcon = `<i data-lucide="alert-triangle" style="color: var(--accent); width: 14px; height: 14px; display:inline; vertical-align:middle;"></i>`;
        stockLabel = `<span style="color: var(--accent); font-size: 11px; margin-left: 8px;">[Need ${Math.round(requiredQty*100)/100}, have ${pantryMatch.quantity}]</span>`;
      }
    } else {
      checkIcon = `<i data-lucide="circle" style="color: var(--text-dim); width: 14px; height: 14px; display:inline; vertical-align:middle;"></i>`;
      stockLabel = `<span style="color: var(--text-dim); font-size: 11px; margin-left: 8px;">[Missing]</span>`;
    }

    item.innerHTML = `
      <span class="ingredient-stock-label">${ingredientLabel(ing.name)} ${checkIcon} ${stockLabel}</span>
      <span style="color: var(--text-muted); font-weight: 500;">${Math.round(requiredQty * 100) / 100} ${escapeHtml(ing.unit)}</span>
    `;
    ingContainer.appendChild(item);
  });

  initLucide();
}

let cookToastTimeout;

export function handleCookMeal() {
  if (!RUNTIME.activeModalRecipe) return;

  const shortages = [];

  RUNTIME.activeModalRecipe.ingredients.forEach(ing => {
    const requiredQty = ing.amount * RUNTIME.activeModalServingsMultiplier;
    const pantryMatch = findPantryMatch(STATE.pantry, ing);

    if (!pantryMatch) {
      shortages.push({ name: ing.name, message: `${ing.name}: missing` });
    } else if (convertQuantity(pantryMatch.quantity, pantryMatch.unit, ing.unit) < requiredQty) {
      shortages.push({ name: ing.name, message: `${ing.name}: need ${Math.round(requiredQty * 100) / 100} ${ing.unit}, have ${pantryMatch.quantity} ${pantryMatch.unit}` });
    }
  });

  document.getElementById("cook-meal-summary").textContent = `${RUNTIME.activeModalRecipe.title} for ${RUNTIME.activeModalServingsCount} ${RUNTIME.activeModalServingsCount === 1 ? "person" : "people"}`;
  const shortagePanel = document.getElementById("cook-meal-shortages");
  const shortageList = document.getElementById("cook-meal-shortage-list");
  shortageList.replaceChildren(...shortages.map(({ name, message }) => {
    const item = document.createElement("li");
    item.className = 'ingredient-shortage-name';
    item.innerHTML = `${ingredientThumbnail(name)}<span>${escapeHtml(message)}</span>`;
    return item;
  }));
  shortagePanel.hidden = shortages.length === 0;
  document.getElementById("cook-meal-deduct-note").textContent = shortages.length
    ? "Subtract what is available; missing ingredients will not be added."
    : "Subtract recipe amounts from available ingredients.";
  document.querySelector('input[name="cook-pantry-mode"][value="keep"]').checked = true;
  document.getElementById("cook-meal-modal").style.display = "flex";
  document.getElementById("cook-meal-confirm-btn").focus();
  initLucide();
}

export function closeCookMealDialog() {
  const modal = document.getElementById("cook-meal-modal");
  if (modal.style.display !== "flex") return;
  modal.style.display = "none";
  document.getElementById("modal-btn-cook").focus();
}

export function confirmCookMeal() {
  if (!RUNTIME.activeModalRecipe || document.getElementById("cook-meal-modal").style.display !== "flex") return;
  const deduct = document.querySelector('input[name="cook-pantry-mode"]:checked')?.value === "deduct";

  if (deduct) {
    RUNTIME.activeModalRecipe.ingredients.forEach(ing => {
      const requiredQty = ing.amount * RUNTIME.activeModalServingsMultiplier;
      const pantryMatch = findPantryMatch(STATE.pantry, ing);

      if (pantryMatch) {
        pantryMatch.quantity = Math.max(0, pantryMatch.quantity - convertQuantity(requiredQty, ing.unit, pantryMatch.unit));
      }
    });

    STATE.pantry = STATE.pantry.filter(p => p.quantity > 0.001);
    saveStateToStorage();
    renderDashboard();
    renderPantryView();
    renderPlannerView();
  }

  playSynthesizedChime();
  closeCookMealDialog();
  document.getElementById("recipe-modal").style.display = "none";
  const toast = document.getElementById("cook-meal-toast");
  document.getElementById("cook-meal-toast-message").textContent = deduct
    ? `Meal cooked. Available ingredients deducted from your pantry.`
    : `Meal cooked. Your pantry was not changed.`;
  toast.hidden = false;
  clearTimeout(cookToastTimeout);
  cookToastTimeout = setTimeout(() => { toast.hidden = true; }, 5000);
}
