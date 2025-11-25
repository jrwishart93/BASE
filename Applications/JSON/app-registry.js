/* Applications/JSON/app-registry.js — bundled defaults for offline use */
window.DEFAULT_APPS_META = {
  version: 'v2024.09.01',
  updated: '2024-09-01T09:00:00Z',
  updatedBy: 'BASE Maintainers'
};

window.DEFAULT_APPS = (typeof window.getDefaultApps === 'function')
  ? window.getDefaultApps()
  : [];
