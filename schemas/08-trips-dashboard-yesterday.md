# Trips Dashboard (Yesterday)

- **File:** `08-trips-dashboard-yesterday-schema.json`
- **UID:** `trips-dashboard-yesterday`
- **Default period:** `now-1d -> now`
- **Purpose:** Trip summary for the previous day.
- **What it shows:** Number of trips, total mileage, and additional daily trip metrics.

## Goal

Daily operational report on trips — how many runs were made, total and average mileage, anomalies per individual vehicle.

## Metrics

- Number of trips per day (per vehicle)
- Total mileage for the day (km)
- Average distance per trip
- Trip start and end timestamps
- Start and end coordinates

## Logic

Trips are segmented through speed transitions in `tracking_data_core`: `speed ≥ 5 km/h` after a stopped period marks a trip start; dropping below the threshold marks the end. The `LAG(speed)` window function is applied partitioned by `device_id` sorted by `device_time`. Distance is calculated using the Haversine formula: `111 * SQRT(POWER(Δlat, 2) + POWER(Δlon * COS(lat), 2))`. Results are aggregated by `trip_day` and `device_id`, enriched via JOIN with `objects` / `vehicles`.

## Business Value

Essential part of daily reporting for logistics and transportation companies. Enables verification of trip quotas, detection of unregistered journeys, and monitoring of vehicle use outside working hours.
