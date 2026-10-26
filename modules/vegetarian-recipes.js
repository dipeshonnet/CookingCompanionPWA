// Original home-cooking instructions. Reference checks and selection notes:
// docs/RECIPE-COLLECTION.md. Quantities serve two unless explicitly overridden.
import { inferActionType } from './action-types.js';

const prep = (title, item, seconds, action) => ({ title, item, duration: seconds, action, stepType: 'Prep', attention: 'active' });
const cook = (title, item, seconds, action) => ({ title, item, duration: seconds, action, stepType: 'Cook', attention: 'active' });
const wait = (title, item, seconds, action, stepType = 'Cook') => ({ title, item, duration: seconds, action, stepType, attention: 'passive' });
const serve = title => prep('Serve', title, 30, `Serve the ${title.toLowerCase()} freshly prepared.`);
const ingredients = text => text.split(';').map(part => {
  const [, amount, unit, name] = part.trim().match(/^(\S+) (\S+) (.+)$/);
  return { amount: Number(amount), unit, name };
});

function recipe(title, category, cuisine, description, list, actions, difficulty = 'Easy', servings = 2) {
  const steps = [...actions, serve(title)].map((step, index) => ({ ...step, id: `action-${index + 1}`,
    dependsOn: index ? [`action-${index}`] : [], cook: 'Cook 1', actionType: inferActionType(step.action), text: step.action }));
  const items = ingredients(list);
  const dairy = /\b(ghee|paneer|butter|yogurt|curd|buttermilk|cream|cheese|ricotta|mozzarella|feta|parmesan)\b|(?<!coconut )\bmilk\b/i;
  return { id: `veg-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '')}`, title, category,
    description, difficulty, servings, cookCount: 1, stepSchemaVersion: 2, rating: 0, image: 'assets/logo.png',
    tags: ['Vegetarian', 'Egg-Free', cuisine, ...(!items.some(item => dairy.test(item.name)) ? ['Vegan'] : [])],
    ingredients: items, steps,
    prepTime: Math.ceil(steps.filter(s => s.stepType === 'Prep').reduce((n, s) => n + s.duration, 0) / 60),
    cookTime: Math.ceil(steps.filter(s => s.stepType === 'Cook').reduce((n, s) => n + s.duration, 0) / 60) };
}
const breakfast = (title, description, list, steps, difficulty = 'Easy') => recipe(title, 'Breakfast', 'Indian', description, list, steps, difficulty);
const lunch = (title, description, list, steps, difficulty = 'Easy') => recipe(title, 'Lunch', 'Indian', description, list, steps, difficulty);
const dinner = (title, description, list, steps, difficulty = 'Easy') => recipe(title, 'Dinner', 'Indian', description, list, steps, difficulty);

// Fermented batter is prepared from scratch, rather than hiding overnight work.
function fermentedBatter() {
  return [
    prep('Rinse rice and dal', 'Rice and urad dal', 120, 'Rinse the rice and urad dal separately until the water runs mostly clear.'),
    wait('Soak grains', 'Rice and urad dal', 21600, 'Soak the rice and dal in separate bowls of ample water for six hours.', 'Prep'),
    prep('Drain grains', 'Rice and urad dal', 60, 'Drain the soaked grains.'),
    prep('Grind urad dal', 'Urad dal', 300, 'Grind the dal with about 100 ml fresh water into a light, fluffy paste.'),
    prep('Grind rice', 'Rice', 300, 'Grind the rice with up to 200 ml fresh water to a slightly grainy batter.'),
    prep('Combine batter', 'Batter', 120, 'Mix the two batters with salt in a large bowl with space to rise.'),
    wait('Ferment batter', 'Batter', 43200, 'Leave loosely covered in a warm place for about 12 hours, until airy with a pleasantly sour aroma. In cool conditions allow longer; do not proceed with flat batter.', 'Prep')
  ];
}

function paratha(title, filling, amount, fillingPrep) {
  return breakfast(title, `Whole-wheat flatbreads stuffed with seasoned ${filling.toLowerCase()}, browned on a tawa.`,
    `1.5 cup Whole-wheat flour; 0.6 cup Water; ${amount} g ${filling}; 0.5 tsp Cumin powder; 0.25 tsp Chilli powder; 0.5 tsp Salt; 2 tbsp Fresh coriander; 1.5 tbsp Oil`, [
      prep('Knead dough', 'Whole-wheat flour', 300, 'Knead the flour with half the salt and enough water for a soft, nonsticky dough.'),
      wait('Rest dough', 'Dough', 1200, 'Rest the covered dough for 20 minutes.', 'Prep'),
      ...fillingPrep,
      prep('Season filling', filling, 120, 'Mix the filling with cumin, chilli powder, coriander and the remaining salt.'),
      prep('Fill dough portions', 'Dough and filling', 300, 'Enclose the filling in six equal dough portions with well-sealed edges.'),
      prep('Roll parathas', 'Filled dough', 300, 'Roll each portion gently to a 15 cm circle on a lightly floured surface.'),
      cook('Heat tawa', 'Tawa', 90, 'Heat a heavy tawa over medium heat.'),
      cook('Cook parathas', 'Parathas and oil', 1080, 'Cook the parathas one at a time with the oil, turning as needed until golden patches appear on both sides with no raw dough. Allow about three minutes per paratha.')
    ], 'Medium');
}

function chilla(title, flour, list, initial = []) {
  return breakfast(title, `Thin savoury ${flour.toLowerCase()} pancakes with onion, coriander and gentle spice.`, list, [
    ...initial,
    prep('Chop vegetables', 'Onion and coriander', 180, 'Finely chop the onion and coriander.'),
    prep('Mix batter', flour, 180, 'Whisk the flour or ground lentils with the water, onion, coriander, cumin and salt to a pourable batter.'),
    wait('Rest batter', 'Batter', 600, 'Rest the batter for ten minutes.', 'Prep'),
    cook('Heat pan', 'Oil', 60, 'Heat a nonstick pan over medium heat with a thin coating of oil.'),
    cook('Cook chillas', 'Batter', 900, 'Cook six thin chillas with the remaining oil, turning each once the surface sets; allow about two minutes on the first side and one minute on the second.')
  ]);
}

