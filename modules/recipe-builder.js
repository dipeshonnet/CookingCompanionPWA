import { normalizeActionType, inferActionType, actionTypeOptions, actionVideoHtml } from './action-types.js';
import { switchView, initLucide } from './navigation.js';
import { normalizeCookLabel, normalizeProcessCount, processKeys, processLabel, recipeProcessCount, normalizeStepType, inferStepTypeFromAction, normalizeRecipeForStorage, hasCombinedCommands, getDefaultRecipe, getRecipeById } from './recipe-domain.js';
import { renderExploreRecipes } from './recipe-views.js';
import { STATE, RUNTIME, FALLBACK_RECIPE_IMAGE } from './state.js';
import { escapeHtml, cleanText, toNonNegativeNumber } from './utils.js';
import { ingredientThumbnail } from './ingredient-images.js';
import { savePersonalRecipe } from './recipe-personalization.js';

let builderFieldId = 0;
function connectBuilderLabels(row) {
  row.querySelectorAll('.form-group').forEach(group => {
    const control = group.querySelector('input, select, textarea');
    const label = group.querySelector('label');
    if (control && label) {
      control.id = `builder-field-${++builderFieldId}`;
      label.htmlFor = control.id;
    }
  });
}

export function renderAddRecipeView() {
  setRecipeExploreVisibility(RUNTIME.recipeExploreVisible);
  if (RUNTIME.recipeExploreVisible) renderExploreRecipes();
  ensureRecipeBuilderDefaults();
  const aiDiet = document.getElementById("ai-diet-preference");
  if (aiDiet) aiDiet.value = STATE.user.dietPreference || "None";
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
  if (!units.includes(selectedUnit)) units.push(selectedUnit);
  return units.map(unit => `<option value="${escapeHtml(unit)}" ${unit === selectedUnit ? "selected" : ""}>${escapeHtml(unit)}</option>`).join("");
}

