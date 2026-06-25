import fs from 'fs';
import path from 'path';

const SCHEMAS_DIR = path.join(import.meta.dirname, '..', 'schemas');

const WIZARD_KPIS = [
  { id: 'fuel-consumption', label: 'Fuel consumption' },
  { id: 'idle-time', label: 'Idle time' },
  { id: 'utilization', label: 'Utilization' },
  { id: 'harsh-driving', label: 'Harsh driving' },
  { id: 'mileage', label: 'Mileage' },
  { id: 'overspeed', label: 'Overspeed' },
  { id: 'connectivity', label: 'Connectivity' },
  { id: 'trip-count', label: 'Trip count' },
  { id: 'geofence', label: 'Geofencing' },
  { id: 'engine-health', label: 'Engine health' },
];

const KPI_PATTERNS = {
  'fuel-consumption': ['mileage', 'distance', 'km', 'fuel'],
  'idle-time': ['idle', 'idling', 'parked', 'stopped'],
  'utilization': ['active', 'moving', 'online', 'registered', 'utilization', 'trip', 'engine hour'],
  'harsh-driving': ['harsh', 'braking', 'acceleration', 'overspeed', 'speeding', 'violation', 'aggressive', 'score', 'event'],
  'mileage': ['mileage', 'distance', 'km'],
  'overspeed': ['overspeed', 'speeding', 'max speed', 'speed avg', 'speed 120'],
  'connectivity': ['online', 'offline', 'signal', 'gps offline', 'connect', 'stale gps', 'gps gap'],
  'trip-count': ['trip', 'drive time'],
  'geofence': ['zone', 'geofence', 'crossing', 'retention'],
  'engine-health': ['engine', 'temp', 'rpm', 'overheat', '°c', 'reefer', 'battery voltage'],
};

const GOALS = {
  'equipment-health': ['hw-status', 'engine-operation', 'hw-asset-detail', 'fleet-anomaly', 'object-status', 'premium-safety-security'],
  'driver-safety': ['premium-safety-security', 'driver-performance', 'behavior-impact', 'fleet-performance', 'fleet-anomaly', 'leasing'],
  'sla': ['object-status', 'hw-status', 'fleet-reports', 'fleet-anomaly', 'fleet-performance', 'premium-safety-security'],
  'routes': ['trips-yesterday', 'trip-operations', 'fleet-reports', 'fleet-performance', 'behavior-impact'],
  'custom-analytics': ['fleet-performance', 'premium-safety-security', 'fleet-reports', 'behavior-impact', 'vehicle-mileage', 'driver-performance'],
};

const ROLE_TEMPLATE_ORDER = {
  'fleet-manager': ['premium-safety-security', 'fleet-performance', 'driver-performance', 'behavior-impact', 'fleet-anomaly', 'fleet-reports', 'vehicle-mileage', 'trip-operations', 'trips-yesterday', 'object-status', 'hw-status', 'engine-operation', 'leasing', 'hw-asset-detail'],
  'operations-manager': ['trip-operations', 'trips-yesterday', 'behavior-impact', 'fleet-performance', 'fleet-reports', 'driver-performance', 'premium-safety-security', 'fleet-anomaly', 'object-status', 'hw-status', 'vehicle-mileage', 'engine-operation', 'leasing', 'hw-asset-detail'],
  dispatcher: ['trips-yesterday', 'hw-status', 'object-status', 'hw-asset-detail', 'trip-operations', 'fleet-reports', 'fleet-anomaly', 'fleet-performance', 'premium-safety-security', 'vehicle-mileage', 'behavior-impact', 'driver-performance', 'engine-operation', 'leasing'],
  'maintenance-manager': ['engine-operation', 'hw-status', 'hw-asset-detail', 'premium-safety-security', 'fleet-anomaly', 'trip-operations', 'fleet-performance', 'behavior-impact', 'fleet-reports', 'object-status', 'trips-yesterday', 'driver-performance', 'vehicle-mileage', 'leasing'],
  'finance-manager': ['leasing', 'vehicle-mileage', 'behavior-impact', 'fleet-reports', 'driver-performance', 'fleet-performance', 'trip-operations', 'trips-yesterday', 'premium-safety-security', 'fleet-anomaly', 'object-status', 'hw-status', 'engine-operation', 'hw-asset-detail'],
  'partner-admin': ['hw-status', 'object-status', 'fleet-reports', 'premium-safety-security', 'fleet-performance', 'fleet-anomaly', 'trips-yesterday', 'trip-operations', 'vehicle-mileage', 'behavior-impact', 'driver-performance', 'engine-operation', 'leasing', 'hw-asset-detail'],
};

