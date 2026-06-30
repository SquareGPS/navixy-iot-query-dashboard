# HW Status Dashboard

- **File:** `11-hw-status-dashboard-schema.json`
- **UID:** `hw-status-dashboard`
- **Default period:** `now-72h → now`

## Goal of the Dashboard

Monitor hardware status across the entire fleet: device connectivity, movement state, sensor readings, and boolean sensor activation. Provides a real-time overview of telematics device health.

It helps to:
- Assess how many devices are moving, stopped, parked, or offline
- Monitor connection status (online, standby, offline)
- Review current sensor readings and boolean sensor states
- Investigate recent telemetry events per device

---

## Why This Dashboard is Important

### Device Health
- Movement and connection status distributions reveal fleet-wide connectivity issues
- Quick identification of devices that have gone silent

### Maintenance
- Sensor readings highlight failing hardware (voltage drops, temperature anomalies)
- Boolean sensors track equipment activation cycles

### Operations
- Real-time fleet position awareness via movement status
- Telematics quality monitoring for data-driven decisions

### Troubleshooting
- Last 20 telemetry events per device help diagnose specific issues
- Boolean activation table shows current state of all binary sensors

---

## Target Audience

### IT / Telematics Support
- Device health monitoring and troubleshooting

### Fleet Managers
- Fleet connectivity and activity overview

### Maintenance Engineers
- Sensor data review and anomaly detection

### Operations Managers
- Real-time fleet movement awareness

---

## Dashboard Elements

### 1. KPI Summary (8 panels)

| Panel | Type | Description |
|-------|------|-------------|
| Total Registered Objects | KPI | Count of active (non-deleted) objects |
| Moving | KPI | Devices currently in motion |
| Stopped | KPI | Devices stopped (ignition on, no movement) |
| Parked | KPI | Devices parked (ignition off) |
| No Signal | KPI | Devices with no recent signal |
| Online | KPI | Devices with active connection |
| Standby | KPI | Devices in standby mode |
| Offline | KPI | Devices with no connection |

---

### 2. Status Distribution

| Panel | Type | Description |
|-------|------|-------------|
| Movement Status Distribution | Pie chart | Moving / Stopped / Parked / No Signal breakdown |
| Connection Status Distribution | Pie chart | Online / Standby / Offline breakdown |

---

### 3. Device Overview

| Panel | Type | Description |
|-------|------|-------------|
| Device Status Table | Table | Per-device summary: label, movement status, connection status, last seen, coordinates |

---

### 4. Telemetry Events

| Panel | Type | Description |
|-------|------|-------------|
| Last 20 Telemetry Events | Table | Recent events per device: event_id, timestamp, coordinates, satellites |

---

### 5. Sensor Data

| Panel | Type | Description |
|-------|------|-------------|
| Current Sensor Reading (last 1 hour) | Table | Latest calibrated sensor values from `latest_calibrated_sensors` |

---

### 6. Boolean Sensors

| Panel | Type | Description |
|-------|------|-------------|
| Boolean Activation Table (current state) | Table | Current ON/OFF state of all boolean sensors |
| Boolean Active Duration (7d) — hours ON | Bar chart | Total hours each boolean sensor was active over 7 days |
| Boolean Active % (7d) | Bar chart | Percentage of time each boolean sensor was active over 7 days |

---

## Logic Behind Calculations

### Movement Status
Complex CTE based on `raw_telematics_data.tracking_data_core` and `raw_telematics_data.states`:
- **Moving** — speed > 0 in the last record
- **Stopped** — speed = 0, ignition on
- **Parked** — speed = 0, ignition off
- **No Signal** — no record in the last 72 hours

### Connection Status
Based on `device_daily_snapshots` and last seen timestamp:
- **Online** — last event within 5 minutes
- **Standby** — last event within 72 hours
- **Offline** — no event in 72+ hours

### Boolean Sensors
Uses `sensor_description.parameters` to detect sensors with `calc_method` (bit_index or direct). For `bit_index`, the raw value is bitwise-shifted to extract the relevant bit. Active duration and percentage calculated from hourly aggregates in `sensors_data_by_hours`.

### Sensor Readings
Latest values from `processed_common_data.latest_calibrated_sensors` joined with `raw_business_data.sensor_description` for labels and types.

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
