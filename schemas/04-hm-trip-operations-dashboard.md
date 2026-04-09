# HM Trip Operations Dashboard

- **File:** `04-hm-trip-operations-dashboard-schema.json`
- **UID:** `hm-trip-operations-dashboard`
- **Default period:** `now-7d → now`

## Goal of the Dashboard

Trip analysis for heavy machinery split by day shift (08:00–19:00) and night shift (19:00–08:00) for yesterday and the last 7 days. Monitors speeding violations and identifies abnormally short or long trips.

It helps to:
- Count the number and characteristics of trips per shift
- Compare yesterday's figures against the weekly trend
- Identify short trips (<5 min) and excessively long trips (>8 h)
- Monitor vehicles with speeds exceeding 120 km/h
- Track average and maximum speed over time

---

## Why This Dashboard is Important

### Shift Control
- Day/night shift breakdown enables output assessment per period
- Identifies underutilization in one of the shifts

### Trip Anomalies
- Short trips (<5 min) may indicate technical faults or idle starts
- Long trips (>8 h) suggest potential driver overload or regulation violations

### Safety
- Exceeding 120 km/h for heavy machinery is a critical violation
- Average speed above 80 km/h indicates a systematically aggressive driving style

### Comparative Analysis
- Yesterday vs 7 days comparison helps detect trends and deviations from the norm

---

## Target Audience

### Shift Dispatchers
- Monitor trip counts for current and previous shifts

### Fleet Managers
- Weekly utilization analysis
- Identify vehicles with anomalous performance

### Safety Teams
- Monitor speeding events

### Operations Directors
- Compare shift-level performance

---

## Dashboard Elements

### 1. KPI — Trip Counts

| Panel | Type | Description |
|-------|------|-------------|
| Trips Yesterday (08:00–19:00) | KPI | Trips yesterday, day shift |
| Trips Yesterday (19:00–08:00) | KPI | Trips yesterday, night shift |
| Trips Last 7d (08:00–19:00) | KPI | Trips over 7 days, day shift |
| Trips Last 7d (19:00–08:00) | KPI | Trips over 7 days, night shift |

---

### 2. KPI — Trip Characteristics

| Panel | Type | Description |
|-------|------|-------------|
| Avg Trip Duration Yesterday (min) | KPI | Average trip duration yesterday (min) |
| Avg Trip Distance Yesterday (km) | KPI | Average trip distance yesterday (km) |
| Avg Trip Duration Last 7d (min) | KPI | Average trip duration over 7 days |
| Avg Trip Distance Last 7d (km) | KPI | Average trip distance over 7 days |

---

### 3. KPI — Anomalous Trips

| Panel | Type | Description |
|-------|------|-------------|
| Short Trips Yesterday (<5 min) | KPI | Ultra-short trips yesterday |
| Short Trips Last 7d (<5 min) | KPI | Ultra-short trips over 7 days |
| Long Trips Yesterday (>8 h) | KPI | Extra-long trips yesterday |
| Long Trips Last 7d (>8 h) | KPI | Extra-long trips over 7 days |

---

### 4. Trip Dynamics

| Panel | Type | Description |
|-------|------|-------------|
| Trips per Day – Last 7 Days | Bar chart | Number of trips per day over 7 days |
| Active Driving Ratio by Day – Last 7 Days (%) | Bar chart | Share of active driving time per day (%) |

---

### 5. Object Activity

| Panel | Type | Description |
|-------|------|-------------|
| Active vs Inactive Objects – Last 7 Days | Pie chart | Active vs inactive vehicle ratio over 7 days |
| Active vs Inactive Objects – Yesterday | Pie chart | Active vs inactive vehicle ratio yesterday |
| Top 5 Vehicles by Avg Trips per Active Day – Last 7 Days | Bar chart | Top 5 vehicles by average trips per active day |

---

### 6. Longest Trips Tables

| Panel | Type | Description |
|-------|------|-------------|
| Top 5 Longest Trips – Yesterday | Table | Top 5 longest trips yesterday |
| Top 5 Longest Trips – Last 7 Days | Table | Top 5 longest trips over 7 days |

---

### 7. Speed Analysis

| Panel | Type | Description |
|-------|------|-------------|
| Trips with MAX speed 120+ (yesterday) | Stat | Trips with max speed 120+ km/h yesterday |
| Trips with MAX speed 120+ (7 days) | KPI | Trips with max speed 120+ km/h over 7 days |
| Average speed and max speed for the last 7 days | Line chart | Daily trend of average and maximum speed |
| Trips with speed AVG 80km/h+ (yesterday) | KPI | Trips with average speed 80+ km/h yesterday |
| Trips with speed AVG 80km/h+ (7 days) | KPI | Trips with average speed 80+ km/h over 7 days |
| Top 5 trips by max speed with vehicle label (7 days) | Table | Top 5 trips by max speed with vehicle label |

---

## Logic Behind Calculations

### Trip Definition
A trip is a continuous movement period where `speed > 5 km/h`. `LAG` / `LEAD` window functions are applied to `device_time` partitioned by `device_id`. A `stopped → moving` transition marks the start; `moving → stopped` marks the end.

### Shift Windows
Time-of-day filter using `EXTRACT(HOUR FROM device_time)`:
- Day shift: 08:00–19:00
- Night shift: 19:00–08:00 (next day)

### Distance
Haversine formula: `111 * SQRT(POWER(Δlat, 2) + POWER(Δlon * COS(lat), 2))`. Coordinates converted from scaled format (`÷ 1e7`).

### Speed Anomalies
From `tracking_data_core`: `speed / 100.0 >= 120` for critical events. Average trip speed is `AVG(speed / 100.0)` across all points in the trip.

### Active Driving Ratio
`SUM(duration of moving periods) / 86400 * 100%` — share of the day the vehicle was in motion.
