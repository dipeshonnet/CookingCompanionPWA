import { populateRecipeFormFromDraft } from './recipe-builder.js';
import { normalizeCookLabel, deriveCookTimeFromSteps } from './recipe-domain.js';
import { RUNTIME } from './state.js';
import { cleanText, toNonNegativeNumber } from './utils.js';

export function getNumberFromWordOrDigits(value) {
  const normalized = cleanText(value).toLowerCase();
  const words = {
    one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
    sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
    thirty: 30, forty: 40, fifty: 50, sixty: 60
  };

  if (words[normalized]) return words[normalized];

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseDurationToSeconds(text) {
  const match = cleanText(text).match(/(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty)\s*(hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)\b/i);
  if (!match) return 0;

  const amount = getNumberFromWordOrDigits(match[1]);
  const unit = match[2].toLowerCase();
  if (unit.startsWith("h")) return Math.round(amount * 3600);
  if (unit.startsWith("s")) return Math.round(amount);
  return Math.round(amount * 60);
}

export function normalizeUnit(unit) {
  const raw = cleanText(unit).toLowerCase();
  const map = {
    gram: "g",
    grams: "g",
    milliliter: "ml",
    milliliters: "ml",
    tablespoon: "tbsp",
    tablespoons: "tbsp",
    teaspoon: "tsp",
    teaspoons: "tsp",
    piece: "pcs",
    pieces: "pcs",
    clove: "cloves",
    slice: "slices"
  };
  return map[raw] || raw || "pcs";
}

export function parseIngredientPhrase(phrase) {
  let text = cleanText(phrase)
    .replace(/^(ingredients?|add)\s*[:,-]?\s*/i, "")
    .replace(/^\d+[\).:-]\s*/, "")
    .replace(/[.]+$/, "");

  if (!text) return null;

  let match = text.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?\s+(.+)$/);
  if (match) {
    return {
      name: cleanText(match[3]),
      amount: toNonNegativeNumber(match[1], 1),
      unit: normalizeUnit(match[2] || "pcs")
    };
  }

  match = text.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?$/);
  if (match) {
    return {
      name: cleanText(match[1]),
      amount: toNonNegativeNumber(match[2], 1),
      unit: normalizeUnit(match[3] || "pcs")
    };
  }

  return { name: text, amount: 1, unit: "pcs" };
}

export function extractSection(text, startWords, endWords) {
  const lower = text.toLowerCase();
  const starts = startWords
    .map(word => lower.indexOf(word))
    .filter(index => index >= 0);

  if (starts.length === 0) return "";

  const startIndex = Math.min(...starts);
  const afterStart = startIndex + startWords.find(word => lower.indexOf(word) === startIndex).length;
  const endIndexes = endWords
    .map(word => lower.indexOf(word, afterStart))
    .filter(index => index > afterStart);
  const endIndex = endIndexes.length ? Math.min(...endIndexes) : text.length;

  return text.slice(afterStart, endIndex);
}

export function parseStepPhrase(phrase, fallbackIndex) {
  let text = cleanText(phrase)
    .replace(/^(steps?|directions?|method)\s*[:,-]?\s*/i, "")
    .replace(/^(step\s*)?(one|two|three|four|five|six|seven|eight|nine|ten|\d+)[\).:-]?\s*/i, "");

  if (!text) return null;

  const duration = parseDurationToSeconds(text) || 60;
  const cook = normalizeCookLabel((text.match(/\b(?:cook|person)\s*(1|2|one|two)\b/i) || [])[0] || "");
  const itemMarkerPattern = /\b(?:item|ingredient)\s*[:\-]?\s*([^,.;]+?)(?=\s+(?:boil|simmer|warm|cook|bake|fry|chop|slice|mix|stir|saute|serve|zest|garnish|for|to)\b|,|;|\.|$)/i;
  const itemMatch = text.match(itemMarkerPattern);
  const colonItem = text.match(/^([^:-]{2,34})[:-]\s*(.+)$/);
  const item = cleanText(itemMatch?.[1] || colonItem?.[1] || `Task ${fallbackIndex + 1}`);
  const action = text
    .replace(/\b(?:cook|person)\s*(1|2|one|two)\b/ig, "")
    .replace(new RegExp(itemMarkerPattern.source, "ig"), "")
    .trim() || text;

  return {
    item,
    action,
    duration,
    cook,
    text: `${item}: ${action}`
  };
}