const indianBreakfasts = [
  breakfast('Idli', 'Soft steamed rice-and-urad cakes made with naturally fermented batter. Start the previous day.',
    '1 cup Idli rice; 0.25 cup Urad dal; 0.5 tsp Salt; 2 cup Water; 1 tsp Oil', [
      ...fermentedBatter(), prep('Grease moulds', 'Oil', 60, 'Grease twelve idli moulds lightly with oil.'),
      prep('Fill moulds', 'Batter', 90, 'Spoon airy batter into the moulds without stirring out all the bubbles.'),
      cook('Bring steamer to boil', 'Water', 300, 'Bring additional water to a steady boil below the steaming rack.'),
      wait('Steam idlis', 'Idli batter', 720, 'Steam covered over medium heat for 12 minutes, until a skewer comes out clean.'),
      wait('Rest idlis', 'Idlis', 180, 'Rest the idlis off the heat for three minutes before unmoulding.')
    ], 'Medium'),
  breakfast('Masala Dosa', 'Crisp fermented rice crepes filled with mustard-tempered potatoes. Start the batter the previous day.',
    '1 cup Rice; 0.25 cup Urad dal; 2 cup Water; 300 g Potatoes; 1 pcs Onion; 0.5 tsp Mustard seeds; 8 pcs Curry leaves; 0.25 tsp Turmeric; 0.75 tsp Salt; 2 tbsp Oil', [
      ...fermentedBatter(), prep('Peel potatoes', 'Potatoes', 90, 'Peel the potatoes.'), prep('Dice potatoes', 'Potatoes', 180, 'Dice the potatoes into small cubes.'),
      cook('Boil potatoes', 'Potatoes', 900, 'Boil the potato cubes in water just covering them until easily pierced.'),
      prep('Drain potatoes', 'Potatoes', 60, 'Drain the cooked potatoes.'), prep('Slice onion', 'Onion', 90, 'Thinly slice the onion.'),
      cook('Heat filling oil', 'Oil', 45, 'Heat one tablespoon oil in a frying pan.'),
      cook('Temper seeds', 'Mustard seeds and curry leaves', 45, 'Toast the mustard seeds and curry leaves in the oil until the seeds pop.'),
      cook('Soften onion', 'Onion', 300, 'Sauté the onion over medium heat until soft.'),
      cook('Season potatoes', 'Potatoes and turmeric', 180, 'Fold the potatoes, turmeric and remaining salt into the onion over low heat.'),
      cook('Heat dosa pan', 'Pan', 90, 'Heat a flat nonstick pan over medium-high heat.'),
      cook('Cook dosas', 'Fermented batter and oil', 900, 'Cook six thin spirals of batter with the remaining oil until crisp underneath and set on top, about two to three minutes each.'),
      prep('Fill dosas', 'Potato filling', 120, 'Fold the potato filling inside the hot dosas.')
    ], 'Medium'),
  breakfast('Rava Dosa', 'Lacy semolina-and-rice crepes with cumin and onion; no fermentation needed.',
    '0.5 cup Semolina; 0.5 cup Rice flour; 0.25 cup Plain flour; 2.5 cup Water; 0.5 pcs Onion; 0.5 tsp Cumin seeds; 0.5 tsp Salt; 2 tbsp Oil', [
      prep('Mince onion', 'Onion', 90, 'Finely mince the onion.'), prep('Mix thin batter', 'Flours and seasonings', 180, 'Whisk all flours with water, onion, cumin and salt into a very thin batter.'),
      wait('Rest batter', 'Batter', 1200, 'Rest for 20 minutes so the semolina hydrates.', 'Prep'),
      cook('Heat pan', 'Pan', 120, 'Heat a nonstick tawa over medium-high heat.'),
      cook('Cook lacy dosas', 'Batter and oil', 1200, 'Cook six dosas with a little oil by pouring stirred batter from the outside inward, allowing about three minutes per dosa until crisp underneath and set on top.')
    ], 'Medium'),
  breakfast('Vegetable Uttapam', 'Thick fermented pancakes topped with onion, tomato and carrot.',
    '1 cup Idli rice; 0.25 cup Urad dal; 2 cup Water; 0.5 pcs Onion; 1 pcs Tomato; 1 pcs Carrot; 0.5 tsp Salt; 1.5 tbsp Oil', [
      ...fermentedBatter(), prep('Chop toppings', 'Vegetables', 240, 'Finely chop the onion, tomato and carrot.'),
      cook('Heat tawa', 'Tawa', 90, 'Heat a lightly oiled nonstick tawa over medium heat.'),
      cook('Cook uttapams', 'Batter, vegetables and oil', 1200, 'Cook six thick pancakes topped with the vegetables, turning once the base is golden; allow about two minutes per side with the remaining oil.')
    ], 'Medium'),
  breakfast('Medu Vada', 'Crisp urad dal fritters with fluffy centres and pepper. Includes soaking time.',
    '1 cup Urad dal; 3 cup Water; 1 tsp Ginger; 0.5 tsp Black pepper; 0.5 tsp Cumin seeds; 0.5 tsp Salt; 300 ml Oil', [
      prep('Rinse dal', 'Urad dal', 60, 'Rinse the dal until the water runs clear.'),
      wait('Soak dal', 'Urad dal', 14400, 'Soak the dal in water for four hours.', 'Prep'),
      prep('Drain dal', 'Urad dal', 60, 'Drain the dal very thoroughly.'),
      prep('Grind dal', 'Urad dal', 300, 'Grind the dal to a fluffy paste with only a few tablespoons fresh water.'),
      prep('Season batter', 'Seasonings', 120, 'Beat the ginger, pepper, cumin and salt into the thick batter.'),
      cook('Heat frying oil', 'Oil', 300, 'Heat the oil in a deep pan to about 175°C.'),
      cook('Fry vadas', 'Batter', 900, 'Fry eight small ring-shaped portions in batches, turning until deep golden on both sides and cooked through, about five minutes per batch.')
    ], 'Medium'),
  chilla('Besan Chilla', 'Gram flour', '1 cup Gram flour; 1 cup Water; 0.5 pcs Onion; 2 tbsp Fresh coriander; 0.5 tsp Cumin powder; 0.5 tsp Salt; 1 tbsp Oil'),
  chilla('Moong Dal Chilla', 'Moong dal', '1 cup Moong dal; 1 cup Water; 0.5 pcs Onion; 2 tbsp Fresh coriander; 0.5 tsp Cumin powder; 0.5 tsp Salt; 1 tbsp Oil', [
    wait('Soak moong dal', 'Moong dal', 10800, 'Soak rinsed moong dal in ample additional water for three hours.', 'Prep'),
    prep('Drain dal', 'Moong dal', 60, 'Drain the soaked dal.'),
    prep('Grind lentils', 'Moong dal', 180, 'Grind the soaked dal with the measured water to a smooth batter.')
  ]),
  breakfast('Pesarattu', 'Andhra green-gram crepes with ginger, rice and cumin.',
    '1 cup Whole green gram; 2 tbsp Rice; 0.75 cup Water; 1 tsp Ginger; 0.5 tsp Cumin seeds; 0.5 tsp Salt; 1.5 tbsp Oil', [
      wait('Soak grains', 'Green gram and rice', 28800, 'Soak rinsed green gram and rice in ample additional water for eight hours.', 'Prep'),
      prep('Drain grains', 'Green gram and rice', 60, 'Drain the grains.'),
      prep('Grind batter', 'Grains and seasonings', 240, 'Grind the soaked grains with measured water, ginger, cumin and salt into a spreadable batter.'),
      cook('Heat griddle', 'Griddle', 90, 'Heat a nonstick griddle over medium heat.'),
      cook('Cook pesarattu', 'Batter and oil', 1200, 'Cook six thin crepes with the oil, turning once the edges lift, until crisp and cooked through, about three minutes each.')
    ]),
  breakfast('Appam', 'Lacy coconut rice pancakes with soft centres, made with a yeast-fermented batter.',
    '1 cup Rice; 0.25 cup Cooked rice; 0.5 cup Coconut milk; 0.5 cup Water; 0.5 tsp Instant yeast; 1 tsp Sugar; 0.5 tsp Salt; 1 tsp Oil', [
      wait('Soak rice', 'Rice', 14400, 'Soak rinsed raw rice in ample additional water for four hours.', 'Prep'),
      prep('Drain rice', 'Rice', 60, 'Drain the rice.'),
      prep('Blend batter', 'Rice and coconut milk', 300, 'Blend both rices with coconut milk and measured water until smooth.'),
      prep('Add yeast', 'Yeast and seasonings', 60, 'Mix yeast, sugar and salt into the batter.'),
      wait('Ferment appam batter', 'Batter', 7200, 'Leave loosely covered in a warm place for two hours until visibly bubbly; allow longer in a cool kitchen.', 'Prep'),
      cook('Heat appam pan', 'Oil', 90, 'Heat an appam pan over medium-low heat with a light coating of oil.'),
      cook('Cook appams', 'Batter', 1080, 'Cook six appams one at a time in the covered pan, swirling each portion to a thin rim, until the centre is set, about three minutes each.')
    ], 'Medium'),
  breakfast('Puttu', 'Steamed rice-flour cylinders layered with fresh coconut.',
    '1 cup Puttu rice flour; 0.5 cup Water; 0.5 cup Grated coconut; 0.5 tsp Salt', [
      prep('Moisten flour', 'Rice flour', 240, 'Rub salted water gradually into the flour until damp crumbs hold together when squeezed.'),
      wait('Hydrate flour', 'Rice flour', 600, 'Rest the damp flour for ten minutes.', 'Prep'),
      prep('Layer puttu mould', 'Flour and coconut', 180, 'Layer loose flour and coconut in a puttu mould without packing tightly.'),
      cook('Boil steamer water', 'Water', 300, 'Bring additional water to a boil in the puttu steamer base.'),
      wait('Steam puttu', 'Puttu', 600, 'Steam the filled mould for ten minutes after steam emerges from the top.'),
      prep('Unmould puttu', 'Puttu', 60, 'Push the cooked puttu carefully out of the mould.')
    ]),
  breakfast('Idiyappam', 'Tender rice-flour noodle nests steamed until delicate and springy.',
    '1 cup Roasted rice flour; 1 cup Water; 0.5 tsp Salt; 1 tsp Oil; 0.25 cup Grated coconut', [
      cook('Boil water', 'Water and salt', 240, 'Bring the salted water to a rolling boil.'),
      prep('Mix dough', 'Rice flour', 120, 'Stir the hot water into the flour with a sturdy spoon to form a soft dough.'),
      prep('Knead warm dough', 'Dough', 120, 'Knead the dough when cool enough to handle until smooth.'),
      prep('Grease steaming plates', 'Oil', 60, 'Grease the steaming plates with oil.'),
      prep('Press noodle nests', 'Dough and coconut', 300, 'Press the dough through an idiyappam press into nests on the plates over a scattering of coconut.'),
      cook('Boil steamer water', 'Water', 300, 'Bring additional water to a boil below the rack.'),
      wait('Steam nests', 'Idiyappam', 600, 'Steam covered for ten minutes until the noodles look glossy and firm.')
    ], 'Medium'),
  breakfast('Khaman Dhokla', 'Light gram-flour cakes lifted with fruit salt and finished with a mustard tempering.',
    '1 cup Gram flour; 0.75 cup Water; 1 tbsp Lemon juice; 2 tsp Sugar; 0.5 tsp Salt; 1 tsp Plain fruit salt; 1 tbsp Oil; 0.5 tsp Mustard seeds; 8 pcs Curry leaves', [
      prep('Mix batter', 'Gram flour', 180, 'Whisk gram flour with half the water, lemon juice, sugar and salt to a smooth thick batter; adjust with a little more measured water if needed.'),
      prep('Grease tin', 'Oil', 45, 'Grease a shallow 15 cm tin with a teaspoon of oil.'),
      cook('Ready steamer', 'Water', 300, 'Bring additional water to a boil beneath the steaming rack.'),
      prep('Activate batter', 'Fruit salt', 20, 'Fold the plain fruit salt into the batter immediately before steaming.'),
      prep('Fill tin', 'Batter', 20, 'Pour the foamy batter immediately into the greased tin.'),
      wait('Steam dhokla', 'Batter', 900, 'Steam covered for 15 minutes until a skewer comes out clean.'),
      cook('Heat tempering oil', 'Oil', 45, 'Heat the remaining oil in a small pan.'),
      cook('Temper mustard', 'Mustard and curry leaves', 45, 'Toast mustard seeds and curry leaves until the seeds pop.'),
      prep('Dilute tempering', 'Water', 30, 'Stir the remaining measured water into the tempering off the heat, taking care of splashes.'),
      prep('Dress dhokla', 'Dhokla', 60, 'Pour the tempering evenly over the cooked dhokla.'),
      prep('Cut dhokla', 'Dhokla', 60, 'Cut the cooled cake into bite-sized squares.')
    ], 'Medium'),
  breakfast('Khandvi', 'Thin gram-flour and yogurt rolls with coconut and mustard seeds.',
    '0.5 cup Gram flour; 0.5 cup Yogurt; 1 cup Water; 0.25 tsp Turmeric; 0.5 tsp Salt; 1 tbsp Oil; 0.5 tsp Mustard seeds; 2 tbsp Grated coconut; 2 tbsp Fresh coriander', [
      prep('Whisk batter', 'Gram flour and yogurt', 180, 'Whisk flour, yogurt, water, turmeric and salt until free of lumps.'),
      cook('Thicken batter', 'Batter', 600, 'Stir constantly over medium-low heat until a thin smear on a plate cools enough to peel cleanly, about eight to ten minutes.'),
      prep('Spread sheets', 'Cooked batter', 180, 'Spread the hot paste very thinly across clean steel plates.'),
      wait('Cool sheets', 'Khandvi', 300, 'Leave the sheets to set for five minutes.', 'Prep'),
      prep('Roll strips', 'Khandvi', 240, 'Cut the sheets into strips to roll into loose cylinders.'),
      cook('Heat oil', 'Oil', 45, 'Heat the oil in a small pan.'),
      cook('Toast mustard', 'Mustard seeds', 30, 'Toast the mustard until it pops.'),
      prep('Dress rolls', 'Khandvi', 60, 'Spoon the tempering over the rolls.'),
      prep('Garnish rolls', 'Coconut and coriander', 60, 'Scatter coconut and chopped coriander over the rolls.')
    ], 'Hard'),
  breakfast('Methi Thepla', 'Soft Gujarati flatbreads with fenugreek leaves, yogurt and mild spice.',
    '1.5 cup Whole-wheat flour; 0.25 cup Gram flour; 1 cup Fenugreek leaves; 0.25 cup Yogurt; 0.25 cup Water; 0.25 tsp Turmeric; 0.5 tsp Cumin powder; 0.5 tsp Salt; 2 tbsp Oil', [
      prep('Chop methi', 'Fenugreek leaves', 180, 'Finely chop the washed fenugreek leaves.'),
      prep('Knead dough', 'Flours and seasonings', 300, 'Knead the flours with methi, yogurt, spices, salt, half the oil and just enough water for a soft dough.'),
      wait('Rest dough', 'Dough', 900, 'Rest covered for 15 minutes.', 'Prep'),
      prep('Roll theplas', 'Dough', 480, 'Roll the dough into eight thin circles on a lightly floured surface.'),
      cook('Heat tawa', 'Tawa', 90, 'Heat the tawa over medium heat.'),
      cook('Cook theplas', 'Theplas and oil', 960, 'Cook the theplas with the remaining oil, turning until both sides have golden spots, about two minutes each.')
    ], 'Medium'),
  paratha('Aloo Paratha', 'Potatoes', 300, [
    cook('Boil potatoes', 'Potatoes', 1200, 'Boil whole potatoes in ample water until tender to the centre.'),
    prep('Peel potatoes', 'Potatoes', 180, 'Peel the drained potatoes when cool enough to handle.'),
    prep('Mash potatoes', 'Potatoes', 120, 'Mash the potatoes until no large pieces remain.')
  ]),
  paratha('Gobi Paratha', 'Cauliflower', 250, [
    prep('Grate cauliflower', 'Cauliflower', 240, 'Finely grate the washed cauliflower.'),
    prep('Dry filling', 'Cauliflower', 120, 'Squeeze excess moisture from the grated cauliflower in a clean cloth.')
  ]),
  paratha('Paneer Paratha', 'Paneer', 200, [prep('Crumble paneer', 'Paneer', 120, 'Crumble paneer into fine, even pieces.')]),
  breakfast('Sabudana Khichdi', 'Pearl tapioca tossed with potatoes, cumin and roasted peanuts. Includes hydration time.',
    '1 cup Sabudana; 0.75 cup Water; 1 pcs Potato; 0.25 cup Roasted peanuts; 0.5 tsp Cumin seeds; 1 tbsp Ghee; 0.5 tsp Salt; 1 tbsp Lemon juice; 2 tbsp Fresh coriander', [
      prep('Rinse pearls', 'Sabudana', 90, 'Rinse sabudana gently in a sieve to remove surface starch.'),
      wait('Hydrate sabudana', 'Sabudana and water', 21600, 'Soak in the measured water for six hours until each pearl crushes easily, extending hydration with a little extra water if still hard.', 'Prep'),
      prep('Crush peanuts', 'Roasted peanuts', 120, 'Crush the peanuts coarsely.'), prep('Peel potato', 'Potato', 60, 'Peel the potato.'), prep('Dice potato', 'Potato', 120, 'Dice the potato into 1 cm cubes.'),
      cook('Heat ghee', 'Ghee', 45, 'Heat ghee over medium heat.'), cook('Toast cumin', 'Cumin seeds', 30, 'Toast cumin in the ghee until fragrant.'),
      cook('Cook potato', 'Potato', 600, 'Sauté the potato cubes over medium-low heat until tender.'),
      cook('Cook pearls', 'Sabudana, peanuts and salt', 360, 'Fold the sabudana, peanuts and salt through the potato until the pearls turn translucent, about six minutes.'),
      prep('Finish khichdi', 'Lemon and coriander', 60, 'Fold lemon juice and chopped coriander into the khichdi off the heat.')
    ]),
  breakfast('Misal Pav', 'Sprouted mung in a spicy tomato broth with crunchy farsan and egg-free bread rolls.',
    '2 cup Mung bean sprouts; 1 pcs Onion; 2 pcs Tomatoes; 1 tbsp Ginger-garlic paste; 1 tbsp Misal masala; 0.25 tsp Turmeric; 1 tbsp Oil; 2 cup Water; 0.5 tsp Salt; 0.5 cup Farsan; 4 pcs Egg-free pav rolls; 1 tbsp Lemon juice', [
      prep('Chop vegetables', 'Onion and tomatoes', 240, 'Finely chop onion and tomatoes.'), cook('Heat oil', 'Oil', 45, 'Heat oil in a saucepan over medium heat.'),
      cook('Sauté onion', 'Onion', 300, 'Sauté three quarters of the onion until golden.'), cook('Cook aromatics', 'Ginger-garlic paste', 60, 'Cook the ginger-garlic paste until fragrant.'),
      cook('Cook tomato masala', 'Tomatoes and spices', 360, 'Cook the tomatoes with misal masala, turmeric and salt until pulpy.'),
      cook('Add sprouts', 'Sprouts and water', 60, 'Stir sprouts and water into the masala.'),
      cook('Simmer misal', 'Misal', 1200, 'Simmer until sprouts are completely tender, about 20 minutes, with occasional stirring.'),
      prep('Top misal', 'Farsan, onion and lemon', 90, 'Top bowls of misal with farsan, reserved onion and lemon juice.'),
      prep('Arrange pav', 'Egg-free pav rolls', 30, 'Place the pav beside the misal.')
    ]),
  breakfast('Bread Pakora', 'Potato-filled egg-free bread triangles in a crisp gram-flour coating.',
    '4 slices Egg-free bread; 200 g Potatoes; 1 cup Gram flour; 0.75 cup Water; 0.5 tsp Cumin powder; 0.25 tsp Turmeric; 0.5 tsp Salt; 300 ml Oil', [
      cook('Boil potatoes', 'Potatoes', 1200, 'Boil the potatoes in ample water until tender.'), prep('Peel potatoes', 'Potatoes', 120, 'Peel the drained potatoes when cool enough to handle.'),
      prep('Mash filling', 'Potatoes and cumin', 120, 'Mash potatoes with cumin and half the salt.'), prep('Fill bread', 'Bread and filling', 180, 'Sandwich the filling between bread slices into two sandwiches.'),
      prep('Cut triangles', 'Sandwiches', 30, 'Cut each sandwich diagonally into two triangles.'), prep('Whisk coating', 'Gram flour', 120, 'Whisk flour, water, turmeric and remaining salt into a thick coating batter.'),
      cook('Heat oil', 'Oil', 300, 'Heat the oil in a deep pan to 175°C.'), prep('Coat triangles', 'Bread and batter', 60, 'Dip each triangle into batter until fully coated.'),
      cook('Fry pakoras', 'Coated bread', 480, 'Fry in two batches until golden on both sides, about four minutes per batch.')
    ], 'Medium')
];

// Shared curry foundations retain explicit, separately timed operations.
function masalaBase() {
  return [prep('Chop onion', 'Onion', 120, 'Finely chop the onion.'), prep('Chop tomatoes', 'Tomatoes', 120, 'Finely chop the tomatoes.'),
    cook('Heat oil', 'Oil', 45, 'Heat the oil in a saucepan over medium heat.'),
    cook('Toast cumin', 'Cumin seeds', 30, 'Toast cumin seeds until fragrant.'), cook('Sauté onion', 'Onion', 420, 'Sauté the onion until lightly golden.'),
    cook('Cook aromatics', 'Ginger-garlic paste', 60, 'Cook ginger-garlic paste until its raw smell fades.'),
    cook('Cook tomato masala', 'Tomatoes and spices', 420, 'Cook tomatoes with turmeric, coriander powder, chilli powder and salt until thick and glossy, stirring frequently.')];
}
const masalaIngredients = '1 pcs Onion; 2 pcs Tomatoes; 1 tbsp Ginger-garlic paste; 0.5 tsp Cumin seeds; 0.25 tsp Turmeric; 1 tsp Coriander powder; 0.25 tsp Chilli powder; 0.5 tsp Salt; 1 tbsp Oil';
function curry(title, description, principal, list, finish, initial = []) {
  return lunch(title, description, `${masalaIngredients}; ${list}`, [...initial, ...masalaBase(), ...finish, prep('Rest curry', principal, 30, 'Taste the curry for seasoning off the heat.')]);
}
function lentilCurry(title, lentil, amount, water, description, extra = '', finish = []) {
  return curry(title, description, lentil, `${amount} cup ${lentil}; ${water} cup Water${extra ? '; ' + extra : ''}`, [
    cook('Combine dal and masala', lentil, 90, 'Fold the cooked dal and its liquid into the tomato masala.'),
    cook('Simmer dal', lentil, 600, 'Simmer over low heat for ten minutes with occasional stirring.'), ...finish
  ], [prep('Rinse lentils', lentil, 90, 'Rinse the lentils thoroughly.'),
    ...(lentil === 'Whole black urad dal' ? [wait('Soak whole lentils', lentil, 28800, 'Soak the lentils in ample additional water for eight hours.', 'Prep'), prep('Drain lentils', lentil, 60, 'Drain the soaked lentils.')] : []),
    cook('Cook lentils', lentil, lentil === 'Whole black urad dal' ? 5400 : 2400,
      `Simmer the lentils in the measured water until completely soft, ${lentil === 'Whole black urad dal' ? 'about 90 minutes' : 'about 40 minutes'}, with occasional stirring and additional water if needed.`)]);
}
function paneerCurry(title, description, extra, before, after, waterAlreadyUsed = false) {
  return curry(title, description, 'Paneer', `200 g Paneer; 0.5 cup Water; ${extra}`, [
    ...before, prep('Cube paneer', 'Paneer', 120, 'Cut paneer into 2 cm cubes.'),
    ...(!waterAlreadyUsed ? [cook('Loosen sauce', 'Water', 30, 'Stir the measured water into the sauce.')] : []),
    cook('Warm paneer', 'Paneer', 300, 'Simmer paneer in the sauce over low heat for five minutes.'), ...after
  ]);
}

