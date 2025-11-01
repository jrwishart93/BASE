/* scripts/main.js — unified startup, renderers, modal flow */
/* nav update: 2025-02-14 – unified site header + admin tooling */
const $ = s => document.querySelector(s);
const escapeHTML = (str='') => String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const isFileProtocol = typeof window !== 'undefined' && window.location && window.location.protocol === 'file:';

if (typeof window.openLocal !== 'function') {
  window.openLocal = function(absPath, relPath){
    try{
      if(absPath){
        const url = absPath.startsWith('file://') ? absPath : `file://${absPath}`;
        const win = window.open(url, '_blank', 'noopener');
        if(win){ win.opener = null; win.focus?.(); return true; }
      }
    }catch(err){
      console.warn('Unable to open absolute path', err);
    }
    if(relPath){
      try{
        const win = window.open(relPath, '_blank', 'noopener');
        if(win){ win.opener = null; win.focus?.(); return true; }
      }catch(err){
        console.warn('Unable to open relative path', err);
      }
    }
    return false;
  };
}

let editingAppKey = null;
let appsModel = [];
let appsModelSynced = false;
let appsSourceLabel = '';
let appsTableEventsBound = false;
const APPS_SOURCE_LABELS = {
  shared: 'Shared registry',
  local: 'Local override',
  bundled: 'Bundled defaults',
  defaults: 'Built-in list',
  picker: 'Imported file'
};

/* Recoveries */
function renderRecoveries(){
  const wrap = $('#recover-grid'); if(!wrap) return;
  wrap.innerHTML = (window.RecentRecoveries || []).map(r => `
    <article class="recover">
      <div class="meta">${r.meta}</div>
      <h4>${r.title}</h4>
      <span class="tag">${r.tag}</span>
    </article>
  `).join('');
}

