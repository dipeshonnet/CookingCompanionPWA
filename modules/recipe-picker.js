// Keep recipe IDs in the select used by playback; expose a searchable combobox.
let picker;

export function syncRecipePicker() {
  if (!picker) return;
  const { input, select, close } = picker;
  const label = select.value ? select.selectedOptions[0]?.textContent || '' : '';
  if (document.activeElement !== input || input.dataset.selectedId !== select.value || select.disabled) {
    input.value = label;
    input.dataset.selectedId = select.value;
    close();
  }
  input.disabled = select.disabled;
}

export function setupRecipePicker() {
  const input = document.getElementById('play-recipe-search');
  const select = document.getElementById('play-recipe-select');
  const list = document.getElementById('play-recipe-options');
  let matches = [], active = -1;

  function close() {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    active = -1;
  }

  function highlight(index) {
    active = index;
    [...list.querySelectorAll('[role="option"]')].forEach((option, i) => {
      option.classList.toggle('is-active', i === active);
    });
    const option = list.children[active];
    if (option) {
      input.setAttribute('aria-activedescendant', option.id);
      option.scrollIntoView({ block: 'nearest' });
    } else input.removeAttribute('aria-activedescendant');
  }

  function open(query = '') {
    if (input.disabled) return;
    const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    matches = [...select.options].filter(option => option.value && terms.every(term => option.textContent.toLocaleLowerCase().includes(term)));
    list.replaceChildren();
    for (const [index, match] of matches.entries()) {
      const option = document.createElement('div');
      option.id = `play-recipe-option-${index}`;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', String(match.value === select.value));
      option.textContent = match.textContent;
      option.addEventListener('mousedown', event => event.preventDefault());
      option.addEventListener('click', () => choose(index));
      list.appendChild(option);
    }
    if (!matches.length) {
      const empty = document.createElement('div');
      empty.className = 'recipe-picker-empty';
      empty.setAttribute('role', 'status');
      empty.textContent = 'No matching recipes. Try another name.';
      list.appendChild(empty);
    }
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    highlight(-1);
  }

  function choose(index) {
    const match = matches[index];
    if (!match || input.disabled) return;
    select.value = match.value;
    input.value = match.textContent;
    input.dataset.selectedId = match.value;
    close();
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  input.addEventListener('focus', () => { open(); input.select(); });
  input.addEventListener('click', () => { if (list.hidden) open(); });
  input.addEventListener('input', () => {
    const query = input.value;
    // Typing a new search must not leave the previous recipe ready to play.
    if (select.value) {
      select.value = '';
      input.dataset.selectedId = '';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    open(query);
  });
  input.addEventListener('keydown', event => {
    if (event.isComposing) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (list.hidden) open(input.dataset.selectedId ? '' : input.value);
      if (matches.length) highlight(event.key === 'ArrowDown' ? (active + 1) % matches.length : (active <= 0 ? matches.length - 1 : active - 1));
    } else if (event.key === 'Enter' && !list.hidden) {
      event.preventDefault();
      choose(active < 0 ? 0 : active);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'Tab') close();
  });
  input.addEventListener('blur', () => {
    close();
    input.value = select.value ? select.selectedOptions[0]?.textContent || '' : '';
  });
  picker = { input, select, close };
  syncRecipePicker();
}
