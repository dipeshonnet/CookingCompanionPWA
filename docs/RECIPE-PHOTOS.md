# Recipe images

All 99 previously missing collection images are now packaged in `assets/recipes/`:
93 photographs sourced from Wikimedia Commons and six AI-generated illustrations.
The existing Idli photo and the eight recipes that already had remote photos were
retained. No paid image service or API key was used.

Photographs were selected using the file description and visual contact sheets.
These are representative finished-dish images, rather than photographs of the
exact recipe quantities. Unrelated results, raw ingredients, and images showing
meat alongside vegetarian dishes were excluded.

## Attribution and generation records

- `recipe-photo-sources.json` records the source page, photographer, license,
  source download URL, and modifications for each newly sourced photo.
- `generated-recipe-photos.json` retains the complete prompts and generator for
  Spinach Kootu, Palak Corn Curry, Paneer Paratha, Moong Dal Chilla, Dal Khichdi,
  and Vegetable Hakka Noodles. These were created using the built-in image
  generation tool, with prompts describing the dish's ingredients and appearance,
  natural daylight, and a centered finished dish without text or branding.
- `assets/recipes/ATTRIBUTION.LICENSE` travels with the offline app. Each sourced
  image retains its individual license. Generated illustrations are identified
  separately and are not represented as Creative Commons photographs.
- `modules/recipe-photos.js` supplies the local image paths and the credits shown
  in recipe details. Original image titles and authors are retained in credits.

Images were resized to at most 800 pixels per side and converted to WebP. The new
images total approximately 6.4 MB. Card crops are identified in the credits.
The build includes the images and attribution file in the offline asset manifest.

## Swiggy and Zomato

Both services were checked as requested. Their photographs were not imported:
[Swiggy's terms, section 13](https://www.swiggy.com/terms-and-conditions)
restrict reuse of the platform's photographs, and
[Zomato's terms](https://www.zomato.com/policies/terms-of-service/)
require permission to reproduce or republish its images. No reuse permission was
available for this app.

## Tools and verification

- `tools/source-recipe-photos.mjs` searches Commons and filters for reusable
  licenses, named authors, and adequate resolution. It respects rate limits.
  Search candidates are written to ignored `output/recipe-photos/candidates.json`.
  `--refresh=RECIPE_ID` searches a particular recipe again.
- Review candidates and set optional numeric selections in
  `output/recipe-photos/selections.json` before running
  `tools/import-recipe-photos.mjs`. It uses Sharp, available through
  `SHARP_MODULE_PATH` when not installed locally. Without the search output, the
  importer can restore missing sourced files from the committed provenance record.
- `tools/recipe-photo-contact-sheet.mjs` creates visual review sheets in
  `output/recipe-photos/`.
- `tests/recipe-photos.test.mjs` checks every vegetarian collection recipe for a
  real packaged image, attribution or a generation label, and offline inclusion.

Validation: 107 unit tests passed using `node --test --test-isolation=none
tests/*.test.mjs`; the production build succeeded. All new image files were also
decoded for image integrity and reviewed on contact sheets.