export function parseRecipeDraftFromText(rawText) {
  const text = cleanText(rawText).replace(/\r/g, "\n");
  const titleMatch = text.match(/(?:title|recipe(?:\s+name)?)\s*[:\-]?\s*([^.\n]+)/i);
  const descriptionMatch = text.match(/(?:description|summary)\s*[:\-]?\s*([^.\n]+)/i);
  const servingsMatch = text.match(/(?:servings?|serves)\s*[:\-]?\s*(\d+)/i);
  const prepMatch = text.match(/(?:prep|preparation)\s*[:\-]?\s*(\d+)\s*(?:minutes?|mins?|m)?/i);
  const cookCount = /\b(?:cook|person)\s*(2|two)\b/i.test(text) ? 2 : 1;
  const firstLine = cleanText(text.split(/\n|[.]/).find(line => !/ingredients?|steps?|directions?|method/i.test(line)) || "");

  const ingredientSection = extractSection(text, ["ingredients", "ingredient"], ["steps", "step", "directions", "method"]);
  const ingredientPhrases = (ingredientSection || text)
    .split(/\n|,|;/)
    .map(parseIngredientPhrase)
    .filter(Boolean)
    .filter(ingredient => !/step|direction|method|title|description/i.test(ingredient.name));

  const stepSection = extractSection(text, ["steps", "step", "directions", "method"], []);
  let stepPhrases = stepSection
    .replace(/\bstep\s*(one|two|three|four|five|six|seven|eight|nine|ten|\d+)[\).:-]?\s*/ig, "\n")
    .split(/\n|;/)
    .map(cleanText)
    .filter(Boolean);

  if (stepPhrases.length === 0) {
    stepPhrases = text.split(/\bthen\b|;/i).map(cleanText).filter(line => /minute|second|hour|cook|person|step/i.test(line));
  }

  const steps = stepPhrases
    .map((phrase, index) => parseStepPhrase(phrase, index))
    .filter(Boolean);

  const normalizedSteps = steps.length ? steps : [{
    item: "Recipe",
    action: text,
    duration: 60,
    cook: "Cook 1",
    text
  }];

  const cookTime = deriveCookTimeFromSteps(normalizedSteps, cookCount);

  return {
    title: cleanText(titleMatch?.[1]) || firstLine || "Custom Spoken Recipe",
    description: cleanText(descriptionMatch?.[1]) || "Drafted from voice notes.",
    category: "Dinner",
    prepTime: prepMatch ? Number.parseInt(prepMatch[1], 10) : 10,
    cookTime,
    servings: servingsMatch ? Number.parseInt(servingsMatch[1], 10) : 2,
    cookCount,
    difficulty: "Medium",
    tags: ["Voice Draft"],
    ingredients: ingredientPhrases.length ? ingredientPhrases : [{ name: "Ingredient", amount: 1, unit: "pcs" }],
    steps: normalizedSteps
  };
}

export function buildRecipeDraftFromTalk() {
  const notes = document.getElementById("recipe-talk-notes");
  if (!notes || !cleanText(notes.value)) {
    alert("Add a voice note or pasted recipe first.");
    return;
  }

  const draft = parseRecipeDraftFromText(notes.value);
  populateRecipeFormFromDraft(draft);
  updateVoiceStatus("Draft ready in the form");
  document.getElementById("recipe-title-input")?.focus();
}

export function updateVoiceStatus(message) {
  const status = document.getElementById("recipe-voice-status");
  if (status) status.innerText = message;
}

export function setVoiceButtonState(isListening) {
  RUNTIME.recipeSpeechIsListening = isListening;
  const startBtn = document.getElementById("recipe-voice-start");
  const stopBtn = document.getElementById("recipe-voice-stop");
  if (startBtn) startBtn.disabled = isListening;
  if (stopBtn) stopBtn.disabled = !isListening;
}

export function startRecipeVoiceInput() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const notes = document.getElementById("recipe-talk-notes");

  if (!SpeechRecognition || !notes) {
    updateVoiceStatus("Voice input is not available in this browser");
    alert("Voice input is not available in this browser. You can still paste or type the recipe notes.");
    return;
  }

  if (RUNTIME.recipeSpeechIsListening && RUNTIME.recipeSpeechRecognition) return;

  RUNTIME.recipeSpeechRecognition = new SpeechRecognition();
  RUNTIME.recipeSpeechRecognition.continuous = true;
  RUNTIME.recipeSpeechRecognition.interimResults = true;
  RUNTIME.recipeSpeechRecognition.lang = navigator.language || "en-US";

  let baseText = cleanText(notes.value);

  RUNTIME.recipeSpeechRecognition.onresult = (event) => {
    let finalChunk = "";
    let interimChunk = "";

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalChunk += transcript + " ";
      } else {
        interimChunk += transcript;
      }
    }

    if (finalChunk) {
      notes.value = `${baseText}${baseText ? "\n" : ""}${finalChunk.trim()}`;
      baseText = cleanText(notes.value);
    }

    updateVoiceStatus(interimChunk ? `Listening: ${interimChunk.slice(0, 70)}` : "Listening...");
  };

  RUNTIME.recipeSpeechRecognition.onerror = (event) => {
    updateVoiceStatus(`Voice error: ${event.error}`);
    setVoiceButtonState(false);
  };

  RUNTIME.recipeSpeechRecognition.onend = () => {
    setVoiceButtonState(false);
    updateVoiceStatus("Voice idle");
  };

  RUNTIME.recipeSpeechRecognition.start();
  setVoiceButtonState(true);
  updateVoiceStatus("Listening...");
}

export function stopRecipeVoiceInput() {
  if (RUNTIME.recipeSpeechRecognition && RUNTIME.recipeSpeechIsListening) {
    RUNTIME.recipeSpeechRecognition.stop();
  }
  setVoiceButtonState(false);
  updateVoiceStatus("Voice idle");
}