/* Apps */
function renderApps(){
  const grid = document.getElementById('apps-grid'); if(!grid) return;
  const store = window.AppsStore;
  let apps = (store?.getAll && store.getAll()) || [];
  const status = store?.getStatus?.() || {};
  const meta = store?.getMeta?.() || {};
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
  updateMetaFooter(meta);
  if(!apps.length) apps = window.Apps || [];
  const isFull = grid.dataset.full === 'true';
  const list = isFull ? apps : apps.slice(0, 9);
  const esc = (str='') => String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const escAttr = (str='') => esc(String(str));
  const placeholderUrl = key => `https://placeholder.local/${key || 'app'}`;

  const markup = list.map(app => {
    const iconMarkup = buildIconMarkup(app);
    const action = normalizeAction(app);
    return buildTileMarkup(app, iconMarkup, action);
  }).join('');

  grid.innerHTML = markup;
  bindAppTileEvents(grid);

  function buildIconMarkup(app){
    const icon = app.icon || '';
    if(icon){
      const direct = icon.startsWith('data:') || icon.startsWith('http') || icon.startsWith('./') || icon.startsWith('../');
      const iconSrc = direct ? icon : `./lib/assets/images/icons/${icon}`;
      return `<span class="icon-ring"><img src="${esc(iconSrc)}" alt="" class="icon-img" loading="lazy" decoding="async"></span>`;
    }
    return `<span class="icon-ring"><span class="icon-fallback">${esc((app.label||'?').slice(0,2))}</span></span>`;
  }

  function normalizeAction(app){
    const type = app.action?.type || 'link';
    const label = app.label || 'Application';
    const fallbackUrl = app.action?.url || app.href || placeholderUrl(app.key);
    return {
      type,
      url: fallbackUrl,
      target: app.action?.target || '_blank',
      rel: app.action?.rel || 'noopener noreferrer',
      ariaLabel: app.action?.ariaLabel || `Open ${label}`,
      title: app.action?.title || label,
      path: app.action?.path || app.href || '',
      relPath: app.action?.relPath || '',
      modalId: app.action?.modalId || null
    };
  }

  function buildTileMarkup(app, iconMarkup, action){
    const key = escAttr(app.key || 'app');
    const aria = escAttr(action.ariaLabel || `Open ${app.label || 'application'}`);
    const title = escAttr(action.title || app.label || 'Application');
    if(action.type === 'link'){
      const url = escAttr(action.url);
      const target = escAttr(action.target || '_blank');
      const relAttr = escAttr(action.rel || 'noopener noreferrer');
      return `
        <a class="icon-btn" href="${url}" target="${target}" rel="${relAttr}" data-key="${key}" role="gridcell" aria-label="${aria}" title="${title}">
          ${iconMarkup}
          <span class="icon-label">${esc(app.label || '')}</span>
        </a>`;
    }

    if(action.type === 'local'){
      const abs = escAttr(action.path || '');
      const relPath = escAttr(action.relPath || '');
      return `
        <button type="button" class="icon-btn" data-key="${key}" role="gridcell" data-action="local" data-path="${abs}" data-rel="${relPath}" aria-label="${aria}" title="${title}">
          ${iconMarkup}
          <span class="icon-label">${esc(app.label || '')}</span>
        </button>`;
    }

    if(action.type === 'modal'){
      const modalId = escAttr(action.modalId || '');
      return `
        <button type="button" class="icon-btn" data-key="${key}" role="gridcell" data-action="modal" data-modal-id="${modalId}" aria-label="${aria}" title="${title}">
          ${iconMarkup}
          <span class="icon-label">${esc(app.label || '')}</span>
        </button>`;
    }

    if(action.type === 'disabled'){
      return `
        <button type="button" class="icon-btn" data-key="${key}" role="gridcell" data-action="disabled" disabled aria-disabled="true" aria-label="${aria}" title="${title}">
          ${iconMarkup}
          <span class="icon-label">${esc(app.label || '')}</span>
        </button>`;
    }

    // fallback to link behaviour
    const url = escAttr(action.url || placeholderUrl(app.key));
    return `
      <a class="icon-btn" href="${url}" target="${escAttr(action.target || '_blank')}" rel="${escAttr(action.rel || 'noopener noreferrer')}" data-key="${key}" role="gridcell" aria-label="${aria}" title="${title}">
        ${iconMarkup}
        <span class="icon-label">${esc(app.label || '')}</span>
      </a>`;
  }
}

async function initAppsAdmin(){
  const table = document.getElementById('tbl-apps');
  if(!table) return;
  console.log('[AppsAdmin] init requested');
  updateAppsModelFromStore();
  bindAppsTableEvents();
  bindIconPreviewInputs();
}

function updateAppsModelFromStore({ renderTable = true } = {}){
  const storeApps = (window.AppsStore?.getAll && window.AppsStore.getAll()) || [];
  appsModel = cloneAppsForModel(storeApps);
  appsModelSynced = true;
  const status = window.AppsStore?.getStatus?.() || {};
  appsSourceLabel = deriveSourceLabel(status.source);
  renderSourceBadge();
  syncMetaInputs();
  if(renderTable) renderAppTable();
  console.log('[AppsAdmin] model synced', { count: appsModel.length, source: status.source });
}

function cloneAppsForModel(list = []){
  return list.map(item => normalizeModelApp(item));
}

function normalizeModelApp(app = {}){
  const clone = JSON.parse(JSON.stringify(app));
  clone.label = clone.label || 'Application';
  clone.key = clone.key || generateAppKey(clone.label);
  const href = deriveHref(clone);
  clone.href = href;
  clone.icon = clone.icon || '';
  ensureLinkAction(clone, href);
  return clone;
}

function deriveHref(app){
  if(app.action?.type === 'link') return app.action.url || app.href || '';
  return app.href || '';
}

function ensureLinkAction(app, hrefValue){
  const href = hrefValue ?? deriveHref(app);
  const label = app.label || 'Application';
  const action = app.action && app.action.type === 'link' ? { ...app.action } : { type:'link' };
  action.url = href;
  action.target = action.target || '_blank';
  action.rel = action.rel || 'noopener noreferrer';
  action.title = action.title || `Open ${label}`;
  action.ariaLabel = action.ariaLabel || `Open ${label}`;
  app.action = action;
  return action;
}

