const SettingsUI = (() => {
  const STORAGE_KEY = 'base.settings.preferences';

  const defaultPreferences = {
    personalization: {
      theme: 'system',
      fontScale: 100,
      motion: 'system'
    },
    notifications: {
      email: true,
      desktop: true,
      sms: false,
      digest: '08:00'
    }
  };

  const clone = value => JSON.parse(JSON.stringify(value));
  const isObject = value => value && typeof value === 'object' && !Array.isArray(value);

  const deepMerge = (base, overrides) => {
    const result = { ...base };
    if (!isObject(overrides)) return result;
    Object.keys(overrides).forEach(key => {
      const baseValue = result[key];
      const overrideValue = overrides[key];
      if (isObject(baseValue) && isObject(overrideValue)) {
        result[key] = deepMerge(baseValue, overrideValue);
      } else if (overrideValue !== undefined) {
        result[key] = overrideValue;
      }
    });
    return result;
  };

  const allowedThemes = ['system', 'dark', 'light'];
  const allowedMotion = ['system', 'reduce', 'default'];

  const normalizePreferences = raw => {
    if (!isObject(raw)) return clone(defaultPreferences);
    const merged = deepMerge(clone(defaultPreferences), raw);

    if (!allowedThemes.includes(merged.personalization.theme)) {
      merged.personalization.theme = defaultPreferences.personalization.theme;
    }
    merged.personalization.fontScale = clampFontScale(merged.personalization.fontScale);
    if (!allowedMotion.includes(merged.personalization.motion)) {
      merged.personalization.motion = defaultPreferences.personalization.motion;
    }

    merged.notifications.email = Boolean(merged.notifications.email);
    merged.notifications.desktop = Boolean(merged.notifications.desktop);
    merged.notifications.sms = Boolean(merged.notifications.sms);
    if (typeof merged.notifications.digest !== 'string') {
      merged.notifications.digest = defaultPreferences.notifications.digest;
    } else if (
      merged.notifications.digest !== 'off' &&
      !/^\d{2}:\d{2}$/.test(merged.notifications.digest)
    ) {
      merged.notifications.digest = defaultPreferences.notifications.digest;
    }

    return merged;
  };

  const storageAvailable = () => {
    try {
      const testKey = '__base-settings-test__';
      window.localStorage.setItem(testKey, testKey);
      window.localStorage.removeItem(testKey);
      return true;
    } catch (error) {
      return false;
    }
  };

  const getPanel = id => document.getElementById(id);
  const setSummaryText = (key, text) => {
    const el = document.querySelector(`[data-settings-summary="${key}"]`);
    if (el) el.textContent = text;
  };
  const clampFontScale = value => {
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return defaultPreferences.personalization.fontScale;
    return Math.min(120, Math.max(90, Math.round(numeric)));
  };
  const getSystemTheme = () => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
    return 'dark';
  };

  const formatTime = value => {
    if (value === 'off') return 'off';
    const [hour, minute] = value.split(':').map(Number);
    if (Number.isNaN(hour) || Number.isNaN(minute)) return value;
    try {
      const formatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
      const date = new Date();
      date.setHours(hour, minute, 0, 0);
      return formatter.format(date);
    } catch (error) {
      return value;
    }
  };

  let canPersist = false;
  let preferences = clone(defaultPreferences);
  let toastTimer = null;

  const loadPreferences = () => {
    if (!canPersist) return clone(defaultPreferences);
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) return clone(defaultPreferences);
      const parsed = JSON.parse(stored);
      return normalizePreferences(parsed);
    } catch (error) {
      console.warn('BASE settings: unable to load preferences', error);
      return clone(defaultPreferences);
    }
  };

  const persistPreferences = () => {
    if (!canPersist) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.warn('BASE settings: unable to save preferences', error);
      canPersist = false;
      const warning = document.getElementById('personalization-storage-warning');
      if (warning) warning.hidden = false;
    }
  };

  const updateStatus = panel => {
    if (!panel) return;
    const label = panel.querySelector('[data-settings-status]');
    if (label) label.textContent = panel.open ? 'Expanded' : 'Collapsed';
  };

  const registerPanels = () => {
    document.querySelectorAll('.settings-panel').forEach(panel => {
      updateStatus(panel);
      panel.addEventListener('toggle', () => updateStatus(panel));
    });
  };

  const applyTheme = theme => {
    const root = document.documentElement;
    const resolved = theme === 'system' ? getSystemTheme() : theme;
    root.setAttribute('data-theme', resolved === 'light' ? 'light' : 'dark');
  };

  const applyFontScale = scale => {
    const factor = clampFontScale(scale) / 100;
    document.documentElement.style.setProperty('--user-font-scale', factor.toFixed(2));
  };

  const applyMotion = motion => {
    const root = document.documentElement;
    if (motion === 'reduce') {
      root.setAttribute('data-motion', 'reduced');
    } else {
      root.removeAttribute('data-motion');
    }
  };

  const themeSummaryText = theme => {
    if (theme === 'system') {
      const systemTheme = getSystemTheme();
      return systemTheme === 'light' ? 'System (light)' : 'System (dark)';
    }
    return theme === 'light' ? 'Light' : 'Dark';
  };

  const motionSummaryText = motion => {
    switch (motion) {
      case 'reduce':
        return 'Motion: Reduced';
      case 'default':
        return 'Motion: Full';
      default:
        return 'Motion: System';
    }
  };

  const getEnabledChannels = () => {
    const { email, desktop, sms } = preferences.notifications;
    return [
      email ? 'Email' : null,
      desktop ? 'Desktop' : null,
      sms ? 'SMS' : null
    ].filter(Boolean);
  };

  const updatePersonalizationSummary = () => {
    const { theme, fontScale, motion } = preferences.personalization;
    const summary = `${themeSummaryText(theme)} • Text ${clampFontScale(fontScale)}% • ${motionSummaryText(motion)}`;
    setSummaryText('personalization', summary);
  };

  const updateNotificationsSummary = () => {
    const channels = getEnabledChannels();
    const channelText = channels.length ? channels.join(', ') : 'No channels';
    const digest = preferences.notifications.digest;
    const digestText = digest === 'off' ? 'Digest off' : `Daily ${formatTime(digest)}`;
    setSummaryText('notifications', `${channelText} • ${digestText}`);
  };

  const applyPersonalization = () => {
    const { theme, fontScale, motion } = preferences.personalization;
    applyTheme(theme);
    applyFontScale(fontScale);
    applyMotion(motion);
    updatePersonalizationSummary();
  };

  const applyNotifications = () => {
    updateNotificationsSummary();
  };

  const showNotificationToast = (html, variant = 'info') => {
    const toast = document.getElementById('notifications-toast');
    if (!toast) return;
    toast.classList.remove('danger', 'info');
    toast.classList.add(variant === 'danger' ? 'danger' : 'info');
    toast.innerHTML = html;
    toast.hidden = false;
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.hidden = true;
    }, variant === 'danger' ? 6500 : 4500);
  };

  const handleSendTest = () => {
    const channels = getEnabledChannels();
    if (!channels.length) {
      showNotificationToast('<strong>No channels selected.</strong><p>Enable at least one alert channel to send a test.</p>', 'danger');
      return;
    }

    const digest = preferences.notifications.digest;
    const digestText = digest === 'off' ? 'instant alerts' : `daily digest at ${formatTime(digest)}`;
    const timestamp = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' }).format(new Date());
    const message = `<strong>Test alert queued.</strong><p>${channels.join(', ')} channel${channels.length > 1 ? 's' : ''} • ${digestText}. (${timestamp})</p>`;
    showNotificationToast(message, 'info');
  };

  const initPersonalization = () => {
    const form = document.querySelector('[data-personalization-form]');
    if (!form) return;

    const themeInputs = form.querySelectorAll('input[name="theme"]');
    const fontScaleInput = form.querySelector('[data-font-scale]');
    const fontScaleOutput = form.querySelector('[data-font-scale-output]');
    const motionSelect = form.querySelector('select[name="motion"]');
    const resetButton = document.querySelector('[data-reset-personalization]');

    const syncControls = () => {
      const { theme, fontScale, motion } = preferences.personalization;
      themeInputs.forEach(input => {
        input.checked = input.value === theme;
      });
      if (fontScaleInput) {
        fontScaleInput.value = clampFontScale(fontScale);
      }
      if (fontScaleOutput) {
        fontScaleOutput.textContent = `${clampFontScale(fontScale)}%`;
      }
      if (motionSelect) {
        motionSelect.value = motion;
      }
    };

    syncControls();

    themeInputs.forEach(input => {
      input.addEventListener('change', event => {
        if (!event.target.checked) return;
        preferences.personalization.theme = event.target.value;
        applyPersonalization();
        persistPreferences();
      });
    });

    if (fontScaleInput) {
      fontScaleInput.addEventListener('input', event => {
        preferences.personalization.fontScale = clampFontScale(event.target.value);
        applyPersonalization();
        if (fontScaleOutput) {
          fontScaleOutput.textContent = `${preferences.personalization.fontScale}%`;
        }
        persistPreferences();
      });
    }

    if (motionSelect) {
      motionSelect.addEventListener('change', event => {
        preferences.personalization.motion = event.target.value;
        applyPersonalization();
        persistPreferences();
      });
    }

    if (resetButton) {
      resetButton.addEventListener('click', () => {
        preferences.personalization = clone(defaultPreferences.personalization);
        applyPersonalization();
        syncControls();
        persistPreferences();
      });
    }

    const warning = document.getElementById('personalization-storage-warning');
    if (warning) warning.hidden = canPersist;
  };

  const initNotifications = () => {
    const form = document.querySelector('[data-notifications-form]');
    if (!form) return;

    const channelFields = ['email', 'desktop', 'sms'];
    channelFields.forEach(name => {
      const input = form.querySelector(`input[name="${name}"]`);
      if (!input) return;
      input.checked = Boolean(preferences.notifications[name]);
      input.addEventListener('change', () => {
        preferences.notifications[name] = input.checked;
        applyNotifications();
        persistPreferences();
      });
    });

    const digestSelect = form.querySelector('select[name="digest"]');
    if (digestSelect) {
      digestSelect.value = preferences.notifications.digest;
      digestSelect.addEventListener('change', () => {
        preferences.notifications.digest = digestSelect.value;
        applyNotifications();
        persistPreferences();
      });
    }

    const testButton = form.querySelector('[data-send-test]');
    if (testButton) {
      testButton.addEventListener('click', handleSendTest);
    }

    applyNotifications();
  };

  const monitorSystemTheme = () => {
    if (!window.matchMedia) return;
    const query = window.matchMedia('(prefers-color-scheme: light)');
    const handler = () => {
      if (preferences.personalization.theme === 'system') {
        applyPersonalization();
      }
    };

    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', handler);
    } else if (typeof query.addListener === 'function') {
      query.addListener(handler);
    }
  };

  const setPanelOpenState = (panelId, shouldOpen) => {
    const panel = getPanel(panelId);
    if (!panel) return;
    panel.open = shouldOpen;
    updateStatus(panel);
  };

  const openApplications = () => setPanelOpenState('settings-applications', true);
  const closeApplications = () => setPanelOpenState('settings-applications', false);
  const toggleApplications = () => {
    const panel = getPanel('settings-applications');
    if (!panel) return;
    panel.open = !panel.open;
    updateStatus(panel);
  };

  document.addEventListener('DOMContentLoaded', () => {
    canPersist = storageAvailable();
    preferences = normalizePreferences(loadPreferences());
    registerPanels();
    applyPersonalization();
    applyNotifications();
    initPersonalization();
    initNotifications();
    monitorSystemTheme();
  });

  return {
    openApplications,
    closeApplications,
    toggleApplications
  };
})();

window.SettingsUI = SettingsUI;
