# Vehicle Mileage Dashboard

- **File:** `09-vehicle-mileage-dashboard-schema.json`
- **UID:** `vehicle-mileage`
- **Default period:** `now-72h → now`

## Goal of the Dashboard

Analyze fleet mileage broken down by time category (business hours / after hours / weekends), weekly mileage structure, and device message activity over time. The key tool for detecting unauthorized vehicle use.

It helps to:
- Assess total and per-vehicle mileage over the period
- Determine the share of business-hours vs after-hours mileage
- Identify trips on weekends and outside working hours
- Track device message activity over time

---

## Why This Dashboard is Important

### Unauthorized Use Detection
- After-hours mileage is a direct indicator of off-purpose corporate vehicle use
- Weekend trips require separate authorization and documentation

### Cost Management
- Mileage breakdown by time category enables accurate allocation of fuel and maintenance costs
- Basis for calculating reimbursements for mixed-use vehicles (business / personal)

### Telematics Data Quality
- The "Messages Over Time" chart shows device data transmission stability
- Gaps in the chart indicate connectivity loss or equipment downtime

### HR & Legal Control
- Data used by HR and security for incident investigations
- Documentary basis for corporate vehicle use policies

---

## Target Audience

### Fleet Managers
- Monitor total and per-vehicle mileage
- Identify vehicles with abnormally high after-hours mileage

### HR & Security Teams
- Investigate unauthorized use
- Build an evidence base

### Finance Department
- Allocate fuel costs across departments
- Calculate mileage-based maintenance schedules

### IT / Technical Teams
- Monitor device connection quality via "Messages Over Time"

---

## Dashboard Elements

### 1. KPI — Mileage

| Panel | Type | Description |
|-------|------|-------------|
| Total Mileage, km | KPI | Total fleet mileage over the period |
| Mileage per Vehicle, km | KPI | Average mileage per vehicle over the period |

---

### 2. Mileage Distribution by Category

| Panel | Type | Description |
|-------|------|-------------|
| Mileage Distribution | Pie chart | Mileage share: business hours (Mon–Fri 09:00–18:00) / after hours / weekends |

---

### 3. Weekly Mileage Trend

| Panel | Type | Description |
|-------|------|-------------|
| Mileage Distribution By Weeks, km | Bar chart | Total fleet mileage by week, broken down by time category |

---

### 4. Device Message Activity Over Time

| Panel | Type | Description |
|-------|------|-------------|
| Messages Over Time | Time series | Telematics message count by hour — reflects connectivity stability and fleet activity |

---

## Logic Behind Calculations

### Time Categories
Each GPS point from `tracking_data_core` is enriched with time attributes:
```sql
EXTRACT(DOW FROM device_time)  -- 0=Sunday, 6=Saturday
EXTRACT(HOUR FROM device_time)
```
Classification:
- **Business hours:** DOW IN (1–5) AND HOUR BETWEEN 9 AND 17
- **After hours:** DOW IN (1–5) AND (HOUR < 9 OR HOUR >= 18)
- **Weekends:** DOW IN (0, 6)

### Segment Mileage
For each pair of consecutive points (within the same `device_id` and day):
```sql
111 * SQRT(POWER(lat - prev_lat, 2) + POWER((lon - prev_lon) * COS(RADIANS(lat)), 2))
```
Coordinates converted from scaled format (`÷ 1e7`). Outlier filtering: `ABS(lat_diff) < 1 AND ABS(lon_diff) < 1`.

### Total & Average Mileage
`SUM(segment_km)` across all points for Total Mileage. `AVG` by `device_id` for Mileage per Vehicle.

### Messages Over Time
`COUNT(*)` from `tracking_data_core`, grouped by `date_trunc('hour', device_time)`. Empty hourly buckets are filled using `generate_series` for a continuous chart.
