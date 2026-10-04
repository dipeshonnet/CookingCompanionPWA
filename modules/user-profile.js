export const DEFAULT_USER_PROFILE = {
  name: "Chef Guest",
  email: "",
  gender: "Prefer not to say",
  dietPreference: "None",
  performerType: "Human",
  performerGender: "Female",
  playStepVideo: true,
  playBackgroundMusic: false,
  mutePlayAudio: false,
  experience: "Expert",
  loggedIn: false
};

export function buildUserProfile(raw = {}) {
  if (!raw || typeof raw !== 'object') raw = {};
  const clean = (v) => String(v ?? "").trim();
  const defaults = DEFAULT_USER_PROFILE;
  return {
    name: clean(raw.name || defaults.name),
    email: clean(raw.email || defaults.email),
    gender: clean(raw.gender || defaults.gender),
    dietPreference: clean(raw.dietPreference || defaults.dietPreference),
    performerType: clean(raw.performerType || defaults.performerType),
    performerGender: clean(raw.performerGender || defaults.performerGender),
    playStepVideo: raw.playStepVideo !== false,
    playBackgroundMusic: Boolean(raw.playBackgroundMusic),
    mutePlayAudio: Boolean(raw.mutePlayAudio),
    experience: ['Expert', 'Somewhat', 'Beginner'].includes(raw.experience) ? raw.experience : defaults.experience,
    likedRecipeIds: Array.isArray(raw.likedRecipeIds) ? raw.likedRecipeIds.filter(id => typeof id === 'string').slice(0, 2000) : [],
    loggedIn: Boolean(raw.loggedIn)
  };
};
