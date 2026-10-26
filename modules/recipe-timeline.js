import { buildRecipeSchedule } from './play-engine.js';
import { processLabel, formatDurationLabel } from './recipe-domain.js';
import { escapeHtml, formatTimerClock } from './utils.js';

export function renderRecipeTimeline(target, recipe, options = {}) {
  const element = typeof target === 'string' ? document.getElementById(target) : target;
  if (!element) return;
  if (!recipe) { element.innerHTML = ''; delete element.dataset.signature; delete element.dataset.selectedAction; delete element.dataset.timelineRecipe; return; }
  try {
    const schedule = buildRecipeSchedule(recipe, options);
    const signature = JSON.stringify([recipe.id, recipe.stepSchemaVersion, schedule.steps.map(s => [s.id, s.title, s.start, s.end, s.duration, s.cook, s.attention, s.status, s.assignedCook, s.dependsOn]), Math.floor(schedule.elapsed)]);
    if (element.dataset.signature === signature) return;
    const focusId = element.contains(document.activeElement) ? document.activeElement.dataset.timelineAction : null;
    const zoomFocused = element.contains(document.activeElement) ? document.activeElement.dataset.timelineZoom : null;
    const oldScroll = element.querySelector('.timeline-scroll');
    const scrollPosition = [oldScroll?.scrollLeft || 0, oldScroll?.scrollTop || 0];
    const scrollFocused = document.activeElement === oldScroll;
    const detailsOpen = element.querySelector('details')?.open;
    const summaryFocused = document.activeElement === element.querySelector('summary');
    const selectedId = element.dataset.timelineRecipe === String(recipe.id) ? element.dataset.selectedAction : null;
    if (!selectedId) delete element.dataset.selectedAction;
    element.dataset.timelineRecipe = recipe.id;
    const zoom = element.dataset.timelineZoom || 'overview';
    element.dataset.signature = signature;
    const groups = [...new Set(schedule.steps.map(step => step.cook))].sort((a, b) => Number(a.split(' ')[1]) - Number(b.split(' ')[1]));
    const rowHeight = 64, groupHeight = 42, headerHeight = 48;
    let top = headerHeight;
    const positions = new Map(), headings = [];
    for (const group of groups) {
      const steps = schedule.steps.filter(step => step.cook === group);
      headings.push({ group, top, count: steps.length });
      top += groupHeight;
      for (const step of steps) { positions.set(step.id, top); top += rowHeight; }
    }
    const height = top, width = 840;
    const interval = [15, 30, 60, 120, 300, 600, 900, 1800, 3600].find(value => value >= schedule.duration / 6) || Math.ceil(schedule.duration / 21600) * 3600;
    const total = Math.max(interval, Math.ceil(schedule.duration / interval) * interval);
    const ticks = Array.from({ length: Math.round(total / interval) + 1 }, (_, index) => index * interval);
    const x = value => Math.max(0, value / total * width);
    const groupColor = group => `timeline-color-${groups.indexOf(group) % 4}`;
    const byId = new Map(schedule.steps.map(step => [step.id, step]));
    const uid = element.id.replace(/[^a-z0-9-]/ig, '') || 'recipe';
    const dependencyText = step => step.dependsOn.length ? step.dependsOn.map(id => byId.get(id)?.title || id).join(', ') : 'None';
    const arrows = schedule.steps.flatMap(step => step.dependsOn.map(id => {
      const dependency = byId.get(id);
      const fromX = x(dependency.end), toX = x(step.start), fromY = positions.get(id) + rowHeight / 2, toY = positions.get(step.id) + rowHeight / 2;
      const elbow = Math.min(width + 10, fromX + 10);
      return `<path data-from="${escapeHtml(id)}" data-to="${escapeHtml(step.id)}" d="M ${fromX} ${fromY} H ${elbow} V ${toY - 24} H ${toX} V ${toY - 17}" marker-end="url(#${uid}-arrow)"/>`;
    })).join('');
    const descriptionFor = step => `${step.title}. ${formatDurationLabel(step.duration)}. ${formatTimerClock(step.start)} to ${formatTimerClock(step.end)}. ${step.attention === 'passive' ? 'Unattended' : step.assignedCook}. Prerequisites: ${dependencyText(step)}. ${step.status}.`;
    element.dataset.timelineZoom = zoom;
    element.innerHTML = `<div class="recipe-timeline-header"><div><span class="timeline-eyebrow">RECIPE PLAN</span><h3>Cooking timeline</h3></div><div class="timeline-estimate"><span>Estimated elapsed</span><strong>${formatDurationLabel(Math.ceil(schedule.duration))}</strong>${options.session ? `<span>Elapsed: ${formatTimerClock(schedule.elapsed)}</span>` : ''}</div></div>
      ${recipe.stepSchemaVersion !== 2 ? '<p class="play-step-meta">Legacy recipe: actions run sequentially until their dependencies are reviewed.</p>' : ''}
      <div class="timeline-toolbar"><div class="timeline-legend"><span><i class="timeline-swatch"></i>Hands-on</span><span><i class="timeline-swatch passive"></i>Unattended</span><span><i class="timeline-legend-arrow" aria-hidden="true">↳</i>Prerequisite</span></div><div class="timeline-zoom" role="group" aria-label="Timeline scale"><button type="button" data-timeline-zoom="overview" aria-pressed="${zoom === 'overview'}">Overview</button><button type="button" data-timeline-zoom="detail" aria-pressed="${zoom === 'detail'}">More detail</button></div></div>
      <div class="timeline-scroll" tabindex="0" role="region" aria-label="Scrollable recipe dependency timeline" aria-describedby="${uid}-hint">
        <div class="timeline-canvas" style="height:${height}px">
          <div class="timeline-time-axis"><div class="timeline-corner">Action <span>${schedule.steps.length} total</span></div><div class="timeline-axis-track">${ticks.map(time => `<span style="left:${time / total * 100}%">${formatTimerClock(time)}</span>`).join('')}</div></div>
          <div class="timeline-grid" aria-hidden="true">${ticks.map(time => `<i style="left:${time / total * 100}%"></i>`).join('')}</div>
          ${headings.map(({ group, top, count }) => `<div class="timeline-group ${groupColor(group)}" style="top:${top}px"><div class="timeline-group-label"><i></i>${escapeHtml(processLabel(group))}</div><span>${count} actions</span></div>`).join('')}
          <svg class="timeline-links" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true"><defs><marker id="${uid}-arrow" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M 0 0 L 8 4 L 0 8 z"/></marker></defs>${arrows}</svg>
          ${schedule.steps.map(step => {
            const assignment = step.attention === 'passive' ? 'Unattended' : step.assignedCook;
            const description = descriptionFor(step);
            const compact = x(step.end - step.start) < 130;
            const duration = formatDurationLabel(step.duration);
            const status = step.status === 'running' ? 'In progress' : step.status === 'completed' ? 'Completed' : assignment;
            return `<div class="timeline-row ${groupColor(step.cook)} ${step.status}" data-timeline-row="${escapeHtml(step.id)}" style="top:${positions.get(step.id)}px">
                <div class="timeline-action-label" title="${escapeHtml(description)}"><span class="timeline-status-dot ${step.status}" aria-hidden="true">${step.status === 'completed' ? '✓' : ''}</span><div><strong>${escapeHtml(step.title)}</strong><small>${escapeHtml(status)} · ${duration}</small></div></div>
                <div class="timeline-bar-row"><button type="button" class="timeline-bar ${step.attention} ${step.status}${compact ? ' compact' : ''}" data-timeline-action="${escapeHtml(step.id)}" style="left:${step.start / total * 100}%;width:${(step.end - step.start) / total * 100}%" aria-pressed="false" aria-label="${escapeHtml(description)}" title="${escapeHtml(description)}">${compact ? '' : `<span>${escapeHtml(step.title)}</span><small>${duration}</small>`}</button>${compact ? `<span class="timeline-bar-duration${step.end / total > .85 ? ' before' : ''}" style="${step.end / total > .85 ? `right:${(1 - step.start / total) * 100}` : `left:${step.end / total * 100}`}%" aria-hidden="true">${duration}</span>` : ''}</div>
              </div>`;
          }).join('')}
          ${options.session ? `<div class="timeline-now-track" aria-hidden="true"><div class="timeline-now" style="left:${Math.min(1, schedule.elapsed / total) * 100}%"><span>Now</span></div></div>` : ''}
        </div>
      </div>
      <p class="timeline-hint" id="${uid}-hint">Select an action to see its timing and prerequisites. Scroll to explore. Estimates follow your experience setting.</p>
      <p class="timeline-selection" role="status"></p>
      <details class="timeline-dependencies" ${detailsOpen ? 'open' : ''}><summary>Action prerequisites and planned times</summary><ol>${schedule.steps.map(step => `<li><strong>${escapeHtml(step.title)}</strong> (${formatTimerClock(step.start)}–${formatTimerClock(step.end)}): ${escapeHtml(dependencyText(step))}</li>`).join('')}</ol></details>`;
    const scroll = element.querySelector('.timeline-scroll');
    scroll.scrollLeft = scrollPosition[0];
    scroll.scrollTop = scrollPosition[1];
    if (scrollFocused) scroll.focus({ preventScroll: true });
    if (summaryFocused) element.querySelector('summary').focus({ preventScroll: true });
    const selectAction = id => {
      const step = byId.get(id);
      if (!step) return;
      element.dataset.selectedAction = id;
      element.querySelector('.timeline-selection').textContent = descriptionFor(step);
      element.querySelectorAll('[data-timeline-action]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.timelineAction === id)));
      element.querySelectorAll('[data-timeline-row]').forEach(row => {
        row.classList.toggle('selected', row.dataset.timelineRow === id);
        row.classList.toggle('prerequisite', step.dependsOn.includes(row.dataset.timelineRow));
      });
      element.querySelectorAll('.timeline-links > path').forEach(path => path.classList.toggle('highlighted', path.dataset.to === id || path.dataset.from === id));
    };
    element.querySelectorAll('[data-timeline-action]').forEach(button => button.addEventListener('click', () => selectAction(button.dataset.timelineAction)));
    element.querySelectorAll('[data-timeline-zoom]').forEach(button => button.addEventListener('click', () => {
      element.dataset.timelineZoom = button.dataset.timelineZoom;
      element.querySelectorAll('[data-timeline-zoom]').forEach(control => control.setAttribute('aria-pressed', String(control === button)));
    }));
    if (selectedId) selectAction(selectedId);
    if (focusId) [...element.querySelectorAll('[data-timeline-action]')].find(button => button.dataset.timelineAction === focusId)?.focus({ preventScroll: true });
    if (zoomFocused) [...element.querySelectorAll('[data-timeline-zoom]')].find(button => button.dataset.timelineZoom === zoomFocused)?.focus({ preventScroll: true });
  } catch (error) {
    element.textContent = `Timeline unavailable: ${error.message}`;
    delete element.dataset.signature;
  }
}