function renderSourceBadge(){
  const chip = document.getElementById('apps-source-chip');
  if(!chip) return;
  if(!appsModel.length){
    chip.hidden = true;
    return;
  }
  chip.textContent = `Loaded: ${appsSourceLabel}`;
  chip.hidden = false;
}

function deriveSourceLabel(code){
  if(!code) return 'Defaults';
  return APPS_SOURCE_LABELS[code] || code;
}

function renderAppTable(){
  const tb = document.querySelector('#tbl-apps tbody');
  if(!tb) return;
  if(!appsModelSynced) return;
  if(!appsModel.length){
    tb.innerHTML = '<tr><td colspan="4" class="empty">No applications yet.</td></tr>';
    return;
  }
  tb.innerHTML = appsModel.map((app, index) => buildAppRow(app, index)).join('');
}

function buildAppRow(app, index){
  const esc = escapeHTML;
  const escAttr = (str='') => escapeHTML(String(str));
  const key = escAttr(app.key || `app-${index}`);
  const href = escAttr(app.href || '');
  const iconMarkup = renderIconPreviewMarkup(app);
  const keyLabel = app.key ? esc(app.key) : '&mdash;';
  return `
    <tr data-key="${key}">
      <td>
        <div>${esc(app.label || '')}</div>
        <small class="muted">${keyLabel}</small>
      </td>
      <td>
        <input class="table-url" type="text" data-key="${key}" value="${href}" spellcheck="false" autocomplete="off" placeholder="https://app.local/..." />
      </td>
      <td>${iconMarkup}</td>
      <td class="table-actions">
        <button class="btn secondary" data-action="edit" data-key="${key}">Edit</button>
        <button class="btn ghost" data-action="delete" data-key="${key}">Delete</button>
      </td>
    </tr>`;
}

function renderIconPreviewMarkup(app){
  const escAttr = (str='') => escapeHTML(String(str));
  const icon = app.icon || '';
  if(icon){
    const direct = icon.startsWith('data:') || icon.startsWith('http') || icon.startsWith('./') || icon.startsWith('../');
    const iconSrc = direct ? icon : `./lib/assets/images/icons/${icon}`;
    return `<img src="${escAttr(iconSrc)}" alt="" class="icon-thumb" loading="lazy">`;
  }
  return `<span class="icon-fallback">${escapeHTML((app.label||'?').slice(0,2))}</span>`;
}

function refreshTableRow(key){
  const selector = `#tbl-apps tbody tr[data-key="${cssEscape(key)}"]`;
  const row = document.querySelector(selector);
  const index = findAppIndexByKey(key);
  if(index === -1){
    if(row) row.remove();
    if(!appsModel.length) renderAppTable();
    return;
  }
  if(!row){
    renderAppTable();
    return;
  }
  row.outerHTML = buildAppRow(appsModel[index], index);
}

function findAppIndexByKey(key){
  return appsModel.findIndex(a => a.key === key);
}

function getAppByKey(key){
  return appsModel.find(a => a.key === key) || null;
}

function updateModelForKey(key, updater){
  const idx = findAppIndexByKey(key);
  if(idx === -1) return false;
  const updated = normalizeModelApp(updater({ ...appsModel[idx] }));
  appsModel[idx] = updated;
  return true;
}

function syncAppsStoreFromModel(options = {}){
  window.AppsStore?.setAll?.(appsModel, options);
}

function handleAppsTableClick(event){
  const btn = event.target.closest('#tbl-apps [data-action]');
  if(!btn) return;
  const action = btn.dataset.action;
  const key = btn.dataset.key;
  if(!key) return;
  if(action === 'edit'){
    console.log('[AppsAdmin] open edit modal', { key });
    openAddApp(key);
  }else if(action === 'delete'){
    const app = getAppByKey(key);
    if(!app) return;
    if(confirm(`Remove "${app.label}"?`)){
      appsModel = appsModel.filter(a => a.key !== key);
      syncAppsStoreFromModel({ silent: true });
      renderAppTable();
      showToast('Application removed. Click Save to persist.');
      console.log('[AppsAdmin] deleted app', { key });
    }
  }
}

