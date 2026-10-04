import { DEFAULT_USER_PROFILE } from './user-profile.js';

export const STATE = {
  user: { ...DEFAULT_USER_PROFILE }, pantry: [], scheduledMeals: {},
  activeTimers: [], customRecipes: [], currentSelectedSlot: null
};

export const STORAGE_KEYS = {
  USER: 'cook_comp_user', PANTRY: 'cook_comp_pantry', SCHEDULE: 'cook_comp_schedule',
  CUSTOM_RECIPES: 'cook_comp_custom_recipes', AI_PROVIDER: 'cook_comp_ai_provider',
  GROQ_KEY: 'cook_comp_groq_key', GEMINI_KEY: 'cook_comp_gemini_key', OPENAI_KEY: 'cook_comp_openai_key',
  PLAY_VIDEO_CACHE: 'cook_comp_play_video_cache'
};

export const RUNTIME = {
  activeModalRecipe: null, activeModalServingsCount: 2, activeModalServingsMultiplier: 1,
  recipeSpeechRecognition: null, recipeSpeechIsListening: false, recipeExploreVisible: false,
  lastGeneratedRecipeObj: null, playVideoCache: {}, playMusicAudio: null,
  playMusicTrack: { name: '', url: '' }, authUnsubscribe: null, currentAuthUid: '',
  suppressCloudSave: false, cloudSaveTimer: null, storageScope: 'guest',
  localMode: false, currentView: 'dashboard', authGeneration: 0,
  playSession: { recipeId: '', upcoming: [], running: { 'Cook 1': null, 'Cook 2': null }, completed: [], intervalId: null }
};

export const CLOUD_SYNC_DEBOUNCE_MS = 900;
export const FALLBACK_RECIPE_IMAGE = 'assets/logo.png';
