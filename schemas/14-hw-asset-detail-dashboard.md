# HW Asset Detail Dashboard

- **File:** `14-hw-asset-detail-dashboard-schema.json`
- **UID:** `hw-asset-detail-dashboard`
- **Default period:** `now-24h → now`

## Goal of the Dashboard

Provide a deep-dive view of a single asset selected via the `${object_label}` template variable. The dashboard combines real-time location, alarm state, sensor readings, boolean sensor activity, and recent telemetry events on one screen.

It helps to:
- Inspect the current status and location of a specific asset
- Monitor sensor readings over time (temperature, voltage, RPM, fuel, etc.)
- Track boolean sensor activation patterns (equipment working time, doors, etc.)
- Review the last 20 telemetry events with coordinates and Google Maps links

---

## Why This Dashboard is Important

### Asset Monitoring
- Single-asset focus provides detailed operational insight unavailable in fleet-wide views
- Alarm state logic (shutdown / warning / ok / offline) gives immediate health assessment

### Maintenance Planning
- Sensor timeseries reveal gradual degradation (battery drop, temperature rise)
- Boolean sensor patterns show equipment utilization cycles

### Incident Investigation
- Last 20 events with coordinates enable post-incident analysis
- Google Maps links provide instant geographic context

### Field Operations
- Geomap shows current/last known position
- Alarm state highlights assets needing immediate attention

---

## Target Audience

### Maintenance Engineers
- Monitor sensor trends and plan preventive maintenance

### Fleet / Asset Managers
- Quick asset health check during daily operations

### IT / Telematics Support
- Diagnose device connectivity and sensor issues

### Field Dispatch
- Locate assets and assess their operational readiness

---

## Dashboard Elements

### 1. Asset Info

| Panel | Type | Description |
|-------|------|-------------|
| Single asset detail | Text | Instructions: asset is selected via the **Asset** dropdown (`${object_label}`) |

---

### 2. Location & Status

| Panel | Type | Description |
|-------|------|-------------|
| Current location | Geomap | Last known GPS position (lat/lon from `tracking_data_core`, last 7 days) |
| Current alarm state & key readings | Table | Alarm status (🔴 shutdown / 🟠 warning / 🟢 ok / ⚪ offline), triggering sensor, battery %, last seen |

---

### 3. Sensor Analysis

| Panel | Type | Description |
|-------|------|-------------|
| Sensor readings (hourly, uses time picker) | Timeseries | Hourly max values from `sensors_data_by_hours` for temperature, charge, power, RPM, fuel, voltage, humidity, etc. |

---

### 4. Boolean Sensors

| Panel | Type | Description |
|-------|------|-------------|
| Boolean active % (last 7 days) | Bar chart (horizontal) | Percentage of hours each boolean sensor was active over 7 days. Supports `bit_index` and `direct` calculation methods |
| Boolean state transitions (hourly) | Table | Transition log showing when each boolean sensor became active (🟢) or inactive (⚪), hourly approximation |

---

### 5. Event History

| Panel | Type | Description |
|-------|------|-------------|
| Last 20 events | Table | Recent telemetry events (event_id 2/802/803/804/811): time, coordinates, satellites, Google Maps link |

---

## Logic Behind Calculations

### Target CTE
Every query uses a `target` CTE that resolves the selected `object_label` to a `device_id` from `raw_business_data.objects`. This ensures all panels consistently show data for the same asset.

### Alarm State
Three-tier logic via a `params` CTE:
1. **🔴 Shutdown** — any boolean sensor from `shutdown_boolean_labels` list is active (value ≥ 1)
2. **🟠 Warning** — battery charge below `warn_battery_threshold` (default 20%)
3. **⚪ Offline** — no telemetry event in the last 24 hours
4. **🟢 OK** — none of the above conditions triggered

### Sensor Timeseries
Hourly aggregated data from `processed_common_data.sensors_data_by_hours`, filtered by `sensor_type` (temperature, charge, power, rpm, fuel, voltage, instant_consumption, humidity, bat_capacity).

### Boolean Sensors
Uses `sensor_description.parameters` to detect boolean sensors with `calc_method` (bit_index or direct). For `bit_index`, the raw value is bitwise-shifted to extract the relevant bit. Active percentage = (hours with active state / total hours) × 100.

### Event History
Latest 20 events from `raw_telematics_data.tracking_data_core` for the target device, filtered by standard event IDs (2, 802, 803, 804, 811). Coordinates are converted from scaled format (÷ 1e7).

---

## Templating

| Variable | Type | Label | Description |
|----------|------|-------|-------------|
| `object_label` | query | Asset | Dropdown of all active assets from `raw_business_data.objects` |

---

## Data Layer (after client DB refactoring)

| Change | Description |
|-----------|------|
| Processing schema | **`processed_common_data`** instead of `business_data` |
| Trips | Table **`trips`**, fields **`trip_*`** (`trip_start_time`, `trip_distance_meters`, …) |
| Lookup tables / raw objects | **`raw_business_data`**, telematics — **`raw_telematics_data`** |
| Events | For code labels: **`processed_common_data.event_description`** |
| Device settings | **`processed_common_data.device_settings`** (key–value on full sync) |
| Hourly sensors | **`processed_common_data.sensors_data_by_hours`**, column **`value_title`** — client-side value label |

SQL infrastructure: `19_trips.sql` / `20_generate_trips.sql` instead of `18_tracks.sql` / `20_generate_tracks.sql`; renamed `02_update_description_parameters.sql`.
