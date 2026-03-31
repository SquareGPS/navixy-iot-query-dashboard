# Leasing Dashboard

- **File:** `06-leasing-dashboard-schema.json`
- **UID:** `hello-world`
- **Default period:** `now-72h -> now`
- **Purpose:** Monitor leasing-related deadlines and associated documents.
- **What it shows:** Drivers and vehicles with upcoming expiry dates (including expired and expiring within 30 days).

## Goal

Provide full compliance control over leased assets against contractual obligations: documents, driver behavior, idle time, and territorial restriction violations.

## Metrics

- Vehicles with expired / expiring insurance (within 30 days): `free_insurance_valid_till_date`, `liability_insurance_valid_till`
- Drivers with expired / expiring driver's licenses: `driver_license_valid_till`
- Total and average engine idle time (min)
- Number of harsh braking / acceleration events by severity (Warning ≥60 km/h/s, Critical ≥80 km/h/s)
- Number of sudden turn events (Warning — heading change ≥30° at speed ≥30 km/h, Critical — ≥50°)
- Total number of idle events (engine on, speed <5 km/h, duration ≥5 min)

## Logic

Document dates are compared against `CURRENT_DATE` using `BETWEEN`. Harsh braking is calculated as `(prev_kmh - kmh) / dt_sec` using the LAG function on `tracking_data_core`; threshold ≥20 km/h/s. Acceleration uses the same approach with `(kmh - prev_kmh) / dt_sec ≥ 20`. Turning is computed via `atan2` (bearing formula). Idle detection joins `states` (ignition=1) with `tracking_data_core` (speed/100 < 5) using `LEAD` to calculate period duration. Message-over-time data is built with `generate_series` to fill empty hourly buckets.

## Business Value

For leasing companies and banks — an asset protection and contract compliance tool. Expired documents lead to fines and downtime. Harsh driving accelerates wear and risks voiding maintenance warranties. Idle time means direct fuel losses. Geofence violations breach territorial contract restrictions.
