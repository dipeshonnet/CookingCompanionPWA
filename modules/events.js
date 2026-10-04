import { handleGoogleSignIn, signInLocalOnly, handleEmailSignIn, handleEmailSignUp, handleLogout } from './auth.js';
import { renderPantryView, addPantryIngredient } from './ingredients.js';
import { switchView } from './navigation.js';
import { saveScheduledMealSelection } from './planner.js';
import { setPlayBackgroundMusicFile } from './play-media.js';
import { resetPlayRecipeSession, startPlayRecipeSession } from './play-recipe.js';
import { openProfileModal, closeProfileModal, saveProfileSettings } from './profile.js';
import { handleAIGeneration, saveGeneratedRecipeToExplore } from './recipe-ai.js';
import { setRecipeExploreVisibility, toggleRecipeExplorePanel, addRecipeIngredientRow, addRecipeStepRow, removeRecipeBuilderRow, updateStepCookControls, recalculateRecipeTimeTotals, handleCustomRecipeSave, resetAddRecipeForm } from './recipe-builder.js';
import { updateRecipeModalIngredientsAndButtons, handleCookMeal, closeCookMealDialog, confirmCookMeal } from './recipe-detail.js';
import { handleRecipeShare, handleRecipeExport, closeRecipeExportModal, confirmRecipeExportSelected, handleRecipeImport } from './recipe-transfer.js';
import { renderDashboard, renderExploreRecipes } from './recipe-views.js';
import { buildRecipeDraftFromTalk, updateVoiceStatus, startRecipeVoiceInput, stopRecipeVoiceInput } from './recipe-voice.js';
import { STATE, RUNTIME } from './state.js';
import { getAiProvider, setAiProvider, getApiKey, setApiKey, saveStateToStorage } from './storage.js';
import { getProviderConfig, updateAiSettingsFields } from './ai-providers.js';
import { startParallelRecipeTimers } from './timers.js';

