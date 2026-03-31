# 📊 Trips Dashboard (Yesterday)

## 🎯 Goal of the Dashboard
The goal of this dashboard is to monitor and analyze fleet trip activity over the previous day. It provides a complete operational snapshot of vehicle usage, performance, and movement patterns.

It helps to:
- Track fleet utilization
- Measure mobility efficiency (distance, time, speed)
- Identify behavioral patterns (trip timing, zones, speed)
- Support operational and strategic decisions

---

## ❗ Why This Dashboard is Important

### Operational Efficiency
- Understand vehicle usage (trips, distance, time)
- Detect underutilized or overused assets

### Cost Optimization
- Distance and time directly impact fuel and maintenance costs
- Enables route optimization

### Safety & Compliance
- Speed metrics highlight risky driving behavior
- Zone retention reflects route discipline

### Planning & Forecasting
- Time-based trends reveal peak demand periods
- Helps optimize scheduling and resource allocation

---

## 👥 Target Audience

### Fleet Managers
- Monitor daily operations
- Optimize vehicle allocation

### Operations Managers
- Improve routing and scheduling

### Data Analysts
- Analyze trends and anomalies

### Safety & Compliance Teams
- Monitor speed and driving behavior

### Executives
- Review high-level KPIs

---

## 🧩 Dashboard Elements

### 1. KPI Summary

- Total Trips
- Total Distance (km)
- Total Drive Time (hours)
- Active Vehicles
- Average Trip Distance (km)
- Average Speed (km/h)
- Peak Speed Observed (km/h)
- Zone Retention Rate (%)

---

### 2. Time-Based Analysis

- Trips Over Time (hourly)
- Distance Over Time
- Drive Time Over Time
- Trips by Hour of Day

---

### 3. Distribution Analysis

- Trip Distance Bands:
  - <5 km
  - 5–20 km
  - 20–50 km
  - 50–100 km
  - 100+ km

- Trip Duration Bands:
  - <15 min
  - 15–30 min
  - 30–60 min
  - 1–2 hours
  - 2+ hours

- Speed Compliance Mix:
  - <50 km/h
  - 50–79 km/h
  - 80–99 km/h
  - 100–119 km/h
  - 120+ km/h

---

### 4. Asset & Spatial Analysis

#### Vehicle Performance
- Top 10 Vehicles by Distance
- Top 10 Vehicles by Trips
- Vehicle Utilization Table:
  - Trips
  - Distance
  - Drive Hours
  - Average Speed
  - Max Speed

#### Organizational Analysis
- Distance by Group

#### Geographic Analysis
- Start Zone Distribution
- End Zone Distribution
- Top Origin-Destination Pairs

---

## 🧠 Logic Behind Calculations

### Time Filter
All metrics are calculated for **yesterday**:
```sql
WHERE track_start_time >= CURRENT_DATE - INTERVAL '1 day'
AND track_start_time < CURRENT_DATE
