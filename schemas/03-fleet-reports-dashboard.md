# Fleet Reports Dashboard

- **File:** `03-fleet-reports-dashboard-schema.json`
- **UID:** `fleet-reports-dashboard`
- **Default period:** `now-30d → now`

## Goal of the Dashboard

An operational reporting dashboard: instant connectivity status of the entire fleet, speeding violations for the month, device supply voltage, and average mileage — all in one place.

It helps to:
- Monitor vehicle online/offline status in real time
- Identify vehicles with connectivity loss for more than 5 days
- Track speeding violations over 30 days
- Diagnose power supply issues with telematics devices
- View the current location of all vehicles on a map

---

## Why This Dashboard is Important

### Connectivity Control
- Rapid detection of offline devices before issues escalate
- Identifies vehicles that have dropped out of the monitoring system

### Technical Diagnostics
- Supply voltage data reveals battery drain or wiring failures
- Prevents hidden telematics failures

### Regulatory Compliance
- Speeding violation log for documentation and incident review

### Geographic Control
- Map of last known positions for search and dispatch

---

## Target Audience

### Dispatchers
- Real-time connectivity status monitoring
- Vehicle location via map

### IT / Technical Teams
- Device power diagnostics
- Telematics data quality control

### Safety Managers
- Speeding violation analysis over the period

### Operations Managers
- Summary report on vehicle activity and mileage

---

## Dashboard Elements

### 1. Connectivity Status KPIs

| Panel | Type | Description |
|-------|------|-------------|
| Online Units | KPI | Number of vehicles online (last signal < 5 min) |
| Offline Units | KPI | Number of vehicles offline |
| Units Inactive >5 Days | KPI | Vehicles with no activity for more than 5 days |
| Speeding Violations (30d) | KPI | Total speeding violations over 30 days |

---

### 2. Status Distribution

| Panel | Type | Description |
|-------|------|-------------|
| Units Online / Offline | Pie chart | Online vs offline vehicle ratio |

---

### 3. Geozone Activity & Mileage

| Panel | Type | Description |
|-------|------|-------------|
| Kilometers by Zone (last month) | Bar chart | Mileage by geozone over the last month |

---

### 4. Detail Tables

| Panel | Type | Description |
|-------|------|-------------|
| Supply Voltage by Unit (last 1 hour) | Table | Supply voltage per device over the last hour |
| Speeding Violations (last 30 days) | Table | Violation log: vehicle, speed, time, location |
| Units Inactive More Than 1 Days | Table | Vehicles inactive 1+ day: label, last signal |
| Average Mileage by Unit (last 30 days) | Table | Average daily mileage per vehicle over 30 days |

---

### 5. Map

| Panel | Type | Description |
|-------|------|-------------|
| Last known location | Geomap | Last known position of each vehicle on the map |

---

## Logic Behind Calculations

### Online / Offline
The maximum `device_time` from `tracking_data_core` is retrieved for each `device_id`. Difference from `NOW()`:
- < 5 min → Online
- 5 min – 24 h → Offline
- > 5 days → Inactive

### Supply Voltage
Data from `raw_telematics_data.inputs` with `sensor_name = 'voltage'` or equivalent. Last value within 1 hour per device.

### Speeding Violations
Records from `tracking_data_core` where `speed / 100.0` exceeds the set threshold. Enriched with object label via JOIN with `objects`.

### Mileage by Geozone
Mileage is calculated from GPS points that fall inside a geozone (via `ST_DWithin`), summed using Haversine over the period.

### Map
Last `(latitude, longitude)` record per `device_id`, converted from scaled format (`÷ 1e7`).
