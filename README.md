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

Run `npm run test:recipes` for recipe dependency checks in the browser: action titles, Gantt previews, one/two-cook changes, unattended timers, editor prerequisites, invalid imports, and mobile layouts. Set `PLAYWRIGHT_CHANNEL=msedge` to use an installed Edge browser when bundled Chromium is unavailable.

Built-in recipes use individually timed actions. In Play Recipe, choose one or two cooks; unattended waits run alongside hands-on work. Dependencies appear in recipe details and the live cooking timeline. Older saved recipes remain playable in conservative sequential order.

**Portions count the people eating, separately from the number of cooks.** Recipe details, Play Recipe, and new planned meals default to one person. Ingredients and quantity-bearing instructions scale together; preparation scales with the amount, fixed waits remain fixed, and batch cooking repeats according to capacity. Selected portions and cooking snapshots survive reloads. Existing planner assignments without a portion count become one-person meals; their shopping requirements follow that count, including meals outside the current diet preference. Older custom recipes keep their original instructions and timing estimates while ingredient quantities scale.

Run `npm run test:portions` for the portion workflow, pantry deductions, reloads, planner migration, and mobile controls. Potato weights remain authoritative; approximate counts use 150 g per medium potato or 40 g per baby potato.

The catalog includes 108 defaults: the original eight plus 100 egg-free vegetarian recipes (80 Indian, 20 international; dairy is allowed). The new recipes use the bundled fallback image and do not invent user ratings. See [Collection notes and references](docs/RECIPE-COLLECTION.md).

Open recipe details and choose **Edit recipe**. **Save my version** creates one private override for a default; **Revert to default** removes that override without losing likes or meal assignments. Custom recipes are edited in place. Account versions sync through the existing recipe collection; device-only versions stay local. Already running cooking sessions retain their instructions. Run `node tests/recipe-personalization-browser.mjs` for the focused desktop/mobile workflow checks.

## Documentation

- [Free Hosting and Domain Setup](docs/DEPLOYMENT.md)
- [Architecture and Data Ownership](docs/ARCHITECTURE.md)
- The in-app FAQ covers recipes, ingredients, profile, playback, exports, and storage.

The live app uses Firebase Spark project `cooking-companion-6bd5b`. Development source remains unconfigured; the Cloudflare Pages build receives the public Firebase web config through its `FIREBASE_WEB_CONFIG` build variable. Device-only mode works without Firebase. Google/email buttons never simulate authentication. Cloudflare Pages project `cooking-companion-git-dipesh` deploys pushes to `main` from `dipeshonnet/CookingCompanionPWA`; see the deployment guide for release checks.

## Optional AI

Choose OpenAI, Gemini, or Groq in Profile or Create with AI, then enter your own key for that provider. Recipe drafts and nutrition estimates use the selected provider. Keys are saved separately for each browser account and provider. Provider pricing and quotas apply; OpenAI requires API billing. Manual recipes work without a key.

In AI Draft, describe a dish or meal idea; no pantry items are required. The selected provider searches live recipe websites using its existing key, then creates a structured draft with exact ingredients, one operation per timed action, explicit action types, Prep/Cook labels, hands-on/unattended tags, process labels, and prerequisite IDs. Choose one or two cooks and preview the cooking timeline before saving. Recipe references remain attached when saved, edited, synced, or exported. Search access and any search charges follow the selected provider's account; failed searches show an error rather than silently drafting without sources.

Search uses [OpenAI Responses web search](https://developers.openai.com/api/docs/guides/tools-web-search), [Gemini Google Search grounding](https://ai.google.dev/gemini-api/docs/google-search), or [Groq browser search](https://console.groq.com/docs/tool-use/built-in-tools/browser-search). Search and strict recipe JSON generation are separate requests because search tools and structured output are not supported together by every provider. Nutrition still uses one structured request. Run `node tests/ai-draft-browser.mjs` for isolated, mocked search-to-save checks without calling paid APIs.