const TEMPLATES = {
  'fleet-anomaly': { file: '01-fleet-anomaly-monitor-schema.json', reportType: 'anomalies', categories: ['Anomalies', 'Safety', 'Geofencing'], period: 'Last 30 days', focus: 'Anomaly detection' },
  'fleet-performance': { file: '02-fleet-performance-dashboard-schema.json', reportType: 'fleet-overview', categories: ['Fleet overview', 'Safety', 'Geofencing'], period: 'Last 30 days', focus: 'Full fleet KPIs' },
  'fleet-reports': { file: '03-fleet-reports-dashboard-schema.json', reportType: 'fleet-overview', categories: ['Fleet overview', 'Live status', 'Mileage'], period: 'Last 30 days', focus: 'Ops snapshot + map' },
  'trip-operations': { file: '04-hm-trip-operations-dashboard-schema.json', reportType: 'trips', categories: ['Trips', 'Fleet overview'], period: 'Yesterday & last 7 days', focus: 'Shift-based trips' },
  'engine-operation': { file: '05-heavy-machinery-engine-operation-schema.json', reportType: 'hardware', categories: ['Engine & workload', 'Hardware'], period: 'Last 7 days', focus: 'Engine & workload' },
  leasing: { file: '06-leasing-dashboard-schema.json', reportType: 'mileage-finance', categories: ['Finance & leasing', 'Behavior'], period: 'Last 72 hours', focus: 'Contracts & idle cost' },
  'object-status': { file: '07-object-status-dashboard-schema.json', reportType: 'live-status', categories: ['Live status', 'Fleet overview'], period: 'Last 72 hours', focus: 'Live connectivity' },
  'trips-yesterday': { file: '08-trips-dashboard-yesterday-schema.json', reportType: 'trips', categories: ['Trips', 'Mileage'], period: 'Yesterday', focus: 'Yesterday deep-dive' },
  'vehicle-mileage': { file: '09-vehicle-mileage-dashboard-schema.json', reportType: 'mileage-finance', categories: ['Mileage', 'Finance & leasing'], period: 'Last 72 hours', focus: 'Mileage by time category' },
  'premium-safety-security': { file: '10-premium-safety-security-dashboard-schema.json', reportType: 'safety-security', categories: ['Safety & security', 'Geofencing', 'Anomalies'], period: 'Last 24 hours', focus: 'Premium 24h safety' },
  'hw-status': { file: '11-hw-status-dashboard-schema.json', reportType: 'hardware', categories: ['Hardware', 'Live status'], period: 'Last 72 hours', focus: 'Device telematics health' },
  'driver-performance': { file: '12-driver-performance-dashboard-schema.json', reportType: 'driver-behavior', categories: ['Driver scoring', 'Safety'], period: 'Last month', focus: '0–100 driving score' },
  'behavior-impact': { file: '13-behavior-impact-dashboard-schema.json', reportType: 'driver-behavior', categories: ['Behavior', 'Safety'], period: 'Last 7 days', focus: 'Weekly behavior trends' },
  'hw-asset-detail': { file: '14-hw-asset-detail-dashboard-schema.json', reportType: 'hardware', categories: ['Hardware', 'Live status'], period: 'Last 24 hours', focus: 'Single-asset drill-down' },
};