const indianLunches = [
  lentilCurry('Dal Tadka', 'Toor dal', 0.75, 3, 'Soft yellow lentils with tomato masala and a separate sizzling ghee tempering.', '1 tbsp Ghee; 2 cloves Garlic; 0.5 tsp Extra cumin seeds', [
    prep('Slice garlic', 'Garlic', 60, 'Thinly slice the garlic.'), cook('Heat ghee', 'Ghee', 45, 'Heat ghee in a small pan.'),
    cook('Brown tempering', 'Garlic and extra cumin', 60, 'Fry the garlic and extra cumin until pale golden.'), prep('Temper dal', 'Dal', 30, 'Pour the hot tempering over the dal.')
  ]),
  lentilCurry('Dal Fry', 'Moong dal', 0.75, 3, 'Comforting yellow mung lentils finished in an onion-and-tomato masala.'),
  lentilCurry('Dal Makhani', 'Whole black urad dal', 0.75, 5, 'Slow-simmered whole black lentils enriched with butter and cream.', '1 tbsp Butter; 3 tbsp Cream', [
    cook('Enrich dal', 'Butter and cream', 600, 'Stir butter and cream through the dal over very low heat for ten minutes.')
  ]),
  curry('Chana Masala', 'Cooked chickpeas in a tangy, warmly spiced tomato gravy.', 'Chickpeas', '2 cup Cooked chickpeas; 0.75 cup Water; 0.5 tsp Garam masala; 1 tbsp Lemon juice', [
    cook('Simmer chickpeas', 'Chickpeas and water', 900, 'Simmer the cooked chickpeas and water in the masala for 15 minutes with occasional stirring.'),
    prep('Finish chana', 'Garam masala and lemon', 45, 'Fold garam masala and lemon juice into the curry off the heat.')
  ]),
  curry('Rajma Masala', 'Tender kidney beans in a rich onion-and-tomato gravy, using fully cooked canned beans.', 'Kidney beans', '2 cup Canned kidney beans; 1 cup Water; 0.5 tsp Garam masala', [
    prep('Rinse canned beans', 'Canned kidney beans', 90, 'Rinse the drained canned kidney beans; this recipe requires fully cooked beans, not raw dried kidney beans.'),
    cook('Simmer rajma', 'Kidney beans and water', 1200, 'Simmer the beans and water in the masala for 20 minutes with occasional stirring.'),
    cook('Add garam masala', 'Garam masala', 60, 'Stir garam masala into the curry over low heat.')
  ]),
  lunch('Kadhi Pakora', 'A tangy yogurt-and-gram-flour sauce with soft onion fritters.',
    '1 cup Yogurt; 0.75 cup Gram flour; 3 cup Water; 1 pcs Onion; 0.5 tsp Turmeric; 0.5 tsp Cumin seeds; 0.75 tsp Salt; 250 ml Oil', [
      prep('Slice onion', 'Onion', 120, 'Thinly slice the onion.'), prep('Mix pakora batter', 'Onion and gram flour', 180, 'Mix onion with half the gram flour, one quarter teaspoon salt and a little of the water into a thick batter.'),
      cook('Heat frying oil', 'Oil', 300, 'Heat 200 ml oil in a small deep pan to 175°C.'), cook('Fry pakoras', 'Onion batter', 600, 'Fry small spoonfuls in batches until golden and cooked through, about four minutes per batch.'),
      prep('Whisk kadhi', 'Yogurt', 180, 'Whisk yogurt with remaining flour, water, turmeric and salt until smooth.'),
      cook('Heat tempering oil', 'Oil', 45, 'Heat one tablespoon of the remaining oil in a saucepan.'), cook('Toast cumin', 'Cumin', 30, 'Toast cumin until fragrant.'),
      cook('Cook kadhi', 'Yogurt mixture', 1500, 'Simmer the yogurt mixture in the pan for 25 minutes with frequent stirring to prevent splitting.'),
      cook('Soften pakoras', 'Pakoras', 300, 'Simmer the pakoras in the kadhi for five minutes.')
    ], 'Medium'),
  lunch('Sambar', 'Toor dal with mixed vegetables, tamarind and a fragrant mustard tempering.',
    '0.5 cup Toor dal; 3 cup Water; 1 pcs Carrot; 1 cup Pumpkin; 1 pcs Tomato; 1 tbsp Tamarind paste; 1 tbsp Sambar powder; 0.25 tsp Turmeric; 0.5 tsp Salt; 1 tbsp Oil; 0.5 tsp Mustard seeds; 8 pcs Curry leaves', [
      prep('Rinse dal', 'Toor dal', 60, 'Rinse the dal thoroughly.'), cook('Cook dal', 'Toor dal and water', 2400, 'Simmer the dal with two cups water and turmeric until soft, about 40 minutes.'),
      prep('Chop vegetables', 'Vegetables', 240, 'Cut the carrot, pumpkin and tomato into bite-sized pieces.'),
      cook('Simmer vegetables', 'Vegetables and seasonings', 1200, 'Simmer vegetables in the remaining water with tamarind, sambar powder and salt until tender, about 20 minutes.'),
      cook('Combine sambar', 'Cooked dal', 300, 'Simmer the cooked dal with the vegetables for five minutes.'),
      cook('Heat tempering oil', 'Oil', 45, 'Heat oil in a small pan.'), cook('Temper mustard', 'Mustard and curry leaves', 45, 'Toast mustard and curry leaves until the seeds pop.'),
      prep('Temper sambar', 'Sambar', 30, 'Pour the tempering over the sambar.')
    ]),
  lunch('Tomato Rasam', 'A light peppery tomato-and-tamarind broth with garlic and curry leaves.',
    '2 pcs Tomatoes; 3 cloves Garlic; 1 tsp Black pepper; 0.5 tsp Cumin seeds; 1 tbsp Tamarind paste; 2.5 cup Water; 0.5 tsp Salt; 1 tbsp Oil; 0.5 tsp Mustard seeds; 8 pcs Curry leaves; 2 tbsp Fresh coriander', [
      prep('Crush aromatics', 'Garlic, pepper and cumin', 120, 'Coarsely crush the garlic, pepper and cumin.'), prep('Chop tomatoes', 'Tomatoes', 120, 'Finely chop the tomatoes.'),
      cook('Heat oil', 'Oil', 45, 'Heat oil in a saucepan.'), cook('Temper seeds', 'Mustard and curry leaves', 45, 'Toast mustard and curry leaves until the seeds pop.'),
      cook('Sauté aromatics', 'Crushed spices', 45, 'Sauté the crushed spices briefly until fragrant.'), cook('Soften tomatoes', 'Tomatoes', 300, 'Cook tomatoes until pulpy.'),
      cook('Simmer rasam', 'Tamarind, water and salt', 600, 'Simmer tomatoes with tamarind, water and salt for ten minutes.'), prep('Garnish rasam', 'Coriander', 30, 'Scatter chopped coriander over the rasam.')
    ]),
  lunch('Mor Kuzhambu', 'A gentle yogurt-and-coconut curry with tender ash gourd.',
    '250 g Ash gourd; 1 cup Yogurt; 0.25 cup Grated coconut; 1 tsp Cumin seeds; 1 pcs Green chilli; 1 cup Water; 0.25 tsp Turmeric; 0.5 tsp Salt; 1 tbsp Oil; 0.5 tsp Mustard seeds; 8 pcs Curry leaves', [
      prep('Peel gourd', 'Ash gourd', 90, 'Peel the gourd.'), prep('Remove seeds', 'Ash gourd', 60, 'Scoop the seeds out of the gourd.'), prep('Cut gourd', 'Ash gourd', 180, 'Cut the gourd into 2 cm cubes.'), prep('Blend coconut', 'Coconut, cumin and chilli', 180, 'Blend coconut, cumin and chilli with a quarter cup water to a smooth paste.'),
      cook('Cook gourd', 'Gourd and seasonings', 900, 'Simmer gourd with remaining water, turmeric and salt until tender.'),
      prep('Whisk yogurt', 'Yogurt and coconut paste', 90, 'Whisk yogurt with the coconut paste.'),
      cook('Warm curry', 'Yogurt mixture', 240, 'Warm the yogurt mixture with the gourd over low heat, stirring gently without boiling.'),
      cook('Heat oil', 'Oil', 45, 'Heat oil in a small pan.'), cook('Temper mustard', 'Mustard and curry leaves', 45, 'Toast mustard and curry leaves until fragrant.'), prep('Dress curry', 'Curry', 30, 'Pour the tempering over the curry.')
    ]),
  lunch('Avial', 'Kerala mixed vegetables coated in coconut, cumin and yogurt.',
    '400 g Mixed carrots beans and pumpkin; 0.5 cup Grated coconut; 0.5 cup Yogurt; 0.5 tsp Cumin seeds; 1 pcs Green chilli; 0.25 tsp Turmeric; 0.5 tsp Salt; 0.5 cup Water; 1 tbsp Coconut oil; 8 pcs Curry leaves', [
      prep('Cut vegetables', 'Mixed vegetables', 300, 'Cut the washed vegetables into even finger-length batons.'), prep('Grind coconut', 'Coconut and spices', 180, 'Coarsely grind coconut, cumin and chilli with two tablespoons of the water.'),
      cook('Cook vegetables', 'Vegetables and water', 900, 'Cook vegetables with remaining water, turmeric and salt over low heat until just tender, stirring occasionally.'),
      cook('Coat vegetables', 'Coconut paste', 180, 'Fold coconut paste through the vegetables over low heat for three minutes.'),
      prep('Finish avial', 'Yogurt, coconut oil and curry leaves', 90, 'Fold yogurt, coconut oil and torn curry leaves into the warm vegetables off the heat.')
    ]),
  lunch('Spinach Kootu', 'A mild mung-lentil and spinach stew with freshly ground coconut.',
    '0.5 cup Moong dal; 200 g Spinach; 0.25 cup Grated coconut; 0.5 tsp Cumin seeds; 0.25 tsp Turmeric; 0.5 tsp Salt; 2.5 cup Water; 1 tbsp Oil; 0.5 tsp Mustard seeds', [
      prep('Rinse dal', 'Moong dal', 60, 'Rinse the dal thoroughly.'), cook('Cook dal', 'Dal and seasonings', 1800, 'Simmer dal with two cups water and turmeric until tender, about 30 minutes.'),
      prep('Wash spinach', 'Spinach', 90, 'Wash the spinach thoroughly.'), prep('Chop spinach', 'Spinach', 180, 'Cut the spinach into thin strips.'), prep('Blend coconut', 'Coconut and cumin', 120, 'Blend coconut and cumin with remaining water.'),
      cook('Cook spinach', 'Spinach and salt', 300, 'Simmer the spinach and salt in the dal for five minutes.'), cook('Add coconut paste', 'Coconut paste', 180, 'Simmer coconut paste in the stew for three minutes.'),
      cook('Heat oil', 'Oil', 45, 'Heat oil in a small pan.'), cook('Toast mustard', 'Mustard seeds', 30, 'Toast mustard until it pops.'), prep('Temper kootu', 'Kootu', 30, 'Pour the mustard tempering over the kootu.')
    ]),
  curry('Aloo Gobi', 'Tender potato and cauliflower in a lightly spiced tomato masala.', 'Potato and cauliflower', '250 g Potatoes; 250 g Cauliflower; 0.5 cup Water', [
    prep('Peel potatoes', 'Potatoes', 90, 'Peel potatoes.'), prep('Cut vegetables', 'Potatoes and cauliflower', 300, 'Cut potatoes into 1 cm cubes and cauliflower into small florets.'),
    cook('Cook vegetables', 'Vegetables and water', 1200, 'Cook vegetables with water in the masala over medium-low heat until tender, stirring occasionally to prevent sticking.')
  ]),
  curry('Bhindi Masala', 'Dry-cooked okra folded into a fragrant onion-and-tomato masala.', 'Okra', '300 g Okra; 1 tbsp Extra oil', [
    cook('Combine okra', 'Cooked okra', 180, 'Fold the sautéed okra into the masala over low heat for three minutes.')
  ], [prep('Dry okra', 'Okra', 180, 'Pat washed okra completely dry.'), prep('Slice okra', 'Okra', 180, 'Trim the okra into 2 cm pieces.'),
    cook('Heat extra oil', 'Extra oil', 45, 'Heat the extra tablespoon oil in a frying pan.'), cook('Sauté okra', 'Okra', 900, 'Sauté the okra uncovered until tender with lightly browned edges, about 15 minutes.')]),
  curry('Baingan Bharta', 'Smoky mashed aubergine with onion, tomato and coriander.', 'Aubergine', '1 pcs Large aubergine; 2 tbsp Fresh coriander', [
    cook('Combine aubergine', 'Roasted aubergine', 480, 'Fold the mashed aubergine into the masala over low heat for eight minutes.'), prep('Garnish bharta', 'Coriander', 30, 'Scatter chopped coriander over the bharta.')
  ], [cook('Preheat oven', 'Oven', 600, 'Preheat the oven to 220°C.'), prep('Prick aubergine', 'Aubergine', 30, 'Prick the aubergine all over with a fork.'),
    wait('Roast aubergine', 'Aubergine', 2400, 'Roast on a tray for about 40 minutes until the skin wrinkles and the centre collapses.'),
    prep('Peel aubergine', 'Aubergine', 180, 'Peel off the skin when cool enough to handle.'), prep('Mash flesh', 'Aubergine', 90, 'Mash the softened flesh with a fork.')]),
  curry('Aloo Matar', 'Potatoes and green peas in a light tomato gravy.', 'Potatoes and peas', '300 g Potatoes; 1 cup Green peas; 1 cup Water', [
    prep('Peel potatoes', 'Potatoes', 90, 'Peel the potatoes.'), prep('Dice potatoes', 'Potatoes', 180, 'Dice potatoes into small cubes.'), cook('Cook potatoes', 'Potatoes and water', 900, 'Simmer potatoes in the masala with water until nearly tender.'),
    cook('Cook peas', 'Green peas', 420, 'Simmer the peas with the potatoes until both are tender.')
  ]),
  lunch('Jeera Aloo', 'Boiled potatoes pan-roasted with cumin and a squeeze of lemon.',
    '400 g Potatoes; 1 tbsp Oil; 1 tsp Cumin seeds; 0.25 tsp Turmeric; 0.5 tsp Salt; 1 tbsp Lemon juice; 2 tbsp Fresh coriander', [
      cook('Boil potatoes', 'Potatoes', 1200, 'Boil the potatoes in ample water until tender.'), prep('Peel potatoes', 'Potatoes', 180, 'Peel the drained potatoes when cool enough to handle.'),
      prep('Cube potatoes', 'Potatoes', 120, 'Cut the potatoes into bite-sized cubes.'), cook('Heat oil', 'Oil', 45, 'Heat the oil in a frying pan.'),
      cook('Toast cumin', 'Cumin seeds', 30, 'Toast cumin until fragrant.'), cook('Roast potatoes', 'Potatoes and spices', 600, 'Sauté potatoes with turmeric and salt until lightly golden, about ten minutes.'),
      prep('Finish potatoes', 'Lemon and coriander', 60, 'Fold lemon juice and chopped coriander into the potatoes off the heat.')
    ]),
  lunch('Cabbage Thoran', 'Finely shredded cabbage cooked with coconut, mustard and curry leaves.',
    '350 g Cabbage; 0.5 cup Grated coconut; 0.5 tsp Cumin seeds; 1 pcs Green chilli; 0.25 tsp Turmeric; 0.5 tsp Salt; 1 tbsp Coconut oil; 0.5 tsp Mustard seeds; 8 pcs Curry leaves', [
      prep('Shred cabbage', 'Cabbage', 240, 'Finely shred the washed cabbage.'), prep('Crush coconut mixture', 'Coconut, cumin and chilli', 120, 'Coarsely crush coconut, cumin and chilli.'),
      cook('Heat oil', 'Coconut oil', 45, 'Heat the coconut oil over medium heat.'), cook('Temper mustard', 'Mustard and curry leaves', 45, 'Toast mustard and curry leaves until fragrant.'),
      cook('Cook cabbage', 'Cabbage and spices', 480, 'Sauté cabbage with turmeric and salt until just tender, about eight minutes.'), cook('Add coconut', 'Coconut mixture', 180, 'Fold the coconut mixture through the cabbage over low heat for three minutes.')
    ]),
  lunch('Beans Poriyal', 'Chopped green beans with coconut and a nutty urad-dal tempering.',
    '300 g Green beans; 0.25 cup Grated coconut; 1 tbsp Oil; 0.5 tsp Mustard seeds; 1 tsp Urad dal; 8 pcs Curry leaves; 0.5 tsp Salt; 0.25 cup Water', [
      prep('Chop beans', 'Green beans', 240, 'Trim the beans into 1 cm pieces.'), cook('Heat oil', 'Oil', 45, 'Heat the oil over medium heat.'),
      cook('Temper spices', 'Mustard, urad dal and curry leaves', 90, 'Toast mustard, urad dal and curry leaves until the dal is pale gold.'),
      cook('Cook beans', 'Beans, salt and water', 720, 'Cook beans with salt and water until tender and the water has evaporated, stirring occasionally.'), cook('Finish with coconut', 'Coconut', 120, 'Fold coconut through the beans over low heat for two minutes.')
    ]),
  lunch('Cucumber Raita', 'Cooling yogurt with grated cucumber, toasted cumin and mint.',
    '1 cup Yogurt; 1 pcs Cucumber; 0.5 tsp Roasted cumin powder; 0.25 tsp Salt; 1 tbsp Fresh mint', [
      prep('Grate cucumber', 'Cucumber', 180, 'Grate the washed cucumber.'), prep('Squeeze cucumber', 'Cucumber', 60, 'Squeeze out excess cucumber liquid.'),
      prep('Chop mint', 'Mint', 60, 'Finely chop the mint.'), prep('Whisk yogurt', 'Yogurt', 60, 'Whisk yogurt until smooth.'),
      prep('Mix raita', 'Cucumber and seasonings', 90, 'Fold cucumber, mint, cumin and salt into the yogurt.')
    ]),
  paneerCurry('Palak Paneer', 'Paneer cubes in a smooth spinach-and-tomato sauce.', '250 g Spinach', [
    prep('Wash spinach', 'Spinach', 180, 'Wash the spinach thoroughly.'), cook('Wilt spinach', 'Spinach', 180, 'Wilt spinach in the masala over medium heat.'),
    prep('Blend spinach sauce', 'Spinach masala', 180, 'Blend the sauce carefully with a hand blender until smooth.')
  ], []),
  paneerCurry('Paneer Butter Masala', 'Paneer in a silky tomato gravy with butter, cream and dried fenugreek.', '1 tbsp Butter; 3 tbsp Cream; 1 tsp Dried fenugreek leaves', [
    prep('Blend sauce', 'Tomato masala', 180, 'Blend the masala carefully with a hand blender until smooth.'), cook('Add butter', 'Butter', 60, 'Melt the butter into the sauce over low heat.')
  ], [cook('Finish sauce', 'Cream and fenugreek', 120, 'Warm cream and crushed dried fenugreek in the sauce over low heat.')]),
  paneerCurry('Matar Paneer', 'Paneer and green peas in an everyday tomato gravy.', '1 cup Green peas', [cook('Cook peas', 'Green peas', 480, 'Simmer peas in the masala with the measured water until tender.')], [], true),
  paneerCurry('Kadai Paneer', 'Paneer with capsicum, onion and crushed coriander seeds.', '1 pcs Green bell pepper; 1 tsp Coriander seeds', [
    prep('Cut capsicum', 'Green bell pepper', 120, 'Cut the bell pepper into bite-sized squares.'), prep('Crush coriander', 'Coriander seeds', 60, 'Coarsely crush the coriander seeds.'),
    cook('Cook capsicum', 'Capsicum and coriander', 300, 'Sauté capsicum and crushed coriander in the masala for five minutes.')
  ], []),
  paneerCurry('Shahi Paneer', 'A mild paneer curry enriched with cashews, cream and cardamom.', '0.25 cup Cashews; 3 tbsp Cream; 0.25 tsp Ground cardamom', [
    prep('Grind cashews', 'Cashews', 180, 'Grind cashews with the measured water to a smooth paste.'), cook('Cook cashew sauce', 'Cashew paste', 300, 'Simmer the cashew paste in the masala over low heat for five minutes.')
  ], [cook('Finish shahi sauce', 'Cream and cardamom', 120, 'Warm cream and cardamom in the sauce over low heat.')], true),
  curry('Vegetable Jalfrezi', 'A colourful, lightly sauced stir-fry of carrots, peppers and beans.', 'Mixed vegetables', '1 pcs Carrot; 1 pcs Bell pepper; 150 g Green beans; 0.25 cup Water; 1 tbsp Lemon juice', [
    prep('Slice vegetables', 'Vegetables', 240, 'Cut carrot, pepper and beans into thin strips.'), cook('Cook vegetables', 'Vegetables and water', 600, 'Stir-fry the vegetables in the masala with water until just tender.'),
    prep('Finish jalfrezi', 'Lemon juice', 30, 'Fold lemon juice into the vegetables off the heat.')
  ]),
  curry('Vegetable Korma', 'Mixed vegetables in a gently spiced coconut-and-cashew sauce.', 'Mixed vegetables', '300 g Mixed carrots peas and potatoes; 0.5 cup Coconut milk; 2 tbsp Cashews; 0.5 cup Water; 0.25 tsp Ground cinnamon', [
    prep('Cut vegetables', 'Mixed vegetables', 240, 'Cut vegetables into even 1 cm pieces.'), prep('Blend cashews', 'Cashews and coconut milk', 180, 'Blend cashews with coconut milk until smooth.'),
    cook('Simmer vegetables', 'Vegetables and water', 1200, 'Simmer vegetables in the masala with water until tender.'), cook('Finish korma', 'Coconut paste and cinnamon', 300, 'Simmer coconut paste and cinnamon in the curry over low heat for five minutes.')
  ]),
  curry('Mushroom Masala', 'Juicy mushrooms simmered in a thick, warmly spiced tomato gravy.', 'Mushrooms', '300 g Mushrooms; 0.25 cup Water; 0.5 tsp Garam masala', [
    prep('Clean mushrooms', 'Mushrooms', 90, 'Wipe mushrooms clean.'), prep('Slice mushrooms', 'Mushrooms', 180, 'Cut mushrooms into thick slices.'), cook('Cook mushrooms', 'Mushrooms and water', 720, 'Simmer mushrooms with water in the masala until tender, stirring occasionally.'),
    cook('Finish masala', 'Garam masala', 60, 'Stir garam masala into the curry over low heat.')
  ]),
  curry('Malai Kofta', 'Tender potato-and-paneer dumplings in a creamy tomato sauce.', 'Kofta', '200 g Potatoes; 150 g Paneer; 2 tbsp Cornflour; 2 tbsp Cream; 0.5 cup Water; 250 ml Frying oil', [
    prep('Blend gravy', 'Masala', 180, 'Blend the masala carefully with a hand blender until smooth.'), cook('Enrich gravy', 'Cream and water', 300, 'Warm cream and water in the gravy over low heat.'),
    prep('Place koftas', 'Koftas', 60, 'Place the cooked koftas in the warm gravy just before serving.')
  ], [cook('Boil potatoes', 'Potatoes', 1200, 'Boil potatoes in ample water until tender.'), prep('Peel potatoes', 'Potatoes', 120, 'Peel drained potatoes when cool enough to handle.'),
    prep('Mash potato', 'Potatoes', 90, 'Mash potatoes until smooth.'), prep('Mix kofta dough', 'Paneer and cornflour', 180, 'Mix crumbled paneer and cornflour into the potato.'),
    prep('Shape koftas', 'Kofta dough', 180, 'Shape the mixture into eight small balls.'), cook('Heat frying oil', 'Frying oil', 300, 'Heat frying oil in a small deep pan to 175°C.'),
    cook('Fry koftas', 'Koftas', 600, 'Fry the koftas in batches until evenly golden, about four minutes per batch.')])
];

