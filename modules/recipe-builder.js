import { switchView, initLucide } from './navigation.js';
import { renderAIIngredientSelector } from './recipe-ai.js';
import { normalizeCookLabel, normalizeStepType, inferStepTypeFromAction, normalizeRecipeForStorage } from './recipe-domain.js';
import { renderExploreRecipes } from './recipe-views.js';
import { STATE, RUNTIME, FALLBACK_RECIPE_IMAGE } from './state.js';
import { saveStateToStorage } from './storage.js';
import { escapeHtml, cleanText, toNonNegativeNumber } from './utils.js';

export function renderAddRecipeView() {
  setRecipeExploreVisibility(RUNTIME.recipeExploreVisible);
  if (RUNTIME.recipeExploreVisible) renderExploreRecipes();
  ensureRecipeBuilderDefaults();
  const aiDiet = document.getElementById("ai-diet-preference");
  if (aiDiet) aiDiet.value = STATE.user.dietPreference || "None";
  renderAIIngredientSelector();
  updateStepCookControls();
  initLucide();
}

export function setRecipeExploreVisibility(visible) {
  RUNTIME.recipeExploreVisible = Boolean(visible);
  const panel = document.getElementById("recipe-explore-panel");
  const toggleBtn = document.getElementById("recipe-explore-toggle-btn");
  if (panel) panel.style.display = RUNTIME.recipeExploreVisible ? "block" : "none";
  if (toggleBtn) {
    toggleBtn.classList.toggle("active", RUNTIME.recipeExploreVisible);
    toggleBtn.innerHTML = RUNTIME.recipeExploreVisible
      ? '<i data-lucide="chevron-up"></i> Explore'
      : '<i data-lucide="compass"></i> Explore';
  }
  initLucide();
}

export function toggleRecipeExplorePanel() {
  const next = !RUNTIME.recipeExploreVisible;
  setRecipeExploreVisibility(next);
  if (next) renderExploreRecipes();
}

export function renderAIGeneratorView() {
  renderAddRecipeView();
}

export function ensureRecipeBuilderDefaults() {
  const ingredientList = document.getElementById("recipe-ingredients-list");
  const stepsList = document.getElementById("recipe-steps-list");

  if (ingredientList && ingredientList.children.length === 0) {
    addRecipeIngredientRow();
    addRecipeIngredientRow();
  }

  if (stepsList && stepsList.children.length === 0) {
    addRecipeStepRow();
  }
}

export function unitOptions(selectedUnit = "pcs") {
  const units = ["pcs", "g", "ml", "cup", "tbsp", "tsp", "cloves", "slices", "pinch"];
  return units.map(unit => `<option value="${unit}" ${unit === selectedUnit ? "selected" : ""}>${unit}</option>`).join("");
}

export function addRecipeIngredientRow(values = {}) {
  const list = document.getElementById("recipe-ingredients-list");
  if (!list) return;

  const row = document.createElement("div");
  row.className = "recipe-builder-row recipe-ingredient-row";
  row.innerHTML = `
    <div class="form-group">
      <label>Item</label>
      <input type="text" class="form-control recipe-ingredient-name" placeholder="Tomatoes" value="${escapeHtml(values.name || "")}">
    </div>
    <div class="form-group">
      <label>Amount</label>
      <input type="number" class="form-control recipe-ingredient-amount" min="0" step="any" value="${escapeHtml(values.amount ?? "")}" placeholder="2">
    </div>
    <div class="form-group">
      <label>Unit</label>
      <select class="form-control recipe-ingredient-unit">${unitOptions(values.unit || "pcs")}</select>
    </div>
    <button type="button" class="btn-secondary recipe-row-remove" data-remove-ingredient-row aria-label="Remove ingredient">
      <i data-lucide="trash-2"></i>
    </button>
  `;
  list.appendChild(row);
  initLucide();
}