function handleTableKeydown(event){
  if(event.target.matches('.table-url') && event.key === 'Enter'){
    event.preventDefault();
    commitInlineUrlChange(event.target);
  }
}

function handleTableBlur(event){
  if(event.target.matches('.table-url')){
    commitInlineUrlChange(event.target);
  }
}

function commitInlineUrlChange(input){
  const key = input.dataset.key;
  if(!key) return false;
  const value = (input.value || '').trim();
  const validation = validateAppUrl(value);
  if(!validation.valid){
    setInputValidity(input, validation.message);
    console.warn('[AppsAdmin] URL validation failed', { key, message: validation.message });
    return false;
  }
  setInputValidity(input, '');
  const success = updateModelForKey(key, app => {
    app.href = value;
    ensureLinkAction(app, value);
    return app;
  });
  if(success){
    syncAppsStoreFromModel({ silent: true });
    refreshTableRow(key);
    console.log('[AppsAdmin] inline URL updated', { key, value });
  }
  return success;
}

function validateAppUrl(value){
  if(!value) return { valid:false, message:'URL is required.' };
  if(/^https?:\/\//i.test(value)){
    try{ new URL(value); return { valid:true }; }
    catch(_){ return { valid:false, message:'Enter a valid http(s) URL.' }; }
  }
  if(/^[\w.-]+(\/.*)?$/i.test(value)){
    return { valid:true };
  }
  return { valid:false, message:'Enter http(s):// or internal host/path.' };
}

function setInputValidity(input, message){
  if(!input) return;
  input.classList.toggle('has-error', Boolean(message));
  if(typeof input.setCustomValidity === 'function'){
    input.setCustomValidity(message || '');
    if(message) input.reportValidity();
  }
}

function bindAppsTableEvents(){
  if(appsTableEventsBound) return;
  const table = document.getElementById('tbl-apps');
  if(!table) return;
  table.addEventListener('click', handleAppsTableClick);
  table.addEventListener('keydown', handleTableKeydown);
  table.addEventListener('blur', handleTableBlur, true);
  appsTableEventsBound = true;
}

function bindIconPreviewInputs(){
  const urlInput = document.getElementById('app-icon-url');
  const fileInput = document.getElementById('app-icon-file');
  urlInput?.addEventListener('input', e => updateIconPreview((e.target.value || '').trim()));
  fileInput?.addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if(file){
      const dataUrl = await readAsDataURL(file);
      updateIconPreview(dataUrl);
    }else{
      const current = editingAppKey ? getAppByKey(editingAppKey)?.icon : '';
      updateIconPreview(current || '');
    }
  });
}

function updateIconPreview(src){
  const img = document.getElementById('app-icon-preview');
  const empty = document.getElementById('app-icon-preview-empty');
  if(!img || !empty) return;
  if(src){
    img.src = src;
    img.hidden = false;
    empty.hidden = true;
  }else{
    img.hidden = true;
    empty.hidden = false;
  }
}

function generateAppKey(label){
  const base = (label || 'app').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'') || 'app';
  let key = base;
  while(findAppIndexByKey(key) !== -1){
    key = `${base}-${Math.random().toString(36).slice(2,6)}`;
  }
  return key;
}