function matchWizardKpis(title) {
  const t = title.toLowerCase();
  return Object.entries(KPI_PATTERNS)
    .filter(([, patterns]) => patterns.some((p) => t.includes(p)))
    .map(([id]) => id);
}

function matchGoals(templateId) {
  return Object.entries(GOALS)
    .filter(([, list]) => list.includes(templateId))
    .map(([g]) => g);
}

function roleTags(templateId) {
  const tags = [];
  for (const [role, list] of Object.entries(ROLE_TEMPLATE_ORDER)) {
    const idx = list.indexOf(templateId);
    if (idx === -1) continue;
    if (idx < 3) tags.push(`#role/${role}★`);
    else if (idx < 6) tags.push(`#role/${role}`);
  }
  return tags;
}

function inferDescription(title) {
  const t = title.toLowerCase();
  const map = [
    [/total vehicles|registered objects/, 'Count of fleet objects registered in master data'],
    [/online/, 'Objects with recent GPS/telematics signal (typically within online threshold)'],
    [/offline/, 'Objects without recent signal within defined offline window'],
    [/standby/, 'Objects in standby connectivity state between online and offline thresholds'],
    [/no signal|stale gps|gps gap/, 'Objects with missing or severely degraded GPS connectivity'],
    [/moving/, 'Objects currently in motion based on speed / movement state'],
    [/stopped/, 'Objects stopped (not parked) — short standstill with engine potentially on'],
    [/parked/, 'Objects in extended standstill / parked state'],
    [/mileage|distance.*km/, 'Distance traveled aggregated over the dashboard time window'],
    [/trip/, 'Trip-related count, duration, or distance metric'],
    [/speed|overspeed|speeding/, 'Speed violation or overspeed event count / severity'],
    [/idle|idling/, 'Engine-on idle time or idle event frequency'],
    [/zone|geofence|crossing/, 'Geozone visit, crossing, or geofence compliance metric'],
    [/engine/, 'Engine hours, temperature, or engine-related workload'],
    [/score/, 'Composite driving performance score (0–100 scale)'],
    [/harsh|aggressive|braking|acceleration/, 'Harsh driving or driver-performance event'],
    [/rpm/, 'High engine RPM events indicating aggressive driving or mechanical stress'],
    [/temp|°c|reefer/, 'Temperature excursion or thermal asset condition'],
    [/door/, 'Door open / cargo access security event'],
    [/panic|sos/, 'Driver panic or SOS alarm activation'],
    [/gnss|satellite/, 'GNSS quality degradation (low satellite count while moving)'],
    [/battery/, 'Battery voltage drop or power supply anomaly'],
    [/night/, 'Trips or events during night hours (elevated risk window)'],
    [/retention/, 'Share of trips remaining inside assigned zones'],
  ];
  for (const [re, desc] of map) {
    if (re.test(t)) return desc;
  }
  return 'KPI/stat panel — see dashboard markdown for SQL detail';
}

function inferValue(title, categories) {
  const t = title.toLowerCase();
  if (/online|active|moving/.test(t)) return 'Fleet utilization and SLA availability — identifies deployable capacity';
  if (/offline|no signal|gps offline|stale/.test(t)) return 'Early warning for device failures and data gaps before ops impact';
  if (/overspeed|speeding|harsh|aggressive|violation|score/.test(t)) return 'Safety risk reduction, insurance, and driver coaching prioritization';
  if (/mileage|distance|km/.test(t)) return 'Cost allocation, fuel planning, and contract / leasing utilization proof';
  if (/idle|idling/.test(t)) return 'Fuel waste and emissions reduction; leasing idle penalties';
  if (/zone|geofence|crossing/.test(t)) return 'Site compliance, security perimeter control, and route adherence';
  if (/engine|temp|rpm/.test(t)) return 'Preventive maintenance and downtime avoidance';
  if (/door|panic|sos|unauthorized/.test(t)) return 'Cargo security, theft response, and incident escalation';
  if (/trip/.test(t)) return 'Operational throughput measurement and shift planning';
  if (categories.includes('Finance & leasing')) return 'Financial exposure and contract compliance monitoring';
  return 'Operational visibility and exception management for the target audience';
}

