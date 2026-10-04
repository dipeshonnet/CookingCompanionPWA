# Cooking Companion

A static, installable cooking PWA for `https://cooking.everydayai.work`. No application server or paid runtime is required.

## Development

Node.js 22+ is the only build dependency:

```sh
npm run dev
npm test
npm run build
```

The default development URL is `http://localhost:5175`. Set `PORT` to use another port. Deploy only `dist`, never the repository root. Native ES modules require an HTTP server, not a `file:` URL.

## Browser Verification

Playwright is optional and free:

```sh
npm install --no-save --package-lock=false playwright
npx playwright install chromium
npm run test:browser
```

`PLAYWRIGHT_CHANNEL=msedge` uses an installed Edge browser. `PLAYWRIGHT_MODULE_PATH` can point to a provisioned Playwright `index.mjs`. Tests launch an isolated browser and temporary server; they do not touch the user's browser data. The deterministic workflow fixtures expect an unconfigured Firebase backend. Run against source, or set `SERVE_DIST=1` after a build without `FIREBASE_WEB_CONFIG`; real Google/email login is a separate deployment check. Screenshots are written to ignored `output/`.

Run `node tests/timer-browser.mjs` for focused floating-timer checks, including parallel cooks, page navigation, desktop/mobile layouts, reset, completion, individual timers, and sign-out. These checks use an isolated device-only browser and write screenshots to `output/playwright/`.

## Documentation

- [Free Hosting and Domain Setup](docs/DEPLOYMENT.md)
- [Architecture and Data Ownership](docs/ARCHITECTURE.md)
- The in-app FAQ covers recipes, ingredients, profile, playback, exports, and storage.

The live app uses Firebase Spark project `cooking-companion-6bd5b`. Development source remains unconfigured; the production build injects `config/firebase-web.json` through `FIREBASE_WEB_CONFIG`. Device-only mode works without Firebase. Google/email buttons never simulate authentication. The current Cloudflare project uses Direct Upload, so GitHub pushes do not automatically deploy it; see the deployment guide for release commands.

## Optional AI

Choose OpenAI, Gemini, or Groq in Profile or Create with AI, then enter your own key for that provider. Recipe drafts and nutrition estimates use the selected provider. Keys are saved separately for each browser account and provider. Provider pricing and quotas apply; OpenAI requires API billing. Manual recipes work without a key.
