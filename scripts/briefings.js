/* scripts/briefings.js — JSON briefings (legacy feed for dashboard) */

/* -------- Legacy JSON Briefings (kept intact) -------- */
const Briefings = (() => {
  let data = [];
  let loadedFromPicker = false;
  const $ = s => document.querySelector(s);
  const esc = s => (s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  const badge = (t='general') => `<span class="badge ${t}">${t.charAt(0).toUpperCase()+t.slice(1)}</span>`;

  function renderList(list){
    const grid = $('#briefings-grid'), empty = $('#briefings-empty');
    if(!grid) return;
    grid.innerHTML = '';
    if(!list?.length){ if(empty) empty.hidden = false; return; }
    if(empty) empty.hidden = true;
    list.forEach(b=>{
      const el = document.createElement('article');
      el.className = 'brief';
      el.innerHTML = `
        ${badge(b.type||'general')}
        <h3>${esc(b.title||'(Untitled)')}</h3>
        ${b.image ? `<img class="image" src="${b.image}" alt="">` : ''}
        <div class="meta">${esc(b.date||'')} • ${esc(b.submittedBy||'Unknown')}</div>
        <div class="desc">${esc(b.description||'')}</div>`;
      grid.appendChild(el);
    });
  }

  function render(){
    const sorted = [...data].sort((a,b)=> new Date(b.date)-new Date(a.date));
    renderList(sorted);
  }

  async function load(){
    try{
      const res = await fetch('briefings.json',{cache:'no-store'});
      if(!res.ok) throw 0;
      const arr = await res.json();
      if(!Array.isArray(arr)) throw 0;
      data = arr;
      const warn = document.getElementById('file-warning'); if(warn) warn.hidden = true;
      render();
    }catch{
      const warn = document.getElementById('file-warning');
      if(warn && !loadedFromPicker){ warn.hidden = false; }
      data = []; render();
    }
  }

  async function importFromPicker(file){
    if(!file) return;
    try{
      const txt = await file.text();
      const arr = JSON.parse(txt);
      if(!Array.isArray(arr)) throw 0;
      data = arr; loadedFromPicker = true; render();
      alert('briefings.json loaded for this session.');
    }catch{ alert('Invalid JSON (expect an array, e.g., [])'); }
  }

  function getAll(){ return data; }
  function setAll(arr){ data = Array.isArray(arr) ? arr : []; render(); }

  return { load, render, importFromPicker, getAll, setAll };
})();
window.Briefings = Briefings;
