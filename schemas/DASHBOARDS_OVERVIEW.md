# Dashboard Templates Overview

All dashboard templates from the `jsons/add_to_template` folder are described below.

---

## 1) Fleet Anomaly Monitor

- **File:** `Fleet Anomaly Monitor-schema.json`
- **UID:** `generated-dashboard`
- **Default period:** `now-30d -> now`
- **Purpose:** Monitor fleet anomalies and telematics issues.
- **What it shows:** Total number of vehicles, devices with no GPS activity for 3+ days, prolonged downtime, and other deviation indicators.

**Goal:** Identify vehicles and devices that have stepped outside normal operating patterns — no signal, no movement, abnormally long downtime.

**Metrics:**
- Number of vehicles with no GPS activity for 3+ days
- Number of objects with abnormally long downtime
- Total number of vehicles in the fleet
- Share of devices with anomalies

**Logic:**
Queries `raw_telematics_data.tracking_data_core` to find devices whose last record is older than a threshold. To detect "stalled" assets, `MIN` and `MAX` coordinates over the period are compared — if the spread is smaller than a tolerance (~10 m, i.e. ≤2000 units for lat and ≤1000 for lon in scaled format), the asset is considered stationary. Devices with fewer than 10 data points are excluded as too sparse.

**Business value:** Enables early detection of hidden telematics failures, device connectivity loss, or actual equipment downtime. Critical for fleet managers who need to know about "silent" assets before they impact operations.

---

## 2) Fleet Performance Dashboard

- **File:** `Fleet Performance Dashboard-schema (1).json`
- **UID:** `fleet-performance-dashboard`
- **Default period:** `now-30d -> now`
- **Purpose:** Comprehensive fleet efficiency assessment.
- **What it shows:** Fleet overview (vehicle count, mileage), performance and safety indicators, geozone and operations blocks.

**Goal:** Provide a summary view of fleet utilization over a period — load, mileage, maximum and average speeds, route compliance.

**Metrics:**
- Total and average daily mileage per vehicle (km)
- Maximum and average speed (km/h)
- Number of active hours per day (unique hours in `tracking_data_core`)
- Number of geozone visits
- Number of trips over the period

**Logic:**
JOIN between `tracking_data_core` and `raw_business_data.objects` / `vehicles` produces a daily summary per vehicle. Mileage is calculated using the Haversine formula between consecutive GPS points (with outlier filtering where `ABS(lat_diff) < 1`). Speed metrics are aggregated with `MAX` / `AVG` on `speed` (values stored ×100, divided by `100.0` at query time). Active hours use `COUNT(DISTINCT DATE_PART('hour', device_time))`.

**Business value:** Helps fleet managers and operations teams identify underutilized and overloaded assets, monitor driving style, justify maintenance needs, and plan route optimization.

---

## 3) Fleet Reports Dashboard

- **File:** `Fleet Reports Dashboard-schema (7).json`
- **UID:** `fleet-reports-dashboard`
- **Default period:** `now-30d -> now`
- **Purpose:** Real-time operational status of the fleet.
- **What it shows:** KPIs for online/offline objects, communication status distribution, and other summary telematics metrics.

**Goal:** Instant operational snapshot — how many vehicles are currently connected, how many have lost signal, and how recent the last message is.

**Metrics:**
- Number of online / standby / offline / no-signal objects
- Distribution of vehicles by communication status (%)
- Time of last message from each device
- Number of devices with no contact for more than N hours

**Logic:**
For each `device_id`, the maximum `device_time` from `tracking_data_core` is retrieved, then the difference from `NOW()` is calculated. Devices are classified against thresholds (e.g.: <5 min — online, 5–60 min — standby, 1–24 h — offline, >24 h — no signal). Results are joined with `raw_business_data.objects` for object labels.

**Business value:** First line of control for dispatchers and operators. Enables immediate response to vehicle connectivity loss, initiating equipment checks or diagnosing device silence.

---

## 4) HM Trip Operations Dashboard

- **File:** `HM Trip Operations Dashboard-schema (1).json`
- **UID:** `hm-trip-operations-dashboard`
- **Default period:** `now-7d -> now`
- **Purpose:** Trip and shift activity analysis for heavy machinery.
- **What it shows:** Trips for the previous day split by day/night window (08:00–19:00 and 19:00–08:00), plus comparative operational metrics over a short horizon.