function riceDish(title, description, additions, prepSteps, panSteps, liquid = 1.75, finish = []) {
  return dinner(title, description, `1 cup Basmati rice; ${liquid} cup Water; 1 tbsp Oil; 0.5 tsp Salt; ${additions}`, [
    prep('Rinse rice', 'Basmati rice', 120, 'Rinse rice until the water runs mostly clear.'),
    wait('Soak rice', 'Rice', 1200, 'Soak rice in ample additional water for 20 minutes.', 'Prep'),
    prep('Drain rice', 'Rice', 60, 'Drain the rice well.'), ...prepSteps,
    cook('Heat oil', 'Oil', 45, 'Heat oil in a heavy saucepan over medium heat.'), ...panSteps,
    cook('Add rice', 'Rice', 60, 'Fold the drained rice gently through the pan ingredients.'),
    cook('Bring rice to boil', 'Water and salt', 240, 'Bring the measured water and salt to a boil with the rice.'),
    wait('Cook covered rice', 'Rice', 720, 'Cook covered over the lowest heat for about 12 minutes until water is absorbed and grains are tender; extend gently if still firm.'),
    wait('Rest rice', 'Rice', 600, 'Rest the covered pan off the heat for ten minutes.'), ...finish
  ]);
}
function cookedRice(title, description, additions, prepSteps, panSteps, finish = []) {
  return dinner(title, description, `2 cup Cooked rice; 1 tbsp Oil; 0.5 tsp Salt; ${additions}`, [
    ...prepSteps, cook('Heat oil', 'Oil', 45, 'Heat oil in a wide pan over medium heat.'), ...panSteps,
    cook('Toss rice', 'Cooked rice and salt', 240, 'Toss the cooked rice and salt through the pan until piping hot throughout.'), ...finish
  ]);
}
function chaat(title, description, list, steps) { return dinner(title, description, list, steps); }

