const DEFAULT_USER_PROFILE = window.DEFAULT_USER_PROFILE;
const buildUserProfile = window.buildUserProfile;

// Core State Manager
const STATE = {
  user: { ...DEFAULT_USER_PROFILE },
  pantry: [],
  scheduledMeals: {}, // key: "Day-Slot", value: recipeId
  activeTimers: [], // { id, title, stepIndex, cookName, stepLabel, timeLeft, totalDuration, intervalId }
  customRecipes: [], // Custom recipes saved in app
  currentSelectedSlot: null // Active planner slot being edited
};

// LocalStorage Sync Keys
const STORAGE_KEYS = {
  USER: "cook_comp_user",
  PANTRY: "cook_comp_pantry",
  SCHEDULE: "cook_comp_schedule",
  CUSTOM_RECIPES: "cook_comp_custom_recipes",
  GEMINI_KEY: "cook_comp_gemini_key",
  PLAY_VIDEO_CACHE: "cook_comp_play_video_cache"
};

// Servings adjustment active state in Modal
let activeModalRecipe = null;
let activeModalServingsCount = 2;
let activeModalServingsMultiplier = 1.0;
let recipeSpeechRecognition = null;
let recipeSpeechIsListening = false;
let recipeExploreVisible = false;
let playSession = {
  recipeId: "",
  upcoming: [],
  running: { "Cook 1": null, "Cook 2": null },
  completed: [],
  intervalId: null,
  tick: 0
};
let playVideoCache = {};
let playMusicAudio = null;
let playMusicTrack = { name: "", url: "" };
let authUnsubscribe = null;
let currentAuthUid = "";
let suppressCloudSave = false;

const FALLBACK_RECIPE_IMAGE = "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop&q=60";

// Lifecycle Initialization
document.addEventListener("DOMContentLoaded", () => {
  initLucide();
  loadStateFromStorage();
  setupEventListeners();
  initAuthenticationLayer();
  renderApp();
  
  // Register Service Worker for PWA Offline Support
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js')
        .then(reg => console.log('ServiceWorker registered with scope: ', reg.scope))
        .catch(err => console.error('ServiceWorker registration failed: ', err));
    });
  }

  // Request Notification Permissions for Cooking Timers
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
});

function initAuthenticationLayer() {
  if (!window.BackendAuthDB || !window.BackendAuthDB.init()) {
    console.warn("Backend auth/db not configured. Using local-only mode.");
    return;
  }
  authUnsubscribe = window.BackendAuthDB.onAuthStateChanged(async (user) => {
    if (!user) {
      currentAuthUid = "";
      STATE.user = { ...DEFAULT_USER_PROFILE, loggedIn: false };
      saveStateToStorage();
      renderApp();
      return;
    }
    currentAuthUid = user.uid;
    STATE.user.loggedIn = true;
    STATE.user.email = cleanText(user.email || STATE.user.email);
    STATE.user.name = cleanText(user.displayName || STATE.user.name || "Chef Explorer");

    try {
      const cloud = await window.BackendAuthDB.loadUserState(user.uid);
      if (cloud) {
        suppressCloudSave = true;
        hydrateStateFromPayload(cloud);
        suppressCloudSave = false;
      } else {
        await syncStateToCloud();
      }
    } catch (err) {
      console.error("Cloud load failed:", err);
    }
    renderApp();
  });
}

// Load state from localStorage
function loadStateFromStorage() {
  const cachedUser = localStorage.getItem(STORAGE_KEYS.USER);
  if (cachedUser) {
    STATE.user = buildUserProfile(JSON.parse(cachedUser));
  }
  
  const cachedPantry = localStorage.getItem(STORAGE_KEYS.PANTRY);
  if (cachedPantry) {
    const raw = JSON.parse(cachedPantry);
    // Migration: Migrate string arrays to structured objects
    STATE.pantry = raw.map(item => {
      if (typeof item === 'string') {
        return { name: item, quantity: 1, unit: "pcs", category: "Other", nutrition: null };
      }
      const parsedQty = Number.parseFloat(item.quantity ?? item.qty ?? 1);
      return {
        name: cleanText(item.name || item.ingredient || "Item"),
        quantity: Number.isFinite(parsedQty) && parsedQty > 0 ? parsedQty : 1,
        unit: cleanText(item.unit || item.measure || "pcs") || "pcs",
        category: cleanText(item.category || item.classifier || "Other") || "Other",
        nutrition: item.nutrition || null
      };
    });
  }
  
  const cachedSchedule = localStorage.getItem(STORAGE_KEYS.SCHEDULE);
  if (cachedSchedule) {
    STATE.scheduledMeals = JSON.parse(cachedSchedule);
  }

  const cachedCustom = localStorage.getItem(STORAGE_KEYS.CUSTOM_RECIPES);
  if (cachedCustom) {
    STATE.customRecipes = JSON.parse(cachedCustom);
  }

  const cachedVideoCache = localStorage.getItem(STORAGE_KEYS.PLAY_VIDEO_CACHE);
  if (cachedVideoCache) {
    try {
      const parsed = JSON.parse(cachedVideoCache);
      playVideoCache = parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      playVideoCache = {};
    }
  }

  // Key input placeholder filling
  const cachedKey = localStorage.getItem(STORAGE_KEYS.GEMINI_KEY);
  if (cachedKey) {
    const keyInput = document.getElementById("gemini-key-input");
    if (keyInput) keyInput.value = cachedKey;
  }
}

function hydrateStateFromPayload(payload) {
  if (payload.user) STATE.user = buildUserProfile({ ...STATE.user, ...payload.user, loggedIn: true });
  if (Array.isArray(payload.pantry)) STATE.pantry = payload.pantry;
  if (payload.scheduledMeals && typeof payload.scheduledMeals === "object") STATE.scheduledMeals = payload.scheduledMeals;
  if (Array.isArray(payload.customRecipes)) STATE.customRecipes = payload.customRecipes;
  if (payload.playVideoCache && typeof payload.playVideoCache === "object") playVideoCache = payload.playVideoCache;
}

// Save state back to localStorage
function saveStateToStorage() {
  localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(STATE.user));
  localStorage.setItem(STORAGE_KEYS.PANTRY, JSON.stringify(STATE.pantry));
  localStorage.setItem(STORAGE_KEYS.SCHEDULE, JSON.stringify(STATE.scheduledMeals));
  localStorage.setItem(STORAGE_KEYS.CUSTOM_RECIPES, JSON.stringify(STATE.customRecipes));
  syncStateToCloud();
}

function savePlayVideoCache() {
  localStorage.setItem(STORAGE_KEYS.PLAY_VIDEO_CACHE, JSON.stringify(playVideoCache));
  syncStateToCloud();
}

async function syncStateToCloud() {
  if (suppressCloudSave) return;
  if (!currentAuthUid || !window.BackendAuthDB || !window.BackendAuthDB.isReady()) return;
  try {
    await window.BackendAuthDB.saveUserState(currentAuthUid, {
      user: {
        name: STATE.user.name,
        email: STATE.user.email,
        gender: STATE.user.gender,
        dietPreference: STATE.user.dietPreference,
        performerType: STATE.user.performerType,
        performerGender: STATE.user.performerGender,
        playBackgroundMusic: STATE.user.playBackgroundMusic,
        playStepVideo: STATE.user.playStepVideo,
        mutePlayAudio: STATE.user.mutePlayAudio,
        experience: STATE.user.experience
      },
      pantry: STATE.pantry,
      scheduledMeals: STATE.scheduledMeals,
      customRecipes: STATE.customRecipes,
      playVideoCache
    });
  } catch (err) {
    console.error("Cloud save failed:", err);
  }
}

