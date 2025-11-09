// Requires js-yaml to be loaded first
function toYaml(entriesArray) {
  // We store as a top-level sequence (YAML list) for simplicity
  return jsyaml.dump(entriesArray, { lineWidth: 120, noCompatMode: true });
}

function fromYaml(yamlText) {
  return jsyaml.load(yamlText);
}

async function loadYamlFile() {
  const txt = await fetch('./data/seizure-log.yaml', { cache: 'no-store' }).then(r => r.ok ? r.text() : '');
  return txt ? fromYaml(txt) : [];
}

// Export a download (offline-friendly)
async function exportYaml(updatedEntries) {
  const y = toYaml(updatedEntries);
  const blob = new Blob([y], { type: 'text/yaml;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'seizure-log.yaml';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

window.BASE_RECOVERIES_SAVE = { toYaml, fromYaml, loadYamlFile, exportYaml };
