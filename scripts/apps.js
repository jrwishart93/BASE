/* scripts/apps.js — offline apps store (load/import/add/save/export shared JSON) */
/* nav update: 2025-02-14 – support unified nav/offline notices */
const AppsStore = (() => {
  const STORAGE_KEY = 'userApps';
  const SHARED_JSON_PATH = './Applications/JSON/app.json';
  const isFileProtocol = typeof window !== 'undefined' && window.location && window.location.protocol === 'file:';

  const sortApps = (typeof window.sortAppsByName === 'function')
    ? window.sortAppsByName
    : (list = []) => (list || []).slice().sort((a, b) => {
        const nameA = String(a?.label || a?.name || '').toLocaleLowerCase();
        const nameB = String(b?.label || b?.name || '').toLocaleLowerCase();
        return nameA.localeCompare(nameB, undefined, { sensitivity:'base' });
      });

  let apps = [];
  let meta = { version:'', updated:'', updatedBy:'' };
  let status = { source:null, error:null, note:null };
  let loadedFromPicker = false;

  const $ = (s) => document.querySelector(s);

  function normalize(list){
    return (Array.isArray(list) ? list : []).map(a => {
      const label = a.label || 'App';
      const key = a.key || label.toLowerCase().replace(/\s+/g,'-');
      const href = a.href || a.url || '#';
      return {
        key,
        label,
        icon: a.icon || '',
        href,
        action: normalizeAction(a.action, label, key, href)
      };
    });
  }

  function normalizeAction(action, label, key, href){
    if(!action) return defaultLinkAction(label, href, null, key);
    const type = action.type || 'link';
    if(type === 'link'){
      return defaultLinkAction(label, action.url || href, action, key);
    }
    if(type === 'local'){
      return {
        type:'local',
        path: action.path || '',
        relPath: action.relPath || action.rel || '',
        title: action.title || label,
        ariaLabel: action.ariaLabel || `Open ${label}`
      };
    }
    if(type === 'modal'){
      return {
        type:'modal',
        modalId: action.modalId || '',
        title: action.title || label,
        ariaLabel: action.ariaLabel || `Open ${label}`
      };
    }
    if(type === 'disabled'){
      return {
        type:'disabled',
        title: action.title || `${label} coming soon`,
        ariaLabel: action.ariaLabel || `${label} coming soon`
      };
    }
    return defaultLinkAction(label, href, action, key);
  }

  function defaultLinkAction(label, href, existing = null, key = 'app'){
    const target = existing?.target || '_blank';
    const rel = existing?.rel || 'noopener noreferrer';
    const url = href || existing?.url || `https://placeholder.local/${key}`;
    return {
      type:'link',
      url,
      target,
      rel,
      title: existing?.title || label,
      ariaLabel: existing?.ariaLabel || `Open ${label}`
    };
  }

  function parsePayload(payload){
    if(Array.isArray(payload)){
      return { apps: payload, meta:{} };
    }
    if(payload && typeof payload === 'object'){
      const list = Array.isArray(payload.apps) ? payload.apps : Array.isArray(payload.items) ? payload.items : [];
      const metaInfo = payload.meta && typeof payload.meta === 'object' ? payload.meta : payload;
      const info = {
        version: metaInfo.version || '',
        updated: metaInfo.updated || '',
        updatedBy: metaInfo.updatedBy || ''
      };
      return { apps: list, meta: info };
    }
    return { apps: [], meta:{} };
  }

  function applyPayload(payload, source, error = null, note = null){
    const parsed = parsePayload(payload);
    apps = sortApps(normalize(parsed.apps));
    meta = {
      version: parsed.meta.version || '',
      updated: parsed.meta.updated || '',
      updatedBy: parsed.meta.updatedBy || ''
    };
    status = { source, error, note };
    render();
  }

  async function load(options = {}){
    console.log('[AppsStore] load start', { file: isFileProtocol });
    if(isFileProtocol){
      return Promise.resolve(resolveOffline({ note: 'Using offline bundled registry.' }));
    }
    return loadFromNetwork(options);
  }

  async function loadFromNetwork(options = {}){
    const { bustCache = true, silent = false } = options;
    const cacheBuster = bustCache ? `?t=${Date.now()}` : '';
    const warn = $('#apps-file-warning');
    let errorMessage = null;
    try{
      const res = await fetch(`${SHARED_JSON_PATH}${cacheBuster}`, { cache:'no-store' });
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      applyPayload(data, 'shared', null);
      console.log('[AppsStore] load success', { source: 'shared', count: apps.length });
      if(warn) warn.hidden = true;
      loadedFromPicker = false;
      return true;
    }catch(err){
      errorMessage = 'Unable to load Applications/JSON/app.json. Confirm the file exists next to BASE and try Reload links.';
      if(warn && !loadedFromPicker) warn.hidden = false;
      if(!silent) console.error('Shared applications JSON failed', err);
    }
    resolveOffline({ error: errorMessage });
    return false;
  }

  function resolveOffline({ error = null, note = null } = {}){
    const local = loadFromLocal();
    if(local){
      applyPayload(local, 'local', error, 'Using localStorage overrides.');
      console.log('[AppsStore] resolved offline via local', { count: apps.length });
      return true;
    }
    const bundled = getBundledDefaults();
    if(bundled){
      applyPayload(bundled, 'bundled', error, note || 'Using offline bundled registry.');
      console.log('[AppsStore] resolved offline via bundled defaults', { count: apps.length });
      return true;
    }
    applyPayload(window.Apps || [], 'defaults', error, note);
    console.log('[AppsStore] resolved offline via window.Apps', { count: apps.length });
    return false;
  }

  function reload(){
    status.error = null;
    if(isFileProtocol){
      return Promise.resolve(resolveOffline({ note: 'Using offline bundled registry.' }));
    }
    return load({ bustCache:true, silent:false });
  }

  function render(){
    if (typeof renderApps === 'function') renderApps();
    if (typeof renderAppTable === 'function') renderAppTable();
  }

  async function importFromPicker(file){
    if(!file) return;
    try{
      const txt = await file.text();
      const arr = JSON.parse(txt);
      applyPayload(arr, 'picker');
      console.log('[AppsStore] import from picker', { count: apps.length });
      loadedFromPicker = true;
      const warn = $('#apps-file-warning'); if(warn) warn.hidden = true;
      alert('apps.json loaded for this session. Remember to export a new copy when finished.');
    }catch(err){
      alert('Invalid apps.json (expect an object with an "apps" array).');
      console.error('apps.json picker error', err);
    }
  }

  function getAll(){ return apps; }
  function getMeta(){ return { ...meta }; }
  function setMeta(next){
    meta = { ...meta, ...next };
    render();
  }
  function getStatus(){ return { ...status }; }

  function addApp({label, href, icon, action}){
    const key = (label||'app').toLowerCase().replace(/\s+/g,'-');
    const normalizedAction = normalizeAction(action, label, key, href);
    apps = sortApps([ ...apps, { key, label, href, icon: icon || '', action: normalizedAction } ]);
    render();
  }

  function updateApp(index, data){
    if(index < 0 || index >= apps.length) return;
    const current = apps[index];
    const label = data.label ?? current.label;
    const href = data.href ?? current.href;
    const icon = data.icon ?? current.icon;
    const nextAction = data.action ? normalizeAction(data.action, label, current.key, href) : normalizeAction(current.action, label, current.key, href);
    apps[index] = { ...current, label, href, icon, action: nextAction };
    apps = sortApps(apps);
    render();
  }

  function removeAt(index){
    if(index < 0 || index >= apps.length) return;
    apps.splice(index,1);
    render();
  }

  function getPayload(payloadApps = apps){
    return {
      version: meta.version || '',
      updated: meta.updated || '',
      updatedBy: meta.updatedBy || '',
      apps: JSON.parse(JSON.stringify(payloadApps || []))
    };
  }

  function validate(list = apps){
    const errors = [];
    (list || []).forEach((app, idx) => {
      const label = app.label || `App ${idx+1}`;
      if(!label || !label.trim()) errors.push(`Row ${idx+1}: missing name/label.`);
      if(!(app.icon && app.icon.trim())) errors.push(`${label}: missing icon path.`);
      const url = getEffectiveUrl(app);
      if(!url) errors.push(`${label}: missing link or action URL.`);
    });
    return { valid: errors.length === 0, errors };
  }

  function getEffectiveUrl(app){
    if(app.action?.type === 'link') return app.action.url || '';
    if(app.action?.type === 'local') return app.action.path || app.action.relPath || '';
    if(app.action?.type === 'modal') return app.action.modalId || '';
    if(app.href) return app.href;
    return '';
  }

  function exportBundles(list){
    console.log('[AppsStore] export requested');
    const working = list ? normalize(list) : apps.slice();
    const validation = validate(working);
    if(!validation.valid){
      console.warn('[AppsStore] export validation failed', validation.errors);
      return { ok:false, errors: validation.errors };
    }
    const payload = getPayload(working);
    const nowIso = new Date().toISOString();
    let metaChanged = false;
    if(!payload.updated){
      payload.updated = nowIso;
      meta.updated = payload.updated;
      metaChanged = true;
    }
    if(!payload.version){
      payload.version = `v${nowIso.slice(0,10).replace(/-/g,'.')}`;
      meta.version = payload.version;
      metaChanged = true;
    }
    if(metaChanged) render();
    const stamp = nowIso.replace(/[:.]/g,'-');
    downloadJSONFile(`app-links-${stamp}.json`, payload);
    downloadRegistryJS(`app-registry-${stamp}.js`, payload);
    return { ok:true };
  }

  function downloadJSONFile(filename, data){
    downloadBlob(filename, JSON.stringify(data, null, 2), 'application/json');
  }

  function downloadRegistryJS(filename, payload){
    const metaBlock = {
      version: payload.version || '',
      updated: payload.updated || '',
      updatedBy: payload.updatedBy || ''
    };
    const js = `window.DEFAULT_APPS_META = ${JSON.stringify(metaBlock, null, 2)};\n\n` +
      `window.DEFAULT_APPS = ${JSON.stringify(payload.apps, null, 2)};\n`;
    downloadBlob(filename, js, 'application/javascript');
  }

  function downloadBlob(filename, contents, mime)
  {
    const blob = new Blob([contents], {type: mime || 'application/octet-stream'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 0);
  }

  function saveToLocal(list = apps){
    try{
      const payload = getPayload(list);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      status = { source:'local', error:null, note:'Using localStorage overrides.' };
      render();
      console.log('[AppsStore] saved to localStorage', { count: payload.apps.length });
      return true;
    }catch(err){
      console.warn('Unable to save userApps', err);
      return false;
    }
  }

  function loadFromLocal(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return null;
      return JSON.parse(raw);
    }catch(err){
      console.warn('Invalid userApps data', err);
      return null;
    }
  }

  function getBundledDefaults(){
    if(Array.isArray(window.DEFAULT_APPS)){
      return {
        apps: JSON.parse(JSON.stringify(window.DEFAULT_APPS)),
        meta: {
          version: window.DEFAULT_APPS_META?.version || '',
          updated: window.DEFAULT_APPS_META?.updated || '',
          updatedBy: window.DEFAULT_APPS_META?.updatedBy || ''
        }
      };
    }
    if(window.DEFAULT_APPS && typeof window.DEFAULT_APPS === 'object'){
      return parsePayload(window.DEFAULT_APPS);
    }
    return null;
  }

  function setAll(list, options = {}){
    apps = sortApps(normalize(list));
    if(!options.silent){
      console.log('[AppsStore] setAll', { count: apps.length });
      render();
    }
  }

  return {
    load,
    reload,
    render,
    importFromPicker,
    getAll,
    getMeta,
    setMeta,
    getStatus,
    addApp,
    updateApp,
    removeAt,
    getPayload,
    validate,
    exportBundles,
    saveToLocal,
    setAll,
    isFileProtocol: () => isFileProtocol
  };
})();
window.AppsStore = AppsStore;

