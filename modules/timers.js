import { initLucide, switchView } from './navigation.js';
import { isPlayAudioMuted, getAudioContext, playShortBeep, speakPlayStep } from './play-media.js';
import { getExperienceTimerMultiplier } from './profile.js';
import { normalizeRecipeForStorage, getAllRecipes } from './recipe-domain.js';
import { STATE, RUNTIME } from './state.js';
import { escapeHtml, formatTimerClock } from './utils.js';
import { getActiveTimerEntries, getRemainingTimerFraction, renderFloatingTimers } from './active-timer-summary.js';

export function startCookingTimer(recipeTitle, stepIdx, durationSeconds, cookName = "Cook 1", stepLabel = "", options = {}) {
  const timerMultiplier = getExperienceTimerMultiplier();
  const adjustedDuration = Math.max(1, Math.round(durationSeconds * timerMultiplier));

  // Prevent duplicate timers for same step
  const timerId = `${recipeTitle}-${stepIdx}-${cookName}`;
  const existing = STATE.activeTimers.find(t => t.id === timerId);
  if (existing) {
    if (!options.silent) alert("This timer is already running!");
    return false;
  }

  if (!options.keepModalOpen) {
    document.getElementById("recipe-modal").style.display = "none";
  }

  const newTimer = {
    id: timerId,
    title: recipeTitle,
    stepIndex: stepIdx,
    cookName,
    stepLabel,
    totalDuration: adjustedDuration,
    deadline: Date.now() + adjustedDuration * 1000,
    lastBeep: null,
    timeLeft: adjustedDuration,
    intervalId: null
  };

  newTimer.intervalId = setInterval(() => {
    newTimer.timeLeft = Math.max(0, Math.ceil((newTimer.deadline - Date.now()) / 1000));
    if (newTimer.timeLeft > 0 && newTimer.timeLeft <= 3 && newTimer.lastBeep !== newTimer.timeLeft) {
      playShortBeep();
      newTimer.lastBeep = newTimer.timeLeft;
    }
    
    if (newTimer.timeLeft <= 0) {
      clearInterval(newTimer.intervalId);
      triggerTimerFinishedAlert(newTimer);
      STATE.activeTimers = STATE.activeTimers.filter(t => t.id !== newTimer.id);
    }
    
    renderActiveTimers();
  }, 1000);

  STATE.activeTimers.push(newTimer);
  speakPlayStep({ cook: cookName, item: stepLabel || `Step ${stepIdx + 1}`, action: options.action || recipeTitle });
  renderActiveTimers();
  if (!options.silent) alert(`Started ${cookName} timer for Step ${stepIdx + 1}!`);
  return true;
}

export function startParallelRecipeTimers(recipe) {
  const displayRecipe = normalizeRecipeForStorage(recipe);
  let startedCount = 0;

  displayRecipe.steps.forEach((step, idx) => {
    if (step.duration > 0) {
      const started = startCookingTimer(displayRecipe.title, idx, step.duration, step.cook, step.item, {
        silent: true,
        keepModalOpen: true,
        action: step.action
      });
      if (started) startedCount++;
    }
  });

  if (startedCount > 0) {
    document.getElementById("recipe-modal").style.display = "none";
    alert(`Started ${startedCount} parallel cooking timers.`);
  } else {
    alert("All timers for this recipe are already running.");
  }
}

export function cancelActiveTimer(timerId) {
  const timer = STATE.activeTimers.find(t => t.id === timerId);
  if (timer) {
    clearInterval(timer.intervalId);
    STATE.activeTimers = STATE.activeTimers.filter(t => t.id !== timerId);
    renderActiveTimers();
  }
}