const indianDinners = [
  riceDish('Vegetable Biryani', 'A one-pot home-style biryani with vegetables, yogurt, mint and whole spices.',
    '250 g Mixed carrots beans and peas; 1 pcs Onion; 1 pcs Tomato; 0.25 cup Yogurt; 1 tbsp Biryani masala; 1 tbsp Ginger-garlic paste; 2 tbsp Fresh mint; 1 pcs Bay leaf', [
      prep('Cut vegetables', 'Vegetables', 300, 'Cut mixed vegetables into small pieces.'), prep('Slice onion', 'Onion', 120, 'Thinly slice onion.'), prep('Chop tomato', 'Tomato', 90, 'Chop the tomato.')
    ], [cook('Brown onion', 'Onion and bay leaf', 480, 'Sauté onion with bay leaf until golden.'), cook('Cook aromatics', 'Ginger-garlic paste', 60, 'Cook ginger-garlic paste until fragrant.'),
      cook('Cook tomato', 'Tomato', 300, 'Cook tomato until soft.'), cook('Coat vegetables', 'Vegetables, yogurt and spices', 300, 'Cook vegetables with yogurt, biryani masala and mint over medium-low heat for five minutes.')], 1.5),
  riceDish('Vegetable Pulao', 'Mild basmati rice with mixed vegetables, cumin and cinnamon.',
    '200 g Mixed carrots beans and peas; 1 tsp Cumin seeds; 1 pcs Bay leaf; 1 pcs Cinnamon stick', [prep('Chop vegetables', 'Mixed vegetables', 240, 'Cut vegetables into small even pieces.')],
    [cook('Toast whole spices', 'Cumin, bay and cinnamon', 45, 'Toast the whole spices until fragrant.'), cook('Sauté vegetables', 'Vegetables', 180, 'Sauté the vegetables for three minutes.')]),
  riceDish('Peas Pulao', 'Fluffy cumin-scented basmati rice with sweet green peas.', '1 cup Green peas; 1 tsp Cumin seeds', [], [cook('Toast cumin', 'Cumin seeds', 30, 'Toast cumin until fragrant.'), cook('Warm peas', 'Green peas', 120, 'Sauté the peas for two minutes.')]),
  riceDish('Jeera Rice', 'Simple basmati rice fragrant with toasted cumin.', '1 tsp Cumin seeds', [], [cook('Toast cumin', 'Cumin seeds', 30, 'Toast cumin until fragrant.')]),
  cookedRice('Lemon Rice', 'Bright lemon rice with peanuts, mustard and curry leaves.', '2 tbsp Lemon juice; 0.25 cup Roasted peanuts; 0.5 tsp Mustard seeds; 8 pcs Curry leaves; 0.25 tsp Turmeric', [],
    [cook('Temper mustard', 'Mustard and curry leaves', 45, 'Toast mustard and curry leaves until the seeds pop.'), cook('Warm peanuts', 'Peanuts and turmeric', 45, 'Warm roasted peanuts and turmeric in the oil.')], [prep('Add lemon', 'Lemon juice', 30, 'Fold lemon juice into the rice off the heat.')]),
  cookedRice('Tamarind Rice', 'Tangy tamarind rice with roasted peanuts and a spicy tempering.', '1.5 tbsp Tamarind paste; 0.25 cup Water; 0.25 cup Roasted peanuts; 0.5 tsp Mustard seeds; 8 pcs Curry leaves; 0.25 tsp Turmeric; 1 tsp Jaggery', [],
    [cook('Temper mustard', 'Mustard and curry leaves', 45, 'Toast mustard and curry leaves until fragrant.'), cook('Reduce tamarind sauce', 'Tamarind and seasonings', 300, 'Simmer tamarind, water, peanuts, turmeric and jaggery in the pan until syrupy.')]),
  cookedRice('Tomato Rice', 'A quick spiced tomato rice with onion and cumin.', '2 pcs Tomatoes; 1 pcs Onion; 0.5 tsp Cumin seeds; 0.25 tsp Turmeric; 0.5 tsp Garam masala',
    [prep('Chop vegetables', 'Onion and tomatoes', 240, 'Finely chop onion and tomatoes.')],
    [cook('Toast cumin', 'Cumin seeds', 30, 'Toast cumin until fragrant.'), cook('Sauté onion', 'Onion', 300, 'Sauté onion until soft.'), cook('Reduce tomatoes', 'Tomatoes and spices', 480, 'Cook tomatoes with turmeric and garam masala until thick.')]),
  dinner('Curd Rice', 'Soft rice mixed with cooling yogurt and a gentle mustard tempering.',
    '2 cup Cooked rice; 1 cup Yogurt; 0.25 cup Water; 0.5 tsp Salt; 1 tbsp Oil; 0.5 tsp Mustard seeds; 8 pcs Curry leaves; 1 tsp Ginger', [
      prep('Cool rice', 'Cooked rice', 180, 'Spread freshly cooked rice on a plate until no longer hot; use promptly.'), prep('Mash rice', 'Rice', 120, 'Mash rice lightly with water.'),
      prep('Mix yogurt', 'Yogurt and salt', 90, 'Fold yogurt and salt into the cooled rice.'), prep('Mince ginger', 'Ginger', 60, 'Finely mince the ginger.'),
      cook('Heat oil', 'Oil', 45, 'Heat oil in a small pan.'), cook('Make tempering', 'Mustard, ginger and curry leaves', 60, 'Toast mustard, ginger and curry leaves until fragrant.'), prep('Temper curd rice', 'Curd rice', 30, 'Pour the tempering over the rice.')
    ]),
  cookedRice('Coconut Rice', 'Coconut-studded rice with cashews, mustard and curry leaves.', '0.5 cup Grated coconut; 2 tbsp Cashews; 0.5 tsp Mustard seeds; 8 pcs Curry leaves', [],
    [cook('Toast cashews', 'Cashews', 120, 'Toast cashews until pale golden.'), cook('Temper mustard', 'Mustard and curry leaves', 45, 'Toast mustard and curry leaves until fragrant.'), cook('Toast coconut', 'Coconut', 120, 'Toast coconut gently until aromatic without browning.')]),
  dinner('Bisi Bele Bath', 'A soft Karnataka rice-and-lentil meal with vegetables and tamarind.',
    '0.5 cup Rice; 0.5 cup Toor dal; 4 cup Water; 200 g Mixed carrots beans and peas; 1.5 tbsp Bisi bele bath powder; 1 tbsp Tamarind paste; 1 tsp Jaggery; 0.75 tsp Salt; 1 tbsp Ghee; 0.5 tsp Mustard seeds; 8 pcs Curry leaves', [
      prep('Rinse rice and dal', 'Rice and toor dal', 120, 'Rinse rice and dal thoroughly.'), prep('Chop vegetables', 'Mixed vegetables', 240, 'Cut vegetables into small pieces.'),
      cook('Cook grains and vegetables', 'Rice, dal and vegetables', 2700, 'Simmer rice, dal and vegetables in the measured water until very soft, about 45 minutes, with occasional stirring and extra water if needed.'),
      cook('Season bath', 'Spices, tamarind, jaggery and salt', 600, 'Simmer the spice powder, tamarind, jaggery and salt in the soft mixture for ten minutes.'),
      cook('Heat ghee', 'Ghee', 45, 'Heat ghee in a small pan.'), cook('Make tempering', 'Mustard and curry leaves', 45, 'Toast mustard and curry leaves until fragrant.'), prep('Temper bath', 'Bisi bele bath', 30, 'Pour the tempering into the rice.')
    ]),
  dinner('Ven Pongal', 'Soft rice and mung dal with pepper, cumin, ginger and ghee-roasted cashews.',
    '0.5 cup Rice; 0.5 cup Moong dal; 4 cup Water; 0.5 tsp Salt; 1 tbsp Ghee; 1 tsp Cumin seeds; 0.5 tsp Black pepper; 1 tsp Ginger; 2 tbsp Cashews; 8 pcs Curry leaves', [
      prep('Rinse grains', 'Rice and moong dal', 120, 'Rinse rice and dal thoroughly.'), cook('Cook grains', 'Rice, dal, water and salt', 2400, 'Simmer rice and dal with water and salt until very soft, about 40 minutes, with occasional stirring.'),
      prep('Mince ginger', 'Ginger', 60, 'Finely mince ginger.'), cook('Heat ghee', 'Ghee', 45, 'Heat ghee in a small pan.'), cook('Toast cashews', 'Cashews', 90, 'Toast cashews in the ghee until golden.'),
      cook('Temper spices', 'Cumin, pepper, ginger and curry leaves', 60, 'Toast the spices, ginger and curry leaves until fragrant.'), prep('Finish pongal', 'Pongal', 60, 'Fold the tempering through the soft rice and dal.')
    ]),
  dinner('Dal Khichdi', 'A gentle one-pot meal of rice, yellow mung dal and turmeric.',
    '0.5 cup Rice; 0.5 cup Moong dal; 4 cup Water; 0.25 tsp Turmeric; 0.5 tsp Salt; 1 tbsp Ghee; 0.5 tsp Cumin seeds', [
      prep('Rinse grains', 'Rice and dal', 120, 'Rinse rice and dal thoroughly.'), cook('Heat ghee', 'Ghee', 45, 'Heat ghee in a saucepan.'), cook('Toast cumin', 'Cumin seeds', 30, 'Toast cumin until fragrant.'),
      cook('Combine khichdi', 'Rice, dal and seasonings', 120, 'Bring rice, dal, water, turmeric and salt to a boil in the pan.'),
      cook('Simmer khichdi', 'Khichdi', 2400, 'Simmer until rice and dal are very soft, about 40 minutes, with occasional stirring and extra water if needed.')
    ]),
  dinner('Masala Khichdi', 'Rice and mung dal cooked with vegetables, tomato and warming spices.',
    '0.5 cup Rice; 0.5 cup Moong dal; 4 cup Water; 1 pcs Onion; 1 pcs Tomato; 1 pcs Carrot; 0.5 cup Green peas; 1 tbsp Oil; 0.5 tsp Cumin seeds; 0.25 tsp Turmeric; 0.5 tsp Garam masala; 0.75 tsp Salt', [
      prep('Rinse grains', 'Rice and dal', 120, 'Rinse rice and dal thoroughly.'), prep('Chop vegetables', 'Onion, tomato and carrot', 300, 'Chop onion, tomato and carrot into small pieces.'),
      cook('Heat oil', 'Oil', 45, 'Heat oil in a saucepan.'), cook('Toast cumin', 'Cumin seeds', 30, 'Toast cumin until fragrant.'), cook('Sauté onion', 'Onion', 300, 'Sauté onion until soft.'),
      cook('Cook tomato', 'Tomato and spices', 240, 'Cook tomato with turmeric and garam masala until softened.'), cook('Combine grains', 'Grains, vegetables, water and salt', 180, 'Bring the grains, carrot, peas, water and salt to a boil in the masala.'),
      cook('Simmer khichdi', 'Khichdi', 2400, 'Simmer until the grains and vegetables are completely soft, stirring occasionally.')
    ]),
  dinner('Chole Bhature', 'Tangy chickpea curry with puffed yogurt-enriched fried breads.',
    '1.5 cup Plain flour; 0.25 cup Yogurt; 0.25 cup Water; 0.5 tsp Baking powder; 0.75 tsp Salt; 2 cup Cooked chickpeas; 1 pcs Onion; 2 pcs Tomatoes; 1 tbsp Chole masala; 1 tbsp Oil; 250 ml Frying oil; 0.75 cup Curry water', [
      prep('Knead bhature dough', 'Flour and yogurt', 300, 'Knead flour, yogurt, water, baking powder and a quarter teaspoon salt into a soft dough.'), wait('Rest dough', 'Dough', 3600, 'Rest the covered dough for one hour.', 'Prep'),
      prep('Chop vegetables', 'Onion and tomatoes', 240, 'Finely chop onion and tomatoes.'), cook('Heat curry oil', 'Oil', 45, 'Heat the tablespoon oil in a saucepan.'), cook('Sauté onion', 'Onion', 360, 'Sauté onion until golden.'),
      cook('Cook tomatoes', 'Tomatoes and chole masala', 420, 'Cook tomatoes with chole masala and remaining salt until thick.'), cook('Simmer chole', 'Chickpeas and curry water', 900, 'Simmer cooked chickpeas with curry water in the sauce for 15 minutes.'),
      prep('Roll bhature', 'Dough', 300, 'Roll the dough into six oval breads.'), cook('Heat frying oil', 'Frying oil', 300, 'Heat frying oil in a deep pan to 180°C.'), cook('Fry bhature', 'Breads', 720, 'Fry breads individually, turning once puffed, until both sides are golden, about two minutes each.')
    ], 'Medium'),
  ...[
    ['Puri Bhaji', 'Turmeric potatoes with crisp whole-wheat puris.', '0.5 tsp Mustard seeds; 8 pcs Curry leaves', 'mustard seeds and curry leaves'],
    ['Aloo Puri', 'Whole-wheat puris served with a cumin-and-tomato potato curry.', '0.5 tsp Cumin seeds; 1 pcs Tomato', 'cumin seeds']
  ].map(([title, description, extra, spices]) => dinner(title, description,
    `1.5 cup Whole-wheat flour; 0.5 cup Dough water; 300 g Potatoes; 1 pcs Onion; 0.25 tsp Turmeric; 0.75 tsp Salt; 1 tbsp Oil; 0.5 cup Curry water; 250 ml Frying oil; ${extra}`, [
      prep('Knead dough', 'Whole-wheat flour', 300, 'Knead flour with dough water and a quarter teaspoon salt into a firm, smooth dough.'), wait('Rest dough', 'Dough', 1200, 'Rest the covered dough for 20 minutes.', 'Prep'),
      prep('Peel potatoes', 'Potatoes', 90, 'Peel the potatoes.'), prep('Chop vegetables', 'Potatoes and onion', 240, 'Cut potatoes into small cubes and onion into thin slices.'),
      ...(title === 'Aloo Puri' ? [prep('Chop tomato', 'Tomato', 90, 'Chop the tomato finely.')] : []),
      cook('Heat curry oil', 'Oil', 45, 'Heat the tablespoon oil in a saucepan.'), cook('Temper spices', spices, 45, `Toast the ${spices} until fragrant.`),
      cook('Cook onion', 'Onion', 300, 'Sauté onion until soft.'),
      ...(title === 'Aloo Puri' ? [cook('Cook tomato', 'Tomato', 240, 'Cook the tomato until pulpy.')] : []),
      cook('Cook potato curry', 'Potatoes and seasonings', 1200, 'Cook potatoes with curry water, turmeric and remaining salt until tender over medium-low heat, stirring occasionally.'),
      prep('Roll puris', 'Dough', 300, 'Roll dough into twelve small discs.'), cook('Heat frying oil', 'Frying oil', 300, 'Heat the frying oil in a deep pan to 180°C.'),
      cook('Fry puris', 'Puris', 720, 'Fry puris individually until puffed and golden on both sides, about one minute each.')
    ], 'Medium')),
  dinner('Vegetable Hakka Noodles', 'Egg-free noodles stir-fried with crisp vegetables and vegetarian soy sauce.',
    '180 g Egg-free wheat noodles; 1 pcs Carrot; 1 pcs Bell pepper; 1 cup Cabbage; 2 pcs Spring onions; 2 cloves Garlic; 1.5 tbsp Oil; 1.5 tbsp Vegetarian soy sauce; 1 tbsp Rice vinegar; 0.25 tsp Black pepper', [
      prep('Slice vegetables', 'Vegetables and garlic', 360, 'Cut carrot, pepper and cabbage into thin strips with sliced spring onions and minced garlic.'),
      cook('Boil noodles', 'Egg-free noodles', 480, 'Boil the noodles in ample water according to the packet, usually six to eight minutes.'), prep('Drain noodles', 'Noodles', 60, 'Drain noodles thoroughly.'),
      cook('Heat wok', 'Oil', 60, 'Heat the oil in a wok over high heat.'), cook('Fry garlic', 'Garlic', 30, 'Stir-fry the garlic briefly.'), cook('Stir-fry vegetables', 'Vegetables', 300, 'Stir-fry vegetables until crisp-tender.'),
      cook('Toss noodles', 'Noodles and sauces', 180, 'Toss noodles with vegetables, soy sauce, vinegar and pepper until hot throughout.')
    ]),
  dinner('Vegetable Fried Rice', 'Quick egg-free fried rice with vegetables and vegetarian soy sauce.',
    '2 cup Cooked rice; 1 pcs Carrot; 0.5 cup Green peas; 2 pcs Spring onions; 2 cloves Garlic; 1.5 tbsp Oil; 1 tbsp Vegetarian soy sauce; 0.25 tsp Black pepper', [
      prep('Chop vegetables', 'Vegetables and garlic', 240, 'Finely dice carrot with sliced spring onions and minced garlic.'), cook('Heat wok', 'Oil', 60, 'Heat oil in a wok over high heat.'),
      cook('Fry garlic', 'Garlic', 30, 'Stir-fry garlic briefly.'), cook('Cook vegetables', 'Carrot, peas and spring onions', 360, 'Stir-fry vegetables until tender.'),
      cook('Fry rice', 'Rice and seasonings', 300, 'Stir-fry cooked rice with soy sauce and pepper until piping hot throughout.')
    ]),
  ...[
    ['Gobi Manchurian', 'Cauliflower', 350, 'Crisp cauliflower in a glossy Indo-Chinese garlic sauce.'],
    ['Chilli Paneer', 'Paneer', 250, 'Crisp paneer cubes in a tangy pepper-and-soy sauce.']
  ].map(([title, main, amount, description]) => dinner(title, description,
    `${amount} g ${main}; 3 tbsp Cornflour; 2 tbsp Plain flour; 0.25 cup Water; 1 pcs Bell pepper; 1 pcs Onion; 3 cloves Garlic; 1.5 tbsp Vegetarian soy sauce; 2 tbsp Egg-free tomato ketchup; 1 tbsp Rice vinegar; 250 ml Oil`, [
      prep('Cut main ingredient', main, 180, `Cut ${main.toLowerCase()} into bite-sized ${main === 'Paneer' ? 'cubes' : 'florets'}.`), prep('Chop sauce vegetables', 'Pepper, onion and garlic', 240, 'Dice pepper and onion with finely minced garlic.'),
      prep('Mix coating', 'Flours and water', 120, 'Whisk two tablespoons cornflour, plain flour and most of the water into a thick coating.'), prep('Coat pieces', main, 120, `Coat ${main.toLowerCase()} pieces with the batter.`),
      cook('Heat frying oil', 'Oil', 300, 'Heat the oil in a deep pan to 175°C.'), cook('Fry coated pieces', main, main === 'Paneer' ? 480 : 720, `Fry pieces in batches until golden ${main === 'Cauliflower' ? 'and tender inside' : 'on both sides'}, about ${main === 'Paneer' ? 'four' : 'six'} minutes per batch.`),
      cook('Heat sauce pan', 'Oil', 45, 'Heat one tablespoon of the frying oil in a clean wide pan.'), cook('Fry garlic', 'Garlic', 30, 'Stir-fry garlic briefly.'), cook('Sauté sauce vegetables', 'Onion and pepper', 240, 'Stir-fry onion and pepper until crisp-tender.'),
      prep('Mix slurry', 'Cornflour and water', 45, 'Mix remaining cornflour with remaining water.'), cook('Thicken sauce', 'Slurry and sauces', 120, 'Simmer soy sauce, ketchup, vinegar and cornflour slurry until glossy.'),
      cook('Coat fried pieces', main, 60, 'Toss the fried pieces in the hot sauce.')
    ], 'Medium')),
  ...[
    ['Paneer Tikka', 'Paneer', 250, 'Yogurt-marinated paneer and vegetables roasted until lightly charred.'],
    ['Mushroom Tikka', 'Mushrooms', 300, 'Juicy mushrooms and vegetables roasted in a spiced yogurt coating.']
  ].map(([title, main, amount, description]) => dinner(title, description,
    `${amount} g ${main}; 1 pcs Bell pepper; 1 pcs Onion; 0.5 cup Yogurt; 1 tbsp Ginger-garlic paste; 1 tsp Garam masala; 0.25 tsp Turmeric; 0.5 tsp Chilli powder; 0.5 tsp Salt; 1 tbsp Oil; 1 tbsp Lemon juice`, [
      prep('Cut ingredients', 'Main ingredient and vegetables', 240, `Cut ${main.toLowerCase()}, pepper and onion into large bite-sized pieces.`), prep('Mix marinade', 'Yogurt and seasonings', 120, 'Mix yogurt, ginger-garlic paste, spices, salt, oil and lemon juice.'),
      prep('Coat ingredients', 'Marinade', 90, 'Coat the main ingredient and vegetables in the marinade.'), wait('Marinate tikka', 'Tikka', 1800, 'Refrigerate covered for 30 minutes.', 'Prep'),
      cook('Preheat oven', 'Oven', 600, 'Preheat the oven to 220°C.'), prep('Arrange tikka', 'Tikka', 120, 'Spread the marinated pieces in one layer on a lined tray.'),
      wait('Roast first side', 'Tikka', 600, 'Roast for ten minutes.'), prep('Turn pieces', 'Tikka', 90, 'Turn the pieces with tongs.'), wait('Finish roasting', 'Tikka', 480, 'Roast for eight more minutes until cooked through with browned edges.')
    ])),
  chaat('Aloo Tikki', 'Crisp potato patties with cumin and fresh coriander.', '400 g Potatoes; 2 tbsp Cornflour; 0.5 tsp Cumin powder; 0.5 tsp Salt; 2 tbsp Fresh coriander; 2 tbsp Oil', [
    cook('Boil potatoes', 'Potatoes', 1200, 'Boil potatoes in ample water until tender.'), prep('Peel potatoes', 'Potatoes', 180, 'Peel drained potatoes when cool enough to handle.'), prep('Mash potatoes', 'Potatoes', 120, 'Mash potatoes until smooth.'),
    prep('Mix tikki dough', 'Seasonings', 120, 'Mix cornflour, cumin, salt and chopped coriander into the potato.'), prep('Shape patties', 'Potato mixture', 180, 'Shape six flat patties.'),
    cook('Heat oil', 'Oil', 60, 'Heat oil in a wide frying pan over medium heat.'), cook('Cook patties', 'Tikki', 600, 'Shallow-fry the patties until golden on both sides, turning after about five minutes.')
  ]),
  chaat('Vegetable Samosa', 'Flaky pastry filled with cumin-spiced potatoes and peas.', '1.5 cup Plain flour; 3 tbsp Oil; 0.4 cup Water; 300 g Potatoes; 0.5 cup Green peas; 0.5 tsp Cumin seeds; 0.5 tsp Garam masala; 0.75 tsp Salt; 300 ml Frying oil', [
    prep('Rub flour with oil', 'Flour and oil', 180, 'Rub two tablespoons oil into flour with a quarter teaspoon salt until sandy.'), prep('Knead pastry', 'Flour mixture and water', 240, 'Knead in water gradually to a firm dough.'), wait('Rest pastry', 'Dough', 1800, 'Rest covered for 30 minutes.', 'Prep'),
    cook('Boil potatoes', 'Potatoes', 1200, 'Boil potatoes in ample water until tender.'), prep('Peel potatoes', 'Potatoes', 180, 'Peel drained potatoes when cool enough to handle.'), prep('Mash potatoes', 'Potatoes', 120, 'Roughly mash potatoes.'),
    cook('Heat filling oil', 'Oil', 45, 'Heat remaining tablespoon oil in a frying pan.'), cook('Toast cumin', 'Cumin seeds', 30, 'Toast cumin until fragrant.'), cook('Cook filling', 'Potatoes, peas and seasonings', 480, 'Cook potatoes and peas with garam masala and remaining salt until peas are tender.'),
    prep('Roll pastry', 'Dough', 360, 'Roll six dough balls into ovals to halve into twelve semicircles.'), prep('Fill cones', 'Pastry and filling', 480, 'Seal semicircles into cones around the filling with moistened edges.'),
    cook('Heat frying oil', 'Frying oil', 300, 'Heat the frying oil to 160°C in a deep pan.'), cook('Fry samosas', 'Samosas', 1800, 'Fry in three small batches until evenly golden and crisp, about ten minutes per batch.')
  ]),
  chaat('Dabeli', 'Spiced potato-filled egg-free rolls with peanuts, chutney and pomegranate.', '250 g Potatoes; 4 pcs Egg-free pav rolls; 1 tbsp Dabeli masala; 1 tbsp Oil; 0.5 tsp Salt; 2 tbsp Tamarind chutney; 2 tbsp Green chutney; 0.25 cup Roasted peanuts; 0.25 cup Pomegranate seeds; 0.25 cup Sev; 2 tbsp Water', [
    cook('Boil potatoes', 'Potatoes', 1200, 'Boil potatoes in ample water until tender.'), prep('Peel potatoes', 'Potatoes', 120, 'Peel drained potatoes when cool enough to handle.'), prep('Mash filling', 'Potatoes', 120, 'Mash potatoes until smooth.'),
    cook('Heat oil', 'Oil', 45, 'Heat oil in a pan.'), cook('Season filling', 'Potatoes, spice and water', 300, 'Cook mashed potato with dabeli masala, salt and water for five minutes.'), prep('Split rolls', 'Pav', 60, 'Split the rolls without cutting completely through.'),
    prep('Fill rolls', 'Filling and toppings', 240, 'Fill rolls with potato, both chutneys, peanuts, pomegranate and sev.')
  ]),
  chaat('Vada Pav', 'Garlic-spiced potato fritters tucked into egg-free pav rolls.', '300 g Potatoes; 4 pcs Egg-free pav rolls; 0.75 cup Gram flour; 0.5 cup Water; 2 cloves Garlic; 0.25 tsp Turmeric; 0.5 tsp Salt; 2 tbsp Dry garlic chutney; 250 ml Oil', [
    cook('Boil potatoes', 'Potatoes', 1200, 'Boil potatoes in ample water until tender.'), prep('Peel potatoes', 'Potatoes', 120, 'Peel drained potatoes when cool enough to handle.'), prep('Mince garlic', 'Garlic', 60, 'Finely mince garlic.'),
    prep('Mash filling', 'Potatoes and seasonings', 180, 'Mash potatoes with garlic, half the turmeric and half the salt.'), prep('Shape vadas', 'Potato filling', 120, 'Shape four flat potato balls.'),
    prep('Whisk batter', 'Gram flour', 120, 'Whisk flour, water, remaining turmeric and salt into a thick batter.'), cook('Heat oil', 'Oil', 300, 'Heat oil in a deep pan to 175°C.'), prep('Coat vadas', 'Vadas and batter', 90, 'Dip the potato balls into the batter until coated.'),
    cook('Fry vadas', 'Vadas', 600, 'Fry vadas in two batches until golden all over, about five minutes per batch.'), prep('Fill pav', 'Rolls and chutney', 120, 'Enclose each vada in a split pav with dry garlic chutney.')
  ]),
  chaat('Dahi Vada', 'Soft lentil fritters soaked briefly in water and dressed with yogurt and chutneys.', '0.75 cup Urad dal; 0.25 cup Batter water; 1.5 cup Yogurt; 0.5 tsp Salt; 0.5 tsp Roasted cumin powder; 2 tbsp Tamarind chutney; 2 tbsp Green chutney; 250 ml Oil', [
    wait('Soak dal', 'Urad dal', 14400, 'Soak rinsed dal in ample additional water for four hours.', 'Prep'), prep('Drain dal', 'Dal', 60, 'Drain dal thoroughly.'), prep('Grind dal', 'Dal and batter water', 300, 'Grind dal with just enough batter water into a fluffy paste.'),
    cook('Heat oil', 'Oil', 300, 'Heat oil in a deep pan to 175°C.'), cook('Fry vadas', 'Dal batter', 900, 'Fry eight small spoonfuls in batches until golden and cooked through, about five minutes per batch.'),
    wait('Soak fritters', 'Vadas', 600, 'Soak fried vadas in a bowl of warm additional water for ten minutes.', 'Prep'), prep('Squeeze vadas', 'Vadas', 120, 'Gently squeeze excess water from the softened vadas.'),
    prep('Whisk yogurt', 'Yogurt and salt', 60, 'Whisk yogurt with salt until smooth.'), prep('Dress vadas', 'Yogurt, chutneys and cumin', 120, 'Cover vadas with yogurt, both chutneys and cumin powder.')
  ]),
  chaat('Sev Puri', 'Crisp puris layered with potato, chutneys, onion and fine sev.', '12 pcs Egg-free crisp puris; 150 g Potatoes; 0.5 pcs Onion; 1 pcs Tomato; 3 tbsp Tamarind chutney; 3 tbsp Green chutney; 0.5 cup Sev; 0.5 tsp Chaat masala; 2 tbsp Fresh coriander', [
    cook('Boil potatoes', 'Potatoes', 1200, 'Boil potatoes in ample water until tender.'), prep('Peel potatoes', 'Potatoes', 120, 'Peel drained potatoes when cool enough to handle.'), prep('Dice toppings', 'Potatoes, onion and tomato', 240, 'Finely dice potatoes, onion and tomato.'),
    prep('Fill puris', 'Puris and toppings', 180, 'Top puris with potato, onion and tomato.'), prep('Dress puris', 'Chutneys', 90, 'Spoon both chutneys over the filled puris.'), prep('Finish puris', 'Sev and seasonings', 60, 'Scatter sev, chaat masala and chopped coriander over the puris.')
  ]),
  chaat('Bhel Puri', 'Crunchy puffed rice tossed with vegetables, chutneys and sev just before serving.', '3 cup Puffed rice; 0.5 cup Sev; 1 pcs Tomato; 0.5 pcs Onion; 0.5 pcs Cucumber; 2 tbsp Tamarind chutney; 2 tbsp Green chutney; 0.5 tsp Chaat masala; 1 tbsp Lemon juice; 2 tbsp Fresh coriander', [
    prep('Dice vegetables', 'Tomato, onion and cucumber', 240, 'Finely dice tomato, onion and cucumber.'), prep('Chop coriander', 'Coriander', 60, 'Finely chop coriander.'),
    cook('Crisp puffed rice', 'Puffed rice', 180, 'Dry-toast puffed rice over low heat until crisp.'), wait('Cool puffed rice', 'Puffed rice', 180, 'Cool the puffed rice off the heat for three minutes.', 'Prep'),
    prep('Toss bhel', 'All ingredients', 120, 'Toss puffed rice with vegetables, chutneys, sev, chaat masala, lemon and coriander immediately before serving.')
  ]),
  chaat('Ragda Pattice', 'Potato patties topped with soft white-pea ragda and chutneys. Includes overnight soaking.', '0.75 cup Dried white peas; 3 cup Water; 300 g Potatoes; 2 tbsp Cornflour; 0.25 tsp Turmeric; 0.5 tsp Cumin powder; 0.75 tsp Salt; 2 tbsp Oil; 2 tbsp Tamarind chutney; 2 tbsp Green chutney', [
    wait('Soak peas', 'Dried white peas', 28800, 'Soak rinsed peas in ample additional water for eight hours.', 'Prep'), prep('Drain peas', 'White peas', 60, 'Drain soaked peas.'), cook('Cook ragda', 'Peas and seasonings', 3600, 'Simmer peas in measured water with turmeric and half the salt until very soft, about one hour, with occasional stirring and extra water if needed.'),
    cook('Boil potatoes', 'Potatoes', 1200, 'Boil potatoes in ample water until tender.'), prep('Peel potatoes', 'Potatoes', 120, 'Peel drained potatoes when cool enough to handle.'), prep('Mash potatoes', 'Potatoes', 120, 'Mash potatoes until smooth.'),
    prep('Mix patty dough', 'Potato and seasonings', 120, 'Mix cornflour, cumin and remaining salt into the potato.'), prep('Shape patties', 'Potato mixture', 120, 'Shape six flat patties.'), cook('Heat oil', 'Oil', 60, 'Heat oil in a wide pan over medium heat.'), cook('Cook patties', 'Patties', 600, 'Cook patties until golden on both sides, turning halfway through.'),
    prep('Assemble ragda pattice', 'Ragda and chutneys', 120, 'Top patties with hot ragda and both chutneys.')
  ]),
  dinner('Palak Corn Curry', 'Sweetcorn in a smooth spinach sauce with a little cream.', `${masalaIngredients}; 250 g Spinach; 1 cup Sweetcorn; 0.5 cup Water; 2 tbsp Cream`, [
    ...masalaBase(), prep('Wash spinach', 'Spinach', 180, 'Wash spinach thoroughly.'), cook('Wilt spinach', 'Spinach', 180, 'Wilt spinach in the masala.'), prep('Blend sauce', 'Spinach masala', 180, 'Blend the spinach masala carefully with a hand blender.'),
    cook('Cook corn', 'Corn and water', 600, 'Simmer sweetcorn in the sauce with water until tender.'), cook('Finish curry', 'Cream', 120, 'Warm cream through the curry over low heat.')
  ]),
  dinner('Dum Aloo', 'Baby potatoes slowly simmered in a yogurt-enriched tomato sauce.', `${masalaIngredients}; 400 g Baby potatoes; 0.5 cup Yogurt; 0.5 cup Water; 0.5 tsp Garam masala`, [
    cook('Boil baby potatoes', 'Potatoes', 900, 'Boil baby potatoes in ample water until just tender.'), prep('Peel potatoes', 'Potatoes', 180, 'Peel drained potatoes when cool enough to handle.'),
    ...masalaBase(), prep('Whisk yogurt', 'Yogurt', 60, 'Whisk yogurt until smooth.'), cook('Add yogurt', 'Yogurt', 180, 'Stir yogurt into the masala over low heat without boiling rapidly.'),
    cook('Simmer potatoes', 'Potatoes, water and garam masala', 900, 'Simmer potatoes with water and garam masala in the sauce over low heat for 15 minutes.')
  ])
];

