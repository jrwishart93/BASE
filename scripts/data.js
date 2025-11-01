const placeholderLink = name => `https://placeholder.local/${name}`;
window.Apps = [
  { key:"intranet", label:"INTRANET", icon:"./lib/assets/images/icons/icon-intranet.png", href:placeholderLink('intranet') },
  { key:"storm",    label:"STORM",    icon:"./lib/assets/images/icons/icon-storm.png",    href:placeholderLink('storm') },
  { key:"case",     label:"CASE",     icon:"./lib/assets/images/icons/icon-case.png",     href:placeholderLink('case') },
  { key:"insight",  label:"INSIGHT",  icon:"./lib/assets/images/icons/icon-insight.png",  href:placeholderLink('insight') },
  { key:"unifi",    label:"UNIFI",    icon:"./lib/assets/images/icons/icon-unifi.png",    href:placeholderLink('unifi') },
  { key:"pronto",   label:"PRONTO",   icon:"./lib/assets/images/icons/icon-pronto.png",   href:placeholderLink('pronto') },
  { key:"anpr",     label:"ANPR",     icon:"./lib/assets/images/icons/icon-anpr.png",     href:placeholderLink('anpr') },
  { key:"desc",     label:"DESC",     icon:"./lib/assets/images/icons/icon-desc.png",     href:placeholderLink('desc') },
  { key:"reports",  label:"REPORTS",  icon:"./lib/assets/images/icons/icon-reports.png",  href:placeholderLink('reports') }
];

window.RecentRecoveries = [
  { title:"Stolen motorcycle", tag:"Vehicle", meta:"Recovered • 1 day ago" },
  { title:"Class A drugs",     tag:"Evidence", meta:"Confiscated • 1 day ago" },
  { title:"Missing person",    tag:"Welfare", meta:"Located • 3 hours ago" }
];
