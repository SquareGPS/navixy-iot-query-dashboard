# Fleet Performance Dashboard

- **File:** `02-fleet-performance-dashboard-schema.json`
- **UID:** `fleet-performance-dashboard`
- **Default period:** `now-30d -> now`
- **Purpose:** Comprehensive fleet efficiency assessment.
- **What it shows:** Fleet overview (vehicle count, mileage), performance and safety indicators, geozone and operations blocks.

## Goal

Provide a summary view of fleet utilization over a period — load, mileage, maximum and average speeds, route compliance.

## Metrics

- Total and average daily mileage per vehicle (km)
- Maximum and average speed (km/h)
- Number of active hours per day (unique hours in `tracking_data_core`)
- Number of geozone visits
- Number of trips over the period

## Logic

JOIN between `tracking_data_core` and `raw_business_data.objects` / `vehicles` produces a daily summary per vehicle. Mileage is calculated using the Haversine formula between consecutive GPS points (with outlier filtering where `ABS(lat_diff) < 1`). Speed metrics are aggregated with `MAX` / `AVG` on `speed` (values stored ×100, divided by `100.0` at query time). Active hours use `COUNT(DISTINCT DATE_PART('hour', device_time))`.

## Business Value

Helps fleet managers and operations teams identify underutilized and overloaded assets, monitor driving style, justify maintenance needs, and plan route optimization.
