# Dashboard metrics catalog

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
| `01-fleet-anomaly-monitor-schema.json` | `fleet-anomaly` | Fleet Anomaly Monitor | Last 30 days | 4 | [`01-fleet-anomaly-monitor.md`](./01-fleet-anomaly-monitor.md) |
| `02-fleet-performance-dashboard-schema.json` | `fleet-performance` | Fleet Performance Dashboard | Last 30 days | 16 | [`02-fleet-performance-dashboard.md`](./02-fleet-performance-dashboard.md) |
| `03-fleet-reports-dashboard-schema.json` | `fleet-reports` | Fleet Reports Dashboard | Last 30 days | 4 | [`03-fleet-reports-dashboard.md`](./03-fleet-reports-dashboard.md) |
| `04-hm-trip-operations-dashboard-schema.json` | `trip-operations` | Trip Operations Dashboard | Yesterday & last 7 days | 16 | [`04-hm-trip-operations-dashboard.md`](./04-hm-trip-operations-dashboard.md) |
| `05-heavy-machinery-engine-operation-schema.json` | `engine-operation` | Heavy Machinery – Actual engine operation | Last 7 days | 4 | [`05-heavy-machinery-engine-operation.md`](./05-heavy-machinery-engine-operation.md) |
| `06-leasing-dashboard-schema.json` | `leasing` | Leasing Dashboard | Last 72 hours | 3 | [`06-leasing-dashboard.md`](./06-leasing-dashboard.md) |
| `07-object-status-dashboard-schema.json` | `object-status` | Object Status Dashboard | Last 72 hours | 8 | [`07-object-status-dashboard.md`](./07-object-status-dashboard.md) |
| `08-trips-dashboard-yesterday-schema.json` | `trips-yesterday` | Trips Dashboard (Yesterday) | Yesterday | 8 | [`08-trips-dashboard-yesterday.md`](./08-trips-dashboard-yesterday.md) |
| `09-vehicle-mileage-dashboard-schema.json` | `vehicle-mileage` | Vehicle Mileage Dashboard | Last 72 hours | 2 | [`09-vehicle-mileage-dashboard.md`](./09-vehicle-mileage-dashboard.md) |
| `10-premium-safety-security-dashboard-schema.json` | `premium-safety-security` | Safety & Security | Last 24 hours | 33 | [`10-premium-safety-security-dashboard.md`](./10-premium-safety-security-dashboard.md) |
| `11-hw-status-dashboard-schema.json` | `hw-status` | HW Status Dashboard | Last 72 hours | 8 | [`11-hw-status-dashboard.md`](./11-hw-status-dashboard.md) |
| `12-driver-performance-dashboard-schema.json` | `driver-performance` | Driving Score Dashboard | Last month | 3 | [`12-driver-performance-dashboard.md`](./12-driver-performance-dashboard.md) |
| `13-behavior-impact-dashboard-schema.json` | `behavior-impact` | Behavior Impact Dashboard | Last 7 days | 4 | [`13-behavior-impact-dashboard.md`](./13-behavior-impact-dashboard.md) |
| `14-hw-asset-detail-dashboard-schema.json` | `hw-asset-detail` | HW Asset Detail Dashboard | Last 24 hours | 0 | [`14-hw-asset-detail-dashboard.md`](./14-hw-asset-detail-dashboard.md) |

---

## Fleet Anomaly Monitor

- **File:** `01-fleet-anomaly-monitor-schema.json` · **Template:** `fleet-anomaly` · **UID:** `generated-dashboard`
- **Period:** Last 30 days · **Focus:** Anomaly detection
- **Tags:** #type/anomalies #category/Anomalies #category/Safety #category/Geofencing #goal/equipment-health #goal/driver-safety #goal/sla #role/fleet-manager #role/maintenance-manager #role/partner-admin

| Metric | Panel ID | Type | Description | Tags | Business value |
|--------|----------|------|-------------|------|----------------|
| Total Vehicles | 1 | kpi | Count of fleet objects registered in master data | #type/anomalies #panel/kpi | Operational visibility and exception management for the target audience |
| GPS Offline 3+ Days | 2 | kpi | Objects without recent signal within defined offline window | #type/anomalies #panel/kpi #wizard/connectivity | Early warning for device failures and data gaps before ops impact |
| Long Stops 24h+ This Month | 3 | kpi | KPI/stat panel — see dashboard markdown for SQL detail | #type/anomalies #panel/kpi | Operational visibility and exception management for the target audience |
| Zone Exits 3+ This Month | 4 | kpi | Geozone visit, crossing, or geofence compliance metric | #type/anomalies #panel/kpi #wizard/geofence | Site compliance, security perimeter control, and route adherence |

---

## Fleet Performance Dashboard

- **File:** `02-fleet-performance-dashboard-schema.json` · **Template:** `fleet-performance` · **UID:** `fleet-performance-dashboard`
- **Period:** Last 30 days · **Focus:** Full fleet KPIs
- **Tags:** #type/fleet-overview #category/Fleet-overview #category/Safety #category/Geofencing #goal/driver-safety #goal/sla #goal/routes #goal/custom-analytics #role/fleet-manager★ #role/operations-manager #role/finance-manager #role/partner-admin
- **Description:** Fleet Performance Dashboard – Block 1: Fleet Overview

