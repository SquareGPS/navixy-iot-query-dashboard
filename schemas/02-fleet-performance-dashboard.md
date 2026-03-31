# Fleet Performance Dashboard

- **File:** `02-fleet-performance-dashboard-schema.json`
- **UID:** `fleet-performance-dashboard`
- **Default period:** `now-30d → now`

## Goal of the Dashboard

Comprehensive fleet performance assessment over 30 days across four blocks: fleet overview, driver performance, safety events, and geozone monitoring.

It helps to:
- Assess overall fleet utilization and mileage
- Identify speeding offenders and night drivers
- Analyze driver activity and violation distribution
- Monitor compliance with geozone restrictions

---

## Why This Dashboard is Important

### Operational Efficiency
- Provides a complete picture of fleet usage over the month
- Identifies underutilized and overloaded assets

### Driver Management
- Personalized mileage and violation analysis per driver
- Foundation for KPI policies and incentive systems

### Safety
- Detailed speeding records tied to hour of day
- Identifies night driving as a risk factor

### Geofencing
- Monitors zone visit frequency (warehouses, sites, restricted areas)
- Analyzes visit duration and distribution across vehicles

---

## Target Audience

### Fleet Managers
- Monthly operational review
- Optimize vehicle allocation

### HR & Driver Managers
- Evaluate driver KPIs
- Monitor violations and discipline

### Safety Teams
- Monitor speeding and night driving

### Operations Directors
- High-level KPIs for strategic decision-making

---

## Dashboard Elements

### Block 1 — Fleet Overview

| Panel | Type | Description |
|-------|------|-------------|
| Total Vehicles | KPI | Total number of vehicles |
| Total Mileage 30d (km) | KPI | Total fleet mileage over 30 days |
| Active Vehicles (24h) | KPI | Vehicles with activity in the last 24 hours |
| Speeding Events 30d | KPI | Number of speeding events over 30 days |
| Active vs Inactive Vehicles | Pie chart | Share of active vs inactive vehicles |
| Mileage by Vehicle 30d (km) | Bar chart | Mileage per vehicle over 30 days |
| Speeding Violations by Vehicle 30d | Bar chart | Speed violations per vehicle |
| Fleet Status Overview | Table | Summary table: vehicle, mileage, status, violations |

---

### Block 2 — Driver Performance

| Panel | Type | Description |
|-------|------|-------------|
| Total Drivers | KPI | Total number of drivers |
| Active Drivers 30d | KPI | Drivers with trips in the last 30 days |
| Avg Mileage per Driver 30d (km) | KPI | Average mileage per driver |
| Drivers with Violations 30d | KPI | Number of drivers with violations |
| Violations per Driver 30d | Bar chart | Violation distribution across drivers |
| Mileage by Driver 30d (km) | Bar chart | Mileage per driver |
| Driver Activity Summary 30d | Table | Summary: driver, mileage, trips, violations |

---

### Block 3 — Safety Events

| Panel | Type | Description |
|-------|------|-------------|
| Speeding Events 30d | KPI | Total number of speeding violations |
| Night Driving Events 30d | KPI | Number of night driving events |
| Avg Speed at Violation (km/h) | KPI | Average speed at the time of violation |
| Max Speed Recorded 30d (km/h) | KPI | Maximum recorded speed over the period |
| Alerts Distribution 30d | Pie chart | Distribution of violation types |
| Speeding Violations by Hour of Day 30d | Bar chart | Violations by hour of day — identifies peak periods |
| Speeding Violations Detail 30d | Table | Detailed log: vehicle, driver, speed, time, location |

---

### Block 4 — Geozone Monitoring

| Panel | Type | Description |
|-------|------|-------------|
| Total Zone Visits 30d | KPI | Total number of geozone visits |
| Active Zones 30d | KPI | Number of zones visited over the period |
| Avg Visit Duration 30d (min) | KPI | Average visit duration (min) |
| Unique Vehicles in Zones 30d | KPI | Number of unique vehicles in zones |
| Entry/Exit Counts by Zone 30d | Bar chart | Entry/exit counts per zone |
| Zone Visits by Vehicle 30d | Bar chart | Zone visits broken down by vehicle |
| Zone Visits Detail 30d | Table | Detailed log: zone, vehicle, entry/exit time, duration |

---

## Logic Behind Calculations

### Mileage
Summed using the Haversine formula between consecutive points in `tracking_data_core`. Coordinates converted from scaled format (`÷ 1e7`). Outliers filtered by `ABS(lat_diff) < 1`.

### Vehicle Activity
A vehicle is considered active if it has at least one record in `tracking_data_core` within the last 24 hours.

### Speeding Violations
Records filtered where `speed / 100.0 > threshold` (e.g., 90 km/h). Enriched via JOIN with `driver_history` to associate violations with drivers.

### Night Driving
Events where `EXTRACT(HOUR FROM device_time)` falls outside the 06:00–22:00 range.

### Geozones
Entries and exits detected via `ST_DWithin` (PostGIS) between GPS points and zone centers (`zones`). Visit duration is the difference between entry and exit timestamps.
