/* scripts/apps.js — offline apps store (load/import/add/save/export shared JSON) */
/* nav update: 2025-02-14 – support unified nav/offline notices */
const AppsStore = (() => {
  const STORAGE_KEY = 'userApps';
  const SHARED_JSON_PATH = './Applications/JSON/app.json';
  const isFileProtocol = typeof window !== 'undefined' && window.location && window.location.protocol === 'file:';

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
    apps = normalize(parsed.apps);
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
    apps.push({ key, label, href, icon: icon || '', action: normalizedAction });
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
    apps = normalize(list);
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
/* Applications grid enhancements (search + rendering)                 */
/* ------------------------------------------------------------------ */
(function(){
  const SEARCH_DEBOUNCE_MS = 80;
  const state = {
    apps: [],
    searchTerm: '',
    eventsBound: false,
    searchInput: null,
    controlsReady: false,
    tiles: new Map(),
    appLookup: new Map()
  };

  const BLANK_ICON_SRC = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

  function init(){
    const grid = document.getElementById('apps-grid');
    if(!grid) return;
    setupControls();
    overrideRenderer();
  }

  function setupControls(){
    if(state.controlsReady) return;
    state.controlsReady = true;
    state.searchInput = document.getElementById('apps-search');

    if(state.searchInput){
      const handler = debounce(value => {
        state.searchTerm = (value || '').trim();
        renderTiles();
      }, SEARCH_DEBOUNCE_MS);
      state.searchInput.addEventListener('input', event => handler(event.target.value));
    }
  }

  function overrideRenderer(){
    const customRender = () => {
      const grid = document.getElementById('apps-grid');
      if(!grid) return;

      const store = window.AppsStore;
      let apps = (store?.getAll && store.getAll()) || [];
      const status = store?.getStatus?.() || {};
      const errorBox = document.getElementById('apps-error');
      const errorMsg = document.getElementById('apps-error-message');

      if(errorBox){
        if(status.error){
          errorBox.hidden = false;
          if(errorMsg) errorMsg.textContent = status.error;
        }else{
          errorBox.hidden = true;
        }
      }

      if(!apps.length) apps = window.Apps || [];
      state.apps = Array.isArray(apps) ? apps.slice() : [];
      renderTiles({ sync:true });
    };

    window.renderApps = customRender;
    customRender();
  }

  function renderTiles(options = {}){
    const grid = document.getElementById('apps-grid');
    if(!grid) return;

    if(options.sync) syncTiles(grid);

    const visibleCount = applySearchFilter(grid);
    grid.classList.toggle('is-empty', visibleCount === 0);
  }

  function syncTiles(grid){
    const apps = Array.isArray(state.apps) ? state.apps : [];
    const fragment = document.createDocumentFragment();
    const seen = new Set();
    const lookup = new Map();

    apps.forEach(app => {
      const key = getAppKey(app);
      lookup.set(key, app);
      let tile = state.tiles.get(key);
      if(!tile){
        tile = buildTile(app);
        state.tiles.set(key, tile);
      }else{
        updateTile(tile, app);
      }
      fragment.appendChild(tile);
      seen.add(key);
    });

    state.tiles.forEach((tile, key) => {
      if(!seen.has(key)){
        tile.remove();
        state.tiles.delete(key);
      }
    });

    grid.innerHTML = '';
    grid.appendChild(fragment);
    state.appLookup = lookup;
    bindTileEvents(grid);
  }

  function applySearchFilter(grid){
    const query = (state.searchTerm || '').toLowerCase();
    let visibleCount = 0;

    state.tiles.forEach((tile, key) => {
      const app = state.appLookup.get(key) || {};
      const matches = matchesQuery(app, query);
      tile.classList.toggle('is-hidden', !matches);
      if(matches) visibleCount++;
    });

    updateGridMetrics(grid, visibleCount);
    return visibleCount;
  }

  function buildTile(app = {}){
    const el = document.createElement('a');
    el.className = 'app-tile';
    el.setAttribute('role', 'gridcell');
    el.target = '_self';
    el.rel = 'noopener';
    el.href = '#';

    const iconWrap = document.createElement('span');
    iconWrap.className = 'app-icon-wrap';
    iconWrap.appendChild(buildIcon(app));

    const labelEl = document.createElement('span');
    labelEl.className = 'app-label';

    el.append(iconWrap, labelEl);
    updateTile(el, app);
    return el;
  }

  function updateTile(tile, app = {}){
    const action = normalizeAction(app);
    const label = app.label || 'Application';
    const key = getAppKey(app);
    const ariaLabel = action.ariaLabel || `Open ${label}`;
    const title = action.title || label;

    tile.dataset.key = key;
    tile.setAttribute('aria-label', ariaLabel);
    tile.title = title;

    applyActionAttributes(tile, action);

    const labelEl = tile.querySelector('.app-label');
    if(labelEl) labelEl.textContent = label;

    const iconWrap = tile.querySelector('.app-icon-wrap');
    if(iconWrap){
      let img = iconWrap.querySelector('.app-icon');
      const nextSrc = resolveIconSrc(app.icon);
      if(!img){
        img = buildIcon(app);
        iconWrap.innerHTML = '';
        iconWrap.appendChild(img);
      }else if(img.getAttribute('src') !== nextSrc){
        img.src = nextSrc;
      }
    }
  }

  function applyActionAttributes(tile, action){
    tile.removeAttribute('data-action');
    tile.removeAttribute('data-path');
    tile.removeAttribute('data-rel');
    tile.removeAttribute('data-modal-id');
    tile.removeAttribute('aria-disabled');
    tile.classList.remove('is-disabled');

    tile.target = action.target || '_self';
    tile.rel = action.rel || 'noopener';

    let href = action.url || '#';

    if(action.type === 'local'){
      href = action.path || action.relPath || href || '#';
      tile.target = '_self';
      tile.rel = 'noopener';
      tile.dataset.action = 'local';
      if(action.path) tile.dataset.path = action.path;
      if(action.relPath) tile.dataset.rel = action.relPath;
    }else if(action.type === 'modal'){
      href = '#';
      tile.target = '_self';
      tile.rel = 'noopener';
      tile.dataset.action = 'modal';
      if(action.modalId) tile.dataset.modalId = action.modalId;
    }else if(action.type === 'disabled'){
      href = '#';
      tile.target = '_self';
      tile.rel = 'noopener';
      tile.dataset.action = 'disabled';
      tile.setAttribute('aria-disabled', 'true');
      tile.classList.add('is-disabled');
    }

    tile.href = href || '#';
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

  function resolveIconSrc(iconPath){
    const icon = (iconPath || '').trim();
    if(!icon) return BLANK_ICON_SRC;
    const direct = /^(data:|https?:|\.\.?\/)/i.test(icon);
    return direct ? icon : `./lib/assets/images/icons/${icon}`;
  }

  function getAppKey(app = {}){
    if(app.key) return app.key;
    const label = app.label || 'application';
    return label.toLowerCase().replace(/\s+/g,'-');
  }

  function matchesQuery(app = {}, query = ''){
    if(!query) return true;
    const haystack = [];
    if(app.label) haystack.push(String(app.label));
    if(app.key) haystack.push(String(app.key));
    const tags = app.tags;
    if(Array.isArray(tags)) haystack.push(...tags.map(tag => String(tag)));
    else if(typeof tags === 'string') haystack.push(tags);
    return haystack.some(value => value && value.toLowerCase().includes(query));
  }

  function normalizeAction(app = {}){
    const type = app.action?.type || 'link';
    const label = app.label || 'Application';
    const fallbackUrl = app.action?.url || app.href || `https://placeholder.local/${app.key || 'app'}`;
    return {
      type,
      url: fallbackUrl,
      target: app.action?.target || '_self',
      rel: app.action?.rel || 'noopener',
      ariaLabel: app.action?.ariaLabel || `Open ${label}`,
      title: app.action?.title || label,
      path: app.action?.path || app.href || '',
      relPath: app.action?.relPath || '',
      modalId: app.action?.modalId || null
    };
  }

  function bindTileEvents(grid){
    if(state.eventsBound){
      return;
    }
    grid.addEventListener('click', event => {
      const target = event.target.closest('.app-tile[data-action]');
      if(!target) return;
      const action = target.dataset.action;
      if(action === 'disabled'){
        event.preventDefault();
        return;
      }
      if(action === 'local'){
        event.preventDefault();
        const abs = target.dataset.path || '';
        const rel = target.dataset.rel || '';
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
        const modalId = target.dataset.modalId || '';
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
    state.eventsBound = true;
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

  function debounce(fn, wait){
    let timer = null;
    return function(value){
      if(timer) clearTimeout(timer);
      timer = setTimeout(() => fn.call(this, value), wait);
    };
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init, { once:true });
  }else{
    init();
  }
})();