| Metric | Panel ID | Type | Description | Tags | Business value |
|--------|----------|------|-------------|------|----------------|
| Total Vehicles | 1 | kpi | Count of fleet objects registered in master data | #type/fleet-overview #panel/kpi | Operational visibility and exception management for the target audience |
| Total Mileage 30d (km) | 2 | kpi | Distance traveled aggregated over the dashboard time window | #type/fleet-overview #panel/kpi #wizard/fuel-consumption #wizard/mileage | Cost allocation, fuel planning, and contract / leasing utilization proof |
| Active Vehicles (24h) | 3 | kpi | KPI/stat panel — see dashboard markdown for SQL detail | #type/fleet-overview #panel/kpi #wizard/utilization | Fleet utilization and SLA availability — identifies deployable capacity |
| Speeding Events 30d | 4 | kpi | Speed violation or overspeed event count / severity | #type/fleet-overview #panel/kpi #wizard/harsh-driving #wizard/overspeed | Safety risk reduction, insurance, and driver coaching prioritization |
| Total Drivers | 21 | kpi | KPI/stat panel — see dashboard markdown for SQL detail | #type/fleet-overview #panel/kpi | Operational visibility and exception management for the target audience |
| Active Drivers 30d | 22 | kpi | KPI/stat panel — see dashboard markdown for SQL detail | #type/fleet-overview #panel/kpi #wizard/utilization | Fleet utilization and SLA availability — identifies deployable capacity |
| Avg Mileage per Driver 30d (km) | 23 | kpi | Distance traveled aggregated over the dashboard time window | #type/fleet-overview #panel/kpi #wizard/fuel-consumption #wizard/mileage | Cost allocation, fuel planning, and contract / leasing utilization proof |
| Drivers with Violations 30d | 24 | kpi | KPI/stat panel — see dashboard markdown for SQL detail | #type/fleet-overview #panel/kpi #wizard/harsh-driving | Safety risk reduction, insurance, and driver coaching prioritization |
| Speeding Events 30d | 31 | kpi | Speed violation or overspeed event count / severity | #type/fleet-overview #panel/kpi #wizard/harsh-driving #wizard/overspeed | Safety risk reduction, insurance, and driver coaching prioritization |
| Night Driving Events 30d | 32 | kpi | Trips or events during night hours (elevated risk window) | #type/fleet-overview #panel/kpi #wizard/harsh-driving | Operational visibility and exception management for the target audience |
| Avg Speed at Violation (km/h) | 33 | kpi | Speed violation or overspeed event count / severity | #type/fleet-overview #panel/kpi #wizard/fuel-consumption #wizard/harsh-driving #wizard/mileage | Safety risk reduction, insurance, and driver coaching prioritization |
| Max Speed Recorded 30d (km/h) | 34 | kpi | Speed violation or overspeed event count / severity | #type/fleet-overview #panel/kpi #wizard/fuel-consumption #wizard/mileage #wizard/overspeed | Cost allocation, fuel planning, and contract / leasing utilization proof |
| Total Zone Visits 30d | 41 | kpi | Geozone visit, crossing, or geofence compliance metric | #type/fleet-overview #panel/kpi #wizard/geofence | Site compliance, security perimeter control, and route adherence |
| Active Zones 30d | 42 | kpi | Geozone visit, crossing, or geofence compliance metric | #type/fleet-overview #panel/kpi #wizard/utilization #wizard/geofence | Fleet utilization and SLA availability — identifies deployable capacity |
| Avg Visit Duration 30d (min) | 43 | kpi | KPI/stat panel — see dashboard markdown for SQL detail | #type/fleet-overview #panel/kpi | Operational visibility and exception management for the target audience |
| Unique Vehicles in Zones 30d | 44 | kpi | Geozone visit, crossing, or geofence compliance metric | #type/fleet-overview #panel/kpi #wizard/geofence | Site compliance, security perimeter control, and route adherence |

---

## Fleet Reports Dashboard

- **File:** `03-fleet-reports-dashboard-schema.json` · **Template:** `fleet-reports` · **UID:** `fleet-reports-dashboard`
- **Period:** Last 30 days · **Focus:** Ops snapshot + map
- **Tags:** #type/fleet-overview #category/Fleet-overview #category/Live-status #category/Mileage #goal/sla #goal/routes #goal/custom-analytics #role/fleet-manager #role/operations-manager #role/dispatcher #role/finance-manager #role/partner-admin★
- **Description:** Dashboard based on sql_scripts/reports: speeding, inactive units, kilometers by zone, supply voltage, online/offline, average mileage.

| Metric | Panel ID | Type | Description | Tags | Business value |
|--------|----------|------|-------------|------|----------------|
| Online Units | 1 | kpi | Objects with recent GPS/telematics signal (typically within online threshold) | #type/fleet-overview #panel/kpi #wizard/utilization #wizard/connectivity | Fleet utilization and SLA availability — identifies deployable capacity |
| Offline Units | 2 | kpi | Objects without recent signal within defined offline window | #type/fleet-overview #panel/kpi #wizard/connectivity | Early warning for device failures and data gaps before ops impact |
| Units Inactive >5 Days | 3 | kpi | KPI/stat panel — see dashboard markdown for SQL detail | #type/fleet-overview #panel/kpi #wizard/utilization | Fleet utilization and SLA availability — identifies deployable capacity |
| Speeding Violations (30d) | 4 | kpi | Speed violation or overspeed event count / severity | #type/fleet-overview #panel/kpi #wizard/harsh-driving #wizard/overspeed | Safety risk reduction, insurance, and driver coaching prioritization |

---

## Trip Operations Dashboard

- **File:** `04-hm-trip-operations-dashboard-schema.json` · **Template:** `trip-operations` · **UID:** `trip-operations-dashboard`
- **Period:** Yesterday & last 7 days · **Focus:** Shift-based trips
- **Tags:** #type/trips #category/Trips #category/Fleet-overview #goal/routes #role/operations-manager★ #role/dispatcher #role/maintenance-manager
- **Description:** Dashboard generated from the trip metrics list and the provided example JSON. It uses processed_common_data.trips enriched with raw_business_data.objects and raw_business_data.vehicles so charts and tables show human-readable asset labels where available.

