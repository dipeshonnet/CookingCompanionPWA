import { initLucide } from './navigation.js';
import { renderAddRecipeView } from './recipe-builder.js';
import { getAllRecipes, getVisibleRecipes, normalizeRecipeForStorage } from './recipe-domain.js';
import { STATE } from './state.js';
import { saveStateToStorage } from './storage.js';
import { escapeHtml, cleanText } from './utils.js';

export async function handleRecipeShare() {
  const shareText = `Check out my Cooking Companion recipes: ${window.location.href}`;
  try {
    if (navigator.share) {
      await navigator.share({ title: "Cooking Companion Recipes", text: shareText, url: window.location.href });
    } else {
      await navigator.clipboard.writeText(shareText);
      alert("Recipe link copied to clipboard.");
    }
  } catch (err) {
    console.error("Share failed:", err);
  }
}

export function handleRecipeExport() {
  openRecipeExportModal();
}

export function openRecipeExportModal() {
  const modal = document.getElementById("recipe-export-modal");
  const list = document.getElementById("recipe-export-list");
  if (!modal || !list) return;

  const recipes = getVisibleRecipes();
  if (!recipes.length) {
    alert("No recipes available to export.");
    return;
  }

  list.innerHTML = recipes.map(recipe => `
    <label class="profile-radio-row">
      <input type="checkbox" class="recipe-export-check" value="${escapeHtml(recipe.id)}">
      <span>${escapeHtml(recipe.title)} (${escapeHtml(recipe.category)})</span>
    </label>
  `).join("");

  modal.style.display = "flex";
  initLucide();
}

export function closeRecipeExportModal() {
  const modal = document.getElementById("recipe-export-modal");
  if (modal) modal.style.display = "none";
}

export function confirmRecipeExportSelected() {
  const selectedIds = Array.from(document.querySelectorAll(".recipe-export-check:checked")).map(input => input.value);
  if (!selectedIds.length) {
    alert("Select at least one recipe to export.");
    return;
  }
  const selectedRecipes = getAllRecipes().filter(recipe => selectedIds.includes(recipe.id));
  const payload = {
    exportedAt: new Date().toISOString(),
    recipes: selectedRecipes
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "cooking-companion-selected-recipes.json";
  anchor.click();
  URL.revokeObjectURL(url);
  closeRecipeExportModal();
}

export async function handleRecipeImport(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    if (file.size > 2 * 1024 * 1024) throw new Error('Recipe import exceeds 2 MB');
    const text = await file.text();
    const parsed = JSON.parse(text);
    const incoming = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.recipes) ? parsed.recipes : []);
    if (!incoming.length || incoming.length > 200) {
      alert("No recipes found in this file.");
      return;
    }
    if (incoming.some(recipe => !recipe || typeof recipe !== 'object' || !recipe.title || !Array.isArray(recipe.ingredients) || !Array.isArray(recipe.steps))) throw new Error('Invalid recipe structure');
    const normalized = incoming.map(recipe => normalizeRecipeForStorage({
      ...recipe,
      id: cleanText(recipe.id) || `import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    }));
    const knownIds = new Set(getAllRecipes().map(recipe => recipe.id));
    const unique = normalized.filter(recipe => {
      if (knownIds.has(recipe.id)) return false;
      knownIds.add(recipe.id);
      return true;
    });
    STATE.customRecipes = [...unique, ...STATE.customRecipes];
    saveStateToStorage();
    renderAddRecipeView();
    alert(`Imported ${unique.length} recipe(s). Existing recipe IDs were skipped.`);
  } catch (err) {
    console.error(err);
    alert("Import failed. Please use a valid JSON recipe export file.");
  } finally {
    event.target.value = "";
  }
}
