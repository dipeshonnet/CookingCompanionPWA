const APP_RECIPES = [
  {
    id: "r1",
    title: "Gourmet Garlic Butter Tuscan Salmon",
    description: "Pan-seared salmon fillets in a rich, creamy garlic butter sauce with fresh spinach and sun-dried tomatoes.",
    category: "Dinner",
    difficulty: "Medium",
    prepTime: 10,
    cookTime: 15,
    servings: 2,
    rating: 4.9,
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
    steps: [
      { duration: 180, text: "Heat olive oil and 1 tablespoon of butter in a large skillet over medium-high heat. Season salmon with salt and pepper, then sear for 4 minutes on each side until golden." },
      { duration: 120, text: "Remove salmon from skillet. In the same skillet, add the remaining butter and garlic. Sauté for 1 minute until fragrant." },
      { duration: 240, text: "Add sun-dried tomatoes and spinach. Cook for 2-3 minutes until spinach is fully wilted." },
      { duration: 300, text: "Reduce heat to low, pour in the heavy cream and bring to a gentle simmer. Stir in the parmesan cheese until the sauce thickens slightly." },
      { duration: 180, text: "Return the salmon to the skillet, spoon the sauce over the fillets, and simmer for an additional 2-3 minutes until the salmon is hot and cooked through." }
    ]
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
    rating: 4.8,
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
    steps: [
      { duration: 180, text: "Toast the sourdough bread slices until they are golden and crispy." },
      { duration: 120, text: "Mash the avocado in a small bowl with the lemon juice, salt, pepper, and a pinch of red pepper flakes." },
      { duration: 120, text: "Spread the mashed avocado evenly across both slices of toasted bread." },
      { duration: 60, text: "Top with halved cherry tomatoes and crumbled feta cheese. Drizzle with balsamic glaze and serve immediately." }
    ]
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
    rating: 4.7,
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
    steps: [
      { duration: 600, text: "Bring a large pot of salted water to a boil. Add the penne pasta and cook for 9-10 minutes until al dente. Reserve 1/2 cup of pasta water, then drain." },
      { duration: 180, text: "While pasta cooks, toast the pine nuts in a dry pan over medium heat for 2-3 minutes until golden and fragrant." },
      { duration: 180, text: "In a food processor, blend the basil, garlic, toasted pine nuts, and parmesan cheese while slowly drizzling in the olive oil until smooth." },
      { duration: 120, text: "Toss the drained pasta with the pesto sauce, adding a splash of reserved pasta water to emulsify the sauce. Mix in halved cherry tomatoes and serve warm." }
    ]
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
    rating: 4.6,
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
    steps: [
      { duration: 600, text: "Press the tofu block to remove excess water. Cut into bite-sized cubes, then toss with cornstarch until evenly coated." },
      { duration: 900, text: "Cook jasmine rice according to package instructions. Meanwhile, steam broccoli florets until tender-crisp (about 4 minutes)." },
      { duration: 480, text: "Heat sesame oil in a skillet. Add the tofu and pan-fry for 8 minutes, flipping occasionally until golden and crispy on all sides." },
      { duration: 180, text: "Whisk together soy sauce, minced ginger, minced garlic, and maple syrup. Pour the sauce into the skillet, stirring until it thickens and glazes the tofu (2 minutes)." },
      { duration: 60, text: "Assemble bowls with jasmine rice, steamed broccoli, and crispy sesame tofu. Garnish with sesame seeds if desired." }
    ]
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
    rating: 4.8,
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
    steps: [
      { duration: 180, text: "In a blender, combine oats, banana, protein powder, cocoa powder, baking powder, and milk. Blend on high until completely smooth." },
      { duration: 60, text: "Stir the dark chocolate chips into the pancake batter by hand." },
      { duration: 300, text: "Heat a non-stick skillet over medium-low heat. Pour batter to form small pancakes and cook for 2-3 minutes until small bubbles form on top." },
      { duration: 180, text: "Flip and cook the other side for 1-2 minutes until cooked through. Repeat with the remaining batter and serve warm." }
    ]
  }
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = APP_RECIPES;
}
