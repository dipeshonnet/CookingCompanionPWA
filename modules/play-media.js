import { APP_CONFIG } from './app-config.js';
import { getMedia, putMedia } from './media-store.js';
import { renderPlayBoards } from './play-recipe.js';
import { STATE, RUNTIME } from './state.js';

let audioContext;
let musicGeneration = 0;

export function isPlayAudioMuted() { return Boolean(STATE.user.mutePlayAudio); }

export function getAudioContext() {
  const Constructor = window.AudioContext || window.webkitAudioContext;
  if (!Constructor) return null;
  if (!audioContext || audioContext.state === 'closed') audioContext = new Constructor();
  if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
  return audioContext;
}

export function playShortBeep() {
  if (isPlayAudioMuted()) return;
  try {
    const context = getAudioContext();
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 900;
    oscillator.connect(gain);
    gain.connect(context.destination);
    const now = context.currentTime;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    oscillator.start(now);
    oscillator.stop(now + 0.22);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  } catch (error) { console.warn('Beep unavailable:', error); }
}

function applyMusic(record) {
  stopPlayBackgroundMusic();
  if (RUNTIME.playMusicTrack.url) URL.revokeObjectURL(RUNTIME.playMusicTrack.url);
  RUNTIME.playMusicTrack = record ? { name: record.name, url: URL.createObjectURL(record.blob) } : { name: '', url: '' };
  if (RUNTIME.playMusicAudio) RUNTIME.playMusicAudio.src = RUNTIME.playMusicTrack.url;
  const label = document.getElementById('profile-music-file-name');
  if (label) label.textContent = record?.name || 'No file selected';
}

export async function restorePlayBackgroundMusic() {
  if (!globalThis.indexedDB) return;
  const scope = RUNTIME.storageScope;
  const generation = ++musicGeneration;
  const record = await getMedia(scope, 'background-music');
  if (scope === RUNTIME.storageScope && generation === musicGeneration) applyMusic(record);
}

export async function setPlayBackgroundMusicFile(file) {
  if (!file) return;
  if (!file.type.startsWith('audio/') && !/\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file.name)) {
    alert('Choose an audio file.'); return;
  }
  if (file.size > APP_CONFIG.maxMusicBytes) { alert('Choose a music file smaller than 50 MB.'); return; }
  const scope = RUNTIME.storageScope;
  const generation = ++musicGeneration;
  const record = { name: file.name || 'Selected track', blob: file };
  try {
    await putMedia(scope, 'background-music', record);
    if (scope === RUNTIME.storageScope && generation === musicGeneration) applyMusic(record);
  } catch (error) { console.warn(error); alert('Music could not be saved. Device media storage may be full or unavailable.'); }
}

export function startPlayBackgroundMusic() {
  if (!STATE.user.playBackgroundMusic || isPlayAudioMuted() || !RUNTIME.playMusicTrack.url) return;
  if (!RUNTIME.playMusicAudio) RUNTIME.playMusicAudio = new Audio();
  RUNTIME.playMusicAudio.src = RUNTIME.playMusicTrack.url;
  RUNTIME.playMusicAudio.loop = true;
  RUNTIME.playMusicAudio.volume = 0.35;
  RUNTIME.playMusicAudio.play().catch(error => console.warn('Music playback blocked:', error));
}

export function stopPlayBackgroundMusic() {
  RUNTIME.playMusicAudio?.pause();
  if (RUNTIME.playMusicAudio) RUNTIME.playMusicAudio.currentTime = 0;
}

export function speakPlayStep(step) {
  if (isPlayAudioMuted() || !window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(`${step.cook}, ${step.item}. ${step.action}`);
  window.speechSynthesis.speak(utterance);
}

export function getStepVideoCacheKey(recipeId, step) {
  return JSON.stringify([recipeId, step.order, STATE.user.performerType, STATE.user.performerGender, step.item, step.action]);
}

export async function ensurePlayStepVideo(step) {
  if (!STATE.user.playStepVideo) return;
  const scope = RUNTIME.storageScope;
  const session = RUNTIME.playSession;
  const key = getStepVideoCacheKey(session.recipeId, step);
  const valid = () => scope === RUNTIME.storageScope && session === RUNTIME.playSession;
  const cache = RUNTIME.playVideoCache;
  try {
    let url = cache[key];
    if (!url) {
      const record = await getMedia(scope, `video:${key}`);
      if (!valid()) return;
      if (record && valid()) { url = URL.createObjectURL(record.blob); cache[key] = url; }
    }
    if (valid()) step.videoUrl = url || '';
  } catch (error) { console.warn('Step video unavailable:', error); }
  finally { if (valid()) { step.videoLoading = false; renderPlayBoards(); } }
}
