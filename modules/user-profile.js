window.DEFAULT_USER_PROFILE = {
  name: "Chef Guest",
  email: "guest@cookingcompanion.local",
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

window.buildUserProfile = function buildUserProfile(raw = {}) {
  const clean = (v) => String(v ?? "").trim();
  const defaults = window.DEFAULT_USER_PROFILE;
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
    experience: clean(raw.experience || defaults.experience),
    loggedIn: Boolean(raw.loggedIn)
  };
};
