# HM Trip Operations Dashboard

- **File:** `04-hm-trip-operations-dashboard-schema.json`
- **UID:** `hm-trip-operations-dashboard`
- **Default period:** `now-7d -> now`
- **Purpose:** Trip and shift activity analysis for heavy machinery.
- **What it shows:** Trips for the previous day split by day/night window (08:00–19:00 and 19:00–08:00), plus comparative operational metrics over a short horizon.

## Goal

Track the number and nature of heavy machinery trips broken down by shift, detect schedule violations, and compare day/night performance.

## Metrics

- Number of trips in the previous day (day shift / night shift)
- Total mileage per shift
- Average number of trips per unit of equipment
- Current period vs previous period comparison

## Logic

A trip is defined as a continuous movement period: speed above a threshold (>5 km/h) marks the start, dropping below marks the end. `LAG` / `LEAD` window functions are applied to `device_time` partitioned by `device_id`. Shift time windows are set using `EXTRACT(HOUR FROM device_time)`. Distance is calculated using the Haversine formula between the first and last point of the trip.

## Business Value

Critical for mining, construction, and logistics companies with shift-based operations. Enables monitoring of trip quotas, detection of in-shift downtime, and improved utilization of high-value equipment.
