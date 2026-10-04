# Free Hosting Plan

Target: **https://cooking.everydayai.work**

## Current Deployment

Deployed October 4, 2026:

| Resource | Production value |
| --- | --- |
| Public app | https://cooking.everydayai.work/ |
| Cloudflare Pages project | `cooking-companion-git-dipesh` |
| Pages hostname | `cooking-companion-git-dipesh.pages.dev` |
| Deployment method | GitHub integration, `dipeshonnet/CookingCompanionPWA` `main` |
| Firebase project | `cooking-companion-6bd5b` |
| Firebase plan | Spark, no cost |
| Firebase web app | `1:471759035334:web:398e613a3c97c45136f0c7` |
| Firestore database | Standard, `(default)`, `asia-south1` (Mumbai) |
| Authentication | Google and Email/Password enabled |
| Google consent name/support | Cooking Companion / dipeshonnet@gmail.com |

The custom domain is active with SSL. Authentication authorizes the custom domain, the actual Pages hostname, `localhost`, and the project's Firebase hostnames. Owner-only Firestore rules and index exemptions have been deployed. No Firebase Storage, Functions, paid video service, or billing upgrade was enabled.

The public browser configuration is in local, Git-ignored `config/firebase-web.json`; it is not an administrator credential. Development source keeps cloud authentication unconfigured. Cloudflare's `FIREBASE_WEB_CONFIG` build variable injects the public configuration during Git builds.

An unused setup project, `cooking-companion-9f6f6`, remains separate from production. Its automatically linked billing account was unlinked with approval. It was not deleted.

## Services

| Function | Tool | Cost boundary |
| --- | --- | --- |
| Static hosting, TLS and CDN | Cloudflare Pages Free | Static asset requests are free; 500 builds/month on Free |
| Google and email/password login | Firebase Authentication, Spark | Use standard providers, not phone/SMS or paid Identity Platform features |
| User preferences, ingredients, recipes and meal slots | Cloud Firestore Standard, Spark | One free database: 1 GiB stored data; 50,000 reads/day; 20,000 writes/day; 20,000 deletes/day; 10 GiB/month outbound |
| Offline preferences and structured data | Browser localStorage | Account-scoped; quota depends on browser |
| Local music and optional video cache | Browser IndexedDB | No Firebase Storage or cloud-media charges; device-local and subject to eviction |
| Countdown sounds and spoken steps | Web Audio and speech synthesis | No paid audio API; browser/device support varies |
| Recipe dictation | Browser speech recognition | Browser-dependent; recognition may use the browser vendor's online service |
| Optional recipe and nutrition AI | User's own OpenAI, Gemini, or Groq key | Provider pricing, access and quotas apply; OpenAI API usage requires billing; no shared application key |
| AI video generation | Disabled | Only previously cached step videos are played |
| Build and tests | Node.js, node:test, optional Playwright | Free and open-source; no framework build service required |

Free tiers are quotas, not unlimited backend capacity. Keep Firebase on Spark and do not link a billing account. For free AI usage, select Gemini or Groq with available free quota; OpenAI is an optional paid API provider. Exhausted quotas should degrade to device storage/manual recipes rather than trigger paid services. Domain renewal is separate from this plan.

