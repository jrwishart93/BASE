const baseApps = typeof window.getDefaultApps === 'function'
  ? window.getDefaultApps()
  : [];

window.Apps = baseApps;

window.RecentRecoveries = [
  { title:"Stolen motorcycle", tag:"Vehicle", meta:"Recovered • 1 day ago" },
  { title:"Class A drugs",     tag:"Evidence", meta:"Confiscated • 1 day ago" },
  { title:"Missing person",    tag:"Welfare", meta:"Located • 3 hours ago" }
];
