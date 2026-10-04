# Architecture

## Module Responsibilities

`app.js` is the bootstrap only. Browser-native ES modules replace the original shared classic script and inline event handlers.

| Module | Responsibility |
| --- | --- |
| `state.js` | Durable domain state and transient runtime state |
| `user-profile.js`, `profile.js` | Profile normalization and settings UI |
| `auth.js`, `backend-auth-db.js` | Auth lifecycle and Firebase adapter |
| `storage.js`, `cloud-records.js` | Device namespaces, migration, save queue, record diff/merge |
| `recipe-domain.js` | Recipe normalization, prep/cook totals and diet filtering |
| `recipe-builder.js`, `recipe-voice.js` | Manual form and speech-note drafts |
| `recipe-ai.js`, `ai.js` | Optional AI workflow and provider requests |
| `recipe-transfer.js` | Share, selection-based JSON export and validated import |
| `recipe-views.js`, `recipe-detail.js` | Recommendations, Explore, likes, servings and stock deduction |
| `ingredients.js`, `units.js` | Ingredient UI, estimated nutrition and compatible quantity conversions |
| `play-engine.js`, `play-recipe.js` | Deterministic two-cook scheduling and kanban rendering |
| `play-media.js`, `media-store.js` | Shared audio context, speech queue and IndexedDB media |
| `timers.js` | Standalone recipe-detail timers |
| `planner.js` | Meal slots and shopping-list calculation |
| `navigation.js`, `events.js`, `faq-view.js` | View lifecycle, UI binding and FAQ |
| `app-config.js`, `firebase-config.js` | Explicit deployment and public service configuration |

The UI modules may call one another's render functions; those imports contain no top-level DOM side effects. Pure scheduling, quantity, cloud record, normalization and parsing functions are independently testable. `events.js` is the only central event-binding layer; feature implementations live in their own modules.

## Data Layout

```text
Firestore users/{uid}/
  app/profile        { schemaVersion: 2, user: preferences and likedRecipeIds }
  pantry/{id}        ingredient quantity, unit, category, nutrition estimate
  recipes/{id}       a single custom recipe, ingredients and steps
  meals/{day-slot}   { recipeId }

localStorage cook_comp_v2:{guest-or-uid}:{key}
  user / pantry / schedule / custom_recipes / API key
  dirty / sync-base / device-only mode

IndexedDB cooking-companion-media / media
  {scope}:background-music -> { name, blob }
  {scope}:video:{step-cache-key} -> { blob } (previously cached video only)
```

Firestore rules deny other-user and anonymous access. The database adapter uses lazy Firebase loading, one-time collection reads, changed-record batches, and document replacement rather than nested merge writes, so cleared meal slots do not reappear. AI provider selection and separate OpenAI, Gemini, and Groq API keys stay in account-scoped localStorage; they never enter cloud payloads. Existing Gemini keys remain in the Gemini slot. Recipe and nutrition requests use the selected provider with no automatic fallback to another provider. Do not put admin or shared AI credentials in browser code.

## Playback Contract

- Per-cook steps retain their relative recipe order. Tasks assigned to different cooks are assumed independent; the current recipe schema does not express cross-cook dependencies.
- Expert durations are unchanged, Somewhat is 1.5x, Beginner is 2x. Values are frozen when a session starts.
- A new step keeps its full duration. Countdown uses deadlines, not callback counts, so throttled callbacks do not accumulate drift.
- Finishing a task moves it to Completed and starts that cook's next task immediately. Returning after a suspended tab starts the next step at the current time; it does not mark unperformed future steps as done.
- Countdown-only updates retain DOM video nodes. Speech is queued for both cooks, rather than cancelling the first cook's announcement.
- Muting suppresses voice, beeps, chimes and background music. It does not change timer progression.
- Sessions and standalone timers are deliberately not restored after reload. They are runtime-only and are not inferred to be running on another device.

## Boundaries

Nutrition values are AI estimates for an entered quantity, not medical advice or verified laboratory data. Quantity adjustments scale the estimate without extra AI calls. Volume conversions use 240 ml/cup, 15 ml/tbsp, 5 ml/tsp; mass and volume are never cross-converted without ingredient density. Ingredient names must match exactly, ignoring case and surrounding whitespace, to avoid confusing different foods.

Diet filtering uses explicit recipe tags; Low-Carb is not treated as Keto. Custom recipes should have accurate dietary tags. Planner slots retain saved choices when a preference changes; newly selectable recipes and shopping requirements respect the current preference. Review previous assignments after changing diet.

The Share action shares the app URL, not private database records. Recipe JSON export/import is the portable recipe-sharing path. Liked recipe IDs persist in the profile; the Recipe Like button shows the liked subset.

Automatic AI video generation is disabled. Previously cached step videos can still play from IndexedDB. Browser media storage is not an OS folder and is not a backup.

## Verification

`npm test` exercises domain behavior and the database adapter with controlled mock responses. `npm run test:browser` exercises rendered desktop/mobile workflows, reloads, IndexedDB music, selective exports and the offline shell. Live OAuth, Firestore rules enforcement, provider quota behavior, microphone capture, audible output and cross-device synchronization still require configured services and target-device checks. Mocked integration tests do not establish that external services are deployed.