export function addRecipeStepRow(values = {}) {
  const list = document.getElementById("recipe-steps-list");
  if (!list) return;

  const durationMinutes = values.duration ? Math.round(values.duration / 60 * 100) / 100 : (values.minutes || "");
  const stepType = normalizeStepType(values.stepType || values.type || inferStepTypeFromAction(values.action || values.text || ""));
  const row = document.createElement("div");
  row.className = "recipe-builder-row recipe-step-row";
  row.innerHTML = `
    <div class="form-group">
      <label>Item</label>
      <input type="text" class="form-control recipe-step-item" placeholder="Pasta" value="${escapeHtml(values.item || "")}">
    </div>
    <div class="form-group">
      <label>What To Do</label>
      <textarea class="form-control recipe-step-action" rows="2" placeholder="Boil until al dente">${escapeHtml(values.action || values.text || "")}</textarea>
    </div>
    <div class="form-group">
      <label>Minutes</label>
      <input type="number" class="form-control recipe-step-duration" min="0.01" step="any" value="${escapeHtml(durationMinutes)}" placeholder="8">
    </div>
    <div class="form-group">
      <label>Step Type</label>
      <select class="form-control recipe-step-type">
        <option value="Prep" ${stepType === "Prep" ? "selected" : ""}>Prep</option>
        <option value="Cook" ${stepType === "Cook" ? "selected" : ""}>Cook</option>
      </select>
    </div>
    <div class="form-group recipe-step-cook-wrap">
      <label>Cook</label>
      <select class="form-control recipe-step-cook">
        <option value="Cook 1" ${normalizeCookLabel(values.cook) === "Cook 1" ? "selected" : ""}>Cook 1</option>
        <option value="Cook 2" ${normalizeCookLabel(values.cook) === "Cook 2" ? "selected" : ""}>Cook 2</option>
      </select>
    </div>
    <button type="button" class="btn-secondary recipe-row-remove" data-remove-step-row aria-label="Remove step">
      <i data-lucide="trash-2"></i>
    </button>
  `;
  list.appendChild(row);
  updateStepCookControls();
  recalculateRecipeTimeTotals();
  initLucide();
}

export function removeRecipeBuilderRow(button, rowClass) {
  const row = button.closest(`.${rowClass}`);
  const list = row ? row.parentElement : null;
  if (!row || !list) return;

  if (list.querySelectorAll(`.${rowClass}`).length <= 1) {
    alert("Keep at least one row.");
    return;
  }

  row.remove();
  if (rowClass === "recipe-step-row") {
    recalculateRecipeTimeTotals();
  }
}

export function updateStepCookControls() {
  const cookCountInput = document.getElementById("recipe-cook-count-input");
  const cookCount = cookCountInput ? Number.parseInt(cookCountInput.value, 10) : 1;

  document.querySelectorAll(".recipe-step-cook-wrap").forEach(wrapper => {
    wrapper.classList.toggle("hidden", cookCount !== 2);
  });

  if (cookCount !== 2) {
    document.querySelectorAll(".recipe-step-cook").forEach(select => {
      select.value = "Cook 1";
    });
  }
}

export function recalculateRecipeTimeTotals() {
  const prepInput = document.getElementById("recipe-prep-input");
  const cookInput = document.getElementById("recipe-cook-time-input");
  if (!prepInput || !cookInput) return;

  let prepMinutes = 0;
  let cookMinutes = 0;

  document.querySelectorAll(".recipe-step-row").forEach(row => {
    const minutes = toNonNegativeNumber(row.querySelector(".recipe-step-duration")?.value, 0);
    const stepType = normalizeStepType(row.querySelector(".recipe-step-type")?.value || "Cook");
    if (stepType === "Prep") prepMinutes += minutes;
    else cookMinutes += minutes;
  });

  prepInput.value = String(Math.ceil(prepMinutes));
  cookInput.value = String(Math.ceil(cookMinutes));
}