function cssEscape(value){
  if(window.CSS && CSS.escape) return CSS.escape(value);
  return value.replace(/"/g, '\\"');
}

function maybeRefreshAppsAdminModel(){
  if(document.getElementById('tbl-apps')){
    updateAppsModelFromStore();
  }
}

function updateMetaFooter(meta = {}){
  const wrap = document.getElementById('apps-meta');
  if(!wrap) return;
  const fields = [
    { id:'apps-meta-version', label:'Version', value: meta.version },
    { id:'apps-meta-updated', label:'Updated', value: meta.updated },
    { id:'apps-meta-updated-by', label:'Updated by', value: meta.updatedBy }
  ];
  let hasValue = false;
  fields.forEach(({id,label,value})=>{
    const el = document.getElementById(id);
    if(!el) return;
    const clean = (value ?? '').toString().trim();
    if(clean){
      el.textContent = clean;
      el.dataset.label = `${label}:`;
      el.hidden = false;
      hasValue = true;
    }else{
      el.textContent = '';
      el.hidden = true;
    }
  });
  wrap.hidden = !hasValue;
}

function bindAppTileEvents(grid){
  if(grid.dataset.boundAppEvents === 'true') return;
  grid.addEventListener('click', handleAppTileInteraction);
  grid.dataset.boundAppEvents = 'true';

  function handleAppTileInteraction(event){
    const btn = event.target.closest('.icon-btn[data-action]');
    if(!btn) return;
    const action = btn.dataset.action;
    if(action === 'disabled'){
      event.preventDefault();
      return;
    }
    if(action === 'local'){
      event.preventDefault();
      const abs = btn.dataset.path;
      const rel = btn.dataset.rel;
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
      const modalId = btn.dataset.modalId;
      triggerModal(modalId);
    }
  }
}

function triggerModal(modalId){
  if(!modalId) return;
  if(typeof window.openModal === 'function'){
    try{
      window.openModal(modalId);
      return;
    }catch(err){ console.warn('openModal error', err); }
  }
  const modal = document.getElementById(modalId);
  if(modal){
    modal.hidden = false;
    modal.focus?.();
  }else{
    console.warn('Modal not found:', modalId);
  }
}

function showToast(message){
  if(!message) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(()=>toast.remove(), 2600);
}

function displayAppErrors(errors){
  const box = document.getElementById('apps-errors');
  const list = document.getElementById('apps-errors-list');
  if(!box || !list) return;
  if(!errors || !errors.length){
    list.innerHTML = '';
    box.hidden = true;
    return;
  }
  list.innerHTML = errors.map(err => `<li>${escapeHTML(err)}</li>`).join('');
  box.hidden = false;
  box.scrollIntoView({ behavior:'smooth', block:'center' });
}

function wireReloadButton(id){
  const btn = typeof id === 'string' ? document.getElementById(id) : id;
  if(!btn) return;
  btn.addEventListener('click', async ()=>{
    if(btn.dataset.loading === 'true') return;
    btn.dataset.loading = 'true';
    btn.disabled = true;
    try{
      const result = await (window.AppsStore?.reload?.() || Promise.resolve(false));
      const status = window.AppsStore?.getStatus?.() || {};
      if(result){
        displayAppErrors();
        showToast('Latest Applications/JSON/app.json loaded.');
        maybeRefreshAppsAdminModel();
      }else if(status.error){
        showToast('Still using fallback links. Check the warning for details.');
      }else{
        showToast('Links refreshed.');
      }
    }catch(err){
      console.warn('Reload links failed', err);
      showToast('Unable to reload links.');
    }finally{
      btn.disabled = false;
      btn.dataset.loading = 'false';
    }
  });
}

/* ===== Settings Page: render full editable list of apps ===== */


function syncMetaInputs(){
  const meta = window.AppsStore?.getMeta?.() || {};
  setMetaInputValue('apps-meta-version', meta.version);
  setMetaInputValue('apps-meta-updated', meta.updated);
  setMetaInputValue('apps-meta-updated-by', meta.updatedBy);
}

function setMetaInputValue(id, value){
  const input = document.getElementById(id);
  if(!input) return;
  if(document.activeElement === input) return;
  input.value = value || '';
}

/* Modal helpers */
function openModal(modalId){
  const modal = modalId ? document.getElementById(modalId) : document.getElementById('modal-add');
  if(!modal) return;
  modal.hidden = false;
  setTimeout(()=>modal.querySelector('[autofocus]')?.focus() || $('#f-type')?.focus(),0);
}
function closeModal(){ const m=$('#modal-add'), f=$('#add-form'); if(!m) return; m.hidden=true; f?.reset(); }
function readAsDataURL(file){ return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(file); }); }
function downloadJSON(filename, data){
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 0);
  alert('Updated briefings.json downloaded.\n\nReplace it on the shared drive (BASE/briefings/[year]/briefings.json) and ask colleagues to Refresh.');
}

