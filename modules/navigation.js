import { renderFAQView } from './faq-view.js';
import { renderPantryView } from './ingredients.js';
import { renderPlannerView } from './planner.js';
import { renderPlayRecipeView } from './play-recipe.js';
import { renderAddRecipeView } from './recipe-builder.js';
import { renderDashboard } from './recipe-views.js';
import { STATE, RUNTIME } from './state.js';
import { renderFloatingTimers } from './active-timer-summary.js';

export function switchView(viewId) {
  if (viewId === "explore") viewId = "ai-generator";
  RUNTIME.currentView = viewId;
  // Hide all sections
  document.querySelectorAll(".view-section").forEach(sec => sec.classList.remove("active"));
  
  // Show target section
  const targetSec = document.getElementById(`view-${viewId}`);
  if (targetSec) {
    targetSec.classList.add("active");
  }

  // Update navigation items active state
  document.querySelectorAll(".nav-item").forEach(item => {
    if (item.getAttribute("data-view") === viewId) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });

  // Handle mobile sidebar auto-closing
  const sidebar = document.getElementById("sidebar-nav");
  if (sidebar && sidebar.classList.contains("open")) {
    sidebar.classList.remove("open");
  }

  // Refresh current view contents
  if (viewId === "dashboard") {
    renderDashboard();
  } else if (viewId === "pantry") {
    renderPantryView();
  } else if (viewId === "ai-generator") {
    renderAddRecipeView();
  } else if (viewId === "play") {
    renderPlayRecipeView();
  } else if (viewId === "planner") {
    renderPlannerView();
  } else if (viewId === "faq") {
    renderFAQView();
  }
  
  window.scrollTo({ top: 0, behavior: "smooth" });
}

export function initLucide() {
  if (typeof lucide !== "undefined") {
    lucide.createIcons();
  }
}

export function renderApp() {
  const authView = document.getElementById("auth-view");
  const appView = document.getElementById("app-view");
  
  if (STATE.user.loggedIn) {
    authView.style.display = "none";
    appView.style.display = "flex";
    
    // Fill sidebar credentials
    document.getElementById("sidebar-name").innerText = STATE.user.name;
    document.getElementById("sidebar-avatar").innerText = STATE.user.name.charAt(0).toUpperCase();
    document.getElementById("mobile-profile-avatar").innerText = STATE.user.name.charAt(0).toUpperCase();
    const roleTag = document.querySelector(".profile-role");
    if (roleTag) roleTag.innerText = `${STATE.user.experience} Cook`;
    
    switchView(RUNTIME.currentView);
  } else {
    authView.style.display = "flex";
    appView.style.display = "none";
  }
  initLucide();
  renderFloatingTimers();
}