export function renderActiveTimers() {
  const timers = getActiveTimerEntries(RUNTIME.playSession, STATE.activeTimers, getAllRecipes());
  renderFloatingTimers(timers);
  const container = document.getElementById("active-timers-container");
  if (!container) return;
  const signature = JSON.stringify(timers.map(timer => [timer.id, timer.source, timer.title, timer.cookName, timer.stepIndex, timer.stepLabel]));
  if (container.dataset.signature !== signature) {
    container.innerHTML = timers.length ? '' : `<p class="empty-state" style="color: var(--text-dim); font-size: 13px; text-align: center; padding: 20px 0;">No active cooking timers.</p>`;
    container.dataset.signature = signature;
    timers.forEach(t => {
      const item = document.createElement("div");
      item.className = "timer-item";
      const radius = 18;
      const circ = 2 * Math.PI * radius;
      const offset = circ - getRemainingTimerFraction(t) * circ;
      item.innerHTML = `
      <div class="timer-ring-container">
        <svg width="44" height="44">
          <circle cx="22" cy="22" r="${radius}" fill="transparent" stroke="rgba(255,255,255,0.05)" stroke-width="4"></circle>
          <circle class="timer-ring-circle" cx="22" cy="22" r="${radius}" fill="transparent" 
            stroke="var(--accent)" stroke-width="4" stroke-dasharray="${circ}" stroke-dashoffset="${offset}" stroke-linecap="round"></circle>
        </svg>
        <span class="timer-time-left">${formatTimerClock(t.timeLeft)}</span>
      </div>
      <div class="timer-info">
        <span class="timer-title">${escapeHtml(t.title)}</span>
        <span class="timer-step">${escapeHtml(t.cookName || "Cook 1")} &middot; Step ${t.stepIndex + 1}${t.stepLabel ? ` &middot; ${escapeHtml(t.stepLabel)}` : ""}</span>
      </div>
      <button class="btn-icon timer-action-btn" style="${t.source === 'individual' ? 'color: var(--error); border-color: rgba(239, 68, 68, 0.2);' : ''} width: 28px; height: 28px;" type="button" aria-label="${t.source === 'play' ? 'Open Play Recipe' : 'Cancel timer'}" title="${t.source === 'play' ? 'Open Play Recipe' : 'Cancel timer'}">
        <i data-lucide="${t.source === 'play' ? 'arrow-up-right' : 'square'}" style="width: 12px; height: 12px;"></i>
      </button>
      `;
      item.querySelector(".timer-action-btn").addEventListener("click", () => t.source === 'play' ? switchView('play') : cancelActiveTimer(t.id));
      container.appendChild(item);
    });
    initLucide();
  }
  [...container.querySelectorAll('.timer-item')].forEach((item, index) => {
    const timer = timers[index];
    const text = formatTimerClock(timer.timeLeft);
    const clock = item.querySelector('.timer-time-left');
    if (clock.textContent !== text) clock.textContent = text;
    const circ = 2 * Math.PI * 18;
    item.querySelector('.timer-ring-circle').style.strokeDashoffset = circ * (1 - getRemainingTimerFraction(timer));
  });
}

export function triggerTimerFinishedAlert(timer) {
  playSynthesizedChime();

  // Desktop alert notifications
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification("Cooking Timer Finished!", {
      body: `"${timer.title}": ${timer.cookName || "Cook 1"} Step ${timer.stepIndex + 1} is now complete!`,
      icon: "assets/icon-192.png"
    });
  } else {
    alert(`[COOKING ALERT] "${timer.title}": ${timer.cookName || "Cook 1"} Step ${timer.stepIndex + 1} is finished!`);
  }
}

// Generate premium chime dynamically with Web Audio API (Zero static audio files required)
export function playSynthesizedChime() {
  if (isPlayAudioMuted()) return;
  try {
    const audioCtx = getAudioContext();
    if (!audioCtx) return;
    
    // Quick pleasant triple-beep chord
    const playNote = (freq, start, duration) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);
      
      // Envelopes
      gain.gain.setValueAtTime(0.01, start);
      gain.gain.linearRampToValueAtTime(0.4, start + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, start + duration);
      
      osc.start(start);
      osc.stop(start + duration);
      osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    };

    const now = audioCtx.currentTime;
    playNote(523.25, now, 0.35); // C5
    playNote(659.25, now + 0.15, 0.35); // E5
    playNote(783.99, now + 0.30, 0.50); // G5
  } catch (err) {
    console.error("Audio API synthesis error: ", err);
  }
}
