// Local reference data keeps category suggestions available offline.
export const COMMON_INGREDIENTS = {
  Vegetables: ['Tomato', 'Potato', 'Onion', 'Carrot', 'Cauliflower', 'Cabbage', 'Spinach', 'Green peas', 'Green bell pepper', 'Green chilli', 'Ginger', 'Garlic', 'Brinjal', 'Okra', 'Cucumber', 'Beetroot', 'Broccoli', 'Mushroom', 'Pumpkin', 'Bottle gourd', 'Bitter gourd', 'Sweet potato', 'French beans', 'Radish', 'Fresh coriander', 'Curry leaves', 'Mint'],
  Fruits: ['Apple', 'Banana', 'Mango', 'Orange', 'Lemon', 'Lemon juice', 'Lime', 'Grapes', 'Papaya', 'Pineapple', 'Watermelon', 'Pomegranate', 'Guava', 'Strawberry', 'Coconut', 'Dates', 'Raisins'],
  Masala: ['Turmeric', 'Cumin seeds', 'Cumin powder', 'Coriander seeds', 'Coriander powder', 'Mustard seeds', 'Red chilli powder', 'Garam masala', 'Pav bhaji masala', 'Chaat masala', 'Sambar powder', 'Black pepper', 'Cinnamon', 'Cloves', 'Cardamom', 'Bay leaf', 'Fenugreek seeds', 'Fennel seeds', 'Asafoetida', 'Ginger-garlic paste', 'Amchur', 'Kasuri methi', 'Salt'],
  Pulses: ['Toor dal', 'Moong dal', 'Masoor dal', 'Chana dal', 'Urad dal', 'Chickpeas', 'Kabuli chana', 'Kala chana', 'Rajma', 'Black-eyed peas', 'Green gram', 'Horse gram', 'Lentils', 'Soybeans'],
  Dairy: ['Milk', 'Curd', 'Yogurt', 'Paneer', 'Butter', 'Ghee', 'Cream', 'Cheese', 'Buttermilk', 'Condensed milk', 'Khoya'],
  Grains: ['Rice', 'Basmati rice', 'Brown rice', 'Wheat flour', 'Whole wheat flour', 'Maida', 'Semolina (rava)', 'Thick poha (flattened rice)', 'Poha', 'Oats', 'Ragi', 'Bajra', 'Jowar', 'Quinoa', 'Barley', 'Corn flour', 'Besan', 'Bread', 'Pav bread rolls', 'Pasta', 'Noodles'],
  Meat: ['Chicken', 'Chicken breast', 'Chicken thigh', 'Mutton', 'Lamb', 'Goat meat', 'Beef', 'Pork', 'Turkey', 'Minced meat'],
  Seafood: ['Fish', 'Prawns', 'Shrimp', 'Salmon', 'Tuna', 'Rohu', 'Pomfret', 'Sardines', 'Crab', 'Lobster', 'Squid', 'Mussels'],
  Other: ['Oil', 'Sunflower oil', 'Mustard oil', 'Coconut oil', 'Olive oil', 'Water', 'Sugar', 'Jaggery', 'Honey', 'Egg', 'Peanuts', 'Cashews', 'Almonds', 'Sesame seeds', 'Vinegar', 'Soy sauce', 'Tamarind', 'Baking powder', 'Baking soda', 'Yeast', 'Tofu']
};

function knownCategory(name) {
  const normalized = name.toLowerCase();
  return Object.keys(COMMON_INGREDIENTS).find(category => COMMON_INGREDIENTS[category].some(item => {
    const base = item.toLowerCase();
    return normalized === base || normalized === `${base}s` || normalized === `${base}es` || normalized.startsWith(`${base} `);
  }));
}

export function ingredientSuggestions(category, prefix, pantry = [], recipes = []) {
  if (!prefix.trim() || !COMMON_INGREDIENTS[category]) return [];
  const counts = new Map();
  const names = new Map();
  const add = (name, frequency = 0) => {
    if (typeof name !== 'string') return;
    const key = name.trim().toLowerCase();
    if (!key.startsWith(prefix.toLowerCase()) || key.length <= prefix.length) return;
    if (!names.has(key)) names.set(key, name.trim());
    counts.set(key, (counts.get(key) || 0) + frequency);
  };
  COMMON_INGREDIENTS[category].forEach(name => add(name));
  for (const item of pantry) {
    if (item.category === category) add(item.name, 1);
  }
  for (const recipe of recipes) {
    for (const item of recipe.ingredients || []) {
      if ((item.category || (typeof item.name === 'string' && knownCategory(item.name))) === category) add(item.name, 1);
    }
  }
  return [...names.keys()].sort((a, b) => counts.get(b) - counts.get(a) || a.localeCompare(b)).map(key => names.get(key));
}
