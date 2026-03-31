# Vehicle Mileage Dashboard

- **File:** `09-vehicle-mileage-dashboard-schema.json`
- **UID:** `vehicle-mileage`
- **Default period:** `now-72h -> now`
- **Purpose:** Fleet mileage analysis.
- **What it shows:** Mileage distribution by time category (business hours / after hours / weekends), weekly mileage structure, and related KPIs.

## Goal

Detailed analysis of fleet mileage broken down by time category — business hours vs after-hours vs weekends — to identify unauthorized vehicle use.

## Metrics

- Daily mileage per vehicle (km)
- Mileage during business hours (Mon–Fri, 09:00–18:00)
- Mileage outside business hours (before 9:00, after 18:00)
- Mileage on weekends (Sat, Sun)
- Percentage breakdown by time category
- Weekly mileage trend across the fleet

## Logic

GPS points from `tracking_data_core` are enriched with time attributes using `EXTRACT(DOW FROM device_time)` and `EXTRACT(HOUR FROM device_time)`. Each segment between consecutive points is calculated via Haversine and classified by time window. Outlier filtering: `ABS(lat_diff) < 1 AND ABS(lon_diff) < 1`. Aggregated by date and vehicle with JOIN on `objects` / `vehicles`.

## Business Value

Enables detection and quantification of unauthorized corporate vehicle use. After-hours mileage is a direct indicator for HR, security, and finance departments. Data supports fuel cost allocation and mileage-based maintenance scheduling following the methodology from the [Navixy SQL Recipe Book](https://www.navixy.com/docs/analytics/example-queries/logistics).
