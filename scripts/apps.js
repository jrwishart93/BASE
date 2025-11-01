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