Official references, checked October 3, 2026: [Pages static pricing](https://developers.cloudflare.com/pages/functions/pricing/), [Pages limits](https://developers.cloudflare.com/pages/platform/limits/), [Firestore quotas](https://firebase.google.com/docs/firestore/pricing), [Firebase Spark](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans), [Auth limits](https://firebase.google.com/docs/auth/limits), [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing), [Groq quotas](https://console.groq.com/docs/rate-limits), [OpenAI API pricing](https://developers.openai.com/api/docs/pricing).

## Firebase Setup

1. Create a Firebase project on **Spark**, register a Web app, and create one **Cloud Firestore Standard** database. Choose the appropriate nearby region before provisioning; changing region later is not a simple setting.
2. Enable Google and Email/Password under Authentication. Do not enable paid SMS providers.
3. Add `cooking.everydayai.work` to Authentication's authorized domains. Add `localhost` explicitly for development if it is absent. Authorize the Pages preview domain only when you intend to test login there.
4. Keep the web configuration's `authDomain` as the project's Firebase-hosted auth domain, for example `YOUR_PROJECT.firebaseapp.com`. The app uses Google popup authentication. Do not set it to the cooking subdomain without also implementing Firebase's auth-helper hosting requirements.
5. Deploy `firestore.rules` and `firestore.indexes.json` using the Firebase console/CLI. Example: `npx firebase-tools deploy --only firestore --project YOUR_PROJECT_ID`. This step requires your Firebase access; the repo does not provision a project automatically.
6. Supply the **public web configuration JSON** through the Cloudflare Pages `FIREBASE_WEB_CONFIG` build variable. Required fields: `apiKey`, `authDomain`, `projectId`, `appId`. The Git build writes it into `dist/modules/firebase-config.js`. The local config file is not committed.
7. Verify live Google login, email registration/sign-in, sign-out, and cross-account access before inviting users. Web config is public; Firestore rules, not hiding that config, protect data. Never supply a service-account JSON or AI API key to the build.

For local testing, fill `modules/firebase-config.js` with the project's public web configuration, or use `node --env-file=.env tools/build.mjs` with a local `.env` containing `FIREBASE_WEB_CONFIG`. Secrets and `.env` files are ignored.

## Cloudflare Pages and DNS

The live Pages project is Git-integrated. Cloudflare clones `main`, runs `npm run build` with Node.js 22, and publishes `dist`. Production and preview builds use the project's `FIREBASE_WEB_CONFIG` build variable. Pushes to `main` automatically deploy; pull requests can create preview builds. The old Direct Upload project `cooking-companion` remains available at `cooking-companion-b64.pages.dev` as a rollback source, but has no custom domain and is not connected to GitHub. Cloudflare cannot convert a Direct Upload project to Git integration; see [Cloudflare's Direct Upload documentation](https://developers.cloudflare.com/pages/get-started/direct-upload/).

1. Run `npm test`, `npm run test:browser`, and `npm run test:timers` locally. Browser tests use an isolated device-only profile and need Playwright installed or `PLAYWRIGHT_MODULE_PATH` set.
2. Push the tested commit to `main` in `dipeshonnet/CookingCompanionPWA`. Confirm the `cooking-companion-git-dipesh` Pages deployment succeeds at that commit.
3. Verify `https://cooking.everydayai.work/asset-manifest.json` matches the expected build version and that the Google/email controls are enabled. Existing tabs may need a reload after the new service worker installs. Finish running timers first because active sessions do not survive reload.
4. Keep **cooking.everydayai.work** attached under the new project's **Custom domains**. Its proxied CNAME points to `cooking-companion-git-dipesh.pages.dev`; do not change other DNS records.
5. Check HTTPS login and offline startup. Do not commit credentials, local Firebase config, tests' generated output, or screenshots to the deployment source.

Deploy database rules separately when they change, using the official authenticated Firebase CLI:

```sh
firebase deploy --only firestore --project cooking-companion-6bd5b --non-interactive
```

See [Cloudflare's custom-domain instructions](https://developers.cloudflare.com/pages/configuration/custom-domains/) and [Firebase Google sign-in setup](https://firebase.google.com/docs/auth/web/google-signin).

`_headers` supplies CSP, security headers and revalidation rules. Each build fingerprints its offline shell; all app modules and local icons are precached together. Update checks bypass the HTTP cache, and precaching explicitly reloads each asset to avoid retaining an older Firebase configuration. No private account data or API requests are service-worker cached. Do not add a catch-all SPA redirect that returns HTML for missing `.js` files.

## Deployment Verification

The October 4 Git-integrated release is commit `3bf7e5f`, offline version `b3b29b38eab4f204`. Thirty-two unit tests, 62 general browser checks, and 24 focused timer browser checks passed. The new Pages build cloned that commit and produced the same version. The temporary Pages hostname and custom domain returned HTTP 200 with CSP and HSTS; the recipe-detail module, stylesheet, and Firebase web config matched the local build. Cloudflare marked the custom domain Active with SSL and its CNAME points to the Git project. Google/email controls were enabled on the temporary hostname; full sign-in on the migrated custom domain remains a manual check. Existing installed tabs may need a reload after the new shell installs; finish running timers first.

The earlier floating-timer Direct Upload release was `ea6493b8a24c4263`. Its live signed-in verification showed a countdown on Ingredients and navigation back to Play Recipe without restarting it. That verification session was reset afterward.

Release `3740e84b6fd6f1c9` was published successfully. HTTPS, CSP, HSTS, nosniff, and frame protection were verified. Forty static assets, including the service worker and public Firebase configuration, match the local build byte-for-byte. Cloudflare adds a platform security script to the HTML, so the HTML response is not byte-identical to the source.

- 20 unit tests and 36 isolated browser workflow checks passed. AI responses are mocked in those tests; they do not prove a user's live API key or device audio permissions work.
- Live Google/email controls become enabled after the cache update and reload. The user confirmed Google sign-in reaches the app in a normal browser. The resulting account's schema-version-2 profile was independently verified in Firestore. Email/Password is enabled, but creating/signing into an email account and cross-device recipe/meal sync remain launch checks; no credentials were created or changed during deployment.
- Firebase Rules Playground verified an owner read is allowed, an unauthenticated read is denied, and a different user's read is denied. These are simulations, not two real authenticated-account tests.
- No billing upgrade or paid media generation was used. Keep the remaining launch checks below before inviting the public.

## Data and Quota Behavior

- Firestore stores one document per ingredient, recipe, and meal slot, plus a profile document. Only changed documents are written after a 900 ms debounce. Timer ticks do not write to Firestore.
- Login reads the profile and the user's three collections once; there are no continuously billed snapshot listeners. Large collections mean correspondingly more reads.
- Cloud persistence excludes API keys, audio/video blobs, login state, email identity, running timers, and transient UI state. Email comes from Firebase Authentication.
- Guest and authenticated accounts have distinct local namespaces. Signing out keeps recovery data on this device, so shared-device users should clear site data when needed.
- Offline changes merge against the last successful sync snapshot on sign-in, preserving unrelated cloud additions. Conflicting edits to the same record use the local pending record. Concurrent already-open tabs/devices do not provide real-time collaborative editing.
- Legacy cloud aggregate documents are read only for migration and retained as recovery copies. New data uses schema version 2; its marker is committed after migration records. Back up/export before production migration.
- Media is not synced between devices. Browser site-data clearing/eviction removes it; recipe exports are the portable backup, not a cloud media backup.
- Quota/permission/network errors leave a local pending marker and retry on reconnection or the next account load. Review Firebase usage periodically without upgrading billing.

## Launch Checklist

- Unit tests, build, and browser workflow tests pass for `dist`.
- Security rules are deployed and tested against two separate real accounts or the Firestore emulator.
- Google popup redirects and email authentication work on the custom HTTPS domain.
- A meal deletion and a recipe edit persist after a second device signs in.
- Microphone permission, speech playback, countdown sounds and local music are tested on the target browsers/devices. Mobile OS background suspension can delay sound delivery even though remaining times use deadlines.
- Verify a new deployment updates the installed PWA and that offline startup does not depend on a CDN icon script.
- No AI API key, admin credential, local test data, or output screenshot is in `dist`.
- Add a suitable privacy policy before public launch, covering Firebase data and optional requests sent to the selected AI provider or browser speech providers.

The build scripts do not provision accounts or modify DNS. The production resources above were set up separately, with user authorization.

## AI Provider Setup

In Profile or Create with AI, select OpenAI, Gemini, or Groq and save that provider's API key. Keys are saved separately in the current browser account; changing providers loads the saved key for that provider. Clearing a key clears only the selected provider. Selection and keys are excluded from Firebase synchronization and recipe exports.

Default models are `gpt-4.1-mini` for OpenAI, `gemini-2.5-flash` for Gemini, and `openai/gpt-oss-20b` hosted by Groq. Change model defaults in `modules/app-config.js`. OpenAI and Groq use strict JSON chat completions; Gemini uses JSON-schema generateContent responses. All API requests have a 30-second timeout. No provider credentials are needed during the static build.
