# Fleet Anomaly Monitor

- **File:** `01-fleet-anomaly-monitor-schema.json`
- **UID:** `generated-dashboard`
- **Default period:** `now-30d -> now`
- **Purpose:** Monitor fleet anomalies and telematics issues.
- **What it shows:** Total number of vehicles, devices with no GPS activity for 3+ days, prolonged downtime, and other deviation indicators.

## Goal

Identify vehicles and devices that have stepped outside normal operating patterns — no signal, no movement, abnormally long downtime.

## Metrics

- Number of vehicles with no GPS activity for 3+ days
- Number of objects with abnormally long downtime
- Total number of vehicles in the fleet
- Share of devices with anomalies

## Logic

Queries `raw_telematics_data.tracking_data_core` to find devices whose last record is older than a threshold. To detect "stalled" assets, `MIN` and `MAX` coordinates over the period are compared — if the spread is smaller than a tolerance (~10 m, i.e. ≤2000 units for lat and ≤1000 for lon in scaled format), the asset is considered stationary. Devices with fewer than 10 data points are excluded as too sparse.

## Business Value

Enables early detection of hidden telematics failures, device connectivity loss, or actual equipment downtime. Critical for fleet managers who need to know about "silent" assets before they impact operations.