const international = [
  recipe('Overnight Oats', 'Breakfast', 'International', 'Creamy oats soaked in milk with banana, chia and cinnamon.', '1 cup Rolled oats; 1 cup Milk; 0.5 cup Yogurt; 1 pcs Banana; 1 tbsp Chia seeds; 0.25 tsp Cinnamon', [
    prep('Mix oat base', 'Oats, milk, yogurt and chia', 120, 'Mix oats, milk, yogurt, chia and cinnamon in a covered container.'), wait('Chill oats', 'Oats', 21600, 'Refrigerate for at least six hours until soft.', 'Prep'),
    prep('Slice banana', 'Banana', 60, 'Slice the banana.'), prep('Top oats', 'Banana', 30, 'Top the soaked oats with banana.')
  ]),
  recipe('Banana Cinnamon Oatmeal', 'Breakfast', 'International', 'Warm stovetop oats with banana, milk and cinnamon.', '1 cup Rolled oats; 1 cup Milk; 1 cup Water; 1 pcs Banana; 0.25 tsp Cinnamon; 1 tbsp Maple syrup', [
    prep('Slice banana', 'Banana', 60, 'Slice the banana.'), cook('Heat liquids', 'Milk and water', 240, 'Bring milk and water to a gentle simmer.'),
    cook('Cook oats', 'Oats and cinnamon', 480, 'Stir oats and cinnamon into the liquid over medium-low heat until creamy, about eight minutes.'), prep('Finish oatmeal', 'Banana and maple syrup', 60, 'Top oatmeal with banana and maple syrup.')
  ]),
  recipe('Yogurt Fruit Granola Bowl', 'Breakfast', 'International', 'Yogurt layered with fresh fruit, nuts and egg-free granola.', '1.5 cup Yogurt; 0.75 cup Egg-free granola; 1 pcs Banana; 1 cup Strawberries; 2 tbsp Almonds', [
    prep('Wash strawberries', 'Strawberries', 90, 'Wash strawberries thoroughly.'), prep('Slice fruit', 'Banana and strawberries', 120, 'Slice banana and strawberries.'),
    prep('Portion yogurt', 'Yogurt', 30, 'Divide yogurt between two bowls.'), prep('Layer toppings', 'Fruit, granola and almonds', 60, 'Layer fruit, granola and almonds over the yogurt.')
  ]),
  recipe('Egg-Free Banana Pancakes', 'Breakfast', 'International', 'Fluffy banana pancakes bound with mashed fruit instead of eggs.', '1 cup Plain flour; 1 pcs Ripe banana; 0.75 cup Milk; 1 tsp Baking powder; 0.25 tsp Cinnamon; 1 tbsp Oil; 2 tbsp Maple syrup', [
    prep('Mash banana', 'Banana', 90, 'Mash banana until smooth.'), prep('Mix dry ingredients', 'Flour, baking powder and cinnamon', 60, 'Mix flour with baking powder and cinnamon.'),
    prep('Mix pancake batter', 'Banana and milk', 90, 'Fold banana and milk into the dry mixture until just combined.'), cook('Heat pan', 'Oil', 60, 'Heat a lightly oiled nonstick pan over medium-low heat.'),
    cook('Cook pancakes', 'Batter', 900, 'Cook six small pancakes with the remaining oil, turning once bubbles set on top; allow about two minutes on the first side and one on the second.'), prep('Top pancakes', 'Maple syrup', 30, 'Drizzle maple syrup over the pancakes.')
  ]),
  recipe('Turmeric Tofu Scramble', 'Breakfast', 'International', 'Crumbled tofu sautéed with peppers, spinach and mild spice.', '300 g Firm tofu; 1 pcs Bell pepper; 100 g Spinach; 1 tbsp Oil; 0.25 tsp Turmeric; 0.5 tsp Cumin powder; 0.5 tsp Salt; 0.25 tsp Black pepper', [
    prep('Drain tofu', 'Tofu', 90, 'Pat tofu dry.'), prep('Crumble tofu', 'Tofu', 120, 'Crumble tofu into bite-sized pieces.'), prep('Chop vegetables', 'Pepper and spinach', 240, 'Dice pepper with washed spinach cut into strips.'),
    cook('Heat oil', 'Oil', 45, 'Heat oil in a frying pan.'), cook('Sauté pepper', 'Pepper', 300, 'Sauté pepper until tender.'), cook('Scramble tofu', 'Tofu and spices', 420, 'Sauté tofu with turmeric, cumin, salt and pepper for seven minutes.'), cook('Wilt spinach', 'Spinach', 180, 'Fold spinach into the scramble over low heat until wilted.')
  ]),
  recipe('Falafel Wraps', 'Lunch', 'Middle Eastern', 'Crisp chickpea falafel in egg-free flatbread with salad and tahini. Includes overnight soaking.', '0.75 cup Dried chickpeas; 0.5 pcs Onion; 2 cloves Garlic; 0.5 cup Fresh parsley; 1 tsp Cumin powder; 0.5 tsp Salt; 2 tbsp Gram flour; 0.25 tsp Baking powder; 250 ml Oil; 2 pcs Egg-free flatbreads; 1 pcs Tomato; 0.5 pcs Cucumber; 2 tbsp Tahini; 1 tbsp Lemon juice; 2 tbsp Water', [
    wait('Soak chickpeas', 'Dried chickpeas', 43200, 'Soak chickpeas in ample additional water for 12 hours; use soaked dried chickpeas, not canned, for this method.', 'Prep'), prep('Drain chickpeas', 'Chickpeas', 120, 'Drain chickpeas thoroughly.'),
    prep('Process falafel mixture', 'Chickpeas and seasonings', 240, 'Pulse chickpeas, onion, garlic, parsley, cumin, salt, flour and baking powder to a fine crumb that holds when squeezed.'), wait('Chill falafel mixture', 'Falafel', 1800, 'Refrigerate mixture for 30 minutes.', 'Prep'),
    prep('Shape falafel', 'Mixture', 180, 'Shape twelve small flattened balls.'), cook('Heat oil', 'Oil', 300, 'Heat oil in a deep pan to 175°C.'), cook('Fry falafel', 'Falafel', 900, 'Fry falafel in three batches until deep golden and cooked through, about five minutes per batch.'),
    prep('Chop salad', 'Tomato and cucumber', 180, 'Dice tomato and cucumber.'), prep('Mix tahini sauce', 'Tahini, lemon and water', 60, 'Whisk tahini with lemon juice and measured water.'), prep('Fill wraps', 'Flatbreads and fillings', 180, 'Fill flatbreads with falafel, salad and tahini sauce.')
  ], 'Medium'),
  recipe('Hummus Vegetable Wraps', 'Lunch', 'Middle Eastern', 'Fresh crunchy wraps with homemade chickpea hummus.', '1 cup Cooked chickpeas; 2 tbsp Tahini; 1 tbsp Lemon juice; 1 cloves Garlic; 2 tbsp Water; 0.25 tsp Salt; 2 pcs Egg-free flatbreads; 1 pcs Carrot; 0.5 pcs Cucumber; 1 cup Lettuce', [
    prep('Blend hummus', 'Chickpeas and seasonings', 240, 'Blend chickpeas, tahini, lemon, garlic, water and salt until smooth.'), prep('Cut vegetables', 'Carrot and cucumber', 180, 'Cut carrot and cucumber into thin sticks.'), prep('Wash lettuce', 'Lettuce', 90, 'Wash lettuce thoroughly.'),
    prep('Fill wraps', 'Flatbreads and fillings', 180, 'Fill flatbreads with hummus, lettuce and vegetable sticks.')
  ]),
  recipe('Greek Salad', 'Lunch', 'Greek', 'Crisp cucumber, tomato and olives with vegetarian-rennet feta.', '2 pcs Tomatoes; 1 pcs Cucumber; 0.5 pcs Red onion; 0.25 cup Pitted olives; 100 g Vegetarian-rennet feta; 1 tbsp Olive oil; 1 tbsp Lemon juice; 0.5 tsp Dried oregano', [
    prep('Wash vegetables', 'Tomato and cucumber', 90, 'Wash tomatoes and cucumber.'), prep('Cut vegetables', 'Vegetables', 240, 'Cut tomatoes and cucumber into chunks with thinly sliced onion.'), prep('Cube feta', 'Vegetarian-rennet feta', 60, 'Cube the feta.'),
    prep('Whisk dressing', 'Oil, lemon and oregano', 60, 'Whisk olive oil, lemon and oregano.'), prep('Toss salad', 'Salad', 90, 'Toss vegetables with olives, feta and dressing.')
  ]),
  recipe('Caprese Sandwich', 'Lunch', 'Italian', 'Tomato, basil and vegetarian-rennet mozzarella in egg-free bread.', '4 slices Egg-free bread; 150 g Vegetarian-rennet mozzarella; 2 pcs Tomatoes; 0.25 cup Fresh basil; 1 tbsp Olive oil; 1 tsp Balsamic vinegar; 0.25 tsp Black pepper', [
    prep('Slice tomatoes', 'Tomatoes', 120, 'Slice washed tomatoes.'), prep('Slice mozzarella', 'Mozzarella', 90, 'Slice mozzarella thinly.'), cook('Toast bread', 'Bread', 240, 'Toast the bread until lightly golden.'),
    prep('Assemble sandwiches', 'Bread and fillings', 180, 'Layer tomato, mozzarella and basil between bread slices with olive oil, vinegar and pepper.')
  ]),
  recipe('Minestrone', 'Lunch', 'Italian', 'A hearty vegetable-and-bean soup with egg-free pasta and vegetable stock.', '1 pcs Onion; 1 pcs Carrot; 1 pcs Courgette; 2 cloves Garlic; 1 tbsp Olive oil; 1 cup Crushed tomatoes; 3 cup Vegetable stock; 1 cup Cooked white beans; 60 g Egg-free small pasta; 0.5 tsp Dried oregano; 0.25 tsp Black pepper', [
    prep('Dice vegetables', 'Vegetables and garlic', 300, 'Dice onion, carrot and courgette with minced garlic.'), cook('Heat oil', 'Olive oil', 45, 'Heat olive oil in a saucepan.'), cook('Soften onion and carrot', 'Onion and carrot', 420, 'Sauté onion and carrot until softened.'), cook('Cook garlic', 'Garlic', 30, 'Cook garlic briefly until fragrant.'),
    cook('Simmer soup', 'Tomatoes, stock and vegetables', 900, 'Simmer tomatoes, stock, courgette, oregano and pepper in the pan for 15 minutes.'), cook('Cook pasta and beans', 'Pasta and beans', 600, 'Simmer pasta and cooked beans in the soup until pasta is tender, about ten minutes.')
  ]),
  recipe('Red Lentil Soup', 'Lunch', 'Mediterranean', 'A smooth lentil soup with carrots, cumin and lemon.', '0.75 cup Red lentils; 1 pcs Onion; 1 pcs Carrot; 2 cloves Garlic; 1 tbsp Olive oil; 3 cup Vegetable stock; 0.5 tsp Cumin powder; 0.25 tsp Black pepper; 1 tbsp Lemon juice', [
    prep('Rinse lentils', 'Red lentils', 60, 'Rinse lentils thoroughly.'), prep('Chop vegetables', 'Vegetables and garlic', 240, 'Chop onion and carrot with minced garlic.'), cook('Heat oil', 'Olive oil', 45, 'Heat olive oil in a saucepan.'), cook('Soften vegetables', 'Onion and carrot', 420, 'Sauté onion and carrot until softened.'),
    cook('Toast aromatics', 'Garlic and cumin', 45, 'Cook garlic and cumin until fragrant.'), cook('Simmer lentils', 'Lentils, stock and pepper', 1500, 'Simmer lentils with stock and pepper until completely soft, about 25 minutes.'), prep('Blend soup', 'Soup', 180, 'Blend carefully with a hand blender until smooth.'), prep('Finish soup', 'Lemon juice', 30, 'Stir lemon juice into the soup.')
  ]),
  recipe('Vegetable Quesadillas', 'Lunch', 'Mexican', 'Toasted egg-free tortillas with peppers, beans and vegetarian-rennet cheese.', '4 pcs Egg-free flour tortillas; 1 pcs Bell pepper; 1 pcs Onion; 1 cup Cooked black beans; 100 g Vegetarian-rennet cheddar cheese; 1 tbsp Oil; 0.5 tsp Cumin powder; 0.25 tsp Salt', [
    prep('Slice vegetables', 'Onion and pepper', 180, 'Thinly slice onion and pepper.'), prep('Grate cheese', 'Cheddar', 120, 'Grate the cheese.'), cook('Heat oil', 'Oil', 45, 'Heat oil in a frying pan.'), cook('Cook filling', 'Vegetables, beans and seasonings', 600, 'Sauté vegetables with beans, cumin and salt until tender.'),
    prep('Fill tortillas', 'Tortillas and filling', 180, 'Fill each tortilla with vegetables and cheese into a folded half-moon.'), cook('Toast quesadillas', 'Quesadillas', 720, 'Toast each quesadilla in a dry pan until golden on both sides and cheese is melted, about three minutes each.')
  ]),
  recipe('Margherita Pizza', 'Dinner', 'Italian', 'A homemade yeast-risen pizza with tomato, basil and vegetarian-rennet mozzarella.', '1.5 cup Plain flour; 0.6 cup Water; 0.5 tsp Instant yeast; 0.5 tsp Salt; 1 tbsp Olive oil; 0.5 cup Tomato passata; 150 g Vegetarian-rennet mozzarella; 0.25 cup Fresh basil; 0.5 tsp Dried oregano', [
    prep('Knead pizza dough', 'Flour and seasonings', 600, 'Knead flour with water, yeast, salt and half the oil until smooth and elastic.'), wait('Rise dough', 'Dough', 5400, 'Leave covered in a warm place for about 90 minutes until doubled.', 'Prep'), cook('Preheat oven', 'Oven', 1200, 'Preheat the oven and a baking tray to 240°C.'),
    prep('Shape pizza base', 'Dough', 180, 'Stretch dough into a 28 cm circle on baking paper.'), prep('Top pizza', 'Tomato, cheese and oregano', 180, 'Spread passata over the base with torn mozzarella, oregano and remaining oil.'),
    wait('Bake pizza', 'Pizza', 900, 'Bake on the hot tray for 12 to 15 minutes until the base is crisp and the cheese bubbles.'), prep('Add basil', 'Basil', 30, 'Scatter basil over the hot pizza.')
  ], 'Medium'),
  recipe('Spinach Ricotta Lasagne', 'Dinner', 'Italian', 'Egg-free lasagne sheets layered with spinach, ricotta and tomato sauce.', '150 g Egg-free oven-ready lasagne sheets; 250 g Spinach; 200 g Vegetarian-rennet ricotta; 100 g Vegetarian-rennet mozzarella; 2 cup Tomato passata; 0.5 cup Water; 1 tbsp Olive oil; 2 cloves Garlic; 0.5 tsp Dried oregano; 0.5 tsp Salt', [
    prep('Wash spinach', 'Spinach', 180, 'Wash spinach thoroughly.'), prep('Mince garlic', 'Garlic', 60, 'Mince garlic.'), cook('Heat oil', 'Olive oil', 45, 'Heat oil in a saucepan.'), cook('Cook garlic', 'Garlic', 30, 'Cook garlic briefly until fragrant.'), cook('Simmer sauce', 'Passata, water and seasonings', 600, 'Simmer passata, water, oregano and salt for ten minutes.'),
    cook('Wilt spinach', 'Spinach', 240, 'Wilt spinach in a separate saucepan over medium heat.'), prep('Drain spinach', 'Spinach', 90, 'Squeeze excess liquid from spinach once cool enough to handle.'), prep('Mix filling', 'Spinach and ricotta', 120, 'Mix chopped spinach with ricotta.'), cook('Preheat oven', 'Oven', 600, 'Preheat oven to 190°C.'),
    prep('Layer lasagne', 'Lasagne and fillings', 300, 'Layer sauce, sheets and spinach filling in a small baking dish, finishing with sauce and mozzarella.'), wait('Bake covered', 'Lasagne', 1800, 'Bake covered with foil for 30 minutes.'), prep('Uncover dish', 'Lasagne', 30, 'Remove the foil carefully.'), wait('Brown lasagne', 'Lasagne', 900, 'Bake uncovered for 15 minutes until bubbling and sheets are tender.'), wait('Rest lasagne', 'Lasagne', 600, 'Rest off the heat for ten minutes.')
  ], 'Medium'),
  recipe('Mushroom Risotto', 'Dinner', 'Italian', 'Creamy arborio rice with mushrooms, vegetable stock and vegetarian-rennet hard cheese.', '0.75 cup Arborio rice; 250 g Mushrooms; 1 pcs Onion; 2 cloves Garlic; 3 cup Vegetable stock; 1 tbsp Olive oil; 1 tbsp Butter; 30 g Vegetarian-rennet hard cheese; 0.25 tsp Black pepper', [
    prep('Chop vegetables', 'Onion, mushrooms and garlic', 300, 'Finely chop onion with sliced mushrooms and minced garlic.'), cook('Warm stock', 'Vegetable stock', 300, 'Warm stock in a separate saucepan over low heat.'), cook('Heat oil', 'Olive oil', 45, 'Heat olive oil in a wide pan.'), cook('Sauté mushrooms', 'Mushrooms', 480, 'Sauté mushrooms until golden.'), cook('Soften onion', 'Onion and garlic', 300, 'Sauté onion and garlic with the mushrooms until soft.'),
    cook('Toast rice', 'Arborio rice', 120, 'Stir rice through the vegetables until the edges look translucent.'), cook('Cook risotto', 'Rice and stock', 1500, 'Stir warm stock into the rice one ladle at a time over medium-low heat until tender with a slight bite, about 25 minutes, using extra water if needed.'), prep('Grate cheese', 'Hard cheese', 60, 'Grate the hard cheese finely.'), prep('Finish risotto', 'Butter, cheese and pepper', 90, 'Fold butter, grated cheese and pepper into the risotto off the heat.')
  ], 'Medium'),
  recipe('Eggplant Parmesan', 'Dinner', 'Italian', 'Roasted aubergine layered with tomato and vegetarian-rennet cheeses; no egg coating.', '2 pcs Aubergines; 2 tbsp Olive oil; 1.5 cup Tomato passata; 100 g Vegetarian-rennet mozzarella; 30 g Vegetarian-rennet Parmesan-style cheese; 0.5 tsp Salt; 0.5 tsp Dried oregano; 0.25 cup Fresh basil', [
    prep('Slice aubergines', 'Aubergines', 180, 'Slice aubergines into 1 cm rounds.'), cook('Preheat oven', 'Oven', 600, 'Preheat oven to 220°C.'), prep('Season aubergines', 'Aubergines, oil and salt', 180, 'Coat aubergine slices with oil and salt on a lined tray.'), wait('Roast aubergines', 'Aubergines', 1500, 'Roast for 25 minutes until soft and lightly golden.'),
    prep('Layer bake', 'Sauce and cheeses', 240, 'Layer aubergines with passata, oregano, basil and both cheeses in a baking dish.'), wait('Bake layers', 'Aubergine bake', 1200, 'Bake at 200°C for 20 minutes until bubbling.'), wait('Rest bake', 'Aubergine bake', 300, 'Rest off the heat for five minutes.')
  ]),
  recipe('Vegetable Pad Thai', 'Dinner', 'Thai', 'Egg-free rice noodles with tofu, peanuts and a tamarind-soy sauce; no fish sauce.', '150 g Egg-free rice noodles; 200 g Firm tofu; 1 pcs Carrot; 1 cup Bean sprouts; 2 pcs Spring onions; 2 tbsp Oil; 1 tbsp Tamarind paste; 1.5 tbsp Vegetarian soy sauce; 1 tbsp Brown sugar; 2 tbsp Water; 0.25 cup Roasted peanuts; 1 tbsp Lime juice', [
    wait('Soak noodles', 'Rice noodles', 1200, 'Soak noodles in additional warm water according to the packet until flexible, usually 20 minutes.', 'Prep'), prep('Drain noodles', 'Noodles', 60, 'Drain noodles thoroughly.'), prep('Cut ingredients', 'Tofu and vegetables', 300, 'Cube tofu with carrot cut into thin sticks and spring onions sliced.'), prep('Mix sauce', 'Tamarind and seasonings', 90, 'Mix tamarind, soy sauce, sugar and measured water.'), cook('Heat oil', 'Oil', 60, 'Heat oil in a wok.'),
    cook('Brown tofu', 'Tofu', 480, 'Stir-fry tofu until golden.'), cook('Cook carrot', 'Carrot', 180, 'Stir-fry carrot until crisp-tender.'), cook('Toss noodles', 'Noodles and sauce', 300, 'Toss noodles with sauce over medium heat until tender, adding a little water if needed.'), cook('Wilt sprouts', 'Sprouts and spring onions', 180, 'Stir-fry sprouts and spring onions through the noodles until sprouts are thoroughly hot.'), prep('Finish noodles', 'Peanuts and lime', 60, 'Top noodles with crushed peanuts and lime juice.')
  ]),
  recipe('Thai Green Vegetable Curry', 'Dinner', 'Thai', 'A coconut curry with tofu and vegetables, using shrimp-free and fish-free curry paste.', '200 g Firm tofu; 1 pcs Bell pepper; 1 pcs Courgette; 100 g Green beans; 1 tbsp Oil; 1.5 tbsp Vegan Thai green curry paste; 1.5 cup Coconut milk; 0.5 cup Water; 1 tbsp Vegetarian soy sauce; 1 tbsp Lime juice; 0.25 cup Fresh basil', [
    prep('Cut tofu and vegetables', 'Tofu and vegetables', 300, 'Cube tofu with pepper, courgette and beans cut into bite-sized pieces.'), cook('Heat oil', 'Oil', 45, 'Heat oil in a saucepan.'), cook('Fry curry paste', 'Vegan curry paste', 90, 'Fry the curry paste over medium heat until fragrant.'), cook('Warm coconut milk', 'Coconut milk and water', 240, 'Bring coconut milk and water to a gentle simmer in the pan.'),
    cook('Cook vegetables', 'Vegetables, tofu and soy sauce', 900, 'Simmer vegetables and tofu with soy sauce until beans are tender, about 15 minutes.'), prep('Finish curry', 'Lime and basil', 60, 'Fold lime juice and basil into the curry off the heat.')
  ]),
  recipe('Black Bean Tacos', 'Dinner', 'Mexican', 'Warm corn tortillas with cumin-spiced beans, avocado and tomato salsa.', '6 pcs Egg-free corn tortillas; 2 cup Cooked black beans; 1 pcs Onion; 2 pcs Tomatoes; 1 pcs Avocado; 1 tbsp Oil; 1 tsp Cumin powder; 0.5 tsp Smoked paprika; 0.5 tsp Salt; 0.25 cup Water; 1 tbsp Lime juice; 2 tbsp Fresh coriander', [
    prep('Chop vegetables', 'Onion and tomatoes', 240, 'Finely chop onion and tomatoes.'), prep('Slice avocado', 'Avocado', 120, 'Slice the avocado flesh.'), prep('Mix salsa', 'Tomato and seasonings', 120, 'Mix tomatoes with a quarter of the onion, lime juice and chopped coriander.'), cook('Heat oil', 'Oil', 45, 'Heat oil in a saucepan.'), cook('Sauté onion', 'Onion', 300, 'Sauté remaining onion until soft.'),
    cook('Season beans', 'Beans and spices', 480, 'Simmer beans with cumin, paprika, salt and water for eight minutes.'), cook('Warm tortillas', 'Tortillas', 180, 'Warm tortillas in a dry pan until flexible.'), prep('Fill tacos', 'Taco fillings', 180, 'Fill tortillas with beans, salsa and avocado.')
  ]),
  recipe('Vegetable Sushi Rolls', 'Dinner', 'Japanese', 'Nori rolls filled with seasoned sushi rice, cucumber, carrot and avocado.', '1 cup Sushi rice; 1.25 cup Water; 2 tbsp Rice vinegar; 1 tsp Sugar; 0.25 tsp Salt; 4 pcs Nori sheets; 0.5 pcs Cucumber; 1 pcs Carrot; 1 pcs Avocado; 2 tbsp Vegetarian soy sauce', [
    prep('Rinse rice', 'Sushi rice', 180, 'Rinse sushi rice until the water runs mostly clear.'), cook('Bring rice to boil', 'Rice and water', 300, 'Bring rice and measured water to a boil.'), wait('Cook rice', 'Sushi rice', 900, 'Cook covered over the lowest heat for 15 minutes until water is absorbed.'), wait('Rest rice', 'Rice', 600, 'Rest covered off the heat for ten minutes.'), prep('Mix seasoning', 'Vinegar, sugar and salt', 60, 'Mix rice vinegar with sugar and salt until dissolved.'), prep('Season rice', 'Rice', 120, 'Fold the seasoning through the warm rice.'), wait('Cool rice', 'Rice', 600, 'Spread rice in a wide bowl until just warm, about ten minutes.', 'Prep'),
    prep('Cut vegetables', 'Cucumber, carrot and avocado', 300, 'Cut vegetables into thin sticks.'), prep('Roll sushi', 'Nori, rice and vegetables', 480, 'Roll rice and vegetables inside four nori sheets using a bamboo mat, sealing each edge with a little water.'), prep('Slice rolls', 'Sushi', 180, 'Slice rolls with a damp sharp knife.'), prep('Portion soy sauce', 'Soy sauce', 30, 'Pour soy sauce into small dipping bowls.')
  ], 'Medium')
];

export const VEGETARIAN_RECIPES = [...indianBreakfasts, ...indianLunches, ...indianDinners, ...international];
