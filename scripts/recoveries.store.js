/* Storage adapters for Recoveries */

export const REC_DB = 'base-recoveries';
export const REC_STORE = 'records';
export const HANDLE_STORE = 'handles';

export async function openDB(){
  return new Promise((resolve, reject)=>{
    const req = indexedDB.open(REC_DB, 2);
    req.onupgradeneeded = (e)=>{
      const db = e.target.result;
      if(!db.objectStoreNames.contains(HANDLE_STORE)) db.createObjectStore(HANDLE_STORE);
      if(!db.objectStoreNames.contains(REC_STORE)) db.createObjectStore(REC_STORE, { keyPath: 'id' });
    };
    req.onsuccess = ()=>resolve(req.result);
    req.onerror = ()=>reject(req.error);
  });
}

export async function idbPutRecord(record){
  const db = await openDB();
  await new Promise((res, rej)=>{
    const tx = db.transaction(REC_STORE, 'readwrite');
    tx.objectStore(REC_STORE).put(record);
    tx.oncomplete = ()=>{ db.close(); res(); };
    tx.onerror = ()=>{ const err = tx.error; db.close(); rej(err); };
  });
}

export async function idbGetAllRecords(){
  const db = await openDB();
  return new Promise((res, rej)=>{
    const tx = db.transaction(REC_STORE, 'readonly');
    const req = tx.objectStore(REC_STORE).getAll();
    req.onsuccess = ()=>{ const out = req.result || []; db.close(); res(out); };
    req.onerror = ()=>{ const err = req.error; db.close(); rej(err); };
  });
}

export async function idbDeleteRecord(id){
  if(!id) return;
  const db = await openDB();
  await new Promise((res, rej)=>{
    const tx = db.transaction(REC_STORE, 'readwrite');
    tx.objectStore(REC_STORE).delete(id);
    tx.oncomplete = ()=>{ db.close(); res(); };
    tx.onerror = ()=>{ const err = tx.error; db.close(); rej(err); };
  });
}

export async function storeHandle(key, handle){
  const db = await openDB();
  await new Promise((res, rej)=>{
    const tx = db.transaction(HANDLE_STORE, 'readwrite');
    tx.objectStore(HANDLE_STORE).put(handle, key);
    tx.oncomplete = ()=>{ db.close(); res(); };
    tx.onerror = ()=>{ const err = tx.error; db.close(); rej(err); };
  });
}

export async function getStoredHandle(key){
  const db = await openDB();
  return new Promise((res, rej)=>{
    const tx = db.transaction(HANDLE_STORE, 'readonly');
    const req = tx.objectStore(HANDLE_STORE).get(key);
    req.onsuccess = ()=>{ const val = req.result || null; db.close(); res(val); };
    req.onerror = ()=>{ const err = req.error; db.close(); rej(err); };
  });
}

/** FS helpers */
export function supportsFS(){ return !!window.showDirectoryPicker; }

export async function ensurePerm(handle, mode='read'){
  if(!handle) return false;
  try{
    if(handle.queryPermission){
      const q = await handle.queryPermission({ mode: mode === 'readwrite' ? 'readwrite':'read' });
      if(q === 'granted') return true;
    }
    if(handle.requestPermission){
      const r = await handle.requestPermission({ mode: mode === 'readwrite' ? 'readwrite':'read' });
      return r === 'granted';
    }
  }catch(e){ /* ignore */ }
  return false;
}

export async function pickFolder(id='base-recoveries-primary'){
  const handle = await window.showDirectoryPicker({ id });
  const ok = await ensurePerm(handle, 'read');
  return ok ? handle : null;
}

export async function writeToFolder(dirHandle, filename, contents){
  if(!dirHandle) return { ok:false, error:'no-handle' };
  const can = await ensurePerm(dirHandle, 'readwrite');
  if(!can) return { ok:false, error:'no-permission' };
  const fileHandle = await dirHandle.getFileHandle(filename, { create:true });
  const w = await fileHandle.createWritable();
  await w.write(contents);
  await w.close();
  return { ok:true };
}

export async function removeFromFolder(dirHandle, filename){
  if(!dirHandle || !filename) return { ok:false, error:'no-handle' };
  const can = await ensurePerm(dirHandle, 'readwrite');
  if(!can) return { ok:false, error:'no-permission' };
  try{
    if(typeof dirHandle.removeEntry === 'function'){
      await dirHandle.removeEntry(filename);
      return { ok:true, removed:true };
    }
  }catch(err){
    return { ok:false, error: err && err.name ? err.name : 'remove-failed', details: err };
  }
  try{
    const fileHandle = await dirHandle.getFileHandle(filename, { create:false });
    if(fileHandle && fileHandle.createWritable){
      const writer = await fileHandle.createWritable();
      await writer.write(JSON.stringify({ deleted:true, deletedAt: new Date().toISOString() }));
      await writer.close();
      return { ok:true, tombstone:true };
    }
  }catch(err){
    return { ok:false, error: err && err.name ? err.name : 'remove-failed', details: err };
  }
  return { ok:false, error:'unsupported' };
}

export async function readRecoveriesFromFolder(dirHandle){
  const out = [];
  let skipped = 0;
  if(!dirHandle) return { records:[], skipped:0 };
  const can = await ensurePerm(dirHandle, 'read');
  if(!can) return { records:[], skipped:0 };
  for await (const entry of dirHandle.values()){
    if(entry.kind !== 'file') continue;
    if(!entry.name.toLowerCase().endsWith('.json')) continue;
    try{
      const file = await entry.getFile();
      const text = await file.text();
      const data = JSON.parse(text);
      if(data && data.schema === 'base.recovery.v1') out.push(data);
      else skipped++;
    }catch{ skipped++; }
  }
  return { records: out, skipped };
}

export function downloadJson(filename, contents){
  const blob = new Blob([contents], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.rel = 'noopener';
  a.click(); URL.revokeObjectURL(url);
}
