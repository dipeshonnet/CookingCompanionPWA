import { cleanText, escapeHtml } from './utils.js';

export function normalizeRecipeSources(sources) {
  const result = [];
  for (const source of Array.isArray(sources) ? sources.slice(0, 30) : []) {
    try {
      const url = new URL(source?.url);
      if (url.protocol !== 'https:' || url.username || url.password || result.some(item => item.url === url.href)) continue;
      result.push({ url: url.href, title: cleanText(source.title).slice(0, 300) || url.hostname });
    } catch { /* Ignore malformed source links, including imported ones. */ }
  }
  return result;
}

export function recipeSourcesHtml(sources) {
  const safe = normalizeRecipeSources(sources);
  if (!safe.length) return '';
  return `<div class="recipe-sources"><h4>Recipe references</h4><p>Adapted into individually timed actions from these recipe sources.</p><ul>${safe.map(source => `<li><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.title)}</a></li>`).join('')}</ul></div>`;
}

// Provider search suggestions are isolated from the app and cannot execute scripts.
export function searchAttributionHtml(html) {
  if (typeof html !== 'string' || !html) return '';
  const content = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; base-uri 'none'; form-action 'none'">${html.slice(0, 50000)}`;
  return `<iframe class="recipe-search-attribution" title="Google Search suggestions" sandbox="allow-popups allow-popups-to-escape-sandbox" srcdoc="${escapeHtml(content)}"></iframe>`;
}
