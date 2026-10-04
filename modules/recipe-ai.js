import { switchView, initLucide } from './navigation.js';
import { normalizeRecipeForStorage, formatDurationLabel } from './recipe-domain.js';
import { STATE, RUNTIME, FALLBACK_RECIPE_IMAGE } from './state.js';
import { getAiProvider, getApiKey, saveStateToStorage } from './storage.js';
import { escapeHtml } from './utils.js';
import { fetchCustomRecipe } from '../ai.js';
import { getProviderConfig } from './ai-providers.js';

export function renderAIIngredientSelector() {
  const selectableGrid = document.getElementById("ai-selectable-ingredients");
  if (!selectableGrid) return;

  selectableGrid.innerHTML = "";

  if (STATE.pantry.length === 0) {
    selectableGrid.innerHTML = `<p class="empty-state" style="color: var(--text-dim); font-size: 13px;">Add ingredients to your Pantry first to select them here.</p>`;
    return;
  }

  STATE.pantry.forEach(item => {
    if (['Vegetarian', 'Vegan'].includes(STATE.user.dietPreference) && ['Meat', 'Seafood'].includes(item.category)) return;
    if (STATE.user.dietPreference === 'Vegan' && item.category === 'Dairy') return;
    const chip = document.createElement("span");
    chip.className = "selectable-tag";
    chip.innerText = item.name;
    chip.addEventListener("click", () => {
      chip.classList.toggle("selected");
    });
    selectableGrid.appendChild(chip);
  });
}

export async function handleAIGeneration() {
  const scope = RUNTIME.storageScope;
  const provider = getAiProvider();
  const apiKey = getApiKey(provider);
  if (!apiKey) {
    alert(`Please configure your ${getProviderConfig(provider).label} API Key in the settings panel above first!`);
    return;
  }

  const selectedChips = document.querySelectorAll("#ai-selectable-ingredients .selectable-tag.selected");
  const selectedIngredients = Array.from(selectedChips).map(c => c.innerText);
  
  if (selectedIngredients.length === 0) {
    alert("Please select at least one ingredient chip to guide the AI!");
    return;
  }

  const dietPref = document.getElementById("ai-diet-preference").value;
  const requestedDiet = STATE.user.dietPreference !== 'None' ? STATE.user.dietPreference : dietPref;
  const difficulty = document.getElementById("ai-difficulty").value;
  const cookCount = Number.parseInt(document.getElementById("ai-cook-count")?.value, 10) === 2 ? 2 : 1;

  const loader = document.getElementById("ai-loader");
  const resultPanel = document.getElementById("ai-result-panel");
  const generateBtn = document.getElementById("ai-generate-btn");
  
  loader.style.display = "flex";
  resultPanel.style.display = "none";
  generateBtn.disabled = true;
  generateBtn.style.opacity = "0.5";

  try {
    const generatedData = await fetchCustomRecipe(apiKey, {
      ingredients: selectedIngredients,
      dietary: requestedDiet,
      complexity: difficulty,
      cookCount
    }, provider);
    if (scope !== RUNTIME.storageScope || provider !== getAiProvider()) return;

    if (generatedData) {
      const normalizedGenerated = normalizeRecipeForStorage({
        ...generatedData,
        cookCount
      });
      RUNTIME.lastGeneratedRecipeObj = normalizedGenerated;
      
      document.getElementById("ai-recipe-title").innerText = normalizedGenerated.title;
      
      const body = document.getElementById("ai-recipe-body");
      body.innerHTML = `
        <p style="font-style: italic; color: var(--text-muted); margin-bottom: 20px;">${escapeHtml(normalizedGenerated.description)}</p>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px;">
          <div>
            <h4 style="font-size: 15px; margin-bottom: 10px; color: var(--accent);"><i data-lucide="shopping-cart"></i> Ingredients Needed</h4>
            <ul class="ingredients-list">
              ${normalizedGenerated.ingredients.map(i => `
                <li class="ingredient-item"><span>${escapeHtml(i.name)}</span><span>${escapeHtml(i.amount)} ${escapeHtml(i.unit)}</span></li>
              `).join("")}
            </ul>
          </div>
          <div>
            <h4 style="font-size: 15px; margin-bottom: 10px; color: var(--accent);"><i data-lucide="clock"></i> Timing Breakdown</h4>
            <p style="font-size: 13px; color: var(--text-muted);">Preparation: <strong>${escapeHtml(normalizedGenerated.prepTime)} minutes</strong></p>
            <p style="font-size: 13px; color: var(--text-muted);">Cooking: <strong>${escapeHtml(normalizedGenerated.cookTime)} minutes</strong></p>
            <p style="font-size: 13px; color: var(--text-muted);">Servings yield: <strong>${escapeHtml(normalizedGenerated.servings)} people</strong></p>
            <p style="font-size: 13px; color: var(--text-muted);">Cooking crew: <strong>${escapeHtml(normalizedGenerated.cookCount)} cook${normalizedGenerated.cookCount === 2 ? "s" : ""}</strong></p>
          </div>
        </div>

        <h4 style="font-size: 15px; margin-bottom: 12px; color: var(--accent);"><i data-lucide="list-ordered"></i> Preparation Directions</h4>
        <div class="steps-list">
          ${normalizedGenerated.steps.map((s, idx) => `
            <div class="step-card">
              <div class="step-card-header">
                <span class="step-card-num">Step ${idx + 1}</span>
                <span style="display: flex; gap: 8px; align-items: center;">
                  ${normalizedGenerated.cookCount === 2 ? `<span class="cook-pill">${escapeHtml(s.cook)}</span>` : ""}
                  <span class="step-duration-pill">${formatDurationLabel(s.duration)}</span>
                </span>
              </div>
              <p class="step-detail-text"><span class="step-detail-item">${escapeHtml(s.item)}:</span> ${escapeHtml(s.action)}</p>
            </div>
          `).join("")}
        </div>
      `;

      resultPanel.style.display = "block";
      resultPanel.scrollIntoView({ behavior: "smooth" });
    }
  } catch (error) {
    console.error(error);
    if (scope === RUNTIME.storageScope && provider === getAiProvider()) alert(`Failed to generate recipe. ${error.message || 'Please verify your API key and internet connection.'}`);
  } finally {
    loader.style.display = "none";
    generateBtn.disabled = false;
    generateBtn.style.opacity = "1";
    initLucide();
  }
}

export function saveGeneratedRecipeToExplore() {
  if (!RUNTIME.lastGeneratedRecipeObj) return;

  const finalRecipe = normalizeRecipeForStorage({
    ...RUNTIME.lastGeneratedRecipeObj,
    id: "ai-" + Date.now(),
    rating: 4.8,
    image: RUNTIME.lastGeneratedRecipeObj.image || FALLBACK_RECIPE_IMAGE,
    tags: ["AI-Generated", ...(RUNTIME.lastGeneratedRecipeObj.tags || [])]
  });

  STATE.customRecipes.unshift(finalRecipe);
  saveStateToStorage();
  
  alert(`"${finalRecipe.title}" has been added to Recipe successfully!`);
  switchView("ai-generator");
}