function formatQuantity(value) {
  const numeric = Number.parseFloat(value);
  if (!Number.isFinite(numeric)) return "1";
  const rounded = Math.round(numeric * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

// Navigation & Tab Management
function switchView(viewId) {
  if (viewId === "explore") viewId = "ai-generator";
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

// Setup core event handlers
function setupEventListeners() {
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
      alert("Liked!");
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

  // Gemini Settings Config
  const saveKeyBtn = document.getElementById("gemini-key-save-btn");
  const keyInput = document.getElementById("gemini-key-input");
  if (saveKeyBtn && keyInput) {
    saveKeyBtn.addEventListener("click", () => {
      const val = keyInput.value.trim();
      if (val) {
        localStorage.setItem(STORAGE_KEYS.GEMINI_KEY, val);
        const profileApiInput = document.getElementById("profile-gemini-key-input");
        if (profileApiInput) profileApiInput.value = val;
        alert("API Key saved securely locally.");
      } else {
        localStorage.removeItem(STORAGE_KEYS.GEMINI_KEY);
        const profileApiInput = document.getElementById("profile-gemini-key-input");
        if (profileApiInput) profileApiInput.value = "";
        alert("API Key cleared.");
      }
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
      if (activeModalServingsCount > 1) {
        activeModalServingsCount--;
        activeModalServingsMultiplier = activeModalServingsCount / activeModalRecipe.servings;
        document.getElementById("modal-servings").innerText = activeModalServingsCount;
        updateRecipeModalIngredientsAndButtons();
      }
    });
    incServingsBtn.addEventListener("click", () => {
      activeModalServingsCount++;
      activeModalServingsMultiplier = activeModalServingsCount / activeModalRecipe.servings;
      document.getElementById("modal-servings").innerText = activeModalServingsCount;
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

  const parallelTimerBtn = document.getElementById("modal-btn-start-parallel-timers");
  if (parallelTimerBtn) {
    parallelTimerBtn.addEventListener("click", () => {
      if (activeModalRecipe) startParallelRecipeTimers(activeModalRecipe);
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
      const label = document.getElementById("profile-music-file-name");
      if (label) label.innerText = file.name;
    });
  }

  const experienceInfoBtn = document.getElementById("experience-info-btn");
  if (experienceInfoBtn) {
    experienceInfoBtn.addEventListener("click", () => {
      alert("Timers will get adjusted when playing receipe.");
    });
  }
}

// Initialise Lucide icons
function initLucide() {
  if (typeof lucide !== "undefined") {
    lucide.createIcons();
  }
}

// Authentication handling
async function handleGoogleSignIn() {
  if (!window.BackendAuthDB || !window.BackendAuthDB.isReady()) {
    alert("Authentication backend is not configured yet.");
    return;
  }
  try {
    await window.BackendAuthDB.signInGoogle();
  } catch (err) {
    console.error(err);
    alert("Google sign-in failed.");
  }
}

function getAuthCredentialsFromInputs() {
  const email = cleanText(document.getElementById("auth-email-input")?.value || "");
  const password = String(document.getElementById("auth-password-input")?.value || "");
  if (!email || !password) {
    alert("Enter email and password.");
    return null;
  }
  return { email, password };
}

async function handleEmailSignIn() {
  if (!window.BackendAuthDB || !window.BackendAuthDB.isReady()) {
    alert("Authentication backend is not configured yet.");
    return;
  }
  const creds = getAuthCredentialsFromInputs();
  if (!creds) return;
  try {
    await window.BackendAuthDB.signInEmail(creds.email, creds.password);
  } catch (err) {
    console.error(err);
    alert("Email sign-in failed.");
  }
}

async function handleEmailSignUp() {
  if (!window.BackendAuthDB || !window.BackendAuthDB.isReady()) {
    alert("Authentication backend is not configured yet.");
    return;
  }
  const creds = getAuthCredentialsFromInputs();
  if (!creds) return;
  try {
    await window.BackendAuthDB.signUpEmail(creds.email, creds.password);
  } catch (err) {
    console.error(err);
    alert("Email sign-up failed.");
  }
}

function handleLogout() {
  if (window.BackendAuthDB && window.BackendAuthDB.isReady()) {
    window.BackendAuthDB.signOut().catch(err => console.error(err));
  } else {
    STATE.user = { ...DEFAULT_USER_PROFILE };
    STATE.scheduledMeals = {};
    saveStateToStorage();
    renderApp();
  }
}

// Render dynamic components based on authentication state
function renderApp() {
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
    
    switchView("dashboard");
  } else {
    authView.style.display = "flex";
    appView.style.display = "none";
  }
  initLucide();
}

function openProfileModal() {
  const modal = document.getElementById("profile-modal");
  if (!modal) return;

  const nameInput = document.getElementById("profile-name-input");
  const genderInput = document.getElementById("profile-gender-input");
  const dietInput = document.getElementById("profile-diet-input");
  const performerTypeInput = document.getElementById("profile-performer-type-input");
  const performerGenderInput = document.getElementById("profile-performer-gender-input");
  const playMusicInput = document.getElementById("profile-play-music-input");
  const playVideoInput = document.getElementById("profile-play-video-input");
  const muteAudioInput = document.getElementById("profile-mute-audio-input");
  const musicNameLabel = document.getElementById("profile-music-file-name");
  const emailInput = document.getElementById("profile-email-input");
  const apiInput = document.getElementById("profile-gemini-key-input");

  if (nameInput) nameInput.value = STATE.user.name || "";
  if (genderInput) genderInput.value = STATE.user.gender || "Prefer not to say";
  if (dietInput) dietInput.value = STATE.user.dietPreference || "None";
  if (performerTypeInput) performerTypeInput.value = STATE.user.performerType || "Human";
  if (performerGenderInput) performerGenderInput.value = STATE.user.performerGender || "Female";
  if (playMusicInput) playMusicInput.checked = Boolean(STATE.user.playBackgroundMusic);
  if (playVideoInput) playVideoInput.checked = STATE.user.playStepVideo !== false;
  if (muteAudioInput) muteAudioInput.checked = Boolean(STATE.user.mutePlayAudio);
  if (musicNameLabel) musicNameLabel.innerText = playMusicTrack.name || "No file selected";
  if (emailInput) emailInput.value = STATE.user.email || "";
  if (apiInput) apiInput.value = localStorage.getItem(STORAGE_KEYS.GEMINI_KEY) || "";

  const experience = STATE.user.experience || "Expert";
  document.querySelectorAll("input[name='profile-experience']").forEach(radio => {
    radio.checked = radio.value === experience;
  });

  modal.style.display = "flex";
  initLucide();
}

function closeProfileModal() {
  const modal = document.getElementById("profile-modal");
  if (modal) modal.style.display = "none";
}

function saveProfileSettings() {
  const nameInput = document.getElementById("profile-name-input");
  const genderInput = document.getElementById("profile-gender-input");
  const dietInput = document.getElementById("profile-diet-input");
  const performerTypeInput = document.getElementById("profile-performer-type-input");
  const performerGenderInput = document.getElementById("profile-performer-gender-input");
  const playMusicInput = document.getElementById("profile-play-music-input");
  const playVideoInput = document.getElementById("profile-play-video-input");
  const muteAudioInput = document.getElementById("profile-mute-audio-input");
  const apiInput = document.getElementById("profile-gemini-key-input");
  const selectedExperience = document.querySelector("input[name='profile-experience']:checked");

  const nextName = cleanText(nameInput?.value || STATE.user.name);
  STATE.user.name = nextName || STATE.user.name;
  STATE.user.gender = cleanText(genderInput?.value || "Prefer not to say");
  STATE.user.dietPreference = cleanText(dietInput?.value || "None");
  STATE.user.performerType = cleanText(performerTypeInput?.value || "Human");
  STATE.user.performerGender = cleanText(performerGenderInput?.value || "Female");
  STATE.user.playBackgroundMusic = Boolean(playMusicInput?.checked);
  STATE.user.playStepVideo = playVideoInput ? Boolean(playVideoInput.checked) : true;
  STATE.user.mutePlayAudio = Boolean(muteAudioInput?.checked);
  STATE.user.experience = selectedExperience ? selectedExperience.value : "Expert";

  const apiKeyVal = cleanText(apiInput?.value || "");
  if (apiKeyVal) {
    localStorage.setItem(STORAGE_KEYS.GEMINI_KEY, apiKeyVal);
  } else {
    localStorage.removeItem(STORAGE_KEYS.GEMINI_KEY);
  }

  const aiInput = document.getElementById("gemini-key-input");
  if (aiInput) aiInput.value = apiKeyVal;

  if (!STATE.user.playBackgroundMusic) {
    stopPlayBackgroundMusic();
  }

  saveStateToStorage();
  renderApp();
  closeProfileModal();
}

function getExperienceTimerMultiplier() {
  if (STATE.user.experience === "Beginner") return 2.0;
  if (STATE.user.experience === "Somewhat") return 1.5;
  return 1.0;
}

function recipeMatchesDietPreference(recipe, preference = STATE.user.dietPreference || "None") {
  if (!preference || preference === "None") return true;
  const tags = (recipe.tags || []).map(tag => cleanText(tag).toLowerCase());
  const pref = cleanText(preference).toLowerCase();

  if (pref === "vegetarian") return tags.includes("vegetarian") || tags.includes("vegan");
  if (pref === "low-carb") return tags.includes("low-carb") || tags.includes("keto");
  if (pref === "keto") return tags.includes("keto") || tags.includes("low-carb");
  return tags.includes(pref);
}

// Get all recipe lists combined (curated + custom recipes)
function getAllRecipes() {
  return [...APP_RECIPES, ...STATE.customRecipes];
}

function getVisibleRecipes() {
  return getAllRecipes().filter(recipe => recipeMatchesDietPreference(recipe));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function toNonNegativeNumber(value, fallback = 0) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizeCookLabel(value) {
  const raw = cleanText(value).toLowerCase();
  return raw.includes("2") || raw.includes("two") || raw.includes("second") ? "Cook 2" : "Cook 1";
}

function normalizeStepType(value) {
  const raw = cleanText(value).toLowerCase();
  return raw === "prep" ? "Prep" : "Cook";
}

function inferStepTypeFromAction(actionText) {
  const action = cleanText(actionText).toLowerCase();
  if (!action) return "Cook";
  const prepHint = /\b(chop|slice|dice|mince|peel|wash|rinse|measure|mix|whisk|marinate|soak|prep|preheat)\b/i;
  return prepHint.test(action) ? "Prep" : "Cook";
}

function inferStepItem(text) {
  const source = cleanText(text);
  const splitMatch = source.match(/^([^:-]{2,36})[:-]\s*(.+)$/);
  return splitMatch ? splitMatch[1].trim() : "";
}

function normalizeStep(step, index, cookCount = 1) {
  const item = cleanText(step.item || step.ingredient || inferStepItem(step.text)) || `Task ${index + 1}`;
  const action = cleanText(step.action || step.whatToDo || step.text) || "Prepare";
  const text = cleanText(step.text) || `${item}: ${action}`;
  const duration = Math.max(0, Math.round(toNonNegativeNumber(step.duration, 0)));

  return {
    item,
    action,
    duration,
    stepType: normalizeStepType(step.stepType || step.type || inferStepTypeFromAction(action)),
    cook: cookCount === 2 ? normalizeCookLabel(step.cook || step.assignee || step.person) : "Cook 1",
    text
  };
}

function deriveCookTimeFromSteps(steps, cookCount = 1) {
  if (!steps.length) return 0;

  if (cookCount === 2) {
    const cookTotals = { "Cook 1": 0, "Cook 2": 0 };
    steps.forEach(step => {
      const cook = normalizeCookLabel(step.cook);
      cookTotals[cook] += step.duration || 0;
    });
    return Math.max(1, Math.ceil(Math.max(cookTotals["Cook 1"], cookTotals["Cook 2"]) / 60));
  }

  const totalSeconds = steps.reduce((sum, step) => sum + (step.duration || 0), 0);
  return Math.max(1, Math.ceil(totalSeconds / 60));
}

function normalizeRecipeForStorage(recipe) {
  const cookCount = Number.parseInt(recipe.cookCount, 10) === 2 ? 2 : 1;
  const steps = Array.isArray(recipe.steps)
    ? recipe.steps.map((step, index) => normalizeStep(step, index, cookCount))
    : [];

  return {
    ...recipe,
    cookCount,
    image: cleanText(recipe.image) || FALLBACK_RECIPE_IMAGE,
    rating: toNonNegativeNumber(recipe.rating, 4.7),
    ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients : [],
    tags: Array.isArray(recipe.tags) && recipe.tags.length ? recipe.tags : ["Custom"],
    steps,
    cookTime: toNonNegativeNumber(recipe.cookTime, 0) || deriveCookTimeFromSteps(steps, cookCount)
  };
}

function formatDurationLabel(seconds) {
  const total = Math.max(0, Math.round(seconds || 0));
  if (total <= 0) return "No timer";

  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  if (minutes === 0) return `${secs}s`;
  if (secs === 0) return `${minutes}m`;
  return `${minutes}m ${secs}s`;
}

// ----------------------------------------------------
// VIEW 1: DASHBOARD RENDERING
// ----------------------------------------------------
function renderDashboard() {
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
function calculatePantryMatchPercent(recipe) {
  if (STATE.pantry.length === 0) return 0;
  
  let matches = 0;
  const reqCount = recipe.ingredients.length;
  
  recipe.ingredients.forEach(req => {
    const isMatched = STATE.pantry.some(p => {
      const itemLower = p.name.toLowerCase();
      const reqLower = req.name.toLowerCase();
      return reqLower.includes(itemLower) || itemLower.includes(reqLower);
    });
    if (isMatched) matches++;
  });
  
  return Math.round((matches / reqCount) * 100);
}

// Dynamic card generator
function createRecipeCard(recipe) {
  const card = document.createElement("div");
  card.className = "glass-card recipe-card interactive";
  
  const matchPct = calculatePantryMatchPercent(recipe);
  const safeTitle = escapeHtml(recipe.title);
  const safeCategory = escapeHtml(recipe.category);
  const safeDescription = escapeHtml(recipe.description);
  const safeImage = escapeHtml(recipe.image || FALLBACK_RECIPE_IMAGE);
  const safeTags = (recipe.tags || []).slice(0, 2).map(t => `<span class="recipe-tag">${escapeHtml(t)}</span>`).join("");
  const matchPill = matchPct > 0 
    ? `<span class="recipe-match">${matchPct}% Match</span>` 
    : `<span>${escapeHtml(recipe.cookTime)} mins</span>`;

  card.innerHTML = `
    <div class="recipe-image-wrapper">
      <img class="recipe-image" src="${safeImage}" alt="${safeTitle}">
      <span class="recipe-badge">${safeCategory}</span>
      <div class="recipe-favorite" data-id="${recipe.id}">
        <i data-lucide="heart" style="width: 16px; height: 16px;"></i>
      </div>
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
      fav.classList.toggle("active");
      return;
    }
    showRecipeDetailsModal(recipe);
  });

  return card;
}

// ----------------------------------------------------
// VIEW 2: EXPLORE RECIPES
// ----------------------------------------------------
function renderExploreRecipes() {
  const grid = document.getElementById("explore-recipes-grid");
  grid.innerHTML = "";

  const query = document.getElementById("recipe-search").value.trim().toLowerCase();
  const activeFilterBtn = document.querySelector(".filter-btn.active");
  const categoryFilter = activeFilterBtn ? activeFilterBtn.getAttribute("data-filter") : "All";

  let filtered = getVisibleRecipes();

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

// ----------------------------------------------------
// VIEW 3: PANTRY VIEW & STATE ACTIONS
// ----------------------------------------------------
function renderPantryView() {
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
      ? `<span class="pantry-nutrition">~${formatQuantity(nutrition.calories)} kcal | P ${formatQuantity(nutrition.protein_g)}g | C ${formatQuantity(nutrition.carbs_g)}g | F ${formatQuantity(nutrition.fat_g)}g</span>`
      : (item.nutritionLoading ? `<span class="pantry-nutrition">Calculating nutrition...</span>` : "");
    tag.innerHTML = `
      <span>${escapeHtml(item.name)}</span>
      <span class="pantry-tag-qty">${escapeHtml(item.category || "Other")}</span>
      <span class="pantry-tag-qty">${formatQuantity(item.quantity)} ${item.unit}</span>
      ${nutritionHtml}
      <button class="pantry-qty-btn" onclick="adjustPantryQty(${index}, -1)" aria-label="Decrease quantity">-</button>
      <button class="pantry-qty-btn" onclick="adjustPantryQty(${index}, 1)" aria-label="Increase quantity">+</button>
      <button onclick="removePantryIngredient(${index})" aria-label="Remove ${item.name}"><i data-lucide="x" style="width: 14px; height: 14px;"></i></button>
    `;
    container.appendChild(tag);
  });
  initLucide();
}

window.adjustPantryQty = function(index, amount) {
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

function addPantryIngredient(name) {
  const val = name.trim();
  if (!val) return;

  const qtyInput = document.getElementById("pantry-quantity-input");
  const categoryInput = document.getElementById("pantry-category-input");
  const unitInput = document.getElementById("pantry-unit-input");
  
  const quantity = qtyInput ? parseFloat(qtyInput.value) || 1 : 1;
  const category = categoryInput ? categoryInput.value : "Other";
  const unit = unitInput ? unitInput.value : "pcs";

  const existing = STATE.pantry.find(p => p.name.toLowerCase() === val.toLowerCase());
  if (existing) {
    if (existing.unit === unit) {
      existing.quantity += quantity;
    } else {
      existing.quantity = quantity;
      existing.unit = unit;
    }
    existing.category = category;
    existing.nutrition = null;
    existing.nutritionLoading = true;
    fetchAndAttachIngredientNutrition(existing);
  } else {
    const newItem = {
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

async function fetchAndAttachIngredientNutrition(itemRef) {
  const apiKey = localStorage.getItem(STORAGE_KEYS.GEMINI_KEY);
  if (!apiKey || typeof fetchIngredientNutritionFromGemini !== "function") {
    itemRef.nutritionLoading = false;
    saveStateToStorage();
    renderPantryView();
    return;
  }

  try {
    const nutrition = await fetchIngredientNutritionFromGemini(apiKey, {
      name: itemRef.name,
      quantity: itemRef.quantity,
      unit: itemRef.unit,
      category: itemRef.category
    });
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
    itemRef.nutritionLoading = false;
    saveStateToStorage();
    renderPantryView();
  }
}

function removePantryIngredient(index) {
  STATE.pantry.splice(index, 1);
  saveStateToStorage();
  renderPantryView();
  renderDashboard();
}

// ----------------------------------------------------
// VIEW 4: ADD RECIPE & OPTIONAL AI GENERATOR
// ----------------------------------------------------
let lastGeneratedRecipeObj = null;

function renderAddRecipeView() {
  setRecipeExploreVisibility(recipeExploreVisible);
  if (recipeExploreVisible) renderExploreRecipes();
  ensureRecipeBuilderDefaults();
  const aiDiet = document.getElementById("ai-diet-preference");
  if (aiDiet) aiDiet.value = STATE.user.dietPreference || "None";
  renderAIIngredientSelector();
  updateStepCookControls();
  initLucide();
}

function setRecipeExploreVisibility(visible) {
  recipeExploreVisible = Boolean(visible);
  const panel = document.getElementById("recipe-explore-panel");
  const toggleBtn = document.getElementById("recipe-explore-toggle-btn");
  if (panel) panel.style.display = recipeExploreVisible ? "block" : "none";
  if (toggleBtn) {
    toggleBtn.classList.toggle("active", recipeExploreVisible);
    toggleBtn.innerHTML = recipeExploreVisible
      ? '<i data-lucide="chevron-up"></i> Explore'
      : '<i data-lucide="compass"></i> Explore';
  }
  initLucide();
}

function toggleRecipeExplorePanel() {
  const next = !recipeExploreVisible;
  setRecipeExploreVisibility(next);
  if (next) renderExploreRecipes();
}

function renderAIGeneratorView() {
  renderAddRecipeView();
}

function ensureRecipeBuilderDefaults() {
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

function unitOptions(selectedUnit = "pcs") {
  const units = ["pcs", "g", "ml", "cup", "tbsp", "tsp", "cloves", "slices", "pinch"];
  return units.map(unit => `<option value="${unit}" ${unit === selectedUnit ? "selected" : ""}>${unit}</option>`).join("");
}

function addRecipeIngredientRow(values = {}) {
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

function addRecipeStepRow(values = {}) {
  const list = document.getElementById("recipe-steps-list");
  if (!list) return;

  const durationMinutes = values.duration ? Math.round(values.duration / 60) : (values.minutes || "");
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
      <input type="number" class="form-control recipe-step-duration" min="0.1" step="0.5" value="${escapeHtml(durationMinutes)}" placeholder="8">
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

function removeRecipeBuilderRow(button, rowClass) {
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

function updateStepCookControls() {
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

function recalculateRecipeTimeTotals() {
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

  prepInput.value = String(Math.round(prepMinutes));
  cookInput.value = String(Math.round(cookMinutes));
}

function collectCustomRecipeFromForm() {
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

function handleCustomRecipeSave(e) {
  e.preventDefault();

  const recipe = collectCustomRecipeFromForm();
  if (!recipe) return;

  STATE.customRecipes.unshift(recipe);
  saveStateToStorage();
  resetAddRecipeForm();
  alert(`"${recipe.title}" has been added to Recipe.`);
  switchView("ai-generator");
}

function resetAddRecipeForm() {
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

function populateRecipeFormFromDraft(draft) {
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

function getNumberFromWordOrDigits(value) {
  const normalized = cleanText(value).toLowerCase();
  const words = {
    one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
    sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
    thirty: 30, forty: 40, fifty: 50, sixty: 60
  };

  if (words[normalized]) return words[normalized];

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDurationToSeconds(text) {
  const match = cleanText(text).match(/(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty)\s*(hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)\b/i);
  if (!match) return 0;

  const amount = getNumberFromWordOrDigits(match[1]);
  const unit = match[2].toLowerCase();
  if (unit.startsWith("h")) return Math.round(amount * 3600);
  if (unit.startsWith("s")) return Math.round(amount);
  return Math.round(amount * 60);
}

function normalizeUnit(unit) {
  const raw = cleanText(unit).toLowerCase();
  const map = {
    gram: "g",
    grams: "g",
    milliliter: "ml",
    milliliters: "ml",
    tablespoon: "tbsp",
    tablespoons: "tbsp",
    teaspoon: "tsp",
    teaspoons: "tsp",
    piece: "pcs",
    pieces: "pcs",
    clove: "cloves",
    slice: "slices"
  };
  return map[raw] || raw || "pcs";
}

function parseIngredientPhrase(phrase) {
  let text = cleanText(phrase)
    .replace(/^(ingredients?|add)\s*[:,-]?\s*/i, "")
    .replace(/^\d+[\).:-]\s*/, "")
    .replace(/[.]+$/, "");

  if (!text) return null;

  let match = text.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?\s+(.+)$/);
  if (match) {
    return {
      name: cleanText(match[3]),
      amount: toNonNegativeNumber(match[1], 1),
      unit: normalizeUnit(match[2] || "pcs")
    };
  }

  match = text.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?$/);
  if (match) {
    return {
      name: cleanText(match[1]),
      amount: toNonNegativeNumber(match[2], 1),
      unit: normalizeUnit(match[3] || "pcs")
    };
  }

  return { name: text, amount: 1, unit: "pcs" };
}

function extractSection(text, startWords, endWords) {
  const lower = text.toLowerCase();
  const starts = startWords
    .map(word => lower.indexOf(word))
    .filter(index => index >= 0);

  if (starts.length === 0) return "";

  const startIndex = Math.min(...starts);
  const afterStart = startIndex + startWords.find(word => lower.indexOf(word) === startIndex).length;
  const endIndexes = endWords
    .map(word => lower.indexOf(word, afterStart))
    .filter(index => index > afterStart);
  const endIndex = endIndexes.length ? Math.min(...endIndexes) : text.length;

  return text.slice(afterStart, endIndex);
}

function parseStepPhrase(phrase, fallbackIndex) {
  let text = cleanText(phrase)
    .replace(/^(steps?|directions?|method)\s*[:,-]?\s*/i, "")
    .replace(/^(step\s*)?(one|two|three|four|five|six|seven|eight|nine|ten|\d+)[\).:-]?\s*/i, "");

  if (!text) return null;

  const duration = parseDurationToSeconds(text) || 60;
  const cook = normalizeCookLabel((text.match(/\b(?:cook|person)\s*(1|2|one|two)\b/i) || [])[0] || "");
  const itemMarkerPattern = /\b(?:item|ingredient)\s*[:\-]?\s*([^,.;]+?)(?=\s+(?:boil|simmer|warm|cook|bake|fry|chop|slice|mix|stir|saute|serve|zest|garnish|for|to)\b|,|;|\.|$)/i;
  const itemMatch = text.match(itemMarkerPattern);
  const colonItem = text.match(/^([^:-]{2,34})[:-]\s*(.+)$/);
  const item = cleanText(itemMatch?.[1] || colonItem?.[1] || `Task ${fallbackIndex + 1}`);
  const action = text
    .replace(/\b(?:cook|person)\s*(1|2|one|two)\b/ig, "")
    .replace(new RegExp(itemMarkerPattern.source, "ig"), "")
    .trim() || text;

  return {
    item,
    action,
    duration,
    cook,
    text: `${item}: ${action}`
  };
}

function parseRecipeDraftFromText(rawText) {
  const text = cleanText(rawText).replace(/\r/g, "\n");
  const titleMatch = text.match(/(?:title|recipe(?:\s+name)?)\s*[:\-]?\s*([^.\n]+)/i);
  const descriptionMatch = text.match(/(?:description|summary)\s*[:\-]?\s*([^.\n]+)/i);
  const servingsMatch = text.match(/(?:servings?|serves)\s*[:\-]?\s*(\d+)/i);
  const prepMatch = text.match(/(?:prep|preparation)\s*[:\-]?\s*(\d+)\s*(?:minutes?|mins?|m)?/i);
  const cookCount = /\b(?:cook|person)\s*(2|two)\b/i.test(text) ? 2 : 1;
  const firstLine = cleanText(text.split(/\n|[.]/).find(line => !/ingredients?|steps?|directions?|method/i.test(line)) || "");

  const ingredientSection = extractSection(text, ["ingredients", "ingredient"], ["steps", "step", "directions", "method"]);
  const ingredientPhrases = (ingredientSection || text)
    .split(/\n|,|;/)
    .map(parseIngredientPhrase)
    .filter(Boolean)
    .filter(ingredient => !/step|direction|method|title|description/i.test(ingredient.name));

  const stepSection = extractSection(text, ["steps", "step", "directions", "method"], []);
  let stepPhrases = stepSection
    .replace(/\bstep\s*(one|two|three|four|five|six|seven|eight|nine|ten|\d+)[\).:-]?\s*/ig, "\n")
    .split(/\n|;/)
    .map(cleanText)
    .filter(Boolean);

  if (stepPhrases.length === 0) {
    stepPhrases = text.split(/\bthen\b|;/i).map(cleanText).filter(line => /minute|second|hour|cook|person|step/i.test(line));
  }

  const steps = stepPhrases
    .map((phrase, index) => parseStepPhrase(phrase, index))
    .filter(Boolean);

  const normalizedSteps = steps.length ? steps : [{
    item: "Recipe",
    action: text,
    duration: 60,
    cook: "Cook 1",
    text
  }];

  const cookTime = deriveCookTimeFromSteps(normalizedSteps, cookCount);

  return {
    title: cleanText(titleMatch?.[1]) || firstLine || "Custom Spoken Recipe",
    description: cleanText(descriptionMatch?.[1]) || "Drafted from voice notes.",
    category: "Dinner",
    prepTime: prepMatch ? Number.parseInt(prepMatch[1], 10) : 10,
    cookTime,
    servings: servingsMatch ? Number.parseInt(servingsMatch[1], 10) : 2,
    cookCount,
    difficulty: "Medium",
    tags: ["Voice Draft"],
    ingredients: ingredientPhrases.length ? ingredientPhrases : [{ name: "Ingredient", amount: 1, unit: "pcs" }],
    steps: normalizedSteps
  };
}

function buildRecipeDraftFromTalk() {
  const notes = document.getElementById("recipe-talk-notes");
  if (!notes || !cleanText(notes.value)) {
    alert("Add a voice note or pasted recipe first.");
    return;
  }

  const draft = parseRecipeDraftFromText(notes.value);
  populateRecipeFormFromDraft(draft);
  updateVoiceStatus("Draft ready in the form");
  document.getElementById("recipe-title-input")?.focus();
}

function updateVoiceStatus(message) {
  const status = document.getElementById("recipe-voice-status");
  if (status) status.innerText = message;
}

function setVoiceButtonState(isListening) {
  recipeSpeechIsListening = isListening;
  const startBtn = document.getElementById("recipe-voice-start");
  const stopBtn = document.getElementById("recipe-voice-stop");
  if (startBtn) startBtn.disabled = isListening;
  if (stopBtn) stopBtn.disabled = !isListening;
}

function startRecipeVoiceInput() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const notes = document.getElementById("recipe-talk-notes");

  if (!SpeechRecognition || !notes) {
    updateVoiceStatus("Voice input is not available in this browser");
    alert("Voice input is not available in this browser. You can still paste or type the recipe notes.");
    return;
  }

  if (recipeSpeechIsListening && recipeSpeechRecognition) return;

  recipeSpeechRecognition = new SpeechRecognition();
  recipeSpeechRecognition.continuous = true;
  recipeSpeechRecognition.interimResults = true;
  recipeSpeechRecognition.lang = navigator.language || "en-US";

  let baseText = cleanText(notes.value);

  recipeSpeechRecognition.onresult = (event) => {
    let finalChunk = "";
    let interimChunk = "";

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalChunk += transcript + " ";
      } else {
        interimChunk += transcript;
      }
    }

    if (finalChunk) {
      notes.value = `${baseText}${baseText ? "\n" : ""}${finalChunk.trim()}`;
      baseText = cleanText(notes.value);
    }

    updateVoiceStatus(interimChunk ? `Listening: ${interimChunk.slice(0, 70)}` : "Listening...");
  };

  recipeSpeechRecognition.onerror = (event) => {
    updateVoiceStatus(`Voice error: ${event.error}`);
    setVoiceButtonState(false);
  };

  recipeSpeechRecognition.onend = () => {
    setVoiceButtonState(false);
    updateVoiceStatus("Voice idle");
  };

  recipeSpeechRecognition.start();
  setVoiceButtonState(true);
  updateVoiceStatus("Listening...");
}

function stopRecipeVoiceInput() {
  if (recipeSpeechRecognition && recipeSpeechIsListening) {
    recipeSpeechRecognition.stop();
  }
  setVoiceButtonState(false);
  updateVoiceStatus("Voice idle");
}

function renderAIIngredientSelector() {
  const selectableGrid = document.getElementById("ai-selectable-ingredients");
  if (!selectableGrid) return;

  selectableGrid.innerHTML = "";

  if (STATE.pantry.length === 0) {
    selectableGrid.innerHTML = `<p class="empty-state" style="color: var(--text-dim); font-size: 13px;">Add ingredients to your Pantry first to select them here.</p>`;
    return;
  }

  STATE.pantry.forEach(item => {
    const chip = document.createElement("span");
    chip.className = "selectable-tag";
    chip.innerText = item.name;
    chip.addEventListener("click", () => {
      chip.classList.toggle("selected");
    });
    selectableGrid.appendChild(chip);
  });
}

async function handleAIGeneration() {
  const apiKey = localStorage.getItem(STORAGE_KEYS.GEMINI_KEY);
  if (!apiKey) {
    alert("Please configure your Gemini API Key in the settings panel above first!");
    return;
  }

  const selectedChips = document.querySelectorAll("#ai-selectable-ingredients .selectable-tag.selected");
  const selectedIngredients = Array.from(selectedChips).map(c => c.innerText);
  
  if (selectedIngredients.length === 0) {
    alert("Please select at least one ingredient chip to guide the AI!");
    return;
  }

  const dietPref = document.getElementById("ai-diet-preference").value;
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
    const generatedData = await fetchCustomRecipeFromGemini(apiKey, {
      ingredients: selectedIngredients,
      dietary: dietPref,
      complexity: difficulty,
      cookCount
    });

    if (generatedData) {
      const normalizedGenerated = normalizeRecipeForStorage({
        ...generatedData,
        cookCount
      });
      lastGeneratedRecipeObj = normalizedGenerated;
      
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
    alert("Failed to generate recipe. Please verify your API Key and internet connection.");
  } finally {
    loader.style.display = "none";
    generateBtn.disabled = false;
    generateBtn.style.opacity = "1";
    initLucide();
  }
}

function saveGeneratedRecipeToExplore() {
  if (!lastGeneratedRecipeObj) return;

  const finalRecipe = normalizeRecipeForStorage({
    ...lastGeneratedRecipeObj,
    id: "ai-" + Date.now(),
    rating: 4.8,
    image: lastGeneratedRecipeObj.image || FALLBACK_RECIPE_IMAGE,
    tags: ["AI-Generated", ...(lastGeneratedRecipeObj.tags || [])]
  });

  STATE.customRecipes.unshift(finalRecipe);
  saveStateToStorage();
  
  alert(`"${finalRecipe.title}" has been added to Recipe successfully!`);
  switchView("ai-generator");
}

async function handleRecipeShare() {
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

function handleRecipeExport() {
  openRecipeExportModal();
}

function openRecipeExportModal() {
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

function closeRecipeExportModal() {
  const modal = document.getElementById("recipe-export-modal");
  if (modal) modal.style.display = "none";
}

function confirmRecipeExportSelected() {
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

async function handleRecipeImport(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const incoming = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.recipes) ? parsed.recipes : []);
    if (!incoming.length) {
      alert("No recipes found in this file.");
      return;
    }
    const normalized = incoming.map(recipe => normalizeRecipeForStorage({
      ...recipe,
      id: cleanText(recipe.id) || `import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    }));
    STATE.customRecipes = [...normalized, ...STATE.customRecipes];
    saveStateToStorage();
    renderAddRecipeView();
    alert(`Imported ${normalized.length} recipe(s).`);
  } catch (err) {
    console.error(err);
    alert("Import failed. Please use a valid JSON recipe export file.");
  } finally {
    event.target.value = "";
  }
}

function renderPlayRecipeView() {
  const recipeSelect = document.getElementById("play-recipe-select");
  if (recipeSelect) {
    const selected = playSession.recipeId || recipeSelect.value;
    recipeSelect.innerHTML = `<option value="">-- Select Recipe --</option>`;
    getVisibleRecipes().forEach(recipe => {
      const opt = document.createElement("option");
      opt.value = recipe.id;
      opt.innerText = `[${recipe.category}] ${recipe.title}`;
      recipeSelect.appendChild(opt);
    });
    if (selected) recipeSelect.value = selected;
  }

  renderPlayBoards();
  initLucide();
}

function formatTimerClock(seconds) {
  const total = Math.max(0, Math.round(seconds || 0));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function isPlayAudioMuted() {
  return Boolean(STATE.user.mutePlayAudio);
}

function playShortBeep() {
  if (isPlayAudioMuted()) return;
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = 900;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
    osc.start(now);
    osc.stop(now + 0.22);
  } catch (err) {
    console.error("Beep playback failed:", err);
  }
}

function setPlayBackgroundMusicFile(file) {
  if (!file) return;
  if (playMusicTrack.url) {
    URL.revokeObjectURL(playMusicTrack.url);
  }
  const fileUrl = URL.createObjectURL(file);
  playMusicTrack = { name: file.name || "Selected track", url: fileUrl };
  if (!playMusicAudio) {
    playMusicAudio = new Audio();
    playMusicAudio.loop = true;
    playMusicAudio.volume = 0.35;
  }
  playMusicAudio.src = fileUrl;
}

function startPlayBackgroundMusic() {
  if (!STATE.user.playBackgroundMusic || !playMusicTrack.url) return;
  if (!playMusicAudio) {
    playMusicAudio = new Audio(playMusicTrack.url);
    playMusicAudio.loop = true;
    playMusicAudio.volume = 0.35;
  }
  playMusicAudio.loop = true;
  playMusicAudio.volume = 0.35;
  playMusicAudio.play().catch(err => {
    console.error("Background music play blocked:", err);
  });
}

function stopPlayBackgroundMusic() {
  if (!playMusicAudio) return;
  playMusicAudio.pause();
  playMusicAudio.currentTime = 0;
}

function speakPlayStep(step) {
  if (isPlayAudioMuted() || !window.speechSynthesis) return;
  try {
    const utterance = new SpeechSynthesisUtterance(`${step.cook}, ${step.item}. ${step.action}`);
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.error("Speech playback failed:", err);
  }
}

function stepCardHtml(step, withTimer = false) {
  const timer = withTimer ? `<span>${formatTimerClock(step.timeLeft)}</span>` : `<span>${formatDurationLabel(step.duration)}</span>`;
  const showVideo = withTimer && STATE.user.playStepVideo !== false;
  const videoHtml = showVideo
    ? (step.videoUrl
      ? `<video src="${escapeHtml(step.videoUrl)}" autoplay loop muted playsinline style="width: 100%; border-radius: 8px; margin-top: 8px;"></video>`
      : `<div class="play-step-meta" style="margin-top: 8px;">${step.videoLoading ? "Generating step video..." : "Step video unavailable."}</div>`)
    : "";
  return `
    <div class="play-step-card">
      <div class="play-step-title">Step ${step.order + 1} - ${escapeHtml(step.item)}</div>
      <div class="play-step-text">${escapeHtml(step.action)}</div>
      ${videoHtml}
      <div class="play-step-meta">
        <span>${escapeHtml(step.cook)}</span>
        <span>${timer}</span>
      </div>
    </div>
  `;
}

function inferVesselFromAction(action) {
  const text = cleanText(action).toLowerCase();
  if (/boil|simmer|saucepan|pot/.test(text)) return "pot";
  if (/fry|saute|sear|pan/.test(text)) return "pan";
  if (/bake|roast|oven|tray/.test(text)) return "oven tray";
  if (/mix|whisk|stir|bowl/.test(text)) return "mixing bowl";
  if (/chop|slice|dice|mince/.test(text)) return "cutting board and knife";
  return "kitchen counter and standard cookware";
}

function getStepVideoCacheKey(recipeId, step) {
  const performer = `${STATE.user.performerType || "Human"}-${STATE.user.performerGender || "Female"}`;
  return `${recipeId}::${step.order}::${performer}::${cleanText(step.item).toLowerCase()}::${cleanText(step.action).toLowerCase()}`;
}

function buildStepVideoPrompt(step) {
  const performerType = STATE.user.performerType || "Human";
  const performerGender = STATE.user.performerGender || "Female";
  const vessel = inferVesselFromAction(step.action);
  return `Front-facing kitchen shot with visible face. A ${performerGender.toLowerCase()} ${performerType.toLowerCase()} performs this cooking step using ${escapeHtml(vessel)}: ${step.action} on ${step.item}. Keep action clear, hands visible, realistic kitchen, cinematic but practical framing.`;
}

async function ensurePlayStepVideo(step) {
  if (STATE.user.playStepVideo === false) return;
  const cacheKey = getStepVideoCacheKey(playSession.recipeId, step);
  if (playVideoCache[cacheKey]) {
    step.videoUrl = playVideoCache[cacheKey];
    step.videoLoading = false;
    renderPlayBoards();
    return;
  }

  const apiKey = localStorage.getItem(STORAGE_KEYS.GEMINI_KEY);
  if (!apiKey || typeof fetchStepVideoFromGemini !== "function") {
    step.videoLoading = false;
    renderPlayBoards();
    return;
  }

  try {
    step.videoLoading = true;
    renderPlayBoards();
    const videoUrl = await fetchStepVideoFromGemini(apiKey, {
      prompt: buildStepVideoPrompt(step),
      durationSeconds: 4
    });
    if (videoUrl) {
      step.videoUrl = videoUrl;
      playVideoCache[cacheKey] = videoUrl;
      savePlayVideoCache();
    }
  } catch (err) {
    console.error("Step video generation failed:", err);
  } finally {
    step.videoLoading = false;
    renderPlayBoards();
  }
}

function renderPlayBoards() {
  const upcomingCol = document.getElementById("play-col-upcoming");
  const cook1Col = document.getElementById("play-col-cook1");
  const cook2Col = document.getElementById("play-col-cook2");
  const completedCol = document.getElementById("play-col-completed");
  if (!upcomingCol || !cook1Col || !cook2Col || !completedCol) return;

  upcomingCol.innerHTML = playSession.upcoming.length
    ? playSession.upcoming.map(step => stepCardHtml(step)).join("")
    : `<p class="play-empty">No upcoming steps.</p>`;

  cook1Col.innerHTML = playSession.running["Cook 1"]
    ? stepCardHtml(playSession.running["Cook 1"], true)
    : `<p class="play-empty">Cook 1 is idle.</p>`;

  cook2Col.innerHTML = playSession.running["Cook 2"]
    ? stepCardHtml(playSession.running["Cook 2"], true)
    : `<p class="play-empty">Cook 2 is idle.</p>`;

  completedCol.innerHTML = playSession.completed.length
    ? playSession.completed.map(step => stepCardHtml(step)).join("")
    : `<p class="play-empty">No completed items yet.</p>`;
}

function resetPlayRecipeSession() {
  if (playSession.intervalId) {
    clearInterval(playSession.intervalId);
  }
  stopPlayBackgroundMusic();
  playSession = {
    recipeId: "",
    upcoming: [],
    running: { "Cook 1": null, "Cook 2": null },
    completed: [],
    intervalId: null,
    tick: 0
  };
  const recipeSelect = document.getElementById("play-recipe-select");
  if (recipeSelect) recipeSelect.value = "";
  renderPlayBoards();
}

function startPlayRecipeSession() {
  const recipeSelect = document.getElementById("play-recipe-select");
  const recipeId = recipeSelect?.value || "";
  if (!recipeId) {
    alert("Choose a recipe to play.");
    return;
  }

  const recipe = getAllRecipes().find(r => r.id === recipeId);
  if (!recipe || !Array.isArray(recipe.steps) || recipe.steps.length === 0) {
    alert("This recipe has no playable steps.");
    return;
  }

  if (playSession.intervalId) clearInterval(playSession.intervalId);
  stopPlayBackgroundMusic();

  const cookCount = Number.parseInt(recipe.cookCount, 10) === 2 ? 2 : 1;
  const normalized = recipe.steps.map((step, idx) => ({
    order: idx,
    item: cleanText(step.item || inferStepItem(step.text) || `Task ${idx + 1}`),
    action: cleanText(step.action || step.text || "Prepare"),
    duration: Math.max(1, Math.round(toNonNegativeNumber(step.duration, 60))),
    cook: cookCount === 2 ? normalizeCookLabel(step.cook || "Cook 1") : "Cook 1",
    timeLeft: Math.max(1, Math.round(toNonNegativeNumber(step.duration, 60))),
    videoUrl: "",
    videoLoading: false
  }));

  playSession = {
    recipeId,
    upcoming: normalized,
    running: { "Cook 1": null, "Cook 2": null },
    completed: [],
    intervalId: null,
    tick: 0
  };

  playSession.intervalId = setInterval(runPlayRecipeTick, 1000);
  startPlayBackgroundMusic();
  runPlayRecipeTick();
}

function pullNextStepForCook(cookName) {
  const idx = playSession.upcoming.findIndex(step => step.cook === cookName);
  if (idx < 0) return null;
  const [nextStep] = playSession.upcoming.splice(idx, 1);
  speakPlayStep(nextStep);
  ensurePlayStepVideo(nextStep);
  return nextStep;
}

function runPlayRecipeTick() {
  ["Cook 1", "Cook 2"].forEach(cookName => {
    if (!playSession.running[cookName]) {
      playSession.running[cookName] = pullNextStepForCook(cookName);
    }
  });

  ["Cook 1", "Cook 2"].forEach(cookName => {
    const step = playSession.running[cookName];
    if (!step) return;
    if (step.timeLeft <= 3 && step.timeLeft > 0) {
      playShortBeep();
    }
    step.timeLeft = Math.max(0, step.timeLeft - 1);
    if (step.timeLeft <= 0) {
      playSession.completed.push(step);
      playSession.running[cookName] = null;
    }
  });

  const done = playSession.upcoming.length === 0 && !playSession.running["Cook 1"] && !playSession.running["Cook 2"];
  if (done && playSession.intervalId) {
    clearInterval(playSession.intervalId);
    playSession.intervalId = null;
    stopPlayBackgroundMusic();
  }

  renderPlayBoards();
}

// ----------------------------------------------------
// VIEW 5: MEAL PLANNER
// ----------------------------------------------------
const WEEK_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MEAL_SLOTS = ["Breakfast", "Lunch", "Dinner"];

function renderPlannerView() {
  const grid = document.getElementById("meal-planner-week-grid");
  grid.innerHTML = "";

  WEEK_DAYS.forEach(day => {
    const dayCard = document.createElement("div");
    dayCard.className = "planner-day-card";
    dayCard.innerHTML = `<span class="planner-day-name">${day}</span>`;

    MEAL_SLOTS.forEach(slot => {
      const slotDiv = document.createElement("div");
      slotDiv.className = "planner-slot";
      
      const key = `${day}-${slot}`;
      const scheduledRecipeId = STATE.scheduledMeals[key];
      
      let slotBody = "";
      if (scheduledRecipeId) {
        const recipe = getAllRecipes().find(r => r.id === scheduledRecipeId);
        const name = recipe ? recipe.title : "Unknown Recipe";
        slotBody = `<div class="planner-meal" onclick="openScheduleDropdown('${day}', '${slot}')">${name}</div>`;
      } else {
        slotBody = `<div class="planner-meal-empty" onclick="openScheduleDropdown('${day}', '${slot}')">+ Add</div>`;
      }

      slotDiv.innerHTML = `
        <span class="planner-slot-label">${slot}</span>
        ${slotBody}
      `;
      dayCard.appendChild(slotDiv);
    });

    grid.appendChild(dayCard);
  });

  renderPlannerShoppingList();
}

function openScheduleDropdown(day, slot) {
  STATE.currentSelectedSlot = `${day}-${slot}`;
  
  const dropdown = document.getElementById("select-meal-recipe-dropdown");
  dropdown.innerHTML = "";

  // Add clean option
  const defaultOpt = document.createElement("option");
  defaultOpt.value = "";
  defaultOpt.innerText = "-- Select Recipe --";
  dropdown.appendChild(defaultOpt);

  getVisibleRecipes().forEach(recipe => {
    const opt = document.createElement("option");
    opt.value = recipe.id;
    opt.innerText = `[${recipe.category}] ${recipe.title}`;
    dropdown.appendChild(opt);
  });

  // Prefill current if any
  const current = STATE.scheduledMeals[STATE.currentSelectedSlot];
  if (current) dropdown.value = current;

  document.getElementById("select-meal-modal").style.display = "flex";
}

function saveScheduledMealSelection() {
  if (!STATE.currentSelectedSlot) return;

  const rId = document.getElementById("select-meal-recipe-dropdown").value;
  
  if (rId) {
    STATE.scheduledMeals[STATE.currentSelectedSlot] = rId;
  } else {
    delete STATE.scheduledMeals[STATE.currentSelectedSlot];
  }

  saveStateToStorage();
  document.getElementById("select-meal-modal").style.display = "none";
  renderPlannerView();
  renderDashboard();
}

function renderPlannerShoppingList() {
  const listContainer = document.getElementById("planner-shopping-list");
  listContainer.innerHTML = "";

  // Collect scheduled recipes
  const activeIds = Object.values(STATE.scheduledMeals);
  if (activeIds.length === 0) {
    listContainer.innerHTML = `<p class="empty-state" style="color: var(--text-dim); text-align: center; padding: 20px;">No meals scheduled. Your shopping list is empty!</p>`;
    return;
  }

  // Sum ingredients
  const rawIngredients = {};
  activeIds.forEach(id => {
    const recipe = getAllRecipes().find(r => r.id === id);
    if (recipe) {
      recipe.ingredients.forEach(ing => {
        const key = ing.name.toLowerCase().trim();
        if (rawIngredients[key]) {
          rawIngredients[key].amount += ing.amount;
        } else {
          rawIngredients[key] = { ...ing };
        }
      });
    }
  });

  // Filter out items in pantry
  const requiredList = [];
  Object.values(rawIngredients).forEach(ing => {
    const keyLower = ing.name.toLowerCase();
    const pantryMatch = STATE.pantry.find(p => {
      const pLower = p.name.toLowerCase();
      return keyLower.includes(pLower) || pLower.includes(keyLower);
    });

    const availableQty = pantryMatch ? pantryMatch.quantity : 0;
    if (availableQty < ing.amount) {
      requiredList.push({
        ...ing,
        amount: ing.amount - availableQty
      });
    }
  });

  if (requiredList.length === 0) {
    listContainer.innerHTML = `<p class="empty-state" style="color: var(--success); text-align: center; padding: 20px; font-weight: 600;"><i data-lucide="check-circle" style="display:inline; vertical-align: middle; margin-right: 6px;"></i> All items fully stocked in Pantry!</p>`;
    initLucide();
    return;
  }

  requiredList.forEach(ing => {
    const item = document.createElement("li");
    item.className = "ingredient-item";
    item.style.cursor = "pointer";
    item.style.transition = "opacity var(--transition-fast)";
    item.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <input type="checkbox" style="accent-color: var(--accent);">
        <span>${ing.name}</span>
      </div>
      <span style="color: var(--text-muted);">${Math.round(ing.amount * 100) / 100} ${ing.unit}</span>
    `;

    // Toggle cross-off state on selection
    const chk = item.querySelector("input");
    item.addEventListener("click", () => {
      chk.checked = !chk.checked;
      item.style.opacity = chk.checked ? "0.35" : "1";
      item.style.textDecoration = chk.checked ? "line-through" : "none";
    });
    chk.addEventListener("click", (e) => {
      e.stopPropagation();
      item.style.opacity = chk.checked ? "0.35" : "1";
      item.style.textDecoration = chk.checked ? "line-through" : "none";
    });

    listContainer.appendChild(item);
  });
  initLucide();
}

// ----------------------------------------------------
// MODAL DIALOG DISPLAY FOR RECIPE DETAILS
// ----------------------------------------------------
function showRecipeDetailsModal(recipe) {
  const displayRecipe = normalizeRecipeForStorage(recipe);
  activeModalRecipe = displayRecipe;
  activeModalServingsCount = displayRecipe.servings;
  activeModalServingsMultiplier = 1.0;

  document.getElementById("modal-image").src = displayRecipe.image;
  document.getElementById("modal-title").innerText = displayRecipe.title;
  document.getElementById("modal-description").innerText = displayRecipe.description;
  
  document.getElementById("modal-prep").innerText = `Prep: ${displayRecipe.prepTime}m`;
  document.getElementById("modal-cook").innerText = `Cook: ${displayRecipe.cookTime}m`;
  document.getElementById("modal-servings").innerText = activeModalServingsCount;
  document.getElementById("modal-rating").innerText = displayRecipe.rating;

  updateRecipeModalIngredientsAndButtons();

  // Steps fill with optional Timers
  const stepContainer = document.getElementById("modal-steps");
  stepContainer.innerHTML = "";
  displayRecipe.steps.forEach((step, idx) => {
    const card = document.createElement("div");
    card.className = "step-card";
    
    card.innerHTML = `
      <div class="step-card-header">
        <span class="step-card-num">Step ${idx + 1}</span>
        <span style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
          ${displayRecipe.cookCount === 2 ? `<span class="cook-pill">${escapeHtml(step.cook)}</span>` : ""}
          <span class="step-duration-pill">${formatDurationLabel(step.duration)}</span>
          ${step.duration > 0 ? `
            <button class="step-card-btn-timer" type="button">
              <i data-lucide="play" style="width: 12px; height: 12px;"></i> Start Timer
            </button>
          ` : ""}
        </span>
      </div>
      <p class="step-detail-text"><span class="step-detail-item">${escapeHtml(step.item)}:</span> ${escapeHtml(step.action)}</p>
    `;

    const timerBtn = card.querySelector(".step-card-btn-timer");
    if (timerBtn) {
      timerBtn.addEventListener("click", () => {
        startCookingTimer(displayRecipe.title, idx, step.duration, step.cook, step.item);
      });
    }

    stepContainer.appendChild(card);
  });

  const parallelBtn = document.getElementById("modal-btn-start-parallel-timers");
  if (parallelBtn) {
    const hasTimedSteps = displayRecipe.steps.some(step => step.duration > 0);
    parallelBtn.style.display = displayRecipe.cookCount === 2 && hasTimedSteps ? "inline-flex" : "none";
  }

  document.getElementById("recipe-modal").style.display = "flex";
  initLucide();
}

function updateRecipeModalIngredientsAndButtons() {
  if (!activeModalRecipe) return;

  const ingContainer = document.getElementById("modal-ingredients");
  ingContainer.innerHTML = "";

  activeModalRecipe.ingredients.forEach(ing => {
    const item = document.createElement("li");
    item.className = "ingredient-item";

    const requiredQty = ing.amount * activeModalServingsMultiplier;

    // Find pantry match
    const pantryMatch = STATE.pantry.find(p => {
      const pL = p.name.toLowerCase();
      const iL = ing.name.toLowerCase();
      return iL.includes(pL) || pL.includes(iL);
    });

    let checkIcon = "";
    let stockLabel = "";

    if (pantryMatch) {
      if (pantryMatch.quantity >= requiredQty) {
        checkIcon = `<i data-lucide="check-circle" style="color: var(--success); width: 14px; height: 14px; display:inline; vertical-align:middle;"></i>`;
        stockLabel = `<span style="color: var(--success); font-size: 11px; margin-left: 8px;">[In Stock]</span>`;
      } else {
        checkIcon = `<i data-lucide="alert-triangle" style="color: var(--accent); width: 14px; height: 14px; display:inline; vertical-align:middle;"></i>`;
        stockLabel = `<span style="color: var(--accent); font-size: 11px; margin-left: 8px;">[Need ${Math.round(requiredQty*100)/100}, have ${pantryMatch.quantity}]</span>`;
      }
    } else {
      checkIcon = `<i data-lucide="circle" style="color: var(--text-dim); width: 14px; height: 14px; display:inline; vertical-align:middle;"></i>`;
      stockLabel = `<span style="color: var(--text-dim); font-size: 11px; margin-left: 8px;">[Missing]</span>`;
    }

    item.innerHTML = `
      <span>${checkIcon} ${escapeHtml(ing.name)} ${stockLabel}</span>
      <span style="color: var(--text-muted); font-weight: 500;">${Math.round(requiredQty * 100) / 100} ${escapeHtml(ing.unit)}</span>
    `;
    ingContainer.appendChild(item);
  });

  initLucide();
}

function handleCookMeal() {
  if (!activeModalRecipe) return;

  // Verify stock warnings (confirm cooking anyway if insufficient)
  let missingItems = [];
  let insufficientItems = [];

  activeModalRecipe.ingredients.forEach(ing => {
    const requiredQty = ing.amount * activeModalServingsMultiplier;
    const pantryMatch = STATE.pantry.find(p => {
      const pL = p.name.toLowerCase();
      const iL = ing.name.toLowerCase();
      return iL.includes(pL) || pL.includes(iL);
    });

    if (!pantryMatch) {
      missingItems.push(ing.name);
    } else if (pantryMatch.quantity < requiredQty) {
      insufficientItems.push(`${ing.name} (Need ${Math.round(requiredQty*100)/100}, have ${pantryMatch.quantity})`);
    }
  });

  if (missingItems.length > 0 || insufficientItems.length > 0) {
    let warnMsg = "You don't have enough ingredients in your pantry:\n";
    if (missingItems.length > 0) warnMsg += `- Missing: ${missingItems.join(", ")}\n`;
    if (insufficientItems.length > 0) warnMsg += `- Insufficient: ${insufficientItems.join(", ")}\n`;
    warnMsg += "\nDo you want to cook this meal anyway and deduct what is available?";
    
    if (!confirm(warnMsg)) return;
  }

  // Deduct amounts
  activeModalRecipe.ingredients.forEach(ing => {
    const requiredQty = ing.amount * activeModalServingsMultiplier;
    const pantryMatch = STATE.pantry.find(p => {
      const pL = p.name.toLowerCase();
      const iL = ing.name.toLowerCase();
      return iL.includes(pL) || pL.includes(iL);
    });

    if (pantryMatch) {
      pantryMatch.quantity = Math.max(0, pantryMatch.quantity - requiredQty);
    }
  });

  // Filter out completely consumed items (allow minor floating point rounding buffer)
  STATE.pantry = STATE.pantry.filter(p => p.quantity > 0.001);

  saveStateToStorage();
  playSynthesizedChime();

  alert(`Prepared gourmet meal: "${activeModalRecipe.title}" for ${activeModalServingsCount} people! Pantry quantities updated.`);
  
  // Close details modal
  document.getElementById("recipe-modal").style.display = "none";
  
  // Refresh views
  renderDashboard();
  renderPantryView();
  renderPlannerView();
}

// ----------------------------------------------------
// TIMERS MANAGER (BACKGROUND RUNNER & WEB AUDIO CHIMES)
// ----------------------------------------------------
function startCookingTimer(recipeTitle, stepIdx, durationSeconds, cookName = "Cook 1", stepLabel = "", options = {}) {
  const timerMultiplier = getExperienceTimerMultiplier();
  const adjustedDuration = Math.max(1, Math.round(durationSeconds * timerMultiplier));

  // Prevent duplicate timers for same step
  const timerId = `${recipeTitle}-${stepIdx}-${cookName}`;
  const existing = STATE.activeTimers.find(t => t.id === timerId);
  if (existing) {
    if (!options.silent) alert("This timer is already running!");
    return false;
  }

  if (!options.keepModalOpen) {
    document.getElementById("recipe-modal").style.display = "none";
  }

  const newTimer = {
    id: timerId,
    title: recipeTitle,
    stepIndex: stepIdx,
    cookName,
    stepLabel,
    totalDuration: adjustedDuration,
    timeLeft: adjustedDuration,
    intervalId: null
  };

  newTimer.intervalId = setInterval(() => {
    newTimer.timeLeft--;
    
    if (newTimer.timeLeft <= 0) {
      clearInterval(newTimer.intervalId);
      triggerTimerFinishedAlert(newTimer);
      STATE.activeTimers = STATE.activeTimers.filter(t => t.id !== newTimer.id);
    }
    
    renderActiveTimers();
  }, 1000);

  STATE.activeTimers.push(newTimer);
  renderActiveTimers();
  if (!options.silent) alert(`Started ${cookName} timer for Step ${stepIdx + 1}!`);
  return true;
}

function startParallelRecipeTimers(recipe) {
  const displayRecipe = normalizeRecipeForStorage(recipe);
  let startedCount = 0;

  displayRecipe.steps.forEach((step, idx) => {
    if (step.duration > 0) {
      const started = startCookingTimer(displayRecipe.title, idx, step.duration, step.cook, step.item, {
        silent: true,
        keepModalOpen: true
      });
      if (started) startedCount++;
    }
  });

  if (startedCount > 0) {
    document.getElementById("recipe-modal").style.display = "none";
    alert(`Started ${startedCount} parallel cooking timers.`);
  } else {
    alert("All timers for this recipe are already running.");
  }
}

function cancelActiveTimer(timerId) {
  const timer = STATE.activeTimers.find(t => t.id === timerId);
  if (timer) {
    clearInterval(timer.intervalId);
    STATE.activeTimers = STATE.activeTimers.filter(t => t.id !== timerId);
    renderActiveTimers();
  }
}

function renderActiveTimers() {
  const container = document.getElementById("active-timers-container");
  if (!container) return;

  container.innerHTML = "";
  
  if (STATE.activeTimers.length === 0) {
    container.innerHTML = `<p class="empty-state" style="color: var(--text-dim); font-size: 13px; text-align: center; padding: 20px 0;">No active cooking timers.</p>`;
    return;
  }

  STATE.activeTimers.forEach(t => {
    const item = document.createElement("div");
    item.className = "timer-item";

    // Progress rings variables
    const radius = 18;
    const circ = 2 * Math.PI * radius; // ~113.1
    const offset = circ - (t.timeLeft / t.totalDuration) * circ;

    // Formatting MM:SS
    const mins = Math.floor(t.timeLeft / 60);
    const secs = t.timeLeft % 60;
    const timeStr = `${mins}:${secs.toString().padStart(2, "0")}`;

    item.innerHTML = `
      <div class="timer-ring-container">
        <svg width="44" height="44">
          <circle cx="22" cy="22" r="${radius}" fill="transparent" stroke="rgba(255,255,255,0.05)" stroke-width="4"></circle>
          <circle class="timer-ring-circle" cx="22" cy="22" r="${radius}" fill="transparent" 
            stroke="var(--accent)" stroke-width="4" stroke-dasharray="${circ}" stroke-dashoffset="${offset}" stroke-linecap="round"></circle>
        </svg>
        <span class="timer-time-left">${timeStr}</span>
      </div>
      <div class="timer-info">
        <span class="timer-title">${escapeHtml(t.title)}</span>
        <span class="timer-step">${escapeHtml(t.cookName || "Cook 1")} &middot; Step ${t.stepIndex + 1}${t.stepLabel ? ` &middot; ${escapeHtml(t.stepLabel)}` : ""}</span>
      </div>
      <button class="btn-icon timer-cancel-btn" style="color: var(--error); border-color: rgba(239, 68, 68, 0.2); width: 28px; height: 28px;" type="button">
        <i data-lucide="square" style="width: 12px; height: 12px; fill: var(--error);"></i>
      </button>
    `;
    item.querySelector(".timer-cancel-btn").addEventListener("click", () => cancelActiveTimer(t.id));
    container.appendChild(item);
  });
  initLucide();
}

function triggerTimerFinishedAlert(timer) {
  playSynthesizedChime();

  // Desktop alert notifications
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification("Cooking Timer Finished!", {
      body: `"${timer.title}": ${timer.cookName || "Cook 1"} Step ${timer.stepIndex + 1} is now complete!`,
      icon: "assets/icon-192.png"
    });
  } else {
    alert(`[COOKING ALERT] "${timer.title}": ${timer.cookName || "Cook 1"} Step ${timer.stepIndex + 1} is finished!`);
  }
}

// Generate premium chime dynamically with Web Audio API (Zero static audio files required)
function playSynthesizedChime() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    // Quick pleasant triple-beep chord
    const playNote = (freq, start, duration) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);
      
      // Envelopes
      gain.gain.setValueAtTime(0.01, start);
      gain.gain.linearRampToValueAtTime(0.4, start + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, start + duration);
      
      osc.start(start);
      osc.stop(start + duration);
    };

    const now = audioCtx.currentTime;
    playNote(523.25, now, 0.35); // C5
    playNote(659.25, now + 0.15, 0.35); // E5
    playNote(783.99, now + 0.30, 0.50); // G5
  } catch (err) {
    console.error("Audio API synthesis error: ", err);
  }
}
