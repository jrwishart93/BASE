const YAML_PATH = './data/seizure-log.yaml';
const JSON_PATH = './data/seizure-log.json';

const state = {
  lastSource: null,
  lastError: null,
};

async function fetchText(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.text();
}

function normalizeEntries(raw) {
  const entries = Array.isArray(raw) ? raw : raw?.entries || [];
  return entries.filter((x) => x && typeof x === 'object');
}

async function loadSeizures() {
  state.lastError = null;
  try {
    const yamlText = await fetchText(YAML_PATH);
    const data = jsyaml.load(yamlText);
    state.lastSource = 'yaml';
    return normalizeEntries(data);
  } catch (error) {
    state.lastError = error;
    console.warn('YAML load failed, falling back to JSON:', error?.message);
  }

  try {
    const jsonText = await fetchText(JSON_PATH);
    const data = JSON.parse(jsonText);
    state.lastSource = 'json';
    state.lastError = null;
    return normalizeEntries(data.entries || data);
  } catch (error) {
    state.lastError = error;
    state.lastSource = 'none';
    console.error('JSON fallback also failed:', error?.message);
    return [];
  }
}

window.BASE_RECOVERIES = { loadSeizures, state };