let md = `# Dashboard metrics catalog

Reference for all **KPI / stat** metrics across Grafana-compatible dashboard schemas in this folder. Each metric is tagged by **onboarding role**, **report type**, **wizard business goal**, and **wizard KPI theme** for search and filtering.

> **Scope:** 14 template dashboards · **113** KPI/stat metrics · companion per-dashboard docs: NN-*-dashboard.md

---

## Tag legend

| Prefix | Meaning | Example |
|--------|---------|---------|
| #role/… | Onboarding role; ★ = top-3 recommended template for that role | #role/dispatcher★ |
| #type/… | Report type (dashboard family) | #type/live-status |
| #category/… | Template category from catalog | #category/Safety |
| #goal/… | Dashboard Wizard business goal | #goal/sla |
| #wizard/… | Dashboard Wizard KPI theme (title match) | #wizard/connectivity |
| #panel/kpi / #panel/stat | Panel visualization type | #panel/stat |

---

## Report types (#type/…)

| Tag | Description |
|-----|-------------|
| #type/fleet-overview | Utilization, mileage, drivers, consolidated ops reports |
| #type/safety-security | Premium safety, geofence, cargo, SOS monitoring |
| #type/trips | Trip counts, durations, shifts, yesterday drill-downs |
| #type/live-status | Online/offline, movement, connectivity breakdowns |
| #type/hardware | Device health, engine workload, asset drill-down |
| #type/mileage-finance | Mileage breakdown, leasing, idle time, cost metrics |
| #type/driver-behavior | Driving scores, idling, aggression, behavior trends |
| #type/anomalies | GPS loss, long stops, abnormal geozone activity |

---

## Onboarding roles (#role/…)

| Tag | Audience |
|-----|----------|
| #role/fleet-manager | Fleet health, utilization, safety KPIs |
| #role/operations-manager | Daily operations and trip throughput |
| #role/dispatcher | Live status and trip visibility for dispatch |
| #role/maintenance-manager | Hardware health, engines, diagnostics |
| #role/finance-manager | Mileage, leasing, financial fleet metrics |
| #role/partner-admin | Multi-tenant / partner fleet visibility |

---

## Dashboard Wizard goals (#goal/…)

| Tag | Label |
|-----|-------|
| #goal/equipment-health | Equipment health |
| #goal/driver-safety | Driver safety |
| #goal/sla | SLA / availability |
| #goal/routes | Routes & logistics |
| #goal/custom-analytics | Custom analytics |

---

## Wizard KPI themes (#wizard/…)

| Tag | Themes matched in metric titles |
|-----|--------------------------------|
| #wizard/fuel-consumption | mileage, distance, km, fuel |
| #wizard/idle-time | idle, idling, parked, stopped |
| #wizard/utilization | active, moving, online, trips, engine hours |
| #wizard/harsh-driving | harsh, braking, violations, score, events |
| #wizard/mileage | mileage, distance, km |
| #wizard/overspeed | overspeed, speeding, max speed |
| #wizard/connectivity | online, offline, signal, GPS gaps |
| #wizard/trip-count | trips, drive time |
| #wizard/geofence | zone, geofence, crossings |
| #wizard/engine-health | engine, temp, RPM, overheating |

---

## Dashboard index

| Schema | Template ID | Title | Period | Metrics | Detail doc |
|--------|-------------|-------|--------|---------|------------|
`;

for (const [tid, meta] of Object.entries(TEMPLATES)) {
  const schema = JSON.parse(fs.readFileSync(path.join(SCHEMAS_DIR, meta.file), 'utf8'));
  const count = (schema.panels || []).filter((p) => p.type === 'kpi' || p.type === 'stat').length;
  const doc = meta.file.replace('-schema.json', '.md');
  md += `| \`${meta.file}\` | \`${tid}\` | ${schema.title} | ${meta.period} | ${count} | [\`${doc}\`](./${doc}) |\n`;
}

