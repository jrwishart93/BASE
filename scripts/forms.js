/* scripts/forms.js — Forms Hub with icon launchers */
(function(){
  const REGISTRY_PATH = './lib/assets/forms/forms.json';
  const STORAGE_KEYS = { pins: 'forms.pins', recent: 'forms.recent' };

  const LEGACY_PATHS = {
    'antecedents': {
      abs: '',
      rel: './lib/assets/forms/antecedents.html'
    },
    'locus': {
      abs: '',
      rel: './lib/assets/forms/locus.html'
    },
    'drug-driving': {
      abs: '',
      rel: './lib/assets/forms/drug-driving.html'
    },
    'no-insurance': {
      abs: '',
      rel: './lib/assets/forms/insurance.html'
    },
    'no-mot': {
      abs: '',
      rel: './lib/assets/forms/mot.html'
    }
  };

  const state = {
    forms: [],
    query: '',
    pins: new Set(),
    recent: [],
    map: new Map()
  };

  const els = {};

  document.addEventListener('DOMContentLoaded', init);

  async function init(){
    cacheElements();
    loadStorage();
    await loadRegistry();
    bindUI();
    render();
  }

  function cacheElements(){
    els.grid = document.getElementById('forms-grid');
    els.empty = document.getElementById('forms-empty');
    els.error = document.getElementById('forms-error');
    els.search = document.getElementById('forms-search');
    if(els.search){
      els.search.value = '';
    }
  }

  function loadStorage(){
    state.pins = new Set(readStorageArray(STORAGE_KEYS.pins));
    state.recent = readStorageArray(STORAGE_KEYS.recent)
      .filter(entry => entry && typeof entry.id === 'string');
  }

  function readStorageArray(key){
    try{
      const raw = localStorage.getItem(key);
      if(!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }catch(err){
      console.warn('Unable to read localStorage key', key, err);
      return [];
    }
  }

  async function loadRegistry(){
    try{
      const response = await fetch(REGISTRY_PATH, { cache: 'no-store' });
      if(!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const items = Array.isArray(data?.forms) ? data.forms : [];
      state.forms = items.map(normalizeForm).filter(f => f.id);
      state.map = new Map(state.forms.map(f => [f.id, f]));
      setError('');
    }catch(err){
      state.forms = [];
      state.map.clear();
      setError('Could not load forms registry. Check the file is available locally.');
      console.warn('forms.json could not be loaded', err);
    }
  }

  function normalizeForm(entry){
    const id = String(entry?.id || '').trim();
    const title = String(entry?.title || '').trim() || id;
    const desc = String(entry?.desc || '').trim();
    const icon = String(entry?.icon || '').trim();
    const href = String(entry?.href || '').trim();
    const hrefAbs = String(entry?.hrefAbs || '').trim();
    const search = `${title} ${desc}`.toLowerCase();
    return { id, title, desc, icon, href, hrefAbs, search };
  }

  function bindUI(){
    if(!els.grid) return;
    els.grid.addEventListener('click', handleGridClick);
    if(els.search){
      els.search.addEventListener('input', onSearchInput);
    }
    bindStaticCards();
  }

  function onSearchInput(event){
    state.query = String(event.target.value || '').trim().toLowerCase();
    render();
  }

  function bindStaticCards(){
    document.querySelectorAll('[data-form-link]').forEach(anchor=>{
      anchor.addEventListener('click', event=>{
        const abs = anchor.getAttribute('data-href-abs');
        const rel = anchor.getAttribute('data-href-rel') || anchor.getAttribute('href');
        const id = anchor.getAttribute('data-form-id') || abs || rel || anchor.textContent?.trim() || '';
        event.preventDefault();
        openForm({
          id,
          title: anchor.querySelector('h3')?.textContent?.trim() || id,
          desc: anchor.querySelector('p')?.textContent?.trim() || '',
          hrefAbs: abs || '',
          href: rel || ''
        });
      }, { passive:false });
    });
  }

  function handleGridClick(event){
    const actionEl = event.target.closest('[data-action]');
    if(!actionEl) return;
    const card = actionEl.closest('.form-card');
    if(!card) return;
    const entry = state.map.get(card.dataset.id);
    if(!entry) return;

    const action = actionEl.dataset.action;
    if(action === 'open'){
      openForm(entry);
    }else if(action === 'pin'){
      togglePin(entry.id);
      render();
    }
  }

  function render(){
    if(!els.grid) return;

    const filtered = filterForms();
    const sorted = sortForms(filtered);

    if(!sorted.length){
      els.grid.innerHTML = '';
      setEmptyVisible(true);
      return;
    }

    const markup = sorted.map(entry => renderCard(entry)).join('');
    els.grid.innerHTML = markup;
    setEmptyVisible(false);
  }

  function filterForms(){
    if(!state.query) return state.forms.slice();
    return state.forms.filter(form => form.search.includes(state.query));
  }

  function sortForms(list){
    return list.slice().sort((a, b) => {
      const pinnedA = state.pins.has(a.id);
      const pinnedB = state.pins.has(b.id);
      if(pinnedA && !pinnedB) return -1;
      if(pinnedB && !pinnedA) return 1;
      return a.title.localeCompare(b.title);
    });
  }

  function renderCard(entry){
    const pinned = state.pins.has(entry.id);
    const classes = `card form-card${pinned ? ' is-pinned' : ''}`;
    const pinLabel = pinned ? '★ Pinned' : '☆ Pin';
    const iconMarkup = buildIconMarkup(entry);
    const titleText = entry.title;
    const titleHtml = esc(titleText);
    const descriptionHtml = esc(entry.desc);
    const openLabel = `Open ${titleText}`;

    return `
      <li>
        <article class="${classes}" data-id="${escAttr(entry.id)}">
          <button type="button" class="form-card__icon" data-action="open" aria-label="${escAttr(openLabel)}">
            ${iconMarkup}
          </button>
          <h3 class="form-card__title">${titleHtml}</h3>
          <p class="form-card__desc">${descriptionHtml}</p>
          <div class="form-card__actions">
            <button type="button" class="btn primary" data-action="open">Open</button>
            <button type="button" class="btn ghost" data-action="pin" data-state="${pinned ? 'pinned' : 'unpinned'}">${pinLabel}</button>
          </div>
        </article>
      </li>`;
  }

  function buildIconMarkup(entry){
    if(entry.icon){
      return `<img src="${escAttr(entry.icon)}" alt="">`;
    }
    const fallback = esc((entry.title || '').slice(0, 2).toUpperCase());
    return `<span class="app-fallback">${fallback}</span>`;
  }

  function openForm(entry){
    const id = entry.id;
    if(tryOpenAbsolute(entry.hrefAbs)){
      trackRecent(id);
      return;
    }
    if(tryOpenRelative(entry.href)){
      trackRecent(id);
      return;
    }
    const legacy = LEGACY_PATHS[id];
    if(legacy){
      if(tryOpenAbsolute(legacy.abs)){
        trackRecent(id);
        return;
      }
      if(tryOpenRelative(legacy.rel)){
        trackRecent(id);
        return;
      }
    }
    alert('Unable to open this form. Please confirm the file exists locally.');
  }

  function tryOpenAbsolute(path){
    if(!path) return false;
    const url = toFileUrl(path);
    return openWindow(url);
  }

  function tryOpenRelative(path){
    if(!path) return false;
    return openWindow(path);
  }

  function openWindow(url){
    if(!url) return false;
    try{
      const win = window.open(url, '_blank', 'noopener');
      if(win){
        win.opener = null;
        win.focus?.();
        return true;
      }
    }catch(err){
      console.warn('Unable to open form URL', url, err);
    }
    return false;
  }

  function togglePin(id){
    if(state.pins.has(id)){
      state.pins.delete(id);
    }else{
      state.pins.add(id);
    }
    savePins();
  }

  function savePins(){
    saveStorageArray(STORAGE_KEYS.pins, Array.from(state.pins));
  }

  function trackRecent(id){
    const now = Date.now();
    const filtered = state.recent.filter(entry => entry.id !== id);
    filtered.unshift({ id, ts: now });
    state.recent = filtered.slice(0, 12);
    saveStorageArray(STORAGE_KEYS.recent, state.recent);
  }

  function saveStorageArray(key, value){
    try{
      localStorage.setItem(key, JSON.stringify(value));
    }catch(err){
      console.warn('Unable to write localStorage key', key, err);
    }
  }

  function toFileUrl(absPath){
    if(/^file:\/\//i.test(absPath)) return absPath;
    const normalised = absPath.replace(/\\/g, '/');
    return `file://${encodeURI(normalised)}`;
  }

  function setError(message){
    if(!els.error) return;
    if(!message){
      els.error.hidden = true;
      els.error.textContent = '';
      return;
    }
    els.error.hidden = false;
    els.error.innerHTML = `<strong>Notice:</strong> ${esc(message)}`;
  }

  function setEmptyVisible(show){
    if(!els.empty) return;
    if(show){
      const message = state.forms.length
        ? 'No forms match your search.'
        : 'No forms available right now.';
      els.empty.textContent = message;
      els.empty.hidden = false;
    }else{
      els.empty.hidden = true;
    }
  }

  function esc(str=''){
    return String(str).replace(/[&<>"']/g, ch => (
      ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])
    ));
  }

  function escAttr(str=''){
    return esc(str).replace(/`/g, '&#96;');
  }
})();