export function addRecipeIngredientRow(values = {}, sourceIndex = null) {
  const list = document.getElementById("recipe-ingredients-list");
  if (!list) return;

  const row = document.createElement("div");
  row.className = "recipe-builder-row recipe-ingredient-row";
  row.portionIngredient = structuredClone(values);
  row.portionIngredientIndex = sourceIndex;
  row.innerHTML = `
    <div class="form-group">
      <label>Item</label>
      <div class="ingredient-name-control">
        <span data-ingredient-photo>${ingredientThumbnail(values.name)}</span>
        <input type="text" class="form-control recipe-ingredient-name" placeholder="Tomatoes" value="${escapeHtml(values.name || "")}">
      </div>
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
  connectBuilderLabels(row);
  row.querySelector('.recipe-ingredient-name').addEventListener('input', event => {
    row.querySelector('[data-ingredient-photo]').innerHTML = ingredientThumbnail(event.target.value);
  });
  initLucide();
}

export function addRecipeStepRow(values = {}) {
  const list = document.getElementById("recipe-steps-list");
  if (!list) return;

  const actionType = values.actionType == null ? inferActionType(values.action || values.text || '') : normalizeActionType(values.actionType);
  const durationMinutes = values.duration ? Math.round(values.duration / 60 * 100) / 100 : (values.minutes || "");
  const stepType = normalizeStepType(values.stepType || values.type || inferStepTypeFromAction(values.action || values.text || ""));
  const row = document.createElement("div");
  row.className = "recipe-builder-row recipe-step-row";
  row.portionStep = structuredClone(values);
  row.dataset.stepId = values.id || crypto.randomUUID();
  const previous = list.lastElementChild;
  row.dataset.dependsOn = JSON.stringify(values.dependsOn ?? (previous ? [previous.dataset.stepId] : []));
  const actionTitle = values.title || (values.action || values.text || '').split(/[.!?]/)[0].split(/\s+/).slice(0, 8).join(' ');
  row.innerHTML = `
    <div class="recipe-step-header">
      <h4>${escapeHtml(actionTitle || 'New action')}</h4>
      <button type="button" class="btn-secondary recipe-row-remove" data-remove-step-row aria-label="Remove step" title="Remove step">
        <i data-lucide="trash-2"></i>
      </button>
    </div>
    <div class="form-group"><label>Brief action title</label><input class="form-control recipe-step-title" value="${escapeHtml(actionTitle)}" placeholder="Chop onion" required></div>
    <div class="form-group recipe-step-action-type-field">
      <label>Action type</label>
      <select class="form-control recipe-step-action-type">${actionTypeOptions(actionType)}</select>
      <div class="recipe-step-video">${actionVideoHtml(actionType)}</div>
    </div>
    <div class="form-group recipe-step-item-field">
      <label>Item</label>
      <input type="text" class="form-control recipe-step-item" placeholder="Pasta" value="${escapeHtml(values.item || "")}">
    </div>
    <div class="form-group recipe-step-action-field">
      <label>One action</label>
      <textarea class="form-control recipe-step-action" rows="2" placeholder="Boil until al dente">${escapeHtml(values.action || values.text || "")}</textarea>
      <small class="recipe-step-warning" role="status"></small>
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
      <label>Process</label>
      <select class="form-control recipe-step-cook">
        ${processKeys(document.getElementById("recipe-cook-count-input")?.value).map(key => `<option value="${key}" ${normalizeCookLabel(values.cook) === key ? "selected" : ""}>${processLabel(key)}</option>`).join("")}
      </select>
    </div>
    <div class="form-group recipe-step-attention-field"><label>Attention needed</label><select class="form-control recipe-step-attention"><option value="active">Hands-on — uses one cook</option><option value="passive" ${values.attention === 'passive' ? 'selected' : ''}>Unattended — cook is free</option></select></div>
    <div class="form-group recipe-step-dependency-field"><label>Prerequisites</label><select multiple class="form-control recipe-step-dependencies" aria-label="Action prerequisites"></select><small>Select actions that must finish first. Clear all for an independent action. Use Ctrl or Command to select multiple.</small></div>
  `;
  list.appendChild(row);
  connectBuilderLabels(row);
  updateStepCookControls();
  row.querySelector('.recipe-step-action-type').addEventListener('change', event => {
    row.querySelector('.recipe-step-video').innerHTML = actionVideoHtml(event.target.value);
  });
  updateStepDependencyControls();
  recalculateRecipeTimeTotals();
  initLucide();
}

export function removeRecipeBuilderRow(button, rowClass) {
  const row = button.closest(`.${rowClass}`);
  const list = row ? row.parentElement : null;
  if (!row || !list) return;

  if (rowClass === 'recipe-step-row') {
    const dependents = [...list.querySelectorAll('.recipe-step-row')].filter(other => JSON.parse(other.dataset.dependsOn || '[]').includes(row.dataset.stepId));
    if (dependents.length) {
      alert(`Update prerequisites before removing this action. Used by: ${dependents.map(other => other.querySelector('.recipe-step-title').value || 'Untitled action').join(', ')}`);
      return;
    }
  }

  if (list.querySelectorAll(`.${rowClass}`).length <= 1) {
    alert("Keep at least one row.");
    return;
  }

  row.remove();
  if (rowClass === "recipe-step-row") {
    updateStepDependencyControls();
    recalculateRecipeTimeTotals();
  }
}

export function updateStepDependencyControls() {
  const rows = [...document.querySelectorAll('.recipe-step-row')];
  for (const row of rows) {
    const title = row.querySelector('.recipe-step-title').value || 'New action';
    row.querySelector('.recipe-step-header h4').textContent = title;
    row.querySelector('.recipe-step-warning').textContent = hasCombinedCommands(row.querySelector('.recipe-step-action').value) ? 'This looks like several commands. Split them into individually timed actions.' : '';
    const selected = JSON.parse(row.dataset.dependsOn || '[]');
    const select = row.querySelector('.recipe-step-dependencies');
    select.innerHTML = rows.filter(other => other !== row).map(other => `<option value="${escapeHtml(other.dataset.stepId)}" ${selected.includes(other.dataset.stepId) ? 'selected' : ''}>${escapeHtml(other.querySelector('.recipe-step-title').value || 'Untitled action')}</option>`).join('');
    for (const id of selected.filter(id => !rows.some(other => other.dataset.stepId === id))) {
      const option = new Option(`Missing action: ${id}`, id, true, true);
      select.appendChild(option);
    }
  }
}

export function updateStepCookControls() {
  const cookCountInput = document.getElementById("recipe-cook-count-input");
  const cookCount = normalizeProcessCount(cookCountInput?.value);
  if (cookCountInput) cookCountInput.value = String(cookCount);
  document.querySelectorAll(".recipe-step-cook").forEach(select => {
    const selected = normalizeCookLabel(select.value);
    select.innerHTML = processKeys(cookCount).map(key => `<option value="${key}">${processLabel(key)}</option>`).join('');
    select.value = processKeys(cookCount).includes(selected) ? selected : 'Cook 1';
  });
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
      ...(row.portionIngredient?.gramsPerPiece && row.portionIngredient.name === cleanText(row.querySelector(".recipe-ingredient-name")?.value) ? { gramsPerPiece: row.portionIngredient.gramsPerPiece, pieceLabel: row.portionIngredient.pieceLabel } : {}),
      name: cleanText(row.querySelector(".recipe-ingredient-name")?.value),
      amount: toNonNegativeNumber(row.querySelector(".recipe-ingredient-amount")?.value, 0),
      unit: row.querySelector(".recipe-ingredient-unit")?.value || "pcs"
    }))
    .filter(ing => ing.name);

  if (ingredients.length === 0) {
    alert("Add at least one ingredient.");
    return null;
  }

  const cookCount = normalizeProcessCount(document.getElementById("recipe-cook-count-input")?.value);
  const stepRows = Array.from(document.querySelectorAll(".recipe-step-row"));
  const steps = [];

  for (const row of stepRows) {
    const stepTitle = cleanText(row.querySelector('.recipe-step-title')?.value);
    const item = cleanText(row.querySelector(".recipe-step-item")?.value);
    const action = cleanText(row.querySelector(".recipe-step-action")?.value);
    const minutes = toNonNegativeNumber(row.querySelector(".recipe-step-duration")?.value, 0);
    const stepType = normalizeStepType(row.querySelector(".recipe-step-type")?.value || "Cook");
    const cook = cookCount > 1 ? row.querySelector(".recipe-step-cook")?.value : "Cook 1";

    if (!item && !action && minutes <= 0) continue;

    if (!stepTitle || !item || !action || minutes <= 0) {
      alert("Each action needs a brief title, an item, one instruction, and a time.");
      return null;
    }
    if (hasCombinedCommands(action)) {
      alert(`Split "${stepTitle}" into individually timed actions before saving.`);
      row.querySelector('.recipe-step-action').focus();
      return null;
    }

    const original = row.portionStep;
    const scaling = original?.scaling ? structuredClone(original.scaling) : null;
    if (scaling) {
      const ingredientNamesUnchanged = ingredientRows.length === ingredients.length && ingredientRows.every((item, index) => item.portionIngredientIndex === index && item.portionIngredient?.name === ingredients[index].name);
      if (action !== original.action || item !== original.item || !ingredientNamesUnchanged) { delete scaling.template; delete scaling.quantities; delete scaling.ingredients; }
      if (scaling.mode === 'batch') scaling.secondsPerBatch = scaling.group ? Math.round(minutes * 60) : Math.round(minutes * 60) / Math.ceil(scaling.yield / scaling.capacity);
    }
    steps.push({
      ...(scaling ? { scaling } : {}),
      id: row.dataset.stepId,
      title: stepTitle,
      dependsOn: JSON.parse(row.dataset.dependsOn || '[]'),
      attention: row.querySelector('.recipe-step-attention').value,
      item,
      action,
      actionType: normalizeActionType(row.querySelector('.recipe-step-action-type').value),
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

  // If an explicitly aliased phase was edited or removed, retain the editor's
  // full action sequence rather than silently collapsing their instructions.
  const previous = RUNTIME.recipeEditContext?.portionSteps || stepRows.map(row => row.portionStep).filter(Boolean);
  const groupIds = new Set(previous.filter(step => step.scaling?.group).map(step => step.id));
  const groupChanged = previous.some(original => {
    if (!original.scaling?.group && !original.scaling?.aliasOf) return false;
    const current = steps.find(step => step.id === original.id);
    return !current || (original.scaling?.aliasOf && (current.action !== original.action || current.duration !== original.duration || current.title !== original.title || current.item !== original.item || JSON.stringify(current.dependsOn) !== JSON.stringify(original.dependsOn)));
  });
  if (groupChanged) for (const step of steps) {
    if (groupIds.has(step.id) || step.scaling?.aliasOf) delete step.scaling;
  }

  const tags = cleanText(document.getElementById("recipe-tags-input")?.value)
    .split(",")
    .map(tag => cleanText(tag))
    .filter(Boolean);

  const recipe = normalizeRecipeForStorage({
    stepSchemaVersion: 2,
    id: RUNTIME.recipeEditContext?.id || `custom-${crypto.randomUUID()}`,
    ...(RUNTIME.recipeEditContext?.baseRecipeId ? { baseRecipeId: RUNTIME.recipeEditContext.baseRecipeId } : {}),
    ...(RUNTIME.recipeEditContext?.imageCredit && document.getElementById('recipe-image-input').value === RUNTIME.recipeEditContext.image ? { imageCredit: RUNTIME.recipeEditContext.imageCredit } : {}),
    ...(RUNTIME.recipeEditContext?.sources ? { sources: RUNTIME.recipeEditContext.sources } : {}),
    ...(RUNTIME.recipeEditContext?.searchAttribution ? { searchAttribution: RUNTIME.recipeEditContext.searchAttribution } : {}),
    title,
    description: cleanText(document.getElementById("recipe-description-input")?.value) || "A custom recipe from your kitchen.",
    category: document.getElementById("recipe-category-input")?.value || "Dinner",
    difficulty: document.getElementById("recipe-difficulty-input")?.value || "Medium",
    prepTime: Math.round(toNonNegativeNumber(document.getElementById("recipe-prep-input")?.value, 0)),
    cookTime: Math.round(toNonNegativeNumber(document.getElementById("recipe-cook-time-input")?.value, 0)),
    servings: Math.max(1, Math.round(toNonNegativeNumber(document.getElementById("recipe-servings-input")?.value, 2))),
    cookCount,
    rating: RUNTIME.recipeEditContext?.rating ?? 0,
    image: cleanText(document.getElementById("recipe-image-input")?.value) || FALLBACK_RECIPE_IMAGE,
    tags: RUNTIME.recipeEditContext?.baseRecipeId ? tags : ["Custom", ...tags.filter(tag => tag.toLowerCase() !== "custom")],
    ingredients,
    steps
  });

  return recipe;
}

export function handleCustomRecipeSave(e) {
  e.preventDefault();
  if (RUNTIME.recipeEditContext && RUNTIME.recipeEditContext.scope !== RUNTIME.storageScope) return;

  let recipe;
  try { recipe = collectCustomRecipeFromForm(); }
  catch (error) { alert(error.message); return; }
  if (!recipe) return;

  const editing = Boolean(RUNTIME.recipeEditContext);
  if (!savePersonalRecipe(recipe)) return;
  resetAddRecipeForm();
  if (editing) setRecipeExploreVisibility(true);
  alert(`"${recipe.title}" ${editing ? 'changes saved' : 'has been added to Recipe'}.${RUNTIME.currentAuthUid ? ' Saved on this device and queued for account sync.' : ' Saved on this device.'}`);
  switchView("ai-generator");
}

export function resetAddRecipeForm() {
  RUNTIME.recipeEditContext = null;
  updateRecipeEditorMode();
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
  RUNTIME.recipeEditContext = null;
  updateRecipeEditorMode();
  document.getElementById("recipe-title-input").value = draft.title || "";
  document.getElementById("recipe-description-input").value = draft.description || "";
  document.getElementById("recipe-category-input").value = draft.category || "Dinner";
  document.getElementById("recipe-prep-input").value = draft.prepTime ?? 0;
  document.getElementById("recipe-cook-time-input").value = draft.cookTime || 0;
  document.getElementById("recipe-servings-input").value = draft.servings || 2;
  document.getElementById("recipe-cook-count-input").value = String(recipeProcessCount(draft));
  document.getElementById("recipe-difficulty-input").value = draft.difficulty || "Medium";
  document.getElementById("recipe-tags-input").value = (draft.tags || []).join(", ");
  document.getElementById("recipe-image-input").value = draft.image || "";

  const ingredientsList = document.getElementById("recipe-ingredients-list");
  const stepsList = document.getElementById("recipe-steps-list");
  ingredientsList.innerHTML = "";
  stepsList.innerHTML = "";

  (draft.ingredients && draft.ingredients.length ? draft.ingredients : [{}]).forEach((ingredient, index) => {
    addRecipeIngredientRow(ingredient, index);
  });

  (draft.steps && draft.steps.length ? draft.steps : [{}]).forEach(step => {
    addRecipeStepRow(step);
  });

  updateStepCookControls();
  recalculateRecipeTimeTotals();
}

function updateRecipeEditorMode() {
  const editing = RUNTIME.recipeEditContext;
  const title = document.getElementById('recipe-builder-title');
  if (title) title.textContent = editing ? 'Edit Recipe' : 'Custom Recipe';
  const save = document.getElementById('recipe-save-btn');
  if (save) save.textContent = editing?.baseRecipeId ? 'Save my version' : editing ? 'Save changes' : 'Save Recipe';
  const cancel = document.getElementById('recipe-cancel-edit');
  if (cancel) cancel.hidden = !editing;
  const note = document.getElementById('recipe-editor-note');
  if (note) note.textContent = editing?.baseRecipeId ? 'Changes are private to you. The default recipe stays available through Revert to default.' : '';
}

export function editRecipe(id) {
  const recipe = getRecipeById(id);
  if (!recipe) return;
  if (RUNTIME.recipeEditContext && !confirm('Discard the current recipe draft?')) return;
  document.getElementById('recipe-modal').style.display = 'none';
  switchView('ai-generator');
  populateRecipeFormFromDraft(normalizeRecipeForStorage(structuredClone(recipe)));
  RUNTIME.recipeEditContext = { id, scope: RUNTIME.storageScope, image: recipe.image, imageCredit: recipe.imageCredit, rating: recipe.rating, sources: recipe.sources, searchAttribution: recipe.searchAttribution, portionSteps: structuredClone(recipe.steps),
    ...(getDefaultRecipe(id) ? { baseRecipeId: id } : {}) };
  updateRecipeEditorMode();
  document.getElementById('custom-recipe-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
  document.getElementById('recipe-title-input').focus({ preventScroll: true });
}

export function cancelRecipeEdit() {
  const id = RUNTIME.recipeEditContext?.id;
  resetAddRecipeForm();
  setRecipeExploreVisibility(true);
  renderExploreRecipes();
  if (id) document.getElementById('recipe-explore-panel').scrollIntoView({ behavior: 'smooth' });
}
