/**
 * Gemini AI Integration Module
 * Cooking Companion PWA
 */

/**
 * Request a structured gourmet recipe from Gemini 2.5 Flash
 * @param {string} apiKey Gemini API Key
 * @param {object} params Customization parameters { ingredients, dietary, complexity }
 * @returns {Promise<object>} Parsed recipe object matching schema
 */
async function fetchCustomRecipeFromGemini(apiKey, params) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const promptText = `
You are a world-class Michelin-star chef. Construct a unique, premium gourmet recipe that incorporates some or all of these primary ingredients: ${params.ingredients.join(", ")}.

Follow these exact constraints:
- Dietary Preference: ${params.dietary}
- Cooking Style & Complexity: ${params.complexity}
- Cooking Crew: ${params.cookCount === 2 ? "2 cooks, with useful parallel assignments for Cook 1 and Cook 2" : "1 cook"}

Make sure that:
1. The ingredients list is precise, specifying exact decimal amounts and units (e.g. g, pcs, cup, tbsp).
2. The steps are broken down clearly. For every step, include "item", "action", "duration" in SECONDS, "cook", and a combined "text" summary. If two cooks are requested, assign each timed task to Cook 1 or Cook 2 so independent timers can run in parallel. If a step doesn't require a countdown (like assembling/plating), set duration to 60.
3. The tags are relevant, creative dietary labels.
4. Output a highly professional, cohesive gourmet creation.
  `;

  // Schema for structured JSON output
  const schema = {
    type: "OBJECT",
    properties: {
      title: { type: "STRING", description: "An elegant, creative gourmet title for the recipe" },
      description: { type: "STRING", description: "A highly descriptive, mouth-watering marketing summary of the dish" },
      category: { type: "STRING", description: "Must be Breakfast, Lunch, or Dinner" },
      prepTime: { type: "INTEGER", description: "Preparation time in minutes" },
      cookTime: { type: "INTEGER", description: "Cooking time in minutes" },
      servings: { type: "INTEGER", description: "Servings yield (e.g. 2, 4)" },
      tags: { 
        type: "ARRAY", 
        items: { type: "STRING" },
        description: "Dietary or style tags (e.g., Gourmet, Low-Carb, Vegan)" 
      },
      ingredients: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            name: { type: "STRING", description: "Name of the ingredient" },
            amount: { type: "NUMBER", description: "Decimal numeric portion required" },
            unit: { type: "STRING", description: "Measurement unit (e.g., pcs, cup, g, tbsp, tsp)" }
          },
          required: ["name", "amount", "unit"]
        }
      },
      steps: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            item: { type: "STRING", description: "The ingredient, component, pan, pot, or dish part being worked on" },
            action: { type: "STRING", description: "What to do to that item during this step" },
            duration: { type: "INTEGER", description: "Active countdown timer duration in seconds for this cooking step" },
            cook: { type: "STRING", description: "Cook 1 or Cook 2. Use Cook 1 when only one cook is requested" },
            text: { type: "STRING", description: "Detailed, chef-like cooking instructions for the step" }
          },
          required: ["item", "action", "duration", "cook", "text"]
        }
      }
    },
    required: ["title", "description", "category", "prepTime", "cookTime", "servings", "tags", "ingredients", "steps"]
  };

  const payload = {
    contents: [
      {
        parts: [
          { text: promptText }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schema
    }
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API returned status ${response.status}: ${errText}`);
    }

    const data = await response.json();
    
    // Extract generated text content
    const rawText = data.candidates[0].content.parts[0].text;
    const parsedRecipe = JSON.parse(rawText);
    
    return parsedRecipe;
  } catch (error) {
    console.error("Error communicating with Gemini API:", error);
    throw error;
  }
}

/**
 * Request nutrition details for a pantry ingredient from Gemini 2.5 Flash.
 * @param {string} apiKey Gemini API Key
 * @param {object} params Ingredient payload { name, quantity, unit, category }
 * @returns {Promise<object>} Nutrition object
 */
async function fetchIngredientNutritionFromGemini(apiKey, params) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const promptText = `
Estimate nutrition for this ingredient amount:
- Ingredient: ${params.name}
- Quantity: ${params.quantity}
- Unit: ${params.unit}
- Category: ${params.category || "Other"}

Return realistic approximate values for this exact amount.
`;

  const schema = {
    type: "OBJECT",
    properties: {
      calories: { type: "NUMBER", description: "Estimated calories for the provided amount" },
      protein_g: { type: "NUMBER", description: "Estimated protein in grams for the provided amount" },
      carbs_g: { type: "NUMBER", description: "Estimated carbohydrates in grams for the provided amount" },
      fat_g: { type: "NUMBER", description: "Estimated fat in grams for the provided amount" },
      fiber_g: { type: "NUMBER", description: "Estimated fiber in grams for the provided amount" }
    },
    required: ["calories", "protein_g", "carbs_g", "fat_g"]
  };

  const payload = {
    contents: [{ parts: [{ text: promptText }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schema
    }
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API returned status ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error("No nutrition payload returned by Gemini");
  return JSON.parse(rawText);
}

/**
 * Generate a short step video (4s default) using Gemini Veo and return downloadable URI.
 * This uses long-running operation polling from Gemini Video API.
 * @param {string} apiKey Gemini API Key
 * @param {object} params { prompt, durationSeconds }
 * @returns {Promise<string|null>} video URI if available
 */
async function fetchStepVideoFromGemini(apiKey, params) {
  const duration = [4, 6, 8].includes(Number(params.durationSeconds)) ? Number(params.durationSeconds) : 4;
  const base = "https://generativelanguage.googleapis.com/v1beta";
  const predictUrl = `${base}/models/veo-3.1-fast-generate-preview:predictLongRunning`;

  const startResponse = await fetch(predictUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify({
      instances: [{ prompt: params.prompt }],
      parameters: {
        durationSeconds: duration,
        aspectRatio: "16:9"
      }
    })
  });

  if (!startResponse.ok) {
    const errText = await startResponse.text();
    throw new Error(`Video start failed ${startResponse.status}: ${errText}`);
  }

  let operation = await startResponse.json();
  if (!operation?.name) return null;

  for (let i = 0; i < 30; i++) {
    if (operation.done) break;
    await new Promise(resolve => setTimeout(resolve, 3000));
    const statusResp = await fetch(`${base}/${operation.name}`, {
      headers: { "x-goog-api-key": apiKey }
    });
    if (!statusResp.ok) {
      const errText = await statusResp.text();
      throw new Error(`Video poll failed ${statusResp.status}: ${errText}`);
    }
    operation = await statusResp.json();
  }

  if (!operation?.done) return null;
  if (operation.error) throw new Error(`Video generation error: ${operation.error.message || "unknown"}`);

  const uri =
    operation.response?.generatedSamples?.[0]?.video?.uri ||
    operation.response?.videos?.[0]?.uri ||
    operation.response?.video?.uri ||
    null;

  return uri;
}
