import { switchView, initLucide } from './navigation.js';
import { normalizeRecipeForStorage, formatDurationLabel, processLabel, normalizeProcessCount } from './recipe-domain.js';
import { STATE, RUNTIME, FALLBACK_RECIPE_IMAGE } from './state.js';
import { getAiProvider, getApiKey, saveStateToStorage } from './storage.js';
import { escapeHtml } from './utils.js';
import { fetchCustomRecipe } from '../ai.js';
import { getProviderConfig } from './ai-providers.js';
import { ingredientLabel } from './ingredient-images.js';
import { recipeSourcesHtml, searchAttributionHtml } from './recipe-sources.js';
import { renderRecipeTimeline } from './recipe-timeline.js';

export async function handleAIGeneration() {
  const generateBtn = document.getElementById("ai-generate-btn");
  if (generateBtn.disabled) return;
  const descriptionInput = document.getElementById('ai-recipe-description');
  const description = descriptionInput.value.trim();
  if (!description || !descriptionInput.checkValidity()) {
    alert('Describe the dish or meal you would like to cook (up to 2,000 characters).');
    descriptionInput.focus();
    return;
  }
  const scope = RUNTIME.storageScope;
  const provider = getAiProvider();
  const apiKey = getApiKey(provider);
  if (!apiKey) {
    alert(`Please configure your ${getProviderConfig(provider).label} API Key in the settings panel above first!`);
    return;
  }

  const dietPref = document.getElementById("ai-diet-preference").value;
  const requestedDiet = STATE.user.dietPreference !== 'None' ? STATE.user.dietPreference : dietPref;
  const difficulty = document.getElementById("ai-difficulty").value;
  const cookCount = normalizeProcessCount(document.getElementById("ai-cook-count")?.value);
  const availableCooks = Number(document.getElementById('ai-available-cooks').value) === 2 ? 2 : 1;

  const loader = document.getElementById("ai-loader");
  const resultPanel = document.getElementById("ai-result-panel");
  const loaderTitle = document.getElementById('ai-loader-title');
  RUNTIME.lastGeneratedRecipeObj = null;
  loaderTitle.textContent = 'Searching recipe websites...';
  loader.style.display = "flex";
  resultPanel.style.display = "none";
  generateBtn.disabled = true;
  generateBtn.style.opacity = "0.5";

  try {
    const generatedData = await fetchCustomRecipe(apiKey, {
      description,
      dietary: requestedDiet,
      complexity: difficulty,
      cookCount,
      availableCooks
    }, provider, { onProgress: () => {
      if (scope !== RUNTIME.storageScope || provider !== getAiProvider()) return false;
      loaderTitle.textContent = 'Building your cooking plan...';
    } });
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
        
        ${recipeSourcesHtml(normalizedGenerated.sources)}
        ${searchAttributionHtml(normalizedGenerated.searchAttribution)}
        <div class="ai-recipe-summary">
          <div>
            <h4 style="font-size: 15px; margin-bottom: 10px; color: var(--accent);"><i data-lucide="shopping-cart"></i> Ingredients Needed</h4>
            <ul class="ingredients-list">
              ${normalizedGenerated.ingredients.map(i => `
                <li class="ingredient-item">${ingredientLabel(i.name)}<span>${escapeHtml(i.amount)} ${escapeHtml(i.unit)}</span></li>
              `).join("")}
            </ul>
          </div>
          <div>
            <h4 style="font-size: 15px; margin-bottom: 10px; color: var(--accent);"><i data-lucide="clock"></i> Timing Breakdown</h4>
            <p style="font-size: 13px; color: var(--text-muted);">Preparation: <strong>${escapeHtml(normalizedGenerated.prepTime)} minutes</strong></p>
            <p style="font-size: 13px; color: var(--text-muted);">Cooking: <strong>${escapeHtml(normalizedGenerated.cookTime)} minutes</strong></p>
            <p style="font-size: 13px; color: var(--text-muted);">Servings yield: <strong>${escapeHtml(normalizedGenerated.servings)} people</strong></p>
            <p style="font-size: 13px; color: var(--text-muted);">Processes: <strong>${escapeHtml(normalizedGenerated.cookCount)} (including primary)</strong></p>
          </div>
        </div>

        <div class="form-group"><label for="ai-preview-cook-count">Preview cooking with</label><select id="ai-preview-cook-count" class="form-control"><option value="1" ${availableCooks === 1 ? 'selected' : ''}>1 cook</option><option value="2" ${availableCooks === 2 ? 'selected' : ''}>2 cooks</option></select></div>
        <div id="ai-recipe-timeline" class="recipe-timeline"></div>
        <h4 style="font-size: 15px; margin-bottom: 12px; color: var(--accent);"><i data-lucide="list-ordered"></i> Preparation Directions</h4>
        <div class="steps-list">
          ${normalizedGenerated.steps.map(s => `
            <div class="step-card">
              <div class="step-card-header">
                <span class="step-card-num">${escapeHtml(s.title)}</span>
                <span style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                  <span class="cook-pill">${escapeHtml(s.actionType)}</span>
                  <span class="cook-pill">${escapeHtml(s.stepType)}</span>
                  ${normalizedGenerated.cookCount > 1 ? `<span class="cook-pill">${escapeHtml(processLabel(s.cook))}</span>` : ""}
                  <span class="step-duration-pill">${formatDurationLabel(s.duration)}</span>
                  <span class="cook-pill">${s.attention === 'passive' ? 'Unattended' : 'Hands-on'}</span>
                </span>
              </div>
              <p class="step-detail-text"><span class="step-detail-item">${ingredientLabel(s.item)}:</span> ${escapeHtml(s.action)}</p>
              <p class="step-prerequisites">Prerequisites: ${s.dependsOn.length ? s.dependsOn.map(id => escapeHtml(normalizedGenerated.steps.find(step => step.id === id).title)).join(', ') : 'None — independent action'}</p>
            </div>
          `).join("")}
        </div>
      `;
      const previewCooks = document.getElementById('ai-preview-cook-count');
      const renderTimeline = () => renderRecipeTimeline('ai-recipe-timeline', normalizedGenerated, { availableCooks: Number(previewCooks.value) });
      previewCooks.addEventListener('change', renderTimeline);
      renderTimeline();

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
    rating: 0,
    image: RUNTIME.lastGeneratedRecipeObj.image || FALLBACK_RECIPE_IMAGE,
    tags: ["AI-Generated", ...(RUNTIME.lastGeneratedRecipeObj.tags || [])]
  });

  STATE.customRecipes.unshift(finalRecipe);
  saveStateToStorage();
  
  alert(`"${finalRecipe.title}" has been added to Recipe successfully!`);
  switchView("ai-generator");
}