export function setupEventListeners() {
  document.querySelectorAll('[data-navigate]').forEach(button => button.addEventListener('click', () => switchView(button.dataset.navigate)));
  document.getElementById('btn-login-local')?.addEventListener('click', signInLocalOnly);
  const googleBtn = document.getElementById("btn-login-google");
  if (googleBtn) googleBtn.addEventListener("click", handleGoogleSignIn);
  const emailBtn = document.getElementById("btn-login-email");
  if (emailBtn) emailBtn.addEventListener("click", handleEmailSignIn);
  const appleBtn = document.getElementById("btn-login-apple");
  if (appleBtn) appleBtn.addEventListener("click", () => alert("Apple sign-in is not configured in this build yet."));
  const emailSignInBtn = document.getElementById("btn-auth-email-signin");
  if (emailSignInBtn) emailSignInBtn.addEventListener("click", handleEmailSignIn);
  const emailSignUpBtn = document.getElementById("btn-auth-email-signup");
  if (emailSignUpBtn) emailSignUpBtn.addEventListener("click", handleEmailSignUp);
  const authEmailForm = document.getElementById("auth-email-form");
  if (authEmailForm) {
    authEmailForm.addEventListener("submit", (e) => {
      e.preventDefault();
      handleEmailSignIn();
    });
  }

  // Sidebar logout
  const btnLogout = document.getElementById("btn-logout");
  if (btnLogout) {
    btnLogout.addEventListener("click", handleLogout);
  }

  // Sidebar navigations
  document.querySelectorAll(".nav-item").forEach(item => {
    item.addEventListener("click", () => {
      const view = item.getAttribute("data-view");
      switchView(view);
    });
  });

  // Mobile sidebar toggler
  const mobileToggle = document.getElementById("mobile-menu-toggle");
  const sidebar = document.getElementById("sidebar-nav");
  if (mobileToggle && sidebar) {
    mobileToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      sidebar.classList.toggle("open");
    });
    
    // Close sidebar when clicking outside on mobile
    document.addEventListener("click", (e) => {
      if (sidebar.classList.contains("open") && !sidebar.contains(e.target) && e.target !== mobileToggle) {
        sidebar.classList.remove("open");
      }
    });
  }

  // Pantry controls
  const pantryAddBtn = document.getElementById("pantry-add-btn");
  const pantryInput = document.getElementById("pantry-ingredient-input");
  if (pantryAddBtn && pantryInput) {
    pantryAddBtn.addEventListener("click", () => {
      addPantryIngredient(pantryInput.value);
      pantryInput.value = "";
    });
    pantryInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        addPantryIngredient(pantryInput.value);
        pantryInput.value = "";
      }
    });
  }

  const pantryClearBtn = document.getElementById("pantry-clear-btn");
  if (pantryClearBtn) {
    pantryClearBtn.addEventListener("click", () => {
      STATE.pantry = [];
      saveStateToStorage();
      renderPantryView();
      renderDashboard();
    });
  }

  // Search input exploration filter
  const searchInput = document.getElementById("recipe-search");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      renderExploreRecipes();
    });
  }

  // Filter button triggers in Explore
  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderExploreRecipes();
    });
  });

  const recipeShareBtn = document.getElementById("recipe-share-btn");
  if (recipeShareBtn) recipeShareBtn.addEventListener("click", handleRecipeShare);

  const recipeExploreBtn = document.getElementById("recipe-explore-toggle-btn");
  if (recipeExploreBtn) recipeExploreBtn.addEventListener("click", toggleRecipeExplorePanel);

  const recipeExportBtn = document.getElementById("recipe-export-btn");
  if (recipeExportBtn) recipeExportBtn.addEventListener("click", handleRecipeExport);

  const recipeImportBtn = document.getElementById("recipe-import-btn");
  const recipeImportFile = document.getElementById("recipe-import-file");
  if (recipeImportBtn && recipeImportFile) {
    recipeImportBtn.addEventListener("click", () => recipeImportFile.click());
    recipeImportFile.addEventListener("change", handleRecipeImport);
  }

  const recipeLikeBtn = document.getElementById("recipe-like-btn");
  if (recipeLikeBtn) {
    recipeLikeBtn.addEventListener("click", () => {
      recipeLikeBtn.classList.toggle("active");
      recipeLikeBtn.setAttribute('aria-pressed', String(recipeLikeBtn.classList.contains('active')));
      setRecipeExploreVisibility(true);
      renderExploreRecipes();
    });
  }

  const playRecipeStartBtn = document.getElementById("play-recipe-start-btn");
  if (playRecipeStartBtn) playRecipeStartBtn.addEventListener("click", startPlayRecipeSession);
  const playRecipeResetBtn = document.getElementById("play-recipe-reset-btn");
  if (playRecipeResetBtn) playRecipeResetBtn.addEventListener("click", resetPlayRecipeSession);

  const exportCloseBtn = document.getElementById("recipe-export-close-btn");
  if (exportCloseBtn) exportCloseBtn.addEventListener("click", closeRecipeExportModal);
  const exportCancelBtn = document.getElementById("recipe-export-cancel-btn");
  if (exportCancelBtn) exportCancelBtn.addEventListener("click", closeRecipeExportModal);
  const exportConfirmBtn = document.getElementById("recipe-export-confirm-btn");
  if (exportConfirmBtn) exportConfirmBtn.addEventListener("click", confirmRecipeExportSelected);

  // Each provider has a separate device-local key.
  document.getElementById('ai-provider-select')?.addEventListener('change', event => {
    const provider = event.target.value;
    setAiProvider(provider);
    updateAiSettingsFields('ai', provider, getApiKey(provider));
    updateAiSettingsFields('profile-ai', provider, getApiKey(provider));
  });
  document.getElementById('profile-ai-provider-select')?.addEventListener('change', event => {
    const provider = event.target.value;
    updateAiSettingsFields('profile-ai', provider, getApiKey(provider));
  });
  const saveKeyBtn = document.getElementById("ai-key-save-btn");
  const keyInput = document.getElementById("ai-key-input");
  if (saveKeyBtn && keyInput) {
    saveKeyBtn.addEventListener("click", () => {
      const val = keyInput.value.trim();
      const provider = getAiProvider();
      setApiKey(val, provider);
      updateAiSettingsFields('profile-ai', provider, getApiKey(provider));
      alert(`${getProviderConfig(provider).label} API Key ${val ? 'saved on this device only' : 'cleared'}.`);
    });
  }

  // AI custom recipe generation trigger
  const aiGenerateBtn = document.getElementById("ai-generate-btn");
  if (aiGenerateBtn) {
    aiGenerateBtn.addEventListener("click", handleAIGeneration);
  }

  // Save AI Recipe to Explore
  const aiSaveBtn = document.getElementById("ai-save-recipe-btn");
  if (aiSaveBtn) {
    aiSaveBtn.addEventListener("click", saveGeneratedRecipeToExplore);
  }

  // Custom recipe builder
  const customRecipeForm = document.getElementById("custom-recipe-form");
  if (customRecipeForm) {
    customRecipeForm.addEventListener("submit", handleCustomRecipeSave);
  }

  const addIngredientRowBtn = document.getElementById("recipe-add-ingredient-row");
  if (addIngredientRowBtn) {
    addIngredientRowBtn.addEventListener("click", () => addRecipeIngredientRow());
  }

  const addStepRowBtn = document.getElementById("recipe-add-step-row");
  if (addStepRowBtn) {
    addStepRowBtn.addEventListener("click", () => addRecipeStepRow());
  }

  const ingredientsList = document.getElementById("recipe-ingredients-list");
  if (ingredientsList) {
    ingredientsList.addEventListener("click", (e) => {
      const removeBtn = e.target.closest("[data-remove-ingredient-row]");
      if (removeBtn) {
        removeRecipeBuilderRow(removeBtn, "recipe-ingredient-row");
      }
    });
  }

  const stepsList = document.getElementById("recipe-steps-list");
  if (stepsList) {
    stepsList.addEventListener("click", (e) => {
      const removeBtn = e.target.closest("[data-remove-step-row]");
      if (removeBtn) {
        removeRecipeBuilderRow(removeBtn, "recipe-step-row");
      }
    });
    stepsList.addEventListener("input", (e) => {
      if (e.target.closest(".recipe-step-row")) recalculateRecipeTimeTotals();
    });
    stepsList.addEventListener("change", (e) => {
      if (e.target.closest(".recipe-step-row")) recalculateRecipeTimeTotals();
    });
  }

  const cookCountInput = document.getElementById("recipe-cook-count-input");
  if (cookCountInput) {
    cookCountInput.addEventListener("change", updateStepCookControls);
  }

  const resetRecipeFormBtn = document.getElementById("recipe-reset-form");
  if (resetRecipeFormBtn) {
    resetRecipeFormBtn.addEventListener("click", resetAddRecipeForm);
  }

  const voiceStartBtn = document.getElementById("recipe-voice-start");
  if (voiceStartBtn) {
    voiceStartBtn.addEventListener("click", startRecipeVoiceInput);
  }

  const voiceStopBtn = document.getElementById("recipe-voice-stop");
  if (voiceStopBtn) {
    voiceStopBtn.addEventListener("click", stopRecipeVoiceInput);
  }

  const buildFromTalkBtn = document.getElementById("recipe-build-from-talk");
  if (buildFromTalkBtn) {
    buildFromTalkBtn.addEventListener("click", buildRecipeDraftFromTalk);
  }

  const clearTalkBtn = document.getElementById("recipe-clear-talk");
  if (clearTalkBtn) {
    clearTalkBtn.addEventListener("click", () => {
      const talkNotes = document.getElementById("recipe-talk-notes");
      if (talkNotes) talkNotes.value = "";
      updateVoiceStatus("Voice idle");
    });
  }

  // Modal dialog closer
  const modalCloseBtn = document.getElementById("modal-close-btn");
  if (modalCloseBtn) {
    modalCloseBtn.addEventListener("click", () => {
      document.getElementById("recipe-modal").style.display = "none";
    });
  }
  
  window.addEventListener("click", (e) => {
    const modal = document.getElementById("recipe-modal");
    if (e.target === modal) {
      modal.style.display = "none";
    }
    const profileModal = document.getElementById("profile-modal");
    if (e.target === profileModal) {
      profileModal.style.display = "none";
    }
    const recipeExportModal = document.getElementById("recipe-export-modal");
    if (e.target === recipeExportModal) {
      recipeExportModal.style.display = "none";
    }
    if (e.target === document.getElementById("cook-meal-modal")) closeCookMealDialog();
  });

  // Schedule meal planners modals handlers
  const cancelMealBtn = document.getElementById("btn-select-meal-cancel");
  if (cancelMealBtn) {
    cancelMealBtn.addEventListener("click", () => {
      document.getElementById("select-meal-modal").style.display = "none";
    });
  }

  const saveMealBtn = document.getElementById("btn-select-meal-save");
  if (saveMealBtn) {
    saveMealBtn.addEventListener("click", saveScheduledMealSelection);
  }

  // Printing shopping list trigger
  const printBtn = document.getElementById("planner-print-list");
  if (printBtn) {
    printBtn.addEventListener("click", () => {
      window.print();
    });
  }

  // Recipe Modal Servings adjusters
  const decServingsBtn = document.getElementById("modal-servings-dec");
  const incServingsBtn = document.getElementById("modal-servings-inc");
  if (decServingsBtn && incServingsBtn) {
    decServingsBtn.addEventListener("click", () => {
      if (RUNTIME.activeModalServingsCount > 1) {
        RUNTIME.activeModalServingsCount--;
        RUNTIME.activeModalServingsMultiplier = RUNTIME.activeModalServingsCount / RUNTIME.activeModalRecipe.servings;
        document.getElementById("modal-servings").innerText = RUNTIME.activeModalServingsCount;
        updateRecipeModalIngredientsAndButtons();
      }
    });
    incServingsBtn.addEventListener("click", () => {
      RUNTIME.activeModalServingsCount++;
      RUNTIME.activeModalServingsMultiplier = RUNTIME.activeModalServingsCount / RUNTIME.activeModalRecipe.servings;
      document.getElementById("modal-servings").innerText = RUNTIME.activeModalServingsCount;
      updateRecipeModalIngredientsAndButtons();
    });
  }

  // Recipe Modal Cook Meal button
  const cookMealBtn = document.getElementById("modal-btn-cook");
  if (cookMealBtn) {
    cookMealBtn.addEventListener("click", () => {
      handleCookMeal();
    });
  }
  document.getElementById("cook-meal-close-btn").addEventListener("click", closeCookMealDialog);
  document.getElementById("cook-meal-cancel-btn").addEventListener("click", closeCookMealDialog);
  document.getElementById("cook-meal-confirm-btn").addEventListener("click", confirmCookMeal);
  document.getElementById("cook-meal-toast-close").addEventListener("click", () => {
    document.getElementById("cook-meal-toast").hidden = true;
  });
  document.getElementById("cook-meal-modal").addEventListener("keydown", event => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeCookMealDialog();
    } else if (event.key === "Tab") {
      const buttons = [...document.querySelectorAll('#cook-meal-modal button, #cook-meal-modal input')];
      const first = buttons[0];
      const last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  const parallelTimerBtn = document.getElementById("modal-btn-start-parallel-timers");
  if (parallelTimerBtn) {
    parallelTimerBtn.addEventListener("click", () => {
      if (RUNTIME.activeModalRecipe) startParallelRecipeTimers(RUNTIME.activeModalRecipe);
    });
  }

  // Profile modal
  const profileBtn = document.getElementById("btn-profile");
  if (profileBtn) {
    profileBtn.addEventListener("click", openProfileModal);
  }

  const profileCloseBtn = document.getElementById("profile-close-btn");
  if (profileCloseBtn) {
    profileCloseBtn.addEventListener("click", closeProfileModal);
  }

  const profileCancelBtn = document.getElementById("profile-cancel-btn");
  if (profileCancelBtn) {
    profileCancelBtn.addEventListener("click", closeProfileModal);
  }

  const profileSaveBtn = document.getElementById("profile-save-btn");
  if (profileSaveBtn) {
    profileSaveBtn.addEventListener("click", saveProfileSettings);
  }

  const profileMusicFileInput = document.getElementById("profile-music-file-input");
  if (profileMusicFileInput) {
    profileMusicFileInput.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setPlayBackgroundMusicFile(file);
    });
  }

  const experienceInfoBtn = document.getElementById("experience-info-btn");
  if (experienceInfoBtn) {
    experienceInfoBtn.addEventListener("click", () => {
      alert("Timers are adjusted when playing a recipe: Expert 1x, Somewhat 1.5x, Beginner 2x.");
    });
  }
}
