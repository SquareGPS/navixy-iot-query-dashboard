# Fleet Anomaly Monitor

- **File:** `01-fleet-anomaly-monitor-schema.json`
- **UID:** `generated-dashboard`
- **Default period:** `now-30d → now`

## Goal of the Dashboard

Detect anomalies in fleet operations: GPS signal loss, prolonged downtime, and abnormal geozone exits. The dashboard provides a quick snapshot of "problem" assets that require attention.

It helps to:
- Identify vehicles that have lost GPS connectivity for 3+ days
- Flag vehicles with downtime of 24 hours or more
- Track abnormal geozone exits (3+/month)
- Assess the overall telematics health of the entire fleet

---

## Why This Dashboard is Important

### Operational Control
- Immediate detection of "silent" devices before they impact operations
- Tracking vehicles with prolonged downtime that affects fleet utilization

### Asset Security
- Extended downtime can signal a breakdown, theft, or unauthorized parking
- Abnormal zone exits indicate route violations or unauthorized vehicle use

### Data Quality
- Monitoring the health of telematics devices
- Identifying GPS dead zones in coverage

### Fleet Maintenance
- Downtime of 24h+ often coincides with a need for maintenance
- Early detection reduces unplanned downtime

---

## Target Audience

### Fleet Managers
- Monitor device health
- Track downtime and zone exit events

### Operations Managers
- Identify underutilized assets

### IT / Telematics Technical Team
- Diagnose GPS device issues

### Security Teams
- Detect unauthorized vehicle use

---

## Dashboard Elements

### 1. KPI Summary

| Panel | Type | Description |
|-------|------|-------------|
| Total Vehicles | KPI | Total number of vehicles in the fleet |
| GPS Offline 3+ Days | KPI | Vehicles with no GPS activity for 3 or more days |
| Long Stops 24h+ This Month | KPI | Vehicles with downtime of 24h+ this month |
| Zone Exits 3+ This Month | KPI | Vehicles with 3+ geozone exits this month |

---

### 2. Mileage Analysis

| Panel | Type | Description |
|-------|------|-------------|
| Top 15 Vehicles by Mileage (30 Days) | Bar chart | Top 15 vehicles by mileage over the past 30 days |

---

### 3. GPS Signal Status

| Panel | Type | Description |
|-------|------|-------------|
| GPS Signal Status | Pie chart | Distribution of vehicles by GPS signal status (active / no signal) |

---

### 4. Geozone Exit Analysis

| Panel | Type | Description |
|-------|------|-------------|
| Top 10 Vehicles by Zone Exits This Month | Bar chart | Top 10 vehicles by number of geozone exits this month |

---

### 5. Detail Tables

| Panel | Type | Description |
|-------|------|-------------|
| Vehicles GPS Offline 3+ Days | Table | List of vehicles with GPS loss 3+ days: object ID, label, last signal |
| Vehicles with Long Stops 24h+ | Table | List of vehicles with 24h+ downtime: label, duration, coordinates |

---

## Logic Behind Calculations

### GPS Offline
For each `device_id`, the maximum `device_time` in `tracking_data_core` is determined. If the difference from `NOW()` exceeds 3 days, the device is classified as offline.

### Long Stops
Periods where speed equals 0 for 24h+ are analyzed. The `LAG` window function is applied on `device_time`, partitioned by `device_id`.

### Geozone Exits
"Inside → outside" geozone transition events are counted using `ST_DWithin` (PostGIS). Vehicles with 3+ such events per month are flagged as anomalies.

### Mileage
Calculated using the Haversine formula between consecutive GPS points. Outliers are excluded (`ABS(lat_diff) > 1`). Coordinates are converted from scaled format (`÷ 1e7`).
