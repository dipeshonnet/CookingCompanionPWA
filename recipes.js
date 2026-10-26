import { RECIPE_ACTIONS } from './modules/recipe-actions.js';
import { RECIPE_PORTION_DATA } from './modules/recipe-portion-data.js';
import { VEGETARIAN_RECIPES } from './modules/vegetarian-recipes.js';

export const HANDPICKED_RECIPES = [
  {
    id: "handpicked-poha",
    title: "Poha",
    description: "Light and fluffy flattened rice with onions, peanuts, curry leaves, and a fresh squeeze of lemon.",
    category: "Breakfast",
    difficulty: "Easy",
    prepTime: 5,
    cookTime: 15,
    servings: 2,
    rating: 0,
    image: "https://commons.wikimedia.org/wiki/Special:FilePath/Cooked_Poha.jpg?width=800",
    imageCredit: "Cooked Poha by ampersandyslexia, CC BY-SA 2.0 (https://creativecommons.org/licenses/by-sa/2.0/). Source: https://commons.wikimedia.org/wiki/File:Cooked_Poha.jpg. Display cropped to fit.",
    tags: ["Vegetarian", "Indian", "Quick"],
    ingredients: [
      { name: "Thick poha (flattened rice)", amount: 2, unit: "cups" },
      { name: "Onion", amount: 1, unit: "pc" },
      { name: "Peanuts", amount: 0.25, unit: "cup" },
      { name: "Mustard seeds", amount: 0.5, unit: "tsp" },
      { name: "Curry leaves", amount: 8, unit: "pcs" },
      { name: "Green chilli", amount: 1, unit: "pc" },
      { name: "Turmeric", amount: 0.25, unit: "tsp" },
      { name: "Oil", amount: 1.5, unit: "tbsp" },
      { name: "Salt", amount: 0.5, unit: "tsp" },
      { name: "Lemon juice", amount: 1, unit: "tbsp" },
      { name: "Fresh coriander", amount: 2, unit: "tbsp" }
    ],
    stepSchemaVersion: 2,
    steps: RECIPE_ACTIONS["handpicked-poha"]
  },
  {
    id: "handpicked-upma",
    title: "Upma",
    description: "Soft, savoury roasted semolina with vegetables, mustard seeds, and fragrant curry leaves.",
    category: "Breakfast",
    difficulty: "Easy",
    prepTime: 5,
    cookTime: 20,
    servings: 2,
    rating: 0,
    image: "https://upload.wikimedia.org/wikipedia/commons/1/16/Upma.jpg",
    imageCredit: "Upma by stu_spivack, CC BY-SA 2.0 (https://creativecommons.org/licenses/by-sa/2.0/). Source: https://commons.wikimedia.org/wiki/File:Upma.jpg. Display cropped to fit.",
    tags: ["Vegetarian", "Indian", "Semolina"],
    ingredients: [
      { name: "Semolina (rava)", amount: 1, unit: "cup" },
      { name: "Water", amount: 2.5, unit: "cups" },
      { name: "Onion", amount: 1, unit: "pc" },
      { name: "Carrot", amount: 1, unit: "pc" },
      { name: "Green peas", amount: 0.25, unit: "cup" },
      { name: "Mustard seeds", amount: 0.5, unit: "tsp" },
      { name: "Curry leaves", amount: 8, unit: "pcs" },
      { name: "Ginger", amount: 1, unit: "tsp" },
      { name: "Green chilli", amount: 1, unit: "pc" },
      { name: "Oil", amount: 1.5, unit: "tbsp" },
      { name: "Salt", amount: 0.5, unit: "tsp" },
      { name: "Lemon juice", amount: 1, unit: "tsp" }
    ],
    stepSchemaVersion: 2,
    steps: RECIPE_ACTIONS["handpicked-upma"]
  },
  {
    id: "handpicked-pav-bhaji",
    title: "Pav Bhaji",
    description: "A buttery, spiced mash of vegetables served with toasted pav, chopped onion, and lemon wedges.",
    category: "Dinner",
    difficulty: "Medium",
    prepTime: 10,
    cookTime: 30,
    servings: 2,
    rating: 0,
    image: "https://commons.wikimedia.org/wiki/Special:FilePath/Bhaji_pav.jpg?width=800",
    imageCredit: "Bhaji pav by BHAAGIi, CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/). Source: https://commons.wikimedia.org/wiki/File:Bhaji_pav.jpg. Display cropped to fit.",
    tags: ["Vegetarian", "Indian", "Street Food"],
    ingredients: [
      { name: "Potatoes", amount: 2, unit: "pcs" },
      { name: "Cauliflower florets", amount: 1, unit: "cup" },
      { name: "Green peas", amount: 0.5, unit: "cup" },
      { name: "Onion", amount: 1, unit: "pc" },
      { name: "Tomatoes", amount: 2, unit: "pcs" },
      { name: "Green bell pepper", amount: 1, unit: "pc" },
      { name: "Ginger-garlic paste", amount: 1, unit: "tbsp" },
      { name: "Pav bhaji masala", amount: 1.5, unit: "tbsp" },
      { name: "Butter", amount: 3, unit: "tbsp" },
      { name: "Salt", amount: 0.5, unit: "tsp" },
      { name: "Pav bread rolls", amount: 4, unit: "pcs" },
      { name: "Lemon", amount: 1, unit: "pc" },
      { name: "Fresh coriander", amount: 2, unit: "tbsp" }
    ],
    stepSchemaVersion: 2,
    steps: RECIPE_ACTIONS["handpicked-pav-bhaji"]
  }
];

