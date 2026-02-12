/* scripts/app-data.js — canonical applications list and helpers */
(function(){
  const placeholderLink = name => `https://placeholder.local/${name}`;

  const baseApps = [
    { key:'intranet', label:'INTRANET', icon:'./lib/assets/images/icons/icon-intranet.png', href:placeholderLink('intranet') },
    { key:'storm',    label:'STORM',    icon:'./lib/assets/images/icons/icon-storm.png',    href:placeholderLink('storm') },
    { key:'case',     label:'CASE',     icon:'./lib/assets/images/icons/icon-case.png',     href:placeholderLink('case') },
    { key:'insight',  label:'INSIGHT',  icon:'./lib/assets/images/icons/icon-insight.png',  href:placeholderLink('insight') },
    { key:'unifi',    label:'UNIFI',    icon:'./lib/assets/images/icons/icon-unifi.png',    href:placeholderLink('unifi') },
    { key:'pronto',   label:'PRONTO',   icon:'./lib/assets/images/icons/icon-pronto.png',   href:placeholderLink('pronto') },
    { key:'anpr',     label:'ANPR',     icon:'./lib/assets/images/icons/icon-anpr.png',     href:placeholderLink('anpr') },
    { key:'desc',     label:'DESC',     icon:'./lib/assets/images/icons/icon-desc.png',     href:placeholderLink('desc') },
    { key:'reports',  label:'REPORTS',  icon:'./lib/assets/images/icons/icon-reports.png',  href:placeholderLink('reports') }
  ];

  function getAppName(app){
    return String(app?.label || app?.name || '').trim();
  }

  function sortAppsByName(apps = []){
    return (apps || []).slice().sort((a, b) => {
      const nameA = getAppName(a).toLocaleLowerCase();
      const nameB = getAppName(b).toLocaleLowerCase();
      return nameA.localeCompare(nameB, undefined, { sensitivity:'base' });
    });
  }

  function getDefaultApps(){
    return sortAppsByName(baseApps).map(app => ({ ...app }));
  }

  window.BASE_APPS = baseApps;
  window.getDefaultApps = getDefaultApps;
  window.sortAppsByName = sortAppsByName;
})();