| Metric | Panel ID | Type | Description | Tags | Business value |
|--------|----------|------|-------------|------|----------------|
| Trips Yesterday (08:00–19:00) | 1 | kpi | Trip-related count, duration, or distance metric | #type/trips #panel/kpi #wizard/utilization #wizard/trip-count | Operational throughput measurement and shift planning |
| Trips Yesterday (19:00–08:00) | 2 | kpi | Trip-related count, duration, or distance metric | #type/trips #panel/kpi #wizard/utilization #wizard/trip-count | Operational throughput measurement and shift planning |
| Trips Last 7d (08:00–19:00) | 3 | kpi | Trip-related count, duration, or distance metric | #type/trips #panel/kpi #wizard/utilization #wizard/trip-count | Operational throughput measurement and shift planning |
| Trips Last 7d (19:00–08:00) | 4 | kpi | Trip-related count, duration, or distance metric | #type/trips #panel/kpi #wizard/utilization #wizard/trip-count | Operational throughput measurement and shift planning |
| Avg Trip Duration Yesterday (min) | 5 | kpi | Trip-related count, duration, or distance metric | #type/trips #panel/kpi #wizard/utilization #wizard/trip-count | Operational throughput measurement and shift planning |
| Avg Trip Distance Yesterday (km) | 6 | kpi | Distance traveled aggregated over the dashboard time window | #type/trips #panel/kpi #wizard/fuel-consumption #wizard/utilization #wizard/mileage #wizard/trip-count | Cost allocation, fuel planning, and contract / leasing utilization proof |
| Avg Trip Duration Last 7d (min) | 7 | kpi | Trip-related count, duration, or distance metric | #type/trips #panel/kpi #wizard/utilization #wizard/trip-count | Operational throughput measurement and shift planning |
| Avg Trip Distance Last 7d (km) | 8 | kpi | Distance traveled aggregated over the dashboard time window | #type/trips #panel/kpi #wizard/fuel-consumption #wizard/utilization #wizard/mileage #wizard/trip-count | Cost allocation, fuel planning, and contract / leasing utilization proof |
| Short Trips Yesterday (<5 min) | 9 | kpi | Trip-related count, duration, or distance metric | #type/trips #panel/kpi #wizard/utilization #wizard/trip-count | Operational throughput measurement and shift planning |
| Short Trips Last 7d (<5 min) | 10 | kpi | Trip-related count, duration, or distance metric | #type/trips #panel/kpi #wizard/utilization #wizard/trip-count | Operational throughput measurement and shift planning |
| Long Trips Yesterday (>8 h) | 11 | kpi | Trip-related count, duration, or distance metric | #type/trips #panel/kpi #wizard/utilization #wizard/trip-count | Operational throughput measurement and shift planning |
| Long Trips Last 7d (>8 h) | 12 | kpi | Trip-related count, duration, or distance metric | #type/trips #panel/kpi #wizard/utilization #wizard/trip-count | Operational throughput measurement and shift planning |
| Trips with MAX speed 120+ (yesterday) | 23 | stat | Trip-related count, duration, or distance metric | #type/trips #panel/stat #wizard/utilization #wizard/overspeed #wizard/trip-count | Operational throughput measurement and shift planning |
| Trips with MAX speed 120+ (7days) | 24 | kpi | Trip-related count, duration, or distance metric | #type/trips #panel/kpi #wizard/utilization #wizard/overspeed #wizard/trip-count | Operational throughput measurement and shift planning |
| Trips with speed AVG 80km/h+ (yesterday) | 21 | kpi | Trip-related count, duration, or distance metric | #type/trips #panel/kpi #wizard/fuel-consumption #wizard/utilization #wizard/mileage #wizard/overspeed #wizard/trip-count | Cost allocation, fuel planning, and contract / leasing utilization proof |
| Trips with speed AVG 80km/h+ (7 days) | 22 | kpi | Trip-related count, duration, or distance metric | #type/trips #panel/kpi #wizard/fuel-consumption #wizard/utilization #wizard/mileage #wizard/overspeed #wizard/trip-count | Cost allocation, fuel planning, and contract / leasing utilization proof |

---

## Heavy Machinery – Actual engine operation

- **File:** `05-heavy-machinery-engine-operation-schema.json` · **Template:** `engine-operation` · **UID:** `heavy-machinery-dashboard`
- **Period:** Last 7 days · **Focus:** Engine & workload
- **Tags:** #type/hardware #category/Engine-&-workload #category/Hardware #goal/equipment-health #role/maintenance-manager★
- **Description:** Workload, usage by time, zone visits, overheating, operator scoring. Idle (ignition ON, engine OFF) excluded — no data in current dataset.

| Metric | Panel ID | Type | Description | Tags | Business value |
|--------|----------|------|-------------|------|----------------|
| Total engine hours (1d) | 1 | kpi | Engine hours, temperature, or engine-related workload | #type/hardware #panel/kpi #wizard/utilization #wizard/engine-health | Preventive maintenance and downtime avoidance |
| Zone visits (1d) | 2 | kpi | Geozone visit, crossing, or geofence compliance metric | #type/hardware #panel/kpi #wizard/geofence | Site compliance, security perimeter control, and route adherence |
| Units with temp >95°C (1d) | 3 | kpi | Temperature excursion or thermal asset condition | #type/hardware #panel/kpi #wizard/engine-health | Preventive maintenance and downtime avoidance |
| Unauthorized km (1d) | 4 | kpi | KPI/stat panel — see dashboard markdown for SQL detail | #type/hardware #panel/kpi #wizard/fuel-consumption #wizard/mileage | Cost allocation, fuel planning, and contract / leasing utilization proof |

---

## Leasing Dashboard

- **File:** `06-leasing-dashboard-schema.json` · **Template:** `leasing` · **UID:** `leasing-dashboard`
- **Period:** Last 72 hours · **Focus:** Contracts & idle cost
- **Tags:** #type/mileage-finance #category/Finance-&-leasing #category/Behavior #goal/driver-safety #role/finance-manager★
- **Description:** Leasing dashboard

| Metric | Panel ID | Type | Description | Tags | Business value |
|--------|----------|------|-------------|------|----------------|
| Total Idle Events | 16 | stat | Engine-on idle time or idle event frequency | #type/mileage-finance #panel/stat #wizard/idle-time #wizard/harsh-driving | Fuel waste and emissions reduction; leasing idle penalties |
| Total Idle Time(min) | 6 | kpi | Engine-on idle time or idle event frequency | #type/mileage-finance #panel/kpi #wizard/idle-time | Fuel waste and emissions reduction; leasing idle penalties |
| Average Idle Duration(min) | 19 | stat | Engine-on idle time or idle event frequency | #type/mileage-finance #panel/stat #wizard/idle-time | Fuel waste and emissions reduction; leasing idle penalties |

---

## Object Status Dashboard

- **File:** `07-object-status-dashboard-schema.json` · **Template:** `object-status` · **UID:** `object-status-dashboard`
- **Period:** Last 72 hours · **Focus:** Live connectivity
- **Tags:** #type/live-status #category/Live-status #category/Fleet-overview #goal/equipment-health #goal/sla #role/dispatcher★ #role/partner-admin★
- **Description:** Object status monitoring dashboard

