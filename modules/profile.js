import { initLucide, renderApp } from './navigation.js';
import { stopPlayBackgroundMusic } from './play-media.js';
import { STATE, RUNTIME } from './state.js';
import { getAiProvider, setAiProvider, getApiKey, setApiKey, saveStateToStorage } from './storage.js';
import { updateAiSettingsFields } from './ai-providers.js';
import { cleanText } from './utils.js';

export function openProfileModal() {
  const modal = document.getElementById("profile-modal");
  if (!modal) return;

  const nameInput = document.getElementById("profile-name-input");
  const genderInput = document.getElementById("profile-gender-input");
  const dietInput = document.getElementById("profile-diet-input");
  const performerTypeInput = document.getElementById("profile-performer-type-input");
  const performerGenderInput = document.getElementById("profile-performer-gender-input");
  const playMusicInput = document.getElementById("profile-play-music-input");
  const playVideoInput = document.getElementById("profile-play-video-input");
  const muteAudioInput = document.getElementById("profile-mute-audio-input");
  const musicNameLabel = document.getElementById("profile-music-file-name");
  const emailInput = document.getElementById("profile-email-input");

  if (nameInput) nameInput.value = STATE.user.name || "";
  if (genderInput) genderInput.value = STATE.user.gender || "Prefer not to say";
  if (dietInput) dietInput.value = STATE.user.dietPreference || "None";
  if (performerTypeInput) performerTypeInput.value = STATE.user.performerType || "Human";
  if (performerGenderInput) performerGenderInput.value = STATE.user.performerGender || "Female";
  if (playMusicInput) playMusicInput.checked = Boolean(STATE.user.playBackgroundMusic);
  if (playVideoInput) playVideoInput.checked = STATE.user.playStepVideo !== false;
  if (muteAudioInput) muteAudioInput.checked = Boolean(STATE.user.mutePlayAudio);
  if (musicNameLabel) musicNameLabel.innerText = RUNTIME.playMusicTrack.name || "No file selected";
  if (emailInput) emailInput.value = STATE.user.email || "";
  updateAiSettingsFields('profile-ai', getAiProvider(), getApiKey());

  const experience = STATE.user.experience || "Expert";
  document.querySelectorAll("input[name='profile-experience']").forEach(radio => {
    radio.checked = radio.value === experience;
  });

  modal.style.display = "flex";
  initLucide();
}

export function closeProfileModal() {
  const modal = document.getElementById("profile-modal");
  if (modal) modal.style.display = "none";
}

export function saveProfileSettings() {
  const nameInput = document.getElementById("profile-name-input");
  const genderInput = document.getElementById("profile-gender-input");
  const dietInput = document.getElementById("profile-diet-input");
  const performerTypeInput = document.getElementById("profile-performer-type-input");
  const performerGenderInput = document.getElementById("profile-performer-gender-input");
  const playMusicInput = document.getElementById("profile-play-music-input");
  const playVideoInput = document.getElementById("profile-play-video-input");
  const muteAudioInput = document.getElementById("profile-mute-audio-input");
  const apiInput = document.getElementById("profile-ai-key-input");
  const provider = document.getElementById('profile-ai-provider-select')?.value || getAiProvider();
  const selectedExperience = document.querySelector("input[name='profile-experience']:checked");

  const nextName = cleanText(nameInput?.value || STATE.user.name);
  STATE.user.name = nextName || STATE.user.name;
  STATE.user.gender = cleanText(genderInput?.value || "Prefer not to say");
  STATE.user.dietPreference = cleanText(dietInput?.value || "None");
  STATE.user.performerType = cleanText(performerTypeInput?.value || "Human");
  STATE.user.performerGender = cleanText(performerGenderInput?.value || "Female");
  STATE.user.playBackgroundMusic = Boolean(playMusicInput?.checked);
  STATE.user.playStepVideo = playVideoInput ? Boolean(playVideoInput.checked) : true;
  STATE.user.mutePlayAudio = Boolean(muteAudioInput?.checked);
  STATE.user.experience = selectedExperience ? selectedExperience.value : "Expert";

  setApiKey(apiInput?.value || '', provider);
  setAiProvider(provider);
  updateAiSettingsFields('ai', provider, getApiKey(provider));

  if (!STATE.user.playBackgroundMusic) {
    stopPlayBackgroundMusic();
  }
  if (STATE.user.mutePlayAudio) {
    stopPlayBackgroundMusic();
    window.speechSynthesis?.cancel();
  }

  saveStateToStorage();
  renderApp();
  closeProfileModal();
}

export function getExperienceTimerMultiplier() {
  if (STATE.user.experience === "Beginner") return 2.0;
  if (STATE.user.experience === "Somewhat") return 1.5;
  return 1.0;
}
