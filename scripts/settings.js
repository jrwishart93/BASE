const SettingsUI = (() => {
  const getApplicationsPanel = () => document.getElementById('settings-applications');
  const getStatusLabel = () => document.querySelector('[data-settings-status]');

  const updateStatus = panel => {
    const label = getStatusLabel();
    if (!label || !panel) return;
    label.textContent = panel.open ? 'Expanded' : 'Collapsed';
  };

  const openApplications = () => {
    const panel = getApplicationsPanel();
    if (!panel) return;
    panel.open = true;
    updateStatus(panel);
  };

  const closeApplications = () => {
    const panel = getApplicationsPanel();
    if (!panel) return;
    panel.open = false;
    updateStatus(panel);
  };

  const toggleApplications = () => {
    const panel = getApplicationsPanel();
    if (!panel) return;
    panel.open = !panel.open;
    updateStatus(panel);
  };

  document.addEventListener('DOMContentLoaded', () => {
    const panel = getApplicationsPanel();
    if (!panel) return;
    updateStatus(panel);
    panel.addEventListener('toggle', () => updateStatus(panel));
  });

  return {
    openApplications,
    closeApplications,
    toggleApplications
  };
})();

window.SettingsUI = SettingsUI;
