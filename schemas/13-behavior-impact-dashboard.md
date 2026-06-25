# Behavior Impact Dashboard

- **File:** `13-behavior-impact-dashboard-schema.json`
- **UID:** `behavior-impact-dashboard`
- **Default period:** `now-7d → now`

## Goal of the Dashboard

Analyze driver behavior impact on fleet operations without fuel metrics. The dashboard quantifies idling, aggressive driving, high-speed trips, and high RPM events, then highlights week-over-week trends and compares drivers on shared routes.

It helps to:
- Track four key behavior types: idling (≥5 min), aggressive driving, high speed, high RPM (>5000)
- Identify units with the worst week-over-week behavior increase
- Compare drivers on the same routes to isolate behavior-related risk
- Prioritize coaching and corrective action

---

## Why This Dashboard is Important

### Fleet Efficiency
- Excessive idling wastes fuel and increases engine wear
- High RPM operation shortens component life

### Driver Safety
- Aggressive driving (harsh braking/acceleration) is a leading crash indicator
- Speeding above vehicle limits significantly increases accident severity

### Accountability
- Route-based comparison removes route difficulty as an excuse — same route, different behavior scores
- Week-over-week trends catch deteriorating habits early

### Cost Control
- Behavior events directly correlate with maintenance costs
- Identifying top offenders enables targeted intervention

---

## Target Audience

### Fleet Managers
- Weekly behavior review and trend monitoring

### Safety Officers
- Prioritize coaching based on behavior impact scores

### HR / Driver Managers
- Data-driven KPIs for performance reviews

### Operations Directors
- High-level fleet behavior health overview

---

## Dashboard Elements

### 1. KPI Summary

| Panel | Type | Description |
|-------|------|-------------|
| Idling Events (7d) | KPI | Events with `event_type = 'idle over 5 min'` from `driver_performance_events` |
| Aggressive Driving Events (7d) | KPI | All `driver_performance_events` excluding idle, rpm exceeded, and overspeeding |
| High Speed Trips (7d) | KPI | Trips where max speed exceeds vehicle limit (default 70 km/h) from `trips` |
| High RPM > 5000 Events (7d) | KPI | Events with `event_type = 'rpm exceeded'` from `driver_performance_events` |

---

### 2. Behavior Distribution

| Panel | Type | Description |
|-------|------|-------------|
| Top Behaviors Impacting Fleet (7d) | Pie (donut) | Proportional breakdown: Idling ≥5 min, Aggressive Driving, High Speed Trips |

---

### 3. Week-over-Week Comparisons

| Panel | Type | Description |
|-------|------|-------------|
| Top Units: Idling vs Previous Week | Bar chart | Top 15 vehicles by idling increase (current vs previous week) |
| Top Units: Aggressive Driving vs Previous Week | Bar chart | Top 15 vehicles by aggressive driving increase |
| Top Units: High Speed vs Previous Week | Bar chart | Top 15 vehicles by high-speed trips increase |
| Top Units: High RPM > 5000 vs Previous Week | Bar chart | Top 15 vehicles by RPM events increase |

---

### 4. Route-Based Driver Comparison

| Panel | Type | Description |
|-------|------|-------------|
| Route-Based Driver Impact (30d) | Table | Compares drivers on the same route: trips, distance, behavior points, points per 100 km, route rank (top 3 per route) |

---

## Logic Behind Calculations

### Unified behavior event source
All behavior metrics (idling, aggressive, RPM) now come from a single table processed_common_data.driver_performance_events, filtered by event_type. Direct queries to raw_telematics_data.states/inputs and raw_business_data.sensor_description are no longer used.

### Idling Events
Filter: event_type = 'idle over 5 min' from processed_common_data.driver_performance_events.

### Aggressive Driving
All events from driver_performance_events except idle over 5 min, rpm exceeded, and overspeeding. Includes braking, acceleration, turns, lane changes, and others.

### High Speed
Routes are identified by start/end zone pairs from `processed_common_data.trips`. Behavior points are weighted by `event_type`:
- `Driver performance acceleration/braking (and turn)` → **3.0** points
- `idle over 5 min`, `rpm exceeded` → **1.0** point
- All other event types → **2.0** points

Points per 100 km normalizes for distance. Minimum thresholds: ≥2 trips, ≥5 km total. Top 3 drivers per route shown.

---

## Data layer

### Tables used

| Table | Purpose |
|-------|---------|
| processed_common_data.driver_performance_events | All behavior events (idle, aggressive, RPM, overspeeding) |
| processed_common_data.trips | Trips — for high speed and route-based impact |
| raw_business_data.objects | Object directory (label, device_id) |
| raw_business_data.vehicles | Speed limits (max_speed) |
| raw_business_data.employees | Driver-to-object linkage |

### Client DB refactor

| Change | Summary |
|--------|---------|
| Processing schema | **processed_common_data** instead of business_data |
| Trips | Table **trips**, **trip_*** columns (trip_start_time, trip_distance_meters, …) |
| Master / raw objects | **raw_business_data**; telematics — **raw_telematics_data** |
| Events | Code labels: **processed_common_data.event_description** |
| Device settings | **processed_common_data.device_settings** (key–value on full sync) |
| Hourly sensors | **processed_common_data.sensors_data_by_hours**, **value_title** — client-facing value label |

SQL infrastructure: 19_trips.sql / 20_generate_trips.sql replaced 18_tracks.sql / 20_generate_tracks.sql; 02_update_description_parameters.sql renamed.