| Metric | Panel ID | Type | Description | Tags | Business value |
|--------|----------|------|-------------|------|----------------|
| Online | 9 | kpi | Objects with recent GPS/telematics signal (typically within online threshold) | #type/live-status #panel/kpi #wizard/utilization #wizard/connectivity | Fleet utilization and SLA availability — identifies deployable capacity |
| Total Registered Objects | 1 | kpi | Count of fleet objects registered in master data | #type/live-status #panel/kpi #wizard/utilization | Operational visibility and exception management for the target audience |
| Standby | 2 | kpi | Objects in standby connectivity state between online and offline thresholds | #type/live-status #panel/kpi | Operational visibility and exception management for the target audience |
| Parked | 3 | kpi | Objects in extended standstill / parked state | #type/live-status #panel/kpi #wizard/idle-time | Operational visibility and exception management for the target audience |
| Moving | 6 | kpi | Objects currently in motion based on speed / movement state | #type/live-status #panel/kpi #wizard/utilization | Fleet utilization and SLA availability — identifies deployable capacity |
| Offline | 7 | kpi | Objects without recent signal within defined offline window | #type/live-status #panel/kpi #wizard/connectivity | Early warning for device failures and data gaps before ops impact |
| No Signal | 8 | kpi | Objects with missing or severely degraded GPS connectivity | #type/live-status #panel/kpi #wizard/connectivity | Early warning for device failures and data gaps before ops impact |
| Stopped | 10 | kpi | Objects stopped (not parked) — short standstill with engine potentially on | #type/live-status #panel/kpi #wizard/idle-time | Operational visibility and exception management for the target audience |

---

## Trips Dashboard (Yesterday)

- **File:** `08-trips-dashboard-yesterday-schema.json` · **Template:** `trips-yesterday` · **UID:** `trips-dashboard-yesterday`
- **Period:** Yesterday · **Focus:** Yesterday deep-dive
- **Tags:** #type/trips #category/Trips #category/Mileage #goal/routes #role/operations-manager★ #role/dispatcher★
- **Description:** Trips dashboard based on processed_common_data.trips for yesterday with indicators on top and maximum two bar charts per row

| Metric | Panel ID | Type | Description | Tags | Business value |
|--------|----------|------|-------------|------|----------------|
| Total Trips | 1 | stat | Trip-related count, duration, or distance metric | #type/trips #panel/stat #wizard/utilization #wizard/trip-count | Operational throughput measurement and shift planning |
| Total Distance (km) | 2 | stat | Distance traveled aggregated over the dashboard time window | #type/trips #panel/stat #wizard/fuel-consumption #wizard/mileage | Cost allocation, fuel planning, and contract / leasing utilization proof |
| Total Drive Time (hours) | 3 | stat | KPI/stat panel — see dashboard markdown for SQL detail | #type/trips #panel/stat #wizard/trip-count | Operational visibility and exception management for the target audience |
| Active Vehicles | 4 | stat | KPI/stat panel — see dashboard markdown for SQL detail | #type/trips #panel/stat #wizard/utilization | Fleet utilization and SLA availability — identifies deployable capacity |
| Average Trip Distance (km) | 5 | stat | Distance traveled aggregated over the dashboard time window | #type/trips #panel/stat #wizard/fuel-consumption #wizard/utilization #wizard/mileage #wizard/trip-count | Cost allocation, fuel planning, and contract / leasing utilization proof |
| Average Speed (km/h) | 6 | stat | Speed violation or overspeed event count / severity | #type/trips #panel/stat #wizard/fuel-consumption #wizard/mileage | Cost allocation, fuel planning, and contract / leasing utilization proof |
| Peak Speed Observed (km/h) | 7 | stat | Speed violation or overspeed event count / severity | #type/trips #panel/stat #wizard/fuel-consumption #wizard/mileage | Cost allocation, fuel planning, and contract / leasing utilization proof |
| Zone Retention Rate (%) | 8 | stat | Geozone visit, crossing, or geofence compliance metric | #type/trips #panel/stat #wizard/geofence | Site compliance, security perimeter control, and route adherence |

---

## Vehicle Mileage Dashboard

- **File:** `09-vehicle-mileage-dashboard-schema.json` · **Template:** `vehicle-mileage` · **UID:** `vehicle-mileage`
- **Period:** Last 72 hours · **Focus:** Mileage by time category
- **Tags:** #type/mileage-finance #category/Mileage #category/Finance-&-leasing #goal/custom-analytics #role/finance-manager★
- **Description:** vehicle-mileage

| Metric | Panel ID | Type | Description | Tags | Business value |
|--------|----------|------|-------------|------|----------------|
| Mileage per Vehicle, km | 6 | kpi | Distance traveled aggregated over the dashboard time window | #type/mileage-finance #panel/kpi #wizard/fuel-consumption #wizard/mileage | Cost allocation, fuel planning, and contract / leasing utilization proof |
| Total Mileage, km | 1 | kpi | Distance traveled aggregated over the dashboard time window | #type/mileage-finance #panel/kpi #wizard/fuel-consumption #wizard/mileage | Cost allocation, fuel planning, and contract / leasing utilization proof |

---

## Safety & Security

- **File:** `10-premium-safety-security-dashboard-schema.json` · **Template:** `premium-safety-security` · **UID:** `premium-safety-security-dashboard`
- **Period:** Last 24 hours · **Focus:** Premium 24h safety
- **Tags:** #type/safety-security #category/Safety-&-security #category/Geofencing #category/Anomalies #goal/equipment-health #goal/driver-safety #goal/sla #goal/custom-analytics #role/fleet-manager★ #role/maintenance-manager #role/partner-admin
- **Description:** Premium Safety & Security: 8 summary KPI, 8 charts (deduped: bar/pie/timeseries/line). Overspeed from trips.max_speed vs vehicles.max_speed; temp excursions 25–75°C non-reefer by unique device; reefer by sensor_label + heuristic, unique devices.