export function collectCustomRecipeFromForm() {
  const title = cleanText(document.getElementById("recipe-title-input")?.value);
  if (!title) {
    alert("Recipe name is required.");
    return null;
  }

  const ingredientRows = Array.from(document.querySelectorAll(".recipe-ingredient-row"));
  const ingredients = ingredientRows
    .map(row => ({
      name: cleanText(row.querySelector(".recipe-ingredient-name")?.value),
      amount: toNonNegativeNumber(row.querySelector(".recipe-ingredient-amount")?.value, 0),
      unit: row.querySelector(".recipe-ingredient-unit")?.value || "pcs"
    }))
    .filter(ing => ing.name);

  if (ingredients.length === 0) {
    alert("Add at least one ingredient.");
    return null;
  }

  const cookCount = Number.parseInt(document.getElementById("recipe-cook-count-input")?.value, 10) === 2 ? 2 : 1;
  const stepRows = Array.from(document.querySelectorAll(".recipe-step-row"));
  const steps = [];

  for (const row of stepRows) {
    const item = cleanText(row.querySelector(".recipe-step-item")?.value);
    const action = cleanText(row.querySelector(".recipe-step-action")?.value);
    const minutes = toNonNegativeNumber(row.querySelector(".recipe-step-duration")?.value, 0);
    const stepType = normalizeStepType(row.querySelector(".recipe-step-type")?.value || "Cook");
    const cook = cookCount === 2 ? row.querySelector(".recipe-step-cook")?.value : "Cook 1";

    if (!item && !action && minutes <= 0) continue;

    if (!item || !action || minutes <= 0) {
      alert("Each step needs an item, an action, and a time.");
      return null;
    }

    steps.push({
      item,
      action,
      duration: Math.round(minutes * 60),
      stepType,
      cook,
      text: `${item}: ${action}`
    });
  }

  if (steps.length === 0) {
    alert("Add at least one cooking step.");
    return null;
  }

  const tags = cleanText(document.getElementById("recipe-tags-input")?.value)
    .split(",")
    .map(tag => cleanText(tag))
    .filter(Boolean);

  const recipe = normalizeRecipeForStorage({
    id: "custom-" + Date.now(),
    title,
    description: cleanText(document.getElementById("recipe-description-input")?.value) || "A custom recipe from your kitchen.",
    category: document.getElementById("recipe-category-input")?.value || "Dinner",
    difficulty: document.getElementById("recipe-difficulty-input")?.value || "Medium",
    prepTime: Math.round(toNonNegativeNumber(document.getElementById("recipe-prep-input")?.value, 0)),
    cookTime: Math.round(toNonNegativeNumber(document.getElementById("recipe-cook-time-input")?.value, 0)),
    servings: Math.max(1, Math.round(toNonNegativeNumber(document.getElementById("recipe-servings-input")?.value, 2))),
    cookCount,
    rating: 4.7,
    image: cleanText(document.getElementById("recipe-image-input")?.value) || FALLBACK_RECIPE_IMAGE,
    tags: ["Custom", ...tags.filter(tag => tag.toLowerCase() !== "custom")],
    ingredients,
    steps
  });

  return recipe;
}

export function handleCustomRecipeSave(e) {
  e.preventDefault();

  const recipe = collectCustomRecipeFromForm();
  if (!recipe) return;

  STATE.customRecipes.unshift(recipe);
  saveStateToStorage();
  resetAddRecipeForm();
  alert(`"${recipe.title}" has been added to Recipe.`);
  switchView("ai-generator");
}

export function resetAddRecipeForm() {
  const form = document.getElementById("custom-recipe-form");
  if (form) form.reset();

  const ingredientsList = document.getElementById("recipe-ingredients-list");
  const stepsList = document.getElementById("recipe-steps-list");
  if (ingredientsList) ingredientsList.innerHTML = "";
  if (stepsList) stepsList.innerHTML = "";

  addRecipeIngredientRow();
  addRecipeIngredientRow();
  addRecipeStepRow();
  updateStepCookControls();
  recalculateRecipeTimeTotals();
}

export function populateRecipeFormFromDraft(draft) {
  document.getElementById("recipe-title-input").value = draft.title || "";
  document.getElementById("recipe-description-input").value = draft.description || "";
  document.getElementById("recipe-category-input").value = draft.category || "Dinner";
  document.getElementById("recipe-prep-input").value = draft.prepTime ?? 0;
  document.getElementById("recipe-cook-time-input").value = draft.cookTime || 0;
  document.getElementById("recipe-servings-input").value = draft.servings || 2;
  document.getElementById("recipe-cook-count-input").value = draft.cookCount === 2 ? "2" : "1";
  document.getElementById("recipe-difficulty-input").value = draft.difficulty || "Medium";
  document.getElementById("recipe-tags-input").value = (draft.tags || []).join(", ");
  document.getElementById("recipe-image-input").value = draft.image || "";

  const ingredientsList = document.getElementById("recipe-ingredients-list");
  const stepsList = document.getElementById("recipe-steps-list");
  ingredientsList.innerHTML = "";
  stepsList.innerHTML = "";

  (draft.ingredients && draft.ingredients.length ? draft.ingredients : [{}]).forEach(ingredient => {
    addRecipeIngredientRow(ingredient);
  });

  (draft.steps && draft.steps.length ? draft.steps : [{}]).forEach(step => {
    addRecipeStepRow(step);
  });

  updateStepCookControls();
  recalculateRecipeTimeTotals();
}
