import { initLucide } from './navigation.js';
import { renderDashboard } from './recipe-views.js';
import { STATE, RUNTIME } from './state.js';
import { getAiProvider, getApiKey, saveStateToStorage } from './storage.js';
import { formatQuantity, escapeHtml } from './utils.js';
import { fetchIngredientNutrition } from '../ai.js';

export function renderPantryView() {
  const container = document.getElementById("pantry-manager-tags");
  container.innerHTML = "";

  if (STATE.pantry.length === 0) {
    container.innerHTML = `<p class="empty-state" style="color: var(--text-dim); padding: 20px;">Your pantry is empty. Enter ingredient details above to populate!</p>`;
    return;
  }

  STATE.pantry.forEach((item, index) => {
    const tag = document.createElement("span");
    tag.className = "pantry-tag";
    const nutrition = item.nutrition;
    const nutritionHtml = nutrition
      ? `<span class="pantry-nutrition">~${formatQuantity(nutrition.calories * item.quantity / (item.nutritionQuantity || item.quantity))} kcal | P ${formatQuantity(nutrition.protein_g * item.quantity / (item.nutritionQuantity || item.quantity))}g | C ${formatQuantity(nutrition.carbs_g * item.quantity / (item.nutritionQuantity || item.quantity))}g | F ${formatQuantity(nutrition.fat_g * item.quantity / (item.nutritionQuantity || item.quantity))}g</span>`
      : (item.nutritionLoading ? `<span class="pantry-nutrition">Calculating nutrition...</span>` : "");
    tag.innerHTML = `
      <span>${escapeHtml(item.name)}</span>
      <span class="pantry-tag-qty">${escapeHtml(item.category || "Other")}</span>
      <span class="pantry-tag-qty">${formatQuantity(item.quantity)} ${escapeHtml(item.unit)}</span>
      ${nutritionHtml}
      <button type="button" class="pantry-qty-btn" data-qty="-1" aria-label="Decrease quantity">-</button>
      <button type="button" class="pantry-qty-btn" data-qty="1" aria-label="Increase quantity">+</button>
      <button type="button" data-remove aria-label="Remove ${escapeHtml(item.name)}"><i data-lucide="x" style="width: 14px; height: 14px;"></i></button>
    `;
    tag.querySelectorAll('[data-qty]').forEach(button => button.addEventListener('click', () => adjustPantryQty(index, Number(button.dataset.qty))));
    tag.querySelector('[data-remove]').addEventListener('click', () => removePantryIngredient(index));
    container.appendChild(tag);
  });
  initLucide();
}

export function adjustPantryQty(index, amount) {
  if (index >= 0 && index < STATE.pantry.length) {
    STATE.pantry[index].quantity = Math.round((STATE.pantry[index].quantity + amount) * 100) / 100;
    if (STATE.pantry[index].quantity <= 0) {
      STATE.pantry.splice(index, 1);
    }
    saveStateToStorage();
    renderPantryView();
    renderDashboard();
  }
};

export function addPantryIngredient(name) {
  const val = name.trim();
  if (!val) return;

  const qtyInput = document.getElementById("pantry-quantity-input");
  const categoryInput = document.getElementById("pantry-category-input");
  const unitInput = document.getElementById("pantry-unit-input");
  
  const quantity = qtyInput ? parseFloat(qtyInput.value) : 1;
  if (!Number.isFinite(quantity) || quantity <= 0) { alert('Enter a positive quantity.'); return; }
  const category = categoryInput ? categoryInput.value : "Other";
  const unit = unitInput ? unitInput.value : "pcs";

  const existing = STATE.pantry.find(p => p.name.toLowerCase() === val.toLowerCase());
  if (existing) {
    const reuseNutrition = existing.unit === unit && Boolean(existing.nutrition);
    if (existing.unit === unit) {
      existing.quantity += quantity;
    } else {
      existing.quantity = quantity;
      existing.unit = unit;
    }
    existing.category = category;
    if (!reuseNutrition) {
      existing.nutrition = null;
      existing.nutritionLoading = true;
      fetchAndAttachIngredientNutrition(existing);
    }
  } else {
    const newItem = {
      id: crypto.randomUUID(),
      name: val,
      quantity: quantity,
      unit: unit,
      category: category,
      nutrition: null,
      nutritionLoading: true
    };
    STATE.pantry.push(newItem);
    fetchAndAttachIngredientNutrition(newItem);
  }

  saveStateToStorage();
  renderPantryView();
  renderDashboard();

  if (qtyInput) qtyInput.value = "1";
}

export async function fetchAndAttachIngredientNutrition(itemRef) {
  const scope = RUNTIME.storageScope;
  const quantity = itemRef.quantity;
  const requestId = crypto.randomUUID();
  itemRef.nutritionRequestId = requestId;
  const provider = getAiProvider();
  const apiKey = getApiKey(provider);
  if (!apiKey) {
    delete itemRef.nutritionRequestId;
    itemRef.nutritionLoading = false;
    saveStateToStorage();
    renderPantryView();
    return;
  }

  try {
    const nutrition = await fetchIngredientNutrition(apiKey, {
      name: itemRef.name,
      quantity,
      unit: itemRef.unit,
      category: itemRef.category
    }, provider);
    if (scope !== RUNTIME.storageScope || !STATE.pantry.includes(itemRef) || itemRef.nutritionRequestId !== requestId) return;
    itemRef.nutritionQuantity = quantity;
    itemRef.nutrition = {
      calories: Number.isFinite(Number(nutrition.calories)) ? Number(nutrition.calories) : 0,
      protein_g: Number.isFinite(Number(nutrition.protein_g)) ? Number(nutrition.protein_g) : 0,
      carbs_g: Number.isFinite(Number(nutrition.carbs_g)) ? Number(nutrition.carbs_g) : 0,
      fat_g: Number.isFinite(Number(nutrition.fat_g)) ? Number(nutrition.fat_g) : 0,
      fiber_g: Number.isFinite(Number(nutrition.fiber_g)) ? Number(nutrition.fiber_g) : 0
    };
  } catch (err) {
    console.error("Nutrition fetch failed:", err);
  } finally {
    if (scope !== RUNTIME.storageScope || !STATE.pantry.includes(itemRef) || itemRef.nutritionRequestId !== requestId) return;
    delete itemRef.nutritionRequestId;
    itemRef.nutritionLoading = false;
    saveStateToStorage();
    renderPantryView();
  }
}

export function removePantryIngredient(index) {
  STATE.pantry.splice(index, 1);
  saveStateToStorage();
  renderPantryView();
  renderDashboard();
}
