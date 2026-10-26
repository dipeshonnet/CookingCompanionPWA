import { recipeScore, sharedVersion, rateRecipe, ratingLevel, RATING_OPTIONS } from './recipe-community.js';
import { scaleRecipeForPortions, RecipeActionLimitError } from './recipe-portions.js';
import { initLucide } from './navigation.js';
import { showRecipeDetailsModal } from './recipe-detail.js';
import { getVisibleRecipes, getRecipeById, isPersonalRecipe, safeImageSource } from './recipe-domain.js';
import { STATE } from './state.js';
import { renderActiveTimers } from './timers.js';
import { availableQuantity } from './units.js';
import { formatQuantity, escapeHtml } from './utils.js';
import { HANDPICKED_RECIPES } from '../recipes.js';
import { ingredientLabel, ingredientImageSource } from './ingredient-images.js';

function recipeCardImage(recipe) {
  const original = safeImageSource(recipe.image);
  if (original !== 'assets/logo.png') return original;
  const titleWords = new Set((recipe.title || '').toLowerCase().split(/[^a-z0-9]+/).filter(word => word.length > 2));
  const ingredients = recipe.ingredients || [];
  const best = ingredients
    .map(item => ({ name: item.name, score: (item.name || '').toLowerCase().split(/[^a-z0-9]+/).filter(word => titleWords.has(word)).length }))
    .sort((a, b) => b.score - a.score)
    .map(item => ingredientImageSource(item.name))
    .find(Boolean);
  return best || ingredientImageSource(ingredients[0]?.name) || original;
}

export function renderDashboard() {
  document.getElementById("dashboard-welcome-heading").innerText = `Welcome, ${STATE.user.name}!`;

  // 1. Render the fixed handpicked selection in its curated order.
  const recommendations = HANDPICKED_RECIPES.map(recipe => getRecipeById(recipe.id));
  
  const recContainer = document.getElementById("dashboard-recommendations");
  recContainer.innerHTML = "";
  
  recommendations.forEach(recipe => {
    recContainer.appendChild(createRecipeCard(recipe));
  });

  // 2. Render pantry summary
  const pantryTags = document.getElementById("dashboard-pantry-list");
  pantryTags.innerHTML = "";
  
  if (STATE.pantry.length === 0) {
    pantryTags.innerHTML = `<p class="empty-state" style="color: var(--text-dim); font-size: 13px;">Pantry is empty</p>`;
    document.getElementById("pantry-matching-summary").innerHTML = `
      <span style="color: var(--text-dim);">Add items in Pantry tab to see recipe fits!</span>
    `;
  } else {
    STATE.pantry.slice(0, 8).forEach(item => {
      const tag = document.createElement("span");
      tag.className = "pantry-tag";
      tag.style.padding = "4px 10px";
      tag.style.fontSize = "11px";
      tag.innerHTML = `${ingredientLabel(item.name)} <span class="pantry-tag-qty" style="padding: 1px 4px; border-radius: 4px; font-size: 9px; margin-left: 4px;">${formatQuantity(item.quantity)} ${escapeHtml(item.unit)}</span>`;
      pantryTags.appendChild(tag);
    });
    if (STATE.pantry.length > 8) {
      const more = document.createElement("span");
      more.className = "pantry-tag";
      more.style.padding = "4px 10px";
      more.style.fontSize = "11px";
      more.style.background = "rgba(255, 255, 255, 0.02)";
      more.style.borderColor = "var(--border-glass)";
      more.innerText = `+${STATE.pantry.length - 8} more`;
      pantryTags.appendChild(more);
    }

    // Match count calculations
    let perfectMatches = 0;
    getVisibleRecipes().forEach(rec => {
      const match = calculatePantryMatchPercent(rec);
      if (match >= 80) perfectMatches++;
    });

    document.getElementById("pantry-matching-summary").innerHTML = `
      <span style="color: var(--success); font-weight: 700;">${perfectMatches} Recipes</span> ready with your pantry combination!
    `;
  }

  // 3. Render active timers
  renderActiveTimers();
  initLucide();
}

// ----------------------------------------------------
// INGREDIENTS MATCHING ENGINE
// ----------------------------------------------------
export function calculatePantryMatchPercent(recipe) {
  try { recipe = scaleRecipeForPortions(recipe, 1); }
  catch (error) {
    if (!(error instanceof RecipeActionLimitError)) throw error;
    return 0;
  }
  if (STATE.pantry.length === 0 || recipe.ingredients.length === 0) return 0;
  
  let matches = 0;
  const reqCount = recipe.ingredients.length;
  
  recipe.ingredients.forEach(req => {
    const isMatched = availableQuantity(STATE.pantry, req) >= req.amount;
    if (isMatched) matches++;
  });
  
  return Math.round((matches / reqCount) * 100);
}