| Metric | Panel ID | Type | Description | Tags | Business value |
|--------|----------|------|-------------|------|----------------|
| Geofence crossings (24h) | 1 | kpi | Geozone visit, crossing, or geofence compliance metric | #type/safety-security #panel/kpi #wizard/geofence | Site compliance, security perimeter control, and route adherence |
| Overspeed trips (24h) | 2 | kpi | Trip-related count, duration, or distance metric | #type/safety-security #panel/kpi #wizard/utilization #wizard/harsh-driving #wizard/overspeed #wizard/trip-count | Safety risk reduction, insurance, and driver coaching prioritization |
| Driver performance braking (24h) | 3 | kpi | Harsh driving or driver-performance event | #type/safety-security #panel/kpi #wizard/harsh-driving | Operational visibility and exception management for the target audience |
| Driver performance acceleration (24h) | 4 | kpi | Harsh driving or driver-performance event | #type/safety-security #panel/kpi #wizard/harsh-driving | Operational visibility and exception management for the target audience |
| Temp excursions (25–75°C) | 5 | kpi | Temperature excursion or thermal asset condition | #type/safety-security #panel/kpi #wizard/engine-health | Preventive maintenance and downtime avoidance |
| GNSS degraded (<3 sats, moving) | 6 | kpi | Objects currently in motion based on speed / movement state | #type/safety-security #panel/kpi #wizard/utilization | Fleet utilization and SLA availability — identifies deployable capacity |
| Door events / alarm 969 (24h) | 7 | kpi | Door open / cargo access security event | #type/safety-security #panel/kpi #wizard/harsh-driving | Cargo security, theft response, and incident escalation |
| Panic / SOS (24h) | 8 | kpi | Driver panic or SOS alarm activation | #type/safety-security #panel/kpi | Cargo security, theft response, and incident escalation |
| Geofence violation (crossings) | 501 | kpi | Geozone visit, crossing, or geofence compliance metric | #type/safety-security #panel/kpi #wizard/harsh-driving #wizard/geofence | Safety risk reduction, insurance, and driver coaching prioritization |
| Risk zone exposure (h) | 502 | kpi | Geozone visit, crossing, or geofence compliance metric | #type/safety-security #panel/kpi #wizard/geofence | Site compliance, security perimeter control, and route adherence |
| After-hours trips (08–19) | 503 | kpi | Trip-related count, duration, or distance metric | #type/safety-security #panel/kpi #wizard/utilization #wizard/trip-count | Operational throughput measurement and shift planning |
| Unplanned stops ≥20 min | 504 | kpi | KPI/stat panel — see dashboard markdown for SQL detail | #type/safety-security #panel/kpi | Operational visibility and exception management for the target audience |
| Risk zone dwell >15 min | 505 | kpi | Geozone visit, crossing, or geofence compliance metric | #type/safety-security #panel/kpi #wizard/geofence | Site compliance, security perimeter control, and route adherence |
| Stale GPS >30 min | 506 | kpi | Objects with missing or severely degraded GPS connectivity | #type/safety-security #panel/kpi #wizard/connectivity | Early warning for device failures and data gaps before ops impact |
| External power anomalies | 507 | kpi | KPI/stat panel — see dashboard markdown for SQL detail | #type/safety-security #panel/kpi | Operational visibility and exception management for the target audience |
| Battery-only (TBD) | 508 | kpi | Battery voltage drop or power supply anomaly | #type/safety-security #panel/kpi | Operational visibility and exception management for the target audience |
| GNSS degraded (<3 sats) | 509 | kpi | GNSS quality degradation (low satellite count while moving) | #type/safety-security #panel/kpi | Operational visibility and exception management for the target audience |
| GPS gaps >15 min | 510 | kpi | Objects with missing or severely degraded GPS connectivity | #type/safety-security #panel/kpi #wizard/connectivity | Operational visibility and exception management for the target audience |
| Overspeed trips (24h) | 601 | kpi | Trip-related count, duration, or distance metric | #type/safety-security #panel/kpi #wizard/utilization #wizard/harsh-driving #wizard/overspeed #wizard/trip-count | Safety risk reduction, insurance, and driver coaching prioritization |
| Overspeed time (min) | 602 | kpi | Speed violation or overspeed event count / severity | #type/safety-security #panel/kpi #wizard/harsh-driving #wizard/overspeed | Safety risk reduction, insurance, and driver coaching prioritization |
| Driver performance braking (24h) | 603 | kpi | Harsh driving or driver-performance event | #type/safety-security #panel/kpi #wizard/harsh-driving | Operational visibility and exception management for the target audience |
| Driver performance acceleration (24h) | 604 | kpi | Harsh driving or driver-performance event | #type/safety-security #panel/kpi #wizard/harsh-driving | Operational visibility and exception management for the target audience |
| High-risk zone visits | 605 | kpi | Geozone visit, crossing, or geofence compliance metric | #type/safety-security #panel/kpi #wizard/geofence | Site compliance, security perimeter control, and route adherence |
| Night driving (23–05h) | 606 | kpi | Trips or events during night hours (elevated risk window) | #type/safety-security #panel/kpi | Operational visibility and exception management for the target audience |
| Driver panic button (24h) | 607 | kpi | Driver panic or SOS alarm activation | #type/safety-security #panel/kpi | Cargo security, theft response, and incident escalation |
| Driver inactive >3h | 608 | kpi | KPI/stat panel — see dashboard markdown for SQL detail | #type/safety-security #panel/kpi #wizard/utilization | Fleet utilization and SLA availability — identifies deployable capacity |
| Temp excursions (25–75°C) | 701 | kpi | Temperature excursion or thermal asset condition | #type/safety-security #panel/kpi #wizard/engine-health | Preventive maintenance and downtime avoidance |
| Reefer out-of-band (unique objects) | 702 | kpi | Temperature excursion or thermal asset condition | #type/safety-security #panel/kpi #wizard/engine-health | Operational visibility and exception management for the target audience |
| Battery voltage drop | 703 | kpi | Battery voltage drop or power supply anomaly | #type/safety-security #panel/kpi #wizard/engine-health | Operational visibility and exception management for the target audience |
| Engine temperature alerts | 704 | kpi | Engine hours, temperature, or engine-related workload | #type/safety-security #panel/kpi #wizard/engine-health | Preventive maintenance and downtime avoidance |
| Door open events (24h) | 801 | kpi | Door open / cargo access security event | #type/safety-security #panel/kpi #wizard/harsh-driving | Cargo security, theft response, and incident escalation |
| Unauthorized door open | 802 | kpi | Door open / cargo access security event | #type/safety-security #panel/kpi | Cargo security, theft response, and incident escalation |
| Door open duration (min) | 803 | kpi | Door open / cargo access security event | #type/safety-security #panel/kpi | Cargo security, theft response, and incident escalation |

---

## HW Status Dashboard

- **File:** `11-hw-status-dashboard-schema.json` · **Template:** `hw-status` · **UID:** `hw-status-dashboard`
- **Period:** Last 72 hours · **Focus:** Device telematics health
- **Tags:** #type/hardware #category/Hardware #category/Live-status #goal/equipment-health #goal/sla #role/dispatcher★ #role/maintenance-manager★ #role/partner-admin★
- **Description:** HW Status dashboard. Panels: 8 KPI counters (Total/Moving/Stopped/Parked/NoSignal/Online/Standby/Offline), 2 pie charts (movement + connection status), device overview table (driver, statuses, location, freshness, satellites), last 20 telemetry events per device, current sensor readings, boolean activation table, boolean active duration + percentage bar charts.

