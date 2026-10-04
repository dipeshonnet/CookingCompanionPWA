import { initLucide } from './navigation.js';
import { showRecipeDetailsModal } from './recipe-detail.js';
import { getVisibleRecipes, safeImageSource } from './recipe-domain.js';
import { STATE } from './state.js';
import { saveStateToStorage } from './storage.js';
import { renderActiveTimers } from './timers.js';
import { availableQuantity } from './units.js';
import { formatQuantity, escapeHtml } from './utils.js';

export function renderDashboard() {
  document.getElementById("dashboard-welcome-heading").innerText = `Welcome, ${STATE.user.name}!`;

  // 1. Render curated list recommendations (Top 3 highest rated recipes)
  const recommendations = [...getVisibleRecipes()]
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 3);
  
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
      tag.innerHTML = `${item.name} <span class="pantry-tag-qty" style="padding: 1px 4px; border-radius: 4px; font-size: 9px; margin-left: 4px;">${formatQuantity(item.quantity)} ${item.unit}</span>`;
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
  const safeImage = escapeHtml(safeImageSource(recipe.image));
  const safeTags = (recipe.tags || []).slice(0, 2).map(t => `<span class="recipe-tag">${escapeHtml(t)}</span>`).join("");
  const matchPill = matchPct > 0 
    ? `<span class="recipe-match">${matchPct}% Match</span>` 
    : `<span>${escapeHtml(recipe.cookTime)} mins</span>`;

  card.innerHTML = `
    <div class="recipe-image-wrapper">
      <img class="recipe-image" src="${safeImage}" alt="${safeTitle}" loading="lazy" decoding="async">
      <span class="recipe-badge">${safeCategory}</span>
      <button type="button" class="recipe-favorite ${STATE.user.likedRecipeIds?.includes(recipe.id) ? 'active' : ''}" data-id="${escapeHtml(recipe.id)}" aria-label="Like ${safeTitle}" aria-pressed="${STATE.user.likedRecipeIds?.includes(recipe.id) || false}">
        <i data-lucide="heart" style="width: 16px; height: 16px;"></i>
      </button>
    </div>
    <div class="recipe-content">
      <div class="recipe-tags">
        ${safeTags}
      </div>
      <h3 class="recipe-title">${safeTitle}</h3>
      <p class="recipe-desc">${safeDescription}</p>
      <div class="recipe-meta">
        <span><i data-lucide="star" style="width: 12px; height: 12px; fill: var(--accent); stroke: var(--accent);"></i> ${escapeHtml(recipe.rating)}</span>
        <span><i data-lucide="clock" style="width: 12px; height: 12px;"></i> ${matchPill}</span>
      </div>
    </div>
  `;

  // Attach interactive detail triggers
  card.addEventListener("click", (e) => {
    if (e.target.closest(".recipe-favorite")) {
      e.stopPropagation();
      const fav = card.querySelector(".recipe-favorite");
      const likes = new Set(STATE.user.likedRecipeIds || []);
      if (likes.has(recipe.id)) likes.delete(recipe.id); else likes.add(recipe.id);
      STATE.user.likedRecipeIds = [...likes];
      fav.classList.toggle('active', likes.has(recipe.id));
      fav.setAttribute('aria-pressed', String(likes.has(recipe.id)));
      saveStateToStorage();
      return;
    }
    showRecipeDetailsModal(recipe);
  });

  return card;
}

// ----------------------------------------------------
// VIEW 2: EXPLORE RECIPES
// ----------------------------------------------------
export function renderExploreRecipes() {
  const grid = document.getElementById("explore-recipes-grid");
  grid.innerHTML = "";

  const query = document.getElementById("recipe-search").value.trim().toLowerCase();
  const activeFilterBtn = document.querySelector(".filter-btn.active");
  const categoryFilter = activeFilterBtn ? activeFilterBtn.getAttribute("data-filter") : "All";

  let filtered = getVisibleRecipes();
  if (document.getElementById('recipe-like-btn')?.classList.contains('active')) filtered = filtered.filter(recipe => STATE.user.likedRecipeIds?.includes(recipe.id));

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