**Goal:** Track the number and nature of heavy machinery trips broken down by shift, detect schedule violations, and compare day/night performance.

**Metrics:**
- Number of trips in the previous day (day shift / night shift)
- Total mileage per shift
- Average number of trips per unit of equipment
- Current period vs previous period comparison

**Logic:**
A trip is defined as a continuous movement period: speed above a threshold (>5 km/h) marks the start, dropping below marks the end. `LAG` / `LEAD` window functions are applied to `device_time` partitioned by `device_id`. Shift time windows are set using `EXTRACT(HOUR FROM device_time)`. Distance is calculated using the Haversine formula between the first and last point of the trip.

**Business value:** Critical for mining, construction, and logistics companies with shift-based operations. Enables monitoring of trip quotas, detection of in-shift downtime, and improved utilization of high-value equipment.

---

## 5) Heavy Machinery – Actual Engine Operation

- **File:** `Heavy Machinery – Actual engine operation-schema (5).json`
- **UID:** `heavy-machinery-dashboard`
- **Default period:** `now-7d -> now`
- **Purpose:** Actual load and operation of heavy equipment based on RPM/event data.
- **What it shows:** Engine operating hours, zone visits, equipment load metrics, and operational KPIs.

**Goal:** Measure actual engine runtime for heavy equipment, zone visits, and total load broken down by vehicle and driver.

**Metrics:**
- Engine operating hours per day / over the period (per vehicle and driver)
- Number and duration of geozone visits
- Operating time vs idle time ratio
- Overload vs underutilization (comparison against standard)

**Logic:**
Engine state data is taken from `raw_telematics_data.states` (filtered by `state_name = 'ignition'` or from `sensor_description` where `sensor_type = 'engine'`). State transitions `0→1` record engine-on, `1→0` record engine-off. The difference between timestamps gives operating duration in hours. Driver assignment uses a `LATERAL JOIN` on `driver_history` for the closest driver change event prior to the operating period. Zone visits are counted using `ST_DWithin` in PostGIS.

**Business value:** Key tool for scheduling maintenance by engine hours, calculating rental rates (equipment leasing), identifying overloaded units, and optimizing workload distribution among operators.

---

## 6) Leasing Dashboard

- **File:** `Leasing Dashboard-schema (7).json`
- **UID:** `hello-world`
- **Default period:** `now-72h -> now`
- **Purpose:** Monitor leasing-related deadlines and associated documents.
- **What it shows:** Drivers and vehicles with upcoming expiry dates (including expired and expiring within 30 days).

**Goal:** Provide full compliance control over leased assets against contractual obligations: documents, driver behavior, idle time, and territorial restriction violations.

**Metrics:**
- Vehicles with expired / expiring insurance (within 30 days): `free_insurance_valid_till_date`, `liability_insurance_valid_till`
- Drivers with expired / expiring driver's licenses: `driver_license_valid_till`
- Total and average engine idle time (min)
- Number of harsh braking / acceleration events by severity (Warning ≥60 km/h/s, Critical ≥80 km/h/s)
- Number of sudden turn events (Warning — heading change ≥30° at speed ≥30 km/h, Critical — ≥50°)
- Total number of idle events (engine on, speed <5 km/h, duration ≥5 min)

**Logic:**
Document dates are compared against `CURRENT_DATE` using `BETWEEN`. Harsh braking is calculated as `(prev_kmh - kmh) / dt_sec` using the LAG function on `tracking_data_core`; threshold ≥20 km/h/s. Acceleration uses the same approach with `(kmh - prev_kmh) / dt_sec ≥ 20`. Turning is computed via `atan2` (bearing formula). Idle detection joins `states` (ignition=1) with `tracking_data_core` (speed/100 < 5) using `LEAD` to calculate period duration. Message-over-time data is built with `generate_series` to fill empty hourly buckets.

**Business value:** For leasing companies and banks — an asset protection and contract compliance tool. Expired documents lead to fines and downtime. Harsh driving accelerates wear and risks voiding maintenance warranties. Idle time means direct fuel losses. Geofence violations breach territorial contract restrictions.

