# Object Status Dashboard

- **File:** `07-object-status-dashboard-schema.json`
- **UID:** `hello-world`
- **Default period:** `now-72h → now`

## Goal of the Dashboard

A detailed real-time snapshot of all fleet objects/devices: connectivity status (online/standby/offline/no signal) and movement status (moving/stopped/parked). The primary dispatcher tool for instant situational awareness.

It helps to:
- Get an instant status snapshot for each vehicle
- Assess fleet distribution across connectivity and movement statuses
- Identify disconnected and inactive objects
- View a detailed list of all objects with their current state

---

## Why This Dashboard is Important

### Dispatching
- Understand at a glance how many vehicles are moving, stopped, or have lost connectivity
- Fast response to connectivity loss without switching to the map view

### Data Quality Control
- Objects with "No Signal" status require technical investigation
- Enables tracking of "dead" devices before they escalate

### Fleet Management
- Understand the actual number of registered objects
- Quick status-based filtering for operational tasks

---

## Target Audience

### Dispatchers
- Primary operational monitoring screen
- Quick vehicle lookup by status

### Fleet Managers
- Assess real fleet activity
- Monitor "silent" devices

### IT / Technical Support
- Identify devices with connectivity issues

---

## Dashboard Elements

### 1. KPI — Connectivity Status

| Panel | Type | Description |
|-------|------|-------------|
| Online | KPI | Vehicles online (last signal < 5 min) |
| Standby | KPI | Vehicles in standby mode (5 min – 1 h) |
| Offline | KPI | Vehicles offline (1–24 h without signal) |
| No Signal | KPI | Vehicles with no signal for more than 24 h |
| Registered Objects | KPI | Total number of registered objects |

---

### 2. KPI — Movement Status

| Panel | Type | Description |
|-------|------|-------------|
| Moving | KPI | Vehicles in motion (speed > 0) |
| Stopped | KPI | Vehicles stopped (speed = 0, engine not off) |
| Parked | KPI | Vehicles parked (extended standstill) |

---

### 3. Object Detail Table

| Panel | Type | Description |
|-------|------|-------------|
| Table | Table | Full object list: label, group, connectivity status, movement status, last signal, coordinates |

---

### 4. Distribution Charts

| Panel | Type | Description |
|-------|------|-------------|
| Movement Status Distribution | Pie chart | Vehicle distribution by movement status: Moving / Stopped / Parked |
| Connection Status Distribution | Pie chart | Vehicle distribution by connectivity status: Online / Standby / Offline / No Signal |

---

## Logic Behind Calculations

### Connectivity Statuses
The latest `device_time` per `device_id` from `tracking_data_core` is compared to `NOW()`:
- Online: < 5 min
- Standby: 5 min – 1 h
- Offline: 1 – 24 h
- No Signal: > 24 h

### Movement Statuses
From the last `tracking_data_core` record per `device_id`:
- Moving: `speed > 0`
- Stopped: `speed = 0`, interval since previous point < parking threshold
- Parked: `speed = 0` for N+ consecutive minutes (via `LEAD` / `LAG`)

### Registered Objects
`COUNT(*)` from `raw_business_data.objects` with filter `is_deleted = false`.

### Metadata Enrichment
JOIN with `raw_business_data.objects`, `devices` (for IMEI), `groups` (for group label), and `vehicles` (for model and registration number).
