import { getProviderConfig } from './ai-providers.js';

export async function requestAi(provider, apiKey, payload, label, { endpoint, timeout = 30000 } = {}) {
  const config = getProviderConfig(provider);
  const key = String(apiKey || '').trim();
  if (!key) throw new Error(`Configure your ${config.label} API key first.`);
  let response;
  try {
    response = await fetch(endpoint || config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(provider === 'gemini' ? { 'x-goog-api-key': key } : { Authorization: `Bearer ${key}` })
      },
      signal: AbortSignal.timeout(timeout),
      body: JSON.stringify(payload)
    });
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') throw new Error(`${label} timed out. Please try again.`);
    throw new Error(`Could not reach ${config.label} for ${label.toLowerCase()}. Check your internet connection.`);
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new Error(`${config.label} rejected the API key or access. Update your key and check model access.`);
    if (response.status === 429) throw new Error(`${config.label} rate limit or quota reached. Please try again later or check your API account.`);
    if (label === 'Recipe search' && response.status === 400) throw new Error(`${config.label} recipe search is unavailable for these settings. Check search access and billing for your existing provider.`);
    throw new Error(`${label} request to ${config.label} failed (${response.status}).`);
  }
  try { return await response.json(); }
  catch { throw new Error(`${config.label} returned invalid ${label.toLowerCase()} JSON. Please try again.`); }
}
