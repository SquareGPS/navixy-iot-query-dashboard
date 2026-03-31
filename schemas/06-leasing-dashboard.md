# Leasing Dashboard

- **File:** `06-leasing-dashboard-schema.json`
- **UID:** `hello-world`
- **Default period:** `now-72h → now`

## Goal of the Dashboard

Monitor leased asset compliance against contractual obligations: document expiry dates, driver behavior (harsh maneuvers), and engine idle time. The dashboard addresses the needs of banks and leasing companies for asset protection.

It helps to:
- Identify vehicles and drivers with expired or expiring documents
- Detect harsh braking, acceleration, and cornering events
- Measure total and average engine idle time
- Get an overview of unsafe driving event counts

---

## Why This Dashboard is Important

### Asset Protection
- Harsh driving accelerates brake, tire, and suspension wear
- Provides grounds for damage recovery from the client at end of lease

### Document Control
- Expired insurance = fines and legal liability for the lessor
- Expired driver's licenses = contract violation

### Fuel Efficiency
- Extended idle time means direct fuel costs borne by the lessor
- Average idle time identifies repeat offenders

### Regulatory Compliance
- Documents unsafe driving events for insurance disputes and claims

---

## Target Audience

### Leasing Companies & Banks
- Full control over the condition of contracted assets

### Risk Managers
- Assess behavioral risks across the client portfolio

### Account Managers
- Notify clients about upcoming document expiry

### Insurance Departments
- Evidence base for claims settlement

---

## Dashboard Elements

### 1. Documents — Expiry Dates

| Panel | Type | Description |
|-------|------|-------------|
| Vehicles with nearest expiry dates | Pie chart | Vehicles by category: insurance expired / expiring within 30 days / others |
| Drivers with nearest expiry dates | Pie chart | Drivers by category: license expired / others |

---

### 2. Harsh Driving

| Panel | Type | Description |
|-------|------|-------------|
| Harsh Braking Events | Bar chart | Harsh braking by day, broken down by severity: Warning (≥60 km/h/s) / Critical (≥80 km/h/s) |
| Harsh Acceleration Events | Bar chart | Harsh acceleration by day, broken down by severity: Warning / Critical |
| Sudden Turns / Cornering | Bar chart | Sudden turns by day: Warning (≥30° at ≥30 km/h) / Critical (≥50°) |
| Total Harsh Events | Table | Total unsafe driving events over the period |

---

### 3. Idle — Engine Idle Time

| Panel | Type | Description |
|-------|------|-------------|
| Total Idle Events | Stat | Total idle events (engine on, speed <5 km/h, duration ≥5 min) |
| Total Idle Time | KPI | Total engine idle time (min) |
| Average Idle Duration | Stat | Average duration of a single idle event (min) |

---

## Logic Behind Calculations

### Document Expiry
Fields `free_insurance_valid_till_date`, `liability_insurance_valid_till` from `raw_business_data.vehicles` and `driver_license_valid_till` from `employees` are compared against `CURRENT_DATE`:
- Expired: `< CURRENT_DATE`
- Expiring soon: `BETWEEN CURRENT_DATE AND CURRENT_DATE + 30 days`

### Harsh Braking
`(prev_kmh - kmh) / NULLIF(dt_sec, 0)` via `LAG` on `tracking_data_core`.
- Warning: value ≥ 60 km/h/s
- Critical: value ≥ 80 km/h/s

### Harsh Acceleration
`(kmh - prev_kmh) / NULLIF(dt_sec, 0)` — same approach as braking, threshold ≥ 60 / ≥ 80 km/h/s.

### Sudden Turns
Heading change calculated via `atan2` (bearing formula): `ABS(heading_change)`. Trigger threshold: ≥30° (Warning) / ≥50° (Critical) at speed ≥30 km/h.

### Idle (Engine Idle)
JOIN of `states` (ignition = 1) and `tracking_data_core` (speed / 100 < 5). Period duration via `LEAD(device_time)`. Minimum idle threshold: 5 minutes.