| Metric | Panel ID | Type | Description | Tags | Business value |
|--------|----------|------|-------------|------|----------------|
| Total Registered Objects | 1 | kpi | Count of fleet objects registered in master data | #type/hardware #panel/kpi #wizard/utilization | Operational visibility and exception management for the target audience |
| Moving | 2 | kpi | Objects currently in motion based on speed / movement state | #type/hardware #panel/kpi #wizard/utilization | Fleet utilization and SLA availability — identifies deployable capacity |
| Stopped | 3 | kpi | Objects stopped (not parked) — short standstill with engine potentially on | #type/hardware #panel/kpi #wizard/idle-time | Operational visibility and exception management for the target audience |
| Parked | 4 | kpi | Objects in extended standstill / parked state | #type/hardware #panel/kpi #wizard/idle-time | Operational visibility and exception management for the target audience |
| No Signal | 5 | kpi | Objects with missing or severely degraded GPS connectivity | #type/hardware #panel/kpi #wizard/connectivity | Early warning for device failures and data gaps before ops impact |
| Online | 6 | kpi | Objects with recent GPS/telematics signal (typically within online threshold) | #type/hardware #panel/kpi #wizard/utilization #wizard/connectivity | Fleet utilization and SLA availability — identifies deployable capacity |
| Standby | 7 | kpi | Objects in standby connectivity state between online and offline thresholds | #type/hardware #panel/kpi | Operational visibility and exception management for the target audience |
| Offline | 8 | kpi | Objects without recent signal within defined offline window | #type/hardware #panel/kpi #wizard/connectivity | Early warning for device failures and data gaps before ops impact |

---

## Driving Score Dashboard

- **File:** `12-driver-performance-dashboard-schema.json` · **Template:** `driver-performance` · **UID:** `driving-score-dashboard`
- **Period:** Last month · **Focus:** 0–100 driving score
- **Tags:** #type/driver-behavior #category/Driver-scoring #category/Safety #goal/driver-safety #goal/custom-analytics #role/fleet-manager★ #role/operations-manager #role/finance-manager
- **Description:** Driving Score Dashboard — single data source: processed_common_data.driver_performance_events. 3 blocks: Vehicle Rating (score per km), Violation Counts (raw counts), Violations Detail (individual events). No hypertable scans — all violations pre-aggregated by triggers on tracking_data_core, states, inputs.

| Metric | Panel ID | Type | Description | Tags | Business value |
|--------|----------|------|-------------|------|----------------|
| Total Vehicles | 1 | kpi | Count of fleet objects registered in master data | #type/driver-behavior #panel/kpi | Operational visibility and exception management for the target audience |
| Avg Driving Score | 2 | kpi | Composite driving performance score (0–100 scale) | #type/driver-behavior #panel/kpi #wizard/harsh-driving | Safety risk reduction, insurance, and driver coaching prioritization |
| Total Events | 3 | kpi | KPI/stat panel — see dashboard markdown for SQL detail | #type/driver-behavior #panel/kpi #wizard/harsh-driving | Operational visibility and exception management for the target audience |

---

## Behavior Impact Dashboard

- **File:** `13-behavior-impact-dashboard-schema.json` · **Template:** `behavior-impact` · **UID:** `behavior-impact-dashboard`
- **Period:** Last 7 days · **Focus:** Weekly behavior trends
- **Tags:** #type/driver-behavior #category/Behavior #category/Safety #goal/driver-safety #goal/routes #goal/custom-analytics #role/fleet-manager #role/operations-manager★ #role/finance-manager★
- **Description:** Behavior Impact Dashboard without fuel metrics. 4 KPI big numbers + WoW barcharts (Idling, Aggressive Driving, High Speed, High RPM) + Route-Based Driver Impact table.

| Metric | Panel ID | Type | Description | Tags | Business value |
|--------|----------|------|-------------|------|----------------|
| Idling Events (7d) | 1 | kpi | Engine-on idle time or idle event frequency | #type/driver-behavior #panel/kpi #wizard/idle-time #wizard/harsh-driving | Fuel waste and emissions reduction; leasing idle penalties |
| Aggressive Driving Events (7d) | 6 | kpi | Harsh driving or driver-performance event | #type/driver-behavior #panel/kpi #wizard/harsh-driving | Safety risk reduction, insurance, and driver coaching prioritization |
| High RPM > 5000 Events (7d) | 7 | kpi | High engine RPM events indicating aggressive driving or mechanical stress | #type/driver-behavior #panel/kpi #wizard/harsh-driving #wizard/engine-health | Preventive maintenance and downtime avoidance |
| High Speed Trips (7d) | 8 | kpi | Trip-related count, duration, or distance metric | #type/driver-behavior #panel/kpi #wizard/utilization #wizard/trip-count | Operational throughput measurement and shift planning |

---

## HW Asset Detail Dashboard

- **File:** `14-hw-asset-detail-dashboard-schema.json` · **Template:** `hw-asset-detail` · **UID:** `hw-asset-detail-dashboard`
- **Period:** Last 24 hours · **Focus:** Single-asset drill-down
- **Tags:** #type/hardware #category/Hardware #category/Live-status #goal/equipment-health #role/dispatcher #role/maintenance-manager★
- **Description:** HW Asset Detail dashboard. Shows ONE asset selected via the ${object_label} template variable (Asset dropdown); the target CTE maps the label to a device_id from raw_business_data.objects. Panels: current location (geomap), current alarm state + triggering sensor (Unicode circle), sensor timeseries (hourly via sensors_data_by_hours, controlled by the time picker), boolean active % (7d), boolean state transitions (hourly approximation, like equipment working time), last 20 events. Alarm rules come from the params CTE (shutdown_boolean_labels placeholder, warn_battery_threshold=20). No UI dropdowns/parameters because runtime SQL params raise a syntax error in this Studio version.

_No KPI/stat panels — drill-down dashboard (maps, charts, tables only)._

---

## Cross-dashboard metric themes

### #wizard/fuel-consumption — Fuel consumption