// ----- Add Application modal helpers -----
function openAddApp(key = null){
  const modal = document.getElementById('modal-add-app'); if(!modal) return;
  editingAppKey = typeof key === 'string' ? key : null;
  const isEdit = Boolean(editingAppKey);
  const titleEl = document.getElementById('add-app-title');
  const submitBtn = document.querySelector('#form-add-app button[type="submit"]');
  const labelInput = document.getElementById('app-label');
  const hrefInput = document.getElementById('app-href');
  const iconUrlInput = document.getElementById('app-icon-url');
  const fileInput = document.getElementById('app-icon-file');

  if(titleEl) titleEl.textContent = isEdit ? 'Edit Application' : 'Add Application';
  if(submitBtn) submitBtn.textContent = isEdit ? 'Save Changes' : 'Add Application';
  if(fileInput) fileInput.value = '';

  const app = isEdit ? getAppByKey(editingAppKey) : null;
  if(isEdit && !app){
    editingAppKey = null;
    openAddApp();
    return;
  }

  labelInput.value = app?.label || '';
  hrefInput.value = app?.href || '';
  iconUrlInput.value = app?.icon || '';
  updateIconPreview(app?.icon || '');

  modal.hidden = false;
  setTimeout(()=>labelInput?.focus(),0);
}
function closeAddApp(){
  const modal=document.getElementById('modal-add-app'), form=document.getElementById('form-add-app');
  if(!modal) return;
  editingAppKey = null;
  modal.hidden=true;
  form?.reset();
  updateIconPreview('');
}

async function handleAppFormSubmit(e){
  e.preventDefault();
  const labelInput = document.getElementById('app-label');
  const hrefInput = document.getElementById('app-href');
  const iconUrlInput = document.getElementById('app-icon-url');
  const fileInput = document.getElementById('app-icon-file');

  const label = (labelInput.value || '').trim();
  const href = (hrefInput.value || '').trim();
  if(!label){
    labelInput.setCustomValidity('Name is required.');
    labelInput.reportValidity();
    return;
  }
  labelInput.setCustomValidity('');
  const hrefCheck = validateAppUrl(href);
  if(!hrefCheck.valid){
    hrefInput.setCustomValidity(hrefCheck.message);
    hrefInput.reportValidity();
    return;
  }
  hrefInput.setCustomValidity('');

  let icon = (iconUrlInput.value || '').trim();
  const file = fileInput.files[0];
  if(file){
    icon = await readAsDataURL(file);
  }else if(!icon && editingAppKey){
    const current = getAppByKey(editingAppKey);
    icon = current?.icon || '';
  }

  if(editingAppKey){
    const success = updateModelForKey(editingAppKey, app => {
      app.label = label;
      app.icon = icon;
      app.href = href;
      ensureLinkAction(app, href);
      return app;
    });
    if(success){
      syncAppsStoreFromModel({ silent:true });
      refreshTableRow(editingAppKey);
      console.log('[AppsAdmin] modal edit saved', { key: editingAppKey });
      showToast('Application updated. Click Save to persist.');
    }
  }else{
    const key = generateAppKey(label);
    const newApp = normalizeModelApp({ key, label, icon, href, action:{ type:'link', url:href, target:'_blank', rel:'noopener noreferrer', title:`Open ${label}` } });
    appsModel.push(newApp);
    syncAppsStoreFromModel({ silent:true });
    renderAppTable();
    console.log('[AppsAdmin] app added', { key });
    showToast('Application added. Click Save to persist.');
  }
  closeAddApp();
}


