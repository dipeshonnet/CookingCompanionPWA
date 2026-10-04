import { loadStateFromStorage } from './modules/storage.js';
import { initAuthenticationLayer } from './modules/auth.js';
import { setupEventListeners } from './modules/events.js';
import { renderApp, initLucide } from './modules/navigation.js';

async function bootstrap() {
  initLucide();
  loadStateFromStorage();
  setupEventListeners();
  renderApp();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      .then(registration => registration.update())
      .catch(error => console.warn('Offline cache unavailable:', error));
  }
  await initAuthenticationLayer();
}

bootstrap().catch(error => console.error('App initialization failed:', error));