- **Total Mileage 30d (km)** (`fleet-performance`, panel 2)
- **Avg Mileage per Driver 30d (km)** (`fleet-performance`, panel 23)
- **Avg Speed at Violation (km/h)** (`fleet-performance`, panel 33)
- **Max Speed Recorded 30d (km/h)** (`fleet-performance`, panel 34)
- **Avg Trip Distance Yesterday (km)** (`trip-operations`, panel 6)
- **Avg Trip Distance Last 7d (km)** (`trip-operations`, panel 8)
- **Trips with speed AVG 80km/h+ (yesterday)** (`trip-operations`, panel 21)
- **Trips with speed AVG 80km/h+ (7 days)** (`trip-operations`, panel 22)
- **Unauthorized km (1d)** (`engine-operation`, panel 4)
- **Total Distance (km)** (`trips-yesterday`, panel 2)
- **Average Trip Distance (km)** (`trips-yesterday`, panel 5)
- **Average Speed (km/h)** (`trips-yesterday`, panel 6)
- **Peak Speed Observed (km/h)** (`trips-yesterday`, panel 7)
- **Mileage per Vehicle, km** (`vehicle-mileage`, panel 6)
- **Total Mileage, km** (`vehicle-mileage`, panel 1)

### #wizard/idle-time — Idle time

- **Total Idle Events** (`leasing`, panel 16)
- **Total Idle Time(min)** (`leasing`, panel 6)
- **Average Idle Duration(min)** (`leasing`, panel 19)
- **Parked** (`object-status`, panel 3)
- **Stopped** (`object-status`, panel 10)
- **Stopped** (`hw-status`, panel 3)
- **Parked** (`hw-status`, panel 4)
- **Idling Events (7d)** (`behavior-impact`, panel 1)

### #wizard/utilization — Utilization

- **Active Vehicles (24h)** (`fleet-performance`, panel 3)
- **Active Drivers 30d** (`fleet-performance`, panel 22)
- **Active Zones 30d** (`fleet-performance`, panel 42)
- **Online Units** (`fleet-reports`, panel 1)
- **Units Inactive >5 Days** (`fleet-reports`, panel 3)
- **Trips Yesterday (08:00–19:00)** (`trip-operations`, panel 1)
- **Trips Yesterday (19:00–08:00)** (`trip-operations`, panel 2)
- **Trips Last 7d (08:00–19:00)** (`trip-operations`, panel 3)
- **Trips Last 7d (19:00–08:00)** (`trip-operations`, panel 4)
- **Avg Trip Duration Yesterday (min)** (`trip-operations`, panel 5)
- **Avg Trip Distance Yesterday (km)** (`trip-operations`, panel 6)
- **Avg Trip Duration Last 7d (min)** (`trip-operations`, panel 7)
- **Avg Trip Distance Last 7d (km)** (`trip-operations`, panel 8)
- **Short Trips Yesterday (<5 min)** (`trip-operations`, panel 9)
- **Short Trips Last 7d (<5 min)** (`trip-operations`, panel 10)
- **Long Trips Yesterday (>8 h)** (`trip-operations`, panel 11)
- **Long Trips Last 7d (>8 h)** (`trip-operations`, panel 12)
- **Trips with MAX speed 120+ (yesterday)** (`trip-operations`, panel 23)
- **Trips with MAX speed 120+ (7days)** (`trip-operations`, panel 24)
- **Trips with speed AVG 80km/h+ (yesterday)** (`trip-operations`, panel 21)
- **Trips with speed AVG 80km/h+ (7 days)** (`trip-operations`, panel 22)
- **Total engine hours (1d)** (`engine-operation`, panel 1)
- **Online** (`object-status`, panel 9)
- **Total Registered Objects** (`object-status`, panel 1)
- **Moving** (`object-status`, panel 6)
- **Total Trips** (`trips-yesterday`, panel 1)
- **Active Vehicles** (`trips-yesterday`, panel 4)
- **Average Trip Distance (km)** (`trips-yesterday`, panel 5)
- **Overspeed trips (24h)** (`premium-safety-security`, panel 2)
- **GNSS degraded (<3 sats, moving)** (`premium-safety-security`, panel 6)
- **After-hours trips (08–19)** (`premium-safety-security`, panel 503)
- **Overspeed trips (24h)** (`premium-safety-security`, panel 601)
- **Driver inactive >3h** (`premium-safety-security`, panel 608)
- **Total Registered Objects** (`hw-status`, panel 1)
- **Moving** (`hw-status`, panel 2)
- **Online** (`hw-status`, panel 6)
- **High Speed Trips (7d)** (`behavior-impact`, panel 8)

### #wizard/harsh-driving — Harsh driving

- **Speeding Events 30d** (`fleet-performance`, panel 4)
- **Drivers with Violations 30d** (`fleet-performance`, panel 24)
- **Speeding Events 30d** (`fleet-performance`, panel 31)
- **Night Driving Events 30d** (`fleet-performance`, panel 32)
- **Avg Speed at Violation (km/h)** (`fleet-performance`, panel 33)
- **Speeding Violations (30d)** (`fleet-reports`, panel 4)
- **Total Idle Events** (`leasing`, panel 16)
- **Overspeed trips (24h)** (`premium-safety-security`, panel 2)
- **Driver performance braking (24h)** (`premium-safety-security`, panel 3)
- **Driver performance acceleration (24h)** (`premium-safety-security`, panel 4)
- **Door events / alarm 969 (24h)** (`premium-safety-security`, panel 7)
- **Geofence violation (crossings)** (`premium-safety-security`, panel 501)
- **Overspeed trips (24h)** (`premium-safety-security`, panel 601)
- **Overspeed time (min)** (`premium-safety-security`, panel 602)
- **Driver performance braking (24h)** (`premium-safety-security`, panel 603)
- **Driver performance acceleration (24h)** (`premium-safety-security`, panel 604)
- **Door open events (24h)** (`premium-safety-security`, panel 801)
- **Avg Driving Score** (`driver-performance`, panel 2)
- **Total Events** (`driver-performance`, panel 3)
- **Idling Events (7d)** (`behavior-impact`, panel 1)
- **Aggressive Driving Events (7d)** (`behavior-impact`, panel 6)
- **High RPM > 5000 Events (7d)** (`behavior-impact`, panel 7)

### #wizard/mileage — Mileage

