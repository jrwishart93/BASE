const YAML_PATH = './data/seizure-log.yaml';

const state = {
  lastSource: null,
  lastError: null,
};

function validateEntry(entry) {
  const requiredFields = ['schema', 'id', 'datetime', 'incidentNumber', 'division', 'location', 'officers', 'type', 'details', 'remarks'];
  const missing = requiredFields.filter((key) => !(key in (entry || {})));
  if (missing.length) {
    console.warn(`Entry ${entry?.id || '?'} missing:`, missing.join(', '));
  }
  return entry;
}

async function loadSeizures() {
  state.lastError = null;

  try {
    const yamlText = await fetch(YAML_PATH, { cache: 'no-store' }).then((response) => {
      if (!response.ok) throw new Error('Missing seizure-log.yaml');
      return response.text();
    });
    const parsed = jsyaml.load(yamlText);
    const entries = Array.isArray(parsed) ? parsed : (parsed?.entries || []);
    const normalised = entries
      .filter((item) => item && typeof item === 'object')
      .map((entry) => validateEntry(entry));

    state.lastSource = 'yaml';
    return normalised;
  } catch (error) {
    state.lastError = error;
    state.lastSource = 'none';
    console.error('Unable to load seizure log YAML:', error?.message || error);
    return [];
  }
}

window.BASE_RECOVERIES = { loadSeizures, state };
