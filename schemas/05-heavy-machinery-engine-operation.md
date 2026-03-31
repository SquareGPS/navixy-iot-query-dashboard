# Heavy Machinery – Actual Engine Operation

- **File:** `05-heavy-machinery-engine-operation-schema.json`
- **UID:** `heavy-machinery-dashboard`
- **Default period:** `now-7d → now`

## Goal of the Dashboard

Monitor actual engine operation of heavy machinery: engine hours, operational zone visits, temperature violations, and unauthorized trips. The dashboard focuses on a 1-day operational snapshot with weekly context.

It helps to:
- Track total engine hours for the day
- Monitor visits to operational zones
- Identify units with engine overheating (>95°C)
- Detect unauthorized mileage
- Analyze load distribution by time category and workload band

---

## Why This Dashboard is Important

### Maintenance Management
- Engine hours are the primary maintenance trigger for heavy machinery (not mileage)
- Temperature exceeding 95°C signals a critical fault

### Usage Control
- Unauthorized mileage captures movement outside zones or outside working hours
- Time category breakdown (business hours / after hours / weekends) reveals off-purpose use

### Operational Efficiency
- Zone visits confirm execution of production operations
- Workload band comparison enables balanced equipment utilization

### Equipment Safety
- Early overheating detection reduces the risk of emergency breakdowns and costly repairs

---

## Target Audience

### Mechanics & Maintenance Teams
- Monitor engine hours for maintenance scheduling
- Temperature anomalies as a trigger for unscheduled inspection

### Operations Managers
- Daily equipment load monitoring
- Identify downtime and overload

### Security Teams
- Monitor unauthorized equipment use

### Management
- Summary of high-value equipment utilization efficiency

---

## Dashboard Elements

### 1. KPI — Daily Operational Snapshot (1d)

| Panel | Type | Description |
|-------|------|-------------|
| Total engine hours (1d) | KPI | Total engine hours across all units for the current day |
| Zone visits (1d) | KPI | Number of operational zone visits for the day |
| Units with temp >95°C (1d) | KPI | Units with engine overheating for the day |
| Unauthorized km (1d) | KPI | Unauthorized mileage (km) for the day |

---

### 2. 30-Day Load Analysis

| Panel | Type | Description |
|-------|------|-------------|
| Usage by time category (30d) | Pie chart | Distribution of operating hours by category: business hours / after hours / weekends |

---

### 3. 7-Day Workload Analysis

| Panel | Type | Description |
|-------|------|-------------|
| Workload by band (7d) | Bar chart | Distribution of units by workload band (light / medium / heavy) |
| Zone visits by zone (7d) | Pie chart | Distribution of visits across specific zones over 7 days |

---

### 4. Daily Breakdown by Unit

| Panel | Type | Description |
|-------|------|-------------|
| Trips by unit (1d) | Bar chart | Number of trips per unit for the day |
| Distance km by unit (1d) | Bar chart | Mileage (km) per unit for the day |

---

### 5. Zone Visit Log

| Panel | Type | Description |
|-------|------|-------------|
| Recent zone visits | Table | Log of recent zone visits: unit, zone, entry/exit time, duration |

---

## Logic Behind Calculations

### Engine Hours
Data from `raw_telematics_data.states` with `state_name = 'ignition'` (or `sensor_type = 'engine'` from `sensor_description`). State transitions `0→1` (on) and `1→0` (off) are computed via `LAG`. Timestamp difference = engine hours. Aggregated by `device_id` and date.

### Temperature Violations
Data from `raw_telematics_data.inputs` with `sensor_name` matching `'coolant_temp'`. Values are converted through the calibration table (`sensor_description.calibration_data`). Filter: `calibrated_value > 95`.

### Unauthorized Mileage
Mileage recorded outside working hours (`EXTRACT(HOUR FROM device_time)` outside shift range) or outside geozones (`NOT ST_DWithin(...)`). Calculated using Haversine.

### Zone Visits
"Outside → inside" zone transitions detected via `ST_DWithin` (PostGIS). Each continuous period inside a zone counts as one visit.

### Workload Bands
Daily engine hour ranges: light (<4 h), medium (4–8 h), heavy (>8 h). Aggregated by `device_id` and `DATE(device_time)`.