- **Total Mileage 30d (km)** (`fleet-performance`, panel 2)
- **Avg Mileage per Driver 30d (km)** (`fleet-performance`, panel 23)
- **Avg Speed at Violation (km/h)** (`fleet-performance`, panel 33)
- **Max Speed Recorded 30d (km/h)** (`fleet-performance`, panel 34)
- **Avg Trip Distance Yesterday (km)** (`trip-operations`, panel 6)
- **Avg Trip Distance Last 7d (km)** (`trip-operations`, panel 8)
- **Trips with speed AVG 80km/h+ (yesterday)** (`trip-operations`, panel 21)
- **Trips with speed AVG 80km/h+ (7 days)** (`trip-operations`, panel 22)
- **Unauthorized km (1d)** (`engine-operation`, panel 4)
- **Total Distance (km)** (`trips-yesterday`, panel 2)
- **Average Trip Distance (km)** (`trips-yesterday`, panel 5)
- **Average Speed (km/h)** (`trips-yesterday`, panel 6)
- **Peak Speed Observed (km/h)** (`trips-yesterday`, panel 7)
- **Mileage per Vehicle, km** (`vehicle-mileage`, panel 6)
- **Total Mileage, km** (`vehicle-mileage`, panel 1)

### #wizard/overspeed — Overspeed

- **Speeding Events 30d** (`fleet-performance`, panel 4)
- **Speeding Events 30d** (`fleet-performance`, panel 31)
- **Max Speed Recorded 30d (km/h)** (`fleet-performance`, panel 34)
- **Speeding Violations (30d)** (`fleet-reports`, panel 4)
- **Trips with MAX speed 120+ (yesterday)** (`trip-operations`, panel 23)
- **Trips with MAX speed 120+ (7days)** (`trip-operations`, panel 24)
- **Trips with speed AVG 80km/h+ (yesterday)** (`trip-operations`, panel 21)
- **Trips with speed AVG 80km/h+ (7 days)** (`trip-operations`, panel 22)
- **Overspeed trips (24h)** (`premium-safety-security`, panel 2)
- **Overspeed trips (24h)** (`premium-safety-security`, panel 601)
- **Overspeed time (min)** (`premium-safety-security`, panel 602)

### #wizard/connectivity — Connectivity

- **GPS Offline 3+ Days** (`fleet-anomaly`, panel 2)
- **Online Units** (`fleet-reports`, panel 1)
- **Offline Units** (`fleet-reports`, panel 2)
- **Online** (`object-status`, panel 9)
- **Offline** (`object-status`, panel 7)
- **No Signal** (`object-status`, panel 8)
- **Stale GPS >30 min** (`premium-safety-security`, panel 506)
- **GPS gaps >15 min** (`premium-safety-security`, panel 510)
- **No Signal** (`hw-status`, panel 5)
- **Online** (`hw-status`, panel 6)
- **Offline** (`hw-status`, panel 8)

### #wizard/trip-count — Trip count

- **Trips Yesterday (08:00–19:00)** (`trip-operations`, panel 1)
- **Trips Yesterday (19:00–08:00)** (`trip-operations`, panel 2)
- **Trips Last 7d (08:00–19:00)** (`trip-operations`, panel 3)
- **Trips Last 7d (19:00–08:00)** (`trip-operations`, panel 4)
- **Avg Trip Duration Yesterday (min)** (`trip-operations`, panel 5)
- **Avg Trip Distance Yesterday (km)** (`trip-operations`, panel 6)
- **Avg Trip Duration Last 7d (min)** (`trip-operations`, panel 7)
- **Avg Trip Distance Last 7d (km)** (`trip-operations`, panel 8)
- **Short Trips Yesterday (<5 min)** (`trip-operations`, panel 9)
- **Short Trips Last 7d (<5 min)** (`trip-operations`, panel 10)
- **Long Trips Yesterday (>8 h)** (`trip-operations`, panel 11)
- **Long Trips Last 7d (>8 h)** (`trip-operations`, panel 12)
- **Trips with MAX speed 120+ (yesterday)** (`trip-operations`, panel 23)
- **Trips with MAX speed 120+ (7days)** (`trip-operations`, panel 24)
- **Trips with speed AVG 80km/h+ (yesterday)** (`trip-operations`, panel 21)
- **Trips with speed AVG 80km/h+ (7 days)** (`trip-operations`, panel 22)
- **Total Trips** (`trips-yesterday`, panel 1)
- **Total Drive Time (hours)** (`trips-yesterday`, panel 3)
- **Average Trip Distance (km)** (`trips-yesterday`, panel 5)
- **Overspeed trips (24h)** (`premium-safety-security`, panel 2)
- **After-hours trips (08–19)** (`premium-safety-security`, panel 503)
- **Overspeed trips (24h)** (`premium-safety-security`, panel 601)
- **High Speed Trips (7d)** (`behavior-impact`, panel 8)

### #wizard/geofence — Geofencing

- **Zone Exits 3+ This Month** (`fleet-anomaly`, panel 4)
- **Total Zone Visits 30d** (`fleet-performance`, panel 41)
- **Active Zones 30d** (`fleet-performance`, panel 42)
- **Unique Vehicles in Zones 30d** (`fleet-performance`, panel 44)
- **Zone visits (1d)** (`engine-operation`, panel 2)
- **Zone Retention Rate (%)** (`trips-yesterday`, panel 8)
- **Geofence crossings (24h)** (`premium-safety-security`, panel 1)
- **Geofence violation (crossings)** (`premium-safety-security`, panel 501)
- **Risk zone exposure (h)** (`premium-safety-security`, panel 502)
- **Risk zone dwell >15 min** (`premium-safety-security`, panel 505)
- **High-risk zone visits** (`premium-safety-security`, panel 605)

### #wizard/engine-health — Engine health

- **Total engine hours (1d)** (`engine-operation`, panel 1)
- **Units with temp >95°C (1d)** (`engine-operation`, panel 3)
- **Temp excursions (25–75°C)** (`premium-safety-security`, panel 5)
- **Temp excursions (25–75°C)** (`premium-safety-security`, panel 701)
- **Reefer out-of-band (unique objects)** (`premium-safety-security`, panel 702)
- **Battery voltage drop** (`premium-safety-security`, panel 703)
- **Engine temperature alerts** (`premium-safety-security`, panel 704)
- **High RPM > 5000 Events (7d)** (`behavior-impact`, panel 7)

## Maintenance notes

- Metric list is derived from *-schema.json panel titles (type: kpi or stat). Regenerate with: node scripts/generate-schemas-readme.mjs
- Role ★ marks templates in the **top 3** of each role catalog order (src/features/onboarding/templateCatalog.ts).
- Wizard KPI tags use the same substring rules as src/features/dashboard-wizard/catalog.ts.
- For SQL definitions, charts, and tables, see per-dashboard markdown files.
