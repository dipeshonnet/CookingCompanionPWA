import { APP_CONFIG } from './app-config.js';

export const AI_PROVIDERS = Object.freeze({
  openai: Object.freeze({ label: 'OpenAI', model: APP_CONFIG.openaiTextModel, endpoint: 'https://api.openai.com/v1/chat/completions', storageKey: 'cook_comp_openai_key' }),
  gemini: Object.freeze({ label: 'Gemini', model: APP_CONFIG.geminiTextModel, endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${APP_CONFIG.geminiTextModel}:generateContent`, storageKey: 'cook_comp_gemini_key' }),
  groq: Object.freeze({ label: 'Groq', model: APP_CONFIG.groqTextModel, endpoint: 'https://api.groq.com/openai/v1/chat/completions', storageKey: 'cook_comp_groq_key' })
});

export function getProviderConfig(provider) {
  if (!Object.hasOwn(AI_PROVIDERS, provider)) throw new Error('Choose OpenAI, Gemini, or Groq as your AI provider.');
  return AI_PROVIDERS[provider];
}

export function updateAiSettingsFields(prefix, provider, key) {
  const { label } = getProviderConfig(provider);
  const select = document.getElementById(`${prefix}-provider-select`);
  const input = document.getElementById(`${prefix}-key-input`);
  const keyLabel = document.getElementById(`${prefix}-key-label`);
  if (select) select.value = provider;
  if (keyLabel) keyLabel.textContent = `${label} API Key`;
  if (input) {
    input.value = key || '';
    input.placeholder = `Enter your ${label} API Key`;
    input.setAttribute('aria-label', `${label} API Key`);
  }
}