export const APP_RECIPES = [
  ...HANDPICKED_RECIPES,
  {
    id: "r1",
    title: "Gourmet Garlic Butter Tuscan Salmon",
    description: "Pan-seared salmon fillets in a rich, creamy garlic butter sauce with fresh spinach and sun-dried tomatoes.",
    category: "Dinner",
    difficulty: "Medium",
    prepTime: 10,
    cookTime: 15,
    servings: 2,
    rating: 0,
    image: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&auto=format&fit=crop&q=60",
    tags: ["Seafood", "Gluten-Free", "Low-Carb"],
    ingredients: [
      { name: "Salmon fillets", amount: 2, unit: "pcs" },
      { name: "Garlic", amount: 4, unit: "cloves" },
      { name: "Butter", amount: 2, unit: "tbsp" },
      { name: "Spinach", amount: 2, unit: "cups" },
      { name: "Sun-dried tomatoes", amount: 0.5, unit: "cup" },
      { name: "Heavy cream", amount: 0.75, unit: "cup" },
      { name: "Parmesan cheese", amount: 0.25, unit: "cup" },
      { name: "Olive oil", amount: 1, unit: "tbsp" }
    ],
    stepSchemaVersion: 2,
    steps: RECIPE_ACTIONS["r1"]
  },
  {
    id: "r2",
    title: "Mediterranean Avocado Toast",
    description: "Creamy mashed avocado on toasted artisanal sourdough, topped with crumbled feta, cherry tomatoes, and balsamic glaze.",
    category: "Breakfast",
    difficulty: "Easy",
    prepTime: 5,
    cookTime: 5,
    servings: 1,
    rating: 0,
    image: "https://images.unsplash.com/photo-1541532713592-79a0317b6b77?w=800&auto=format&fit=crop&q=60",
    tags: ["Vegetarian", "Quick", "Healthy"],
    ingredients: [
      { name: "Sourdough bread", amount: 2, unit: "slices" },
      { name: "Avocado", amount: 1, unit: "pc" },
      { name: "Cherry tomatoes", amount: 0.5, unit: "cup" },
      { name: "Feta cheese", amount: 0.25, unit: "cup" },
      { name: "Lemon juice", amount: 1, unit: "tsp" },
      { name: "Balsamic glaze", amount: 1, unit: "tbsp" },
      { name: "Red pepper flakes", amount: 0.25, unit: "tsp" }
    ],
    stepSchemaVersion: 2,
    steps: RECIPE_ACTIONS["r2"]
  },
  {
    id: "r3",
    title: "Classic Creamy Basil Pesto Pasta",
    description: "Al dente penne tossed in a vibrant homemade basil pesto sauce, enriched with toasted pine nuts and grated pecorino.",
    category: "Lunch",
    difficulty: "Easy",
    prepTime: 10,
    cookTime: 10,
    servings: 2,
    rating: 0,
    image: "https://images.unsplash.com/photo-1621996346565-e3bb64e0be5e?w=800&auto=format&fit=crop&q=60",
    tags: ["Pasta", "Vegetarian", "Italian"],
    ingredients: [
      { name: "Penne pasta", amount: 200, unit: "g" },
      { name: "Fresh basil", amount: 2, unit: "cups" },
      { name: "Garlic", amount: 2, unit: "cloves" },
      { name: "Pine nuts", amount: 0.25, unit: "cup" },
      { name: "Parmesan cheese", amount: 0.5, unit: "cup" },
      { name: "Olive oil", amount: 0.33, unit: "cup" },
      { name: "Cherry tomatoes", amount: 0.5, unit: "cup" }
    ],
    stepSchemaVersion: 2,
    steps: RECIPE_ACTIONS["r3"]
  },
  {
    id: "r4",
    title: "Crispy Sesame Ginger Tofu Bowl",
    description: "Crispy pan-fried tofu cubes glazed in a sticky sesame ginger soy sauce, served over warm jasmine rice and steamed broccoli.",
    category: "Lunch",
    difficulty: "Medium",
    prepTime: 15,
    cookTime: 15,
    servings: 2,
    rating: 0,
    image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=60",
    tags: ["Vegan", "Gluten-Free", "Healthy"],
    ingredients: [
      { name: "Firm tofu", amount: 1, unit: "block" },
      { name: "Soy sauce", amount: 3, unit: "tbsp" },
      { name: "Ginger", amount: 1, unit: "tbsp" },
      { name: "Garlic", amount: 2, unit: "cloves" },
      { name: "Maple syrup", amount: 2, unit: "tbsp" },
      { name: "Sesame oil", amount: 2, unit: "tbsp" },
      { name: "Cornstarch", amount: 2, unit: "tbsp" },
      { name: "Jasmine rice", amount: 1, unit: "cup" },
      { name: "Broccoli", amount: 1, unit: "head" }
    ],
    stepSchemaVersion: 2,
    steps: RECIPE_ACTIONS["r4"]
  },
  {
    id: "r5",
    title: "Double Chocolate Protein Pancakes",
    description: "Fluffy, high-protein chocolate pancakes made with oats, banana, and cocoa, topped with dark chocolate chips and fresh berries.",
    category: "Breakfast",
    difficulty: "Easy",
    prepTime: 5,
    cookTime: 10,
    servings: 2,
    rating: 0,
    image: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&auto=format&fit=crop&q=60",
    tags: ["High-Protein", "Sweet", "Vegetarian"],
    ingredients: [
      { name: "Oats", amount: 1, unit: "cup" },
      { name: "Banana", amount: 1, unit: "pc" },
      { name: "Protein powder", amount: 1, unit: "scoop" },
      { name: "Cocoa powder", amount: 2, unit: "tbsp" },
      { name: "Baking powder", amount: 1, unit: "tsp" },
      { name: "Milk", amount: 0.75, unit: "cup" },
      { name: "Dark chocolate chips", amount: 0.25, unit: "cup" }
    ],
    stepSchemaVersion: 2,
    steps: RECIPE_ACTIONS["r5"]
  }
];

APP_RECIPES.push(...VEGETARIAN_RECIPES);

for (const recipe of APP_RECIPES) {
  for (const step of recipe.steps) step.scaling = RECIPE_PORTION_DATA[recipe.id][step.id];
  for (const ingredient of recipe.ingredients) {
    if (ingredient.unit === 'g' && /^(potatoes|baby potatoes)$/i.test(ingredient.name)) {
      ingredient.gramsPerPiece = ingredient.name === 'Baby potatoes' ? 40 : 150;
      ingredient.pieceLabel = ingredient.name === 'Baby potatoes' ? 'baby potatoes' : 'medium potatoes';
    }
  }
  recipe.cookCount = Math.max(...recipe.steps.map(step => Number(step.cook.split(' ')[1])));
  recipe.prepTime = Math.ceil(recipe.steps.filter(step => step.stepType === 'Prep').reduce((sum, step) => sum + step.duration, 0) / 60);
  recipe.cookTime = Math.ceil(recipe.steps.filter(step => step.stepType === 'Cook').reduce((sum, step) => sum + step.duration, 0) / 60);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = APP_RECIPES;
}