/* Unified startup */
document.addEventListener('DOMContentLoaded', async () => {
  // static sections
  renderRecoveries();
  if(window.AppsStore?.load){
    try{
      await window.AppsStore.load();
    }catch(err){ console.warn('AppsStore load failed', err); }
  }
  await initAppsAdmin();

  // briefings
  window.Briefings?.load();
  ['#btn-refresh-briefs','#btn-refresh'].forEach(sel => $(sel)?.addEventListener('click', () => window.Briefings?.load()));
  $('#briefings-file-input')?.addEventListener('change', e => { const f=e.target.files?.[0]; if(f) window.Briefings?.importFromPicker(f); });

  // modal
  $('#btn-add')?.addEventListener('click', openModal);
  $('#btn-cancel')?.addEventListener('click', closeModal);
  document.addEventListener('keydown', e => {
    if(e.key==='Escape'){
      if(!$('#modal-add')?.hidden) closeModal();
      const addAppModal = document.getElementById('modal-add-app');
      if(addAppModal && !addAppModal.hidden) closeAddApp();
    }
  });
  $('#modal-add')?.addEventListener('click', e => { if(e.target===e.currentTarget) closeModal(); });
  document.getElementById('btn-add-app')?.addEventListener('click', () => openAddApp());
  document.getElementById('btn-cancel-app')?.addEventListener('click', closeAddApp);
  document.getElementById('modal-add-app')?.addEventListener('click', e => { if(e.target===e.currentTarget) closeAddApp(); });

  // add-form submit
  $('#add-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const type=$('#f-type').value;
    const title=($('#f-title').value||'').trim();
    const description=($('#f-desc').value||'').trim();
    const by=($('#f-by').value||'').trim();
    const file=$('#f-image').files[0];
    let image=null; if(file) image=await readAsDataURL(file);
    const now=new Date().toLocaleString();
    const arr = window.Briefings?.getAll() || [];
    arr.push({ id: Date.now(), type, title, description, submittedBy: by, date: now, image: image||null });
    window.Briefings?.setAll(arr);
    downloadJSON('briefings.json', arr);
    closeModal();
  });

  // File-picker import for apps.json
  document.getElementById('apps-file-input')?.addEventListener('change', async (e)=>{
    const f = e.target.files?.[0];
    if (f){
      await window.AppsStore?.importFromPicker(f);
      maybeRefreshAppsAdminModel();
    }
  });

  // Save (download) apps.json
  document.getElementById('btn-save-apps')?.addEventListener('click', ()=>{
    console.log('[AppsAdmin] save requested', { count: appsModel.length });
    const ok = window.AppsStore?.saveToLocal?.(appsModel);
    if(ok){
      updateAppsModelFromStore({ renderTable:false });
      showToast('Saved to this browser. Use Validate & Export JSON to share.');
    }else{
      showToast('Unable to save locally (storage blocked).');
    }
  });

  document.getElementById('btn-export-apps')?.addEventListener('click', ()=>{
    console.log('[AppsAdmin] export requested', { count: appsModel.length });
    const result = window.AppsStore?.exportBundles?.(appsModel);
    if(result?.ok){
      displayAppErrors();
      showToast('Registry JSON + JS downloaded. Replace Applications/JSON/app.json and Applications/JSON/app-registry.js.');
    }else if(result?.errors){
      displayAppErrors(result.errors);
      showToast('Fix validation issues before exporting.');
    }
  });

  [['apps-meta-version','version'],['apps-meta-updated','updated'],['apps-meta-updated-by','updatedBy']].forEach(([id,key])=>{
    document.getElementById(id)?.addEventListener('input', e=>{
      window.AppsStore?.setMeta?.({ [key]: e.target.value });
    });
  });

  ['btn-reload-links','btn-reload-links-settings'].forEach(id => {
    const el = document.getElementById(id);
    if(!el) return;
    if(isFileProtocol){
      el.hidden = true;
      el.setAttribute('aria-hidden','true');
      el.disabled = true;
      return;
    }
    wireReloadButton(el);
  });

  // Add App submit
  document.getElementById('form-add-app')?.addEventListener('submit', handleAppFormSubmit);
});
