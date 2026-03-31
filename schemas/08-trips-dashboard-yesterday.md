# Trips Dashboard (Yesterday)

- **File:** `08-trips-dashboard-yesterday-schema.json`
- **UID:** `trips-dashboard-yesterday`
- **Default period:** `now-1d → now`

## Goal of the Dashboard

A daily operational trip report for the previous day: how many trips were made, total mileage, how activity was distributed across hours, which vehicles were most utilized, and in which zones routes started and ended.

It helps to:
- Track fleet utilization for the day
- Measure mobility efficiency (distance, time, speed)
- Identify behavioral patterns (trip timing, zones, speed)
- Compare vehicles and groups against key metrics

---

## Why This Dashboard is Important

### Operational Efficiency
- Understand vehicle usage for the day (trips, mileage, drive time)
- Detect underutilized and overloaded assets

### Cost Optimization
- Distance and time directly impact fuel and maintenance costs
- Data for route optimization

### Safety & Compliance
- Speed metrics highlight aggressive driving behavior
- Zone activity reflects route discipline

### Planning & Forecasting
- Hour-of-day analysis reveals peak demand periods
- Origin-destination pairs support schedule optimization

---

## Target Audience

### Fleet Managers
- Daily operational monitoring
- Optimize vehicle allocation

### Operations Managers
- Improve routing and scheduling

### Data Analysts
- Analyze trends and anomalies

### Safety & Compliance Teams
- Monitor speed and driving behavior

### Executives
- High-level KPIs for the previous day

---

## Dashboard Elements

### 1. KPI Summary

| Panel | Type | Description |
|-------|------|-------------|
| Total Trips | Stat | Total number of trips yesterday |
| Total Distance (km) | Stat | Total fleet mileage yesterday (km) |
| Total Drive Time (hours) | Stat | Total time in motion (h) |
| Active Vehicles | Stat | Vehicles with at least one trip |
| Average Trip Distance (km) | Stat | Average distance per trip (km) |
| Average Speed (km/h) | Stat | Average speed across all trips (km/h) |
| Peak Speed Observed (km/h) | Stat | Maximum recorded speed for the day |
| Zone Retention Rate (%) | Stat | Share of trips that both started and ended inside geozones (%) |

---

### 2. Time-Based Analysis

| Panel | Type | Description |
|-------|------|-------------|
| Trips Over Time | Bar chart | Number of trips by hour of day |
| Distance Over Time (km) | Bar chart | Mileage by hour of day (km) |
| Drive Time Over Time (hours) | Bar chart | Drive time by hour of day (h) |
| Trips by Hour of Day | Bar chart | Activity heatmap by hour of day |

---

### 3. Distribution Analysis

| Panel | Type | Description |
|-------|------|-------------|
| Trip Distance Bands | Bar chart | Trips by distance range: <5 / 5–20 / 20–50 / 50–100 / 100+ km |
| Trip Duration Bands | Bar chart | Trips by duration: <15 min / 15–30 / 30–60 / 1–2 h / 2+ h |
| Speed Compliance Mix | Pie chart | Trips by speed range: <50 / 50–79 / 80–99 / 100–119 / 120+ km/h |

---

### 4. Asset & Spatial Analysis

| Panel | Type | Description |
|-------|------|-------------|
| Top 10 Vehicles by Distance | Bar chart | Top 10 vehicles by daily mileage |
| Top 10 Vehicles by Trips | Bar chart | Top 10 vehicles by trip count |
| Distance by Group | Bar chart | Mileage broken down by group / department |
| Start Zone Distribution | Bar chart | Distribution of trip start points across geozones |
| End Zone Distribution | Bar chart | Distribution of trip end points across geozones |
| Top Origin-Destination Pairs | Table | Top route pairs by number of trips |
| Vehicle Utilization Table | Table | Vehicle summary: trips, mileage, drive time, avg speed, max speed |

---

## Logic Behind Calculations

### Time Filter
All metrics are calculated for yesterday:
```sql
WHERE track_start_time >= CURRENT_DATE - INTERVAL '1 day'
  AND track_start_time < CURRENT_DATE
```

### Trip Definition
A trip is a continuous movement period (`speed ≥ 5 km/h`). A `stopped → moving` transition via `LAG(speed)` partitioned by `device_id` marks the start. Dropping below the threshold marks the end.

### Distance
Haversine formula between consecutive GPS points:
`111 * SQRT(POWER(Δlat, 2) + POWER(Δlon * COS(lat), 2))`.
Coordinates converted from scaled format (`÷ 1e7`).

### Zone Retention Rate
Share of trips where both the start and end point are inside a geozone (`ST_DWithin`). Calculated as `COUNT(in_zone_trips) / COUNT(all_trips) * 100`.

### Speed Bands
Each trip is classified by `MAX(speed / 100.0)` over the movement period. Results are grouped by thresholds for the Speed Compliance Mix.
