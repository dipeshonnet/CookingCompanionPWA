# Egg-free vegetarian collection

The 100 additions are an editorial collection of popular home-style dishes, not a measured popularity ranking. They supplement the original eight recipes. All instructions and descriptions in `modules/vegetarian-recipes.js` are original, compact directions for this app; no photographs or recipe text were copied from the references below.

| Meal | Indian | International | Total |
| --- | ---: | ---: | ---: |
| Breakfast | 20 | 5 | 25 |
| Lunch | 28 | 7 | 35 |
| Dinner | 32 | 8 | 40 |
| Total | 80 | 20 | 100 |

The Indian selection spans fermented breakfasts, lentils, beans, vegetable sides, paneer dishes, rice meals, breads and street-food meals. International recipes cover oats, wraps, salads, soups, Italian bakes, Thai noodles/curry, Mexican meals and vegetable sushi. Each recipe serves two; some make several small pieces as described in the actions. Breakfast/Lunch/Dinner are the app's existing categories, so street-food meals use Dinner rather than introducing a new category.

## Ingredient and preparation decisions

- No eggs, meat, seafood, animal stock, gelatin or animal-rennet cheeses. Dairy is permitted. Prepared bread, noodles, pasta, tortillas and granola are explicitly egg-free; cheeses specify vegetarian rennet. Thai curry paste is vegan and sauces use vegetarian soy sauce.
- Vegetarian is applied to every addition. Vegan is also applied when the listed ingredients contain no dairy. Users can change their personal recipes and dietary tags themselves.
- Ingredient quantities are for the stated two-serving recipe, including any oil used for frying; not all frying oil is consumed. Rinsing, soaking and steaming water described as additional is process water. Cooked rice and cooked/canned beans are explicit prepared ingredients, not raw ingredients with omitted cooking steps.
- Kidney beans are fully cooked canned beans. Whole urad, white peas, chickpeas for falafel, and batters have explicit soaking/fermentation actions. Falafel uses soaked dried chickpeas, not canned beans. Fermentation waits have readiness cues because room temperature changes the actual time.
- Rice casseroles use separate covered cooking and resting actions. Hands-on simmering remains active where stirring is needed; soaking, proofing and unattended covered waits are passive. Actions are conservatively sequential so shared pans and appliances cannot be scheduled in conflict.
- All images use the existing local fallback (`assets/logo.png`). No new image licensing or remote availability dependency is introduced. New recipes have no fabricated ratings.
- Times are estimates and include waits; readiness cues in instructions take precedence over a timer. Automated checks validate structure, not kitchen testing of the meals.

## Reference checks

Checked October 26, 2026. These references informed representative grain ratios, preparation methods, fermentation/soaking requirements and ingredient substitutions. The app's recipes are home-style adaptations; references are not endorsements or claims that every variant has been kitchen-tested.

- [Dassana Amit: traditional dosa batter](https://www.vegrecipesofindia.com/dosa-recipe-dosa-batter-recipe/) — rice/urad proportions and fermentation readiness.
- [Dassana Amit: idli and homemade batter](https://www.vegrecipesofindia.com/idli-recipe-how-to-make-soft-idlis/) — soaking, separate grinding, fermentation and steaming.
- [Dassana Amit: dal makhani](https://www.vegrecipesofindia.com/dal-makhani-restaurant-style-recipe/) — whole-lentil soaking and slow softening before enrichment.
- [Dassana Amit: khaman dhokla](https://www.vegrecipesofindia.com/khaman-dhokla-microwave-recipe/) — fruit-salt activation immediately before steaming and a moist tempering. The app uses a steamed variation.
- [Good Food Middle East: five-ingredient falafel](https://www.bbcgoodfoodme.com/recipes/5-ingredient-falafel/) — dried chickpeas soaked before processing, without egg binding.
- [BBC: vegan Thai green curry](https://downloads.bbc.co.uk/herefordandworcester/pdf/vegan_thai_green_curry.pdf) — checking curry paste for animal ingredients.
- [Dassana's vegetarian recipe index](https://www.vegrecipesofindia.com/recipes/) — regional and meal-family coverage.

## Verification

Automated tests check the exact quotas, unique IDs/titles, ingredient completeness, egg-free and vegetarian ingredient constraints, specialty ingredient labels, action dependencies and schedules for one and two cooks. Personalization tests separately cover immutability, stable IDs, local/account isolation, offline merging and deletion, import conversion, failures, shopping quantities and frozen cooking sessions.