// Dynamic card generator
export function createRecipeCard(recipe) {
  const card = document.createElement("div");
  card.className = "glass-card recipe-card interactive";
  
  const matchPct = calculatePantryMatchPercent(recipe);
  const safeTitle = escapeHtml(recipe.title);
  const safeCategory = escapeHtml(recipe.category);
  const safeDescription = escapeHtml(recipe.description);
  const safeImage = escapeHtml(recipeCardImage(recipe));
  const safeTags = (recipe.tags || []).slice(0, 2).map(t => `<span class="recipe-tag">${escapeHtml(t)}</span>`).join("");
  let timing = 'Timing unavailable';
  try { timing = `${scaleRecipeForPortions(recipe, 1).cookTime} mins`; }
  catch (error) { if (!(error instanceof RecipeActionLimitError)) throw error; }
  const matchPill = matchPct > 0 
    ? `<span class="recipe-match">${matchPct}% Match</span>` 
    : `<span>${escapeHtml(timing)}</span>`;

  card.innerHTML = `
    <div class="recipe-image-wrapper">
      <img class="recipe-image" src="${safeImage}" alt="${safeTitle}"${recipe.imageCredit ? ` title="${escapeHtml(recipe.imageCredit)}"` : ''} loading="lazy" decoding="async">
      <span class="recipe-badge">${safeCategory}</span>
      <span class="recipe-score" aria-label="${recipeScore(recipe) ? `${recipeScore(recipe).toFixed(1)} out of 5 stars` : 'Not yet rated'}">★ ${recipeScore(recipe) ? `${Number(recipeScore(recipe).toFixed(1))}/5` : 'Unrated'}</span>
    </div>
    <div class="recipe-content">
      <div class="recipe-tags">
        ${isPersonalRecipe(recipe) ? '<span class="recipe-tag personal-recipe-badge">Your version</span>' : ''}
        ${safeTags}
      </div>
      <h3 class="recipe-title">${safeTitle}</h3>
      ${sharedVersion(recipe) ? `<p class="recipe-author">By ${escapeHtml(sharedVersion(recipe).authorName)}</p>` : ''}
      <p class="recipe-desc">${safeDescription}</p>
      <label class="recipe-rating-control">Your rating
        <select class="form-control recipe-rating-select" aria-label="Rate ${safeTitle}">
          <option value="">Rate recipe</option>
          ${RATING_OPTIONS.map(option => `<option value="${option.score}" ${STATE.user.recipeRatings?.[sharedVersion(recipe)?.id || recipe.id] === option.score ? 'selected' : ''}>${option.label} — ★ ${option.score}</option>`).join('')}
        </select>
      </label>
      <div class="recipe-meta">
        <span><i data-lucide="clock" style="width: 12px; height: 12px;"></i> ${matchPill}</span>
      </div>
    </div>
  `;

  // Attach interactive detail triggers
  card.addEventListener("click", (e) => {
    if (e.target.closest('.recipe-rating-control')) return;
    showRecipeDetailsModal(recipe);
  });

  card.querySelector('.recipe-rating-select').addEventListener('change', async event => {
    const select = event.target;
    if (!select.value) return;
    select.disabled = true;
    try {
      await rateRecipe(recipe, Number(select.value));
      renderExploreRecipes();
      renderDashboard();
    } catch (error) {
      console.warn('Rating failed:', error);
      alert('Could not save your rating. Please try again.');
      select.disabled = false;
    }
  });
  return card;
}

// ----------------------------------------------------
// VIEW 2: EXPLORE RECIPES
// ----------------------------------------------------
export function renderExploreRecipes() {
  const count = document.getElementById('explore-recipe-count');
  if (count) count.textContent = getVisibleRecipes().length.toLocaleString();
  const grid = document.getElementById("explore-recipes-grid");
  grid.innerHTML = "";

  const query = document.getElementById("recipe-search").value.trim().toLowerCase();
  const activeFilterBtn = document.querySelector(".filter-btn.active");
  const categoryFilter = activeFilterBtn ? activeFilterBtn.getAttribute("data-filter") : "All";

  let filtered = getVisibleRecipes();
  const ratingFilter = Number(document.getElementById('recipe-rating-filter')?.value);
  if (ratingFilter) filtered = filtered.filter(recipe => ratingLevel(recipeScore(recipe)) === ratingFilter);

  // Search filter
  if (query) {
    filtered = filtered.filter(r => r.title.toLowerCase().includes(query) || r.description.toLowerCase().includes(query));
  }

  // Category tab filter
  if (categoryFilter === "Matched") {
    filtered = filtered
      .map(r => ({ recipe: r, pct: calculatePantryMatchPercent(r) }))
      .filter(x => x.pct > 0)
      .sort((a, b) => b.pct - a.pct)
      .map(x => x.recipe);
  } else if (categoryFilter !== "All") {
    filtered = filtered.filter(r => r.category === categoryFilter);
  }

  if (filtered.length === 0) {
    grid.innerHTML = `<p class="empty-state" style="grid-column: 1/-1; color: var(--text-dim); text-align: center; padding: 40px;">No recipes match the active filters.</p>`;
    return;
  }

  filtered.forEach(recipe => {
    grid.appendChild(createRecipeCard(recipe));
  });
  initLucide();
}
