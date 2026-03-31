# Object Status Dashboard

- **File:** `07-object-status-dashboard-schema.json`
- **UID:** `hello-world`
- **Default period:** `now-72h -> now`
- **Purpose:** Detailed telematics status of objects/devices.
- **What it shows:** online/standby/offline/no signal, moving/stopped/parked, last contact time, and related object reference data.

## Goal

Provide a detailed real-time snapshot for each fleet object — connectivity status, movement status, last known location, and data freshness.

## Metrics

- Connectivity status per object: online / standby / offline / no signal
- Movement status: moving / stopped / parked
- Time of last message (freshness in hours/minutes)
- Number of objects per status (summary)
- Reference data: group, model, device IMEI

## Logic

The latest `device_time` per `device_id` from `tracking_data_core` is compared to `NOW()`. Movement status is derived from the `speed` field of the last record (>0 — moving). An object is considered "parked" if `speed = 0` for more than N consecutive minutes. JOIN with `raw_business_data.objects`, `devices`, and `groups` enriches results with metadata. "No signal" is assigned when no data is available for >24 h.

## Business Value

Core dispatching tool. Allows a single-glance understanding of which vehicles are active, which are stopped, and which have lost contact — enabling fast operational decisions without switching to the map view.