---

## 7) Object Status Dashboard

- **File:** `Object Status Dashboard-schema (19).json`
- **UID:** `hello-world`
- **Default period:** `now-72h -> now`
- **Purpose:** Detailed telematics status of objects/devices.
- **What it shows:** online/standby/offline/no signal, moving/stopped/parked, last contact time, and related object reference data.

**Goal:** Provide a detailed real-time snapshot for each fleet object — connectivity status, movement status, last known location, and data freshness.

**Metrics:**
- Connectivity status per object: online / standby / offline / no signal
- Movement status: moving / stopped / parked
- Time of last message (freshness in hours/minutes)
- Number of objects per status (summary)
- Reference data: group, model, device IMEI

**Logic:**
The latest `device_time` per `device_id` from `tracking_data_core` is compared to `NOW()`. Movement status is derived from the `speed` field of the last record (>0 — moving). An object is considered "parked" if `speed = 0` for more than N consecutive minutes. JOIN with `raw_business_data.objects`, `devices`, and `groups` enriches results with metadata. "No signal" is assigned when no data is available for >24 h.

**Business value:** Core dispatching tool. Allows a single-glance understanding of which vehicles are active, which are stopped, and which have lost contact — enabling fast operational decisions without switching to the map view.

---

## 8) Trips Dashboard (Yesterday)

- **File:** `Trips Dashboard (Yesterday)-schema.json`
- **UID:** `trips-dashboard-yesterday`
- **Default period:** `now-1d -> now`
- **Purpose:** Trip summary for the previous day.
- **What it shows:** Number of trips, total mileage, and additional daily trip metrics.

**Goal:** Daily operational report on trips — how many runs were made, total and average mileage, anomalies per individual vehicle.

**Metrics:**
- Number of trips per day (per vehicle)
- Total mileage for the day (km)
- Average distance per trip
- Trip start and end timestamps
- Start and end coordinates

**Logic:**
Trips are segmented through speed transitions in `tracking_data_core`: `speed ≥ 5 km/h` after a stopped period marks a trip start; dropping below the threshold marks the end. The `LAG(speed)` window function is applied partitioned by `device_id` sorted by `device_time`. Distance is calculated using the Haversine formula: `111 * SQRT(POWER(Δlat, 2) + POWER(Δlon * COS(lat), 2))`. Results are aggregated by `trip_day` and `device_id`, enriched via JOIN with `objects` / `vehicles`.

**Business value:** Essential part of daily reporting for logistics and transportation companies. Enables verification of trip quotas, detection of unregistered journeys, and monitoring of vehicle use outside working hours.

---

## 9) Vehicle Mileage Dashboard

- **File:** `Vehicle Mileage Dashboard-schema (3).json`
- **UID:** `vehicle-mileage`
- **Default period:** `now-72h -> now`
- **Purpose:** Fleet mileage analysis.
- **What it shows:** Mileage distribution by time category (business hours / after hours / weekends), weekly mileage structure, and related KPIs.

**Goal:** Detailed analysis of fleet mileage broken down by time category — business hours vs after-hours vs weekends — to identify unauthorized vehicle use.

**Metrics:**
- Daily mileage per vehicle (km)
- Mileage during business hours (Mon–Fri, 09:00–18:00)
- Mileage outside business hours (before 9:00, after 18:00)
- Mileage on weekends (Sat, Sun)
- Percentage breakdown by time category
- Weekly mileage trend across the fleet

**Logic:**
GPS points from `tracking_data_core` are enriched with time attributes using `EXTRACT(DOW FROM device_time)` and `EXTRACT(HOUR FROM device_time)`. Each segment between consecutive points is calculated via Haversine and classified by time window. Outlier filtering: `ABS(lat_diff) < 1 AND ABS(lon_diff) < 1`. Aggregated by date and vehicle with JOIN on `objects` / `vehicles`.

**Business value:** Enables detection and quantification of unauthorized corporate vehicle use. After-hours mileage is a direct indicator for HR, security, and finance departments. Data supports fuel cost allocation and mileage-based maintenance scheduling following the methodology from the [Navixy SQL Recipe Book](https://www.navixy.com/docs/analytics/example-queries/logistics).