md += '\n---\n\n';

for (const [tid, meta] of Object.entries(TEMPLATES)) {
  const schema = JSON.parse(fs.readFileSync(path.join(SCHEMAS_DIR, meta.file), 'utf8'));
  const panels = (schema.panels || []).filter((p) => p.type === 'kpi' || p.type === 'stat');
  const cats = meta.categories.map((c) => `#category/${c.replace(/ /g, '-')}`).join(' ');
  const goals = matchGoals(tid).map((g) => `#goal/${g}`).join(' ');
  const roles = roleTags(tid).join(' ');
  const typeTag = `#type/${meta.reportType}`;

  md += `## ${schema.title}\n\n`;
  md += `- **File:** \`${meta.file}\` · **Template:** \`${tid}\` · **UID:** \`${schema.uid || '—'}\`\n`;
  md += `- **Period:** ${meta.period} · **Focus:** ${meta.focus}\n`;
  md += `- **Tags:** ${typeTag} ${cats} ${goals} ${roles}\n`;
  if (schema.description) {
    md += `- **Description:** ${String(schema.description).replace(/\n/g, ' ')}\n`;
  }
  md += '\n';

  if (panels.length === 0) {
    md += '_No KPI/stat panels — drill-down dashboard (maps, charts, tables only)._\n\n';
    md += '---\n\n';
    continue;
  }

  md += '| Metric | Panel ID | Type | Description | Tags | Business value |\n';
  md += '|--------|----------|------|-------------|------|----------------|\n';

  for (const p of panels) {
    const wizard = matchWizardKpis(p.title).map((id) => `#wizard/${id}`).join(' ');
    const panelTag = `#panel/${p.type}`;
    const desc = inferDescription(p.title);
    const value = inferValue(p.title, meta.categories);
    const tags = [typeTag, panelTag, wizard].filter(Boolean).join(' ');
    const metric = p.title.replace(/\|/g, '\\|');
    md += `| ${metric} | ${p.id} | ${p.type} | ${desc} | ${tags} | ${value} |\n`;
  }
  md += '\n---\n\n';
}

md += '## Cross-dashboard metric themes\n\n';

for (const kpi of WIZARD_KPIS) {
  md += `### #wizard/${kpi.id} — ${kpi.label}\n\n`;
  const hits = [];
  for (const [tid, meta] of Object.entries(TEMPLATES)) {
    const schema = JSON.parse(fs.readFileSync(path.join(SCHEMAS_DIR, meta.file), 'utf8'));
    for (const p of (schema.panels || []).filter((p) => p.type === 'kpi' || p.type === 'stat')) {
      if (matchWizardKpis(p.title).includes(kpi.id)) {
        hits.push({ tid, title: p.title, id: p.id });
      }
    }
  }
  if (hits.length === 0) {
    md += '_No direct title matches in KPI/stat panels._\n\n';
    continue;
  }
  for (const h of hits) {
    md += `- **${h.title}** (\`${h.tid}\`, panel ${h.id})\n`;
  }
  md += '\n';
}

md += '## Maintenance notes\n\n';
md += '- Metric list is derived from *-schema.json panel titles (type: kpi or stat). Regenerate with: node scripts/generate-schemas-readme.mjs\n';
md += '- Role ★ marks templates in the **top 3** of each role catalog order (src/features/onboarding/templateCatalog.ts).\n';
md += '- Wizard KPI tags use the same substring rules as src/features/dashboard-wizard/catalog.ts.\n';
md += '- For SQL definitions, charts, and tables, see per-dashboard markdown files.\n';

fs.writeFileSync(path.join(SCHEMAS_DIR, 'README.md'), md);
console.log('Written schemas/README.md (' + md.length + ' chars)');
