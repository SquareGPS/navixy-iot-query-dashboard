# Driving Score Dashboard

- **File:** `12-driver-performance-dashboard-schema.json`
- **UID:** `driving-score-dashboard`
- **Default period:** `now-1M → now`

## Goal of the Dashboard

Evaluate driving quality across the fleet using a composite driving score. The dashboard combines driver performance events (braking, acceleration, turns, speeding) with mileage to produce a normalized 0–100 score per vehicle and provides violation details.

It helps to:
- Rank vehicles by driving quality score
- Identify the most common violation types per vehicle
- Drill down into individual violation events with timestamps and details
- Compare fleet-wide averages

---

## Why This Dashboard is Important

### Driver Management
- Objective, data-driven scoring enables fair performance reviews
- Per-vehicle violation breakdown highlights specific improvement areas

### Safety
- Low driving scores correlate with higher accident risk
- Violation detail enables targeted coaching

### Cost Optimization
- Better driving scores lead to lower fuel consumption, less wear, and fewer accidents
- Identifying top violators enables focused intervention

### Compliance
- Standardized scoring across the fleet supports policy enforcement
- Historical trend data supports audit requirements

---

## Target Audience

### Fleet Managers
- Monthly driving quality assessment

### HR / Driver Managers
- Performance reviews and incentive program data

### Safety Officers
- Risk assessment and coaching priorities

### Operations Directors
- Fleet-wide driving quality KPIs

---

## Dashboard Elements

### 1. KPI Summary

| Panel | Type | Description |
|-------|------|-------------|
| Total Vehicles | KPI | Count of active vehicles |
| Avg Driving Score | KPI | Fleet-wide average driving score (0–100) |
| Total Events | KPI | Total driver performance events in the period |

---

### 2. Block 1 — Vehicle Rating

| Panel | Type | Description |
|-------|------|-------------|
| Vehicle Rating | Table | Per-vehicle: label, driver, mileage (km), braking/acceleration/turn/speed events, driving score (0–100) |

---

### 3. Block 2 — Violation Counts

| Panel | Type | Description |
|-------|------|-------------|
| Violation Counts | Table | Per-vehicle violation breakdown: total violations, braking, acceleration, turns, lane changes, speeding |

---

### 4. Block 3 — Violations Detail

| Panel | Type | Description |
|-------|------|-------------|
| Violations Detail | Table | Event-level log: vehicle, driver, event type, timestamp, coordinates |

---

## Logic Behind Calculations

### Driving Score Formula
Score = 100 − penalties, where penalties are per km:
- Braking events: `brake_count / mileage_km × 100 × 1.0`
- Turn events: `turn_count / mileage_km × 100 × 1.0`
- Speeding events: `speed_count / mileage_km × 100 × 3.0` (triple weight)

Score is clamped to `GREATEST(0, ...)` — cannot go below zero.

### Mileage
From `processed_common_data.trips`: `SUM(trip_distance_meters) / 1000`. Only vehicles with non-zero mileage are scored.

### Driver Performance Events
From `processed_common_data.driver_performance_events`, categorized by `event_type`:
- Braking: `Driver performance braking`, `Driver performance braking and turn`
- Acceleration: `Driver performance acceleration`, `Driver performance acceleration and turn`
- Turns: `Driver performance turn`, `Driver performance quick lane change`
- Speeding: `overspeeding`

### Driver Assignment
Drivers linked via `raw_business_data.employees` (joined on `object_id`).

---

## Data Layer (after client DB refactoring)

| Change | Description |
|-----------|------|
| Processing schema | **`processed_common_data`** instead of `business_data` |
| Trips | Table **`trips`**, fields **`trip_*`** |
| Lookup tables / raw objects | **`raw_business_data`**, telematics — **`raw_telematics_data`** |
| Events | **`processed_common_data.event_description`** |
| Device settings | **`processed_common_data.device_settings`** |
| Hourly sensors | **`processed_common_data.sensors_data_by_hours`**, column **`value_title`** |

SQL infrastructure: `19_trips.sql` / `20_generate_trips.sql` instead of `18_tracks.sql` / `20_generate_tracks.sql`; renamed `02_update_description_parameters.sql`.
