import { buildRecipeSchedule } from './play-engine.js';
import { processLabel, formatDurationLabel } from './recipe-domain.js';
import { escapeHtml, formatTimerClock } from './utils.js';

export function renderRecipeTimeline(target, recipe, options = {}) {
  const element = typeof target === 'string' ? document.getElementById(target) : target;
  if (!element) return;
  if (!recipe) { element.innerHTML = ''; delete element.dataset.signature; return; }
  try {
    const schedule = buildRecipeSchedule(recipe, options);
    const signature = JSON.stringify([recipe.id, schedule.steps.map(s => [s.id, s.title, s.start, s.end, s.status, s.assignedCook, s.dependsOn]), Math.floor(schedule.elapsed)]);
    if (element.dataset.signature === signature) return;
    const focusId = element.contains(document.activeElement) ? document.activeElement.dataset.timelineAction : null;
    const oldScroll = element.querySelector('.timeline-scroll');
    const scrollPosition = [oldScroll?.scrollLeft || 0, oldScroll?.scrollTop || 0];
    const scrollFocused = document.activeElement === oldScroll;
    const detailsOpen = element.querySelector('details')?.open;
    const summaryFocused = document.activeElement === element.querySelector('summary');
    const selection = element.querySelector('.timeline-selection')?.textContent || '';
    element.dataset.signature = signature;
    const groups = [...new Set(schedule.steps.map(step => step.cook))].sort((a, b) => Number(a.split(' ')[1]) - Number(b.split(' ')[1]));
    let row = 1;
    const positions = new Map(), headings = [];
    for (const group of groups) {
      headings.push({ group, row: row++ });
      for (const step of schedule.steps.filter(step => step.cook === group)) positions.set(step.id, row++);
    }
    const height = row * 46, width = 760, total = Math.max(1, schedule.duration);
    const x = value => Math.max(0, value / total * width);
    const byId = new Map(schedule.steps.map(step => [step.id, step]));
    const uid = element.id.replace(/[^a-z0-9-]/ig, '') || 'recipe';
    const dependencyText = step => step.dependsOn.length ? step.dependsOn.map(id => byId.get(id)?.title || id).join(', ') : 'None';
    const arrows = schedule.steps.flatMap(step => step.dependsOn.map(id => {
      const dependency = byId.get(id);
      const fromX = x(dependency.end), toX = x(step.start), fromY = positions.get(id) * 46 + 20, toY = positions.get(step.id) * 46 + 20;
      const elbow = Math.min(width, fromX + 6);
      return `<path d="M ${fromX} ${fromY} H ${elbow} V ${toY} H ${toX}" marker-end="url(#${uid}-arrow)"/>`;
    })).join('');
    element.innerHTML = `<div class="recipe-timeline-header"><h3>Cooking timeline</h3><span>Estimated elapsed: <strong>${formatDurationLabel(Math.ceil(schedule.duration))}</strong>${options.session ? ` · Elapsed: ${formatTimerClock(schedule.elapsed)}` : ''}</span></div>
      ${recipe.stepSchemaVersion !== 2 ? '<p class="play-step-meta">Legacy recipe: actions run sequentially until their dependencies are reviewed.</p>' : ''}
      <p class="timeline-legend">Solid: hands-on · Striped: unattended · Arrows: prerequisites · Estimates follow your experience setting.</p>
      <div class="timeline-scroll" tabindex="0" role="region" aria-label="Scrollable recipe dependency timeline">
        <div class="timeline-canvas" style="height:${height}px">
          <div class="timeline-time-axis"><span>0:00</span><span>${formatTimerClock(total / 2)}</span><span>${formatTimerClock(total)}</span></div>
          ${headings.map(({ group, row }) => `<div class="timeline-group" style="top:${row * 46}px">${escapeHtml(processLabel(group))}</div>`).join('')}
          <svg class="timeline-links" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true"><defs><marker id="${uid}-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 8 4 L 0 8 z"/></marker></defs>${arrows}</svg>
          ${schedule.steps.map(step => {
            const assignment = step.attention === 'passive' ? 'Unattended' : step.assignedCook;
            const description = `${step.title}. ${formatDurationLabel(step.duration)}. ${formatTimerClock(step.start)} to ${formatTimerClock(step.end)}. ${assignment}. Prerequisites: ${dependencyText(step)}. ${step.status}.`;
            return `<div class="timeline-action-label" style="top:${positions.get(step.id) * 46}px" title="${escapeHtml(description)}"><strong>${escapeHtml(step.title)}</strong><small>${escapeHtml(assignment)} · ${formatDurationLabel(step.duration)}</small></div>
              <div class="timeline-bar-row" style="top:${positions.get(step.id) * 46}px"><button type="button" class="timeline-bar ${step.attention} ${step.status}" data-timeline-action="${escapeHtml(step.id)}" style="left:${step.start / total * 100}%;width:${Math.max(0.7, (step.end - step.start) / total * 100)}%" aria-label="${escapeHtml(description)}" title="${escapeHtml(description)}">${escapeHtml(step.title)}</button></div>`;
          }).join('')}
          ${options.session ? `<div class="timeline-now" style="left:calc(220px + ${Math.min(1, schedule.elapsed / total) * 100}% - ${Math.min(1, schedule.elapsed / total) * 240}px)" aria-hidden="true"></div>` : ''}
        </div>
      </div>
      <p class="timeline-selection" role="status">${escapeHtml(selection)}</p>
      <details class="timeline-dependencies" ${detailsOpen ? 'open' : ''}><summary>Action prerequisites and planned times</summary><ol>${schedule.steps.map(step => `<li><strong>${escapeHtml(step.title)}</strong> (${formatTimerClock(step.start)}–${formatTimerClock(step.end)}): ${escapeHtml(dependencyText(step))}</li>`).join('')}</ol></details>`;
    const scroll = element.querySelector('.timeline-scroll');
    scroll.scrollLeft = scrollPosition[0];
    scroll.scrollTop = scrollPosition[1];
    if (scrollFocused) scroll.focus({ preventScroll: true });
    if (summaryFocused) element.querySelector('summary').focus({ preventScroll: true });
    element.querySelectorAll('[data-timeline-action]').forEach(button => button.addEventListener('click', () => {
      element.querySelector('.timeline-selection').textContent = button.getAttribute('aria-label');
    }));
    if (focusId) [...element.querySelectorAll('[data-timeline-action]')].find(button => button.dataset.timelineAction === focusId)?.focus({ preventScroll: true });
  } catch (error) {
    element.textContent = `Timeline unavailable: ${error.message}`;
    delete element.dataset.signature;
  }
}