/* ------------------------------------------------------------------ */
/* Applications grid hydration (single render + search filtering)      */
/* ------------------------------------------------------------------ */
(function(){
  const BLANK_ICON_SRC = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
  const state = {
    grid: null,
    entries: [],
    searchTerm: '',
    searchInput: null
  };

  const sortApps = (typeof window.sortAppsByName === 'function')
    ? window.sortAppsByName
    : (list = []) => (list || []).slice().sort((a, b) => {
        const nameA = String(a?.label || a?.name || '').toLocaleLowerCase();
        const nameB = String(b?.label || b?.name || '').toLocaleLowerCase();
        return nameA.localeCompare(nameB, undefined, { sensitivity:'base' });
      });

  function init(){
    const grid = document.getElementById('apps-grid');
    if(!grid) return;
    state.grid = grid;
    bindSearch();
    installRenderer();
  }

  function bindSearch(){
    const input = document.getElementById('apps-search');
    state.searchInput = input || null;
    if(!input) return;
    input.addEventListener('input', event => {
      state.searchTerm = ((event.target.value || '').trim()).toLowerCase();
      applySearch();
    });
  }

  function installRenderer(){
    function renderApps(){
      console.log('renderApps');
      if(window.BASE?.appsRendered) return;
      const hydrated = hydrateGrid();
      if(hydrated){
        window.BASE = window.BASE || {};
        window.BASE.appsRendered = true;
      }
    }

    window.renderApps = renderApps;
    renderApps();
  }

  function hydrateGrid(){
    const grid = state.grid || document.getElementById('apps-grid');
    if(!grid || grid.dataset.hydrated === 'true') return false;

    const store = window.AppsStore;
    let apps = (store?.getAll && store.getAll()) || [];
    const status = store?.getStatus?.() || {};
    syncErrorState(status);

    if(!apps.length) apps = window.Apps || [];

    apps = sortApps(apps);

    const fragment = document.createDocumentFragment();
    const entries = [];

    apps.forEach(app => {
      const tile = buildTile(app);
      fragment.appendChild(tile);
      entries.push({
        key: getAppKey(app),
        element: tile,
        terms: buildSearchTerms(app)
      });
    });

    grid.replaceChildren(fragment);
    grid.dataset.hydrated = 'true';
    state.entries = entries;

    bindTileEvents(grid);
    applySearch();
    return true;
  }

  function syncErrorState(status){
    const errorBox = document.getElementById('apps-error');
    const errorMsg = document.getElementById('apps-error-message');
    if(!errorBox) return;
    if(status?.error){
      errorBox.hidden = false;
      if(errorMsg) errorMsg.textContent = status.error;
    }else{
      errorBox.hidden = true;
    }
  }

  function buildTile(app = {}){
    const action = normalizeAction(app);
    const tile = document.createElement('a');
    tile.className = 'app-tile';
    tile.setAttribute('role', 'gridcell');
    tile.href = action.url || '#';
    tile.target = '_self';
    tile.rel = 'noopener';
    tile.dataset.key = getAppKey(app);
    tile.setAttribute('aria-label', action.ariaLabel || `Open ${app.label || 'application'}`);
    tile.title = action.title || app.label || '';

    const iconWrap = document.createElement('span');
    iconWrap.className = 'app-icon-wrap';
    iconWrap.appendChild(buildIcon(app));

    const labelEl = document.createElement('span');
    labelEl.className = 'app-label';
    labelEl.textContent = app.label || '';

    tile.append(iconWrap, labelEl);
    applyActionAttributes(tile, action);
    return tile;
  }

  function buildIcon(app = {}){
    const img = document.createElement('img');
    img.className = 'app-icon';
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.width = 56;
    img.height = 56;
    img.src = resolveIconSrc(app.icon);
    return img;
  }

  function applyActionAttributes(tile, action){
    tile.removeAttribute('data-action');
    tile.removeAttribute('data-path');
    tile.removeAttribute('data-rel');
    tile.removeAttribute('data-modal-id');
    tile.removeAttribute('aria-disabled');
    tile.classList.remove('is-disabled');

    if(action.type === 'local'){
      tile.href = action.path || action.relPath || '#';
      tile.dataset.action = 'local';
      if(action.path) tile.dataset.path = action.path;
      if(action.relPath) tile.dataset.rel = action.relPath;
    }else if(action.type === 'modal'){
      tile.href = '#';
      tile.dataset.action = 'modal';
      if(action.modalId) tile.dataset.modalId = action.modalId;
    }else if(action.type === 'disabled'){
      tile.href = '#';
      tile.dataset.action = 'disabled';
      tile.setAttribute('aria-disabled', 'true');
      tile.classList.add('is-disabled');
    }else{
      tile.href = action.url || '#';
    }
  }

  function normalizeAction(app = {}){
    const type = app.action?.type || 'link';
    const label = app.label || 'Application';
    const fallbackUrl = app.action?.url || app.href || `https://placeholder.local/${app.key || 'app'}`;
    return {
      type,
      url: fallbackUrl,
      ariaLabel: app.action?.ariaLabel || `Open ${label}`,
      title: app.action?.title || label,
      path: app.action?.path || app.href || '',
      relPath: app.action?.relPath || '',
      modalId: app.action?.modalId || null
    };
  }

  function resolveIconSrc(iconPath){
    const icon = (iconPath || '').trim();
    if(!icon) return BLANK_ICON_SRC;
    const direct = /^(data:|https?:|\.\.?\/)/i.test(icon);
    return direct ? icon : `./lib/assets/images/icons/${icon}`;
  }

  function bindTileEvents(grid){
    if(grid.dataset.boundAppEvents === 'true') return;
    grid.addEventListener('click', event => {
      const tile = event.target.closest('.app-tile[data-action]');
      if(!tile) return;
      const action = tile.dataset.action;
      if(action === 'disabled'){
        event.preventDefault();
        return;
      }
      if(action === 'local'){
        event.preventDefault();
        const abs = tile.dataset.path || '';
        const rel = tile.dataset.rel || '';
        if(typeof window.openLocal === 'function'){
          if(!window.openLocal(abs, rel)){
            alert('Unable to open this application. Please verify the local path.');
          }
        }else if(abs || rel){
          window.open(abs || rel, '_blank', 'noopener');
        }
      }
      if(action === 'modal'){
        event.preventDefault();
        const modalId = tile.dataset.modalId || '';
        if(typeof window.triggerModal === 'function'){
          window.triggerModal(modalId);
        }else if(modalId){
          const modal = document.getElementById(modalId);
          if(modal){
            modal.hidden = false;
            modal.focus?.();
          }
        }
      }
    });
    grid.dataset.boundAppEvents = 'true';
  }

  function applySearch(){
    const grid = state.grid || document.getElementById('apps-grid');
    if(!grid) return 0;
    const query = state.searchTerm;
    let visible = 0;
    state.entries.forEach(entry => {
      const matches = !query || entry.terms.some(term => term.includes(query));
      entry.element.classList.toggle('is-hidden', !matches);
      if(matches) visible++;
    });
    updateGridMetrics(grid, visible);
    grid.classList.toggle('is-empty', visible === 0 && state.entries.length > 0);
    return visible;
  }

  function buildSearchTerms(app = {}){
    const terms = [];
    if(app.label) terms.push(String(app.label).toLowerCase());
    if(app.key) terms.push(String(app.key).toLowerCase());
    const tags = app.tags;
    if(Array.isArray(tags)) terms.push(...tags.map(tag => String(tag).toLowerCase()));
    else if(typeof tags === 'string') terms.push(String(tags).toLowerCase());
    return terms;
  }

  function getAppKey(app = {}){
    if(app.key) return app.key;
    const label = app.label || 'application';
    return label.toLowerCase().replace(/\s+/g, '-');
  }

  function updateGridMetrics(grid, count){
    if(!grid) return;
    const columns = getColumnCount(grid);
    if(columns){
      grid.setAttribute('aria-colcount', String(columns));
      const rows = count ? Math.ceil(count / columns) : 0;
      grid.setAttribute('aria-rowcount', String(rows));
    }else{
      grid.removeAttribute('aria-colcount');
      grid.removeAttribute('aria-rowcount');
    }
  }

  function getColumnCount(grid){
    try{
      const styles = window.getComputedStyle(grid);
      const template = styles.gridTemplateColumns;
      if(!template || template === 'none') return null;
      if(/repeat\(\s*\d+/i.test(template)){
        const match = template.match(/repeat\(\s*(\d+)/i);
        if(match){
          const value = parseInt(match[1], 10);
          if(Number.isFinite(value) && value > 0) return value;
        }
      }
      const cols = template.trim().split(/\s+/).filter(Boolean).length;
      return cols || null;
    }catch(_){
      return null;
    }
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init, { once:true });
  }else{
    init();
  }
})();

