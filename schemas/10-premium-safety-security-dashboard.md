# Safety & Security (Premium)

- **File:** `10-premium-safety-security-dashboard-schema.json`
- **UID:** `premium-safety-security-dashboard`
- **Default period:** `now-24h → now`

## Goal of the Dashboard

Comprehensive safety, security, condition monitoring, and cargo security dashboard. Provides real-time KPIs and detailed drill-down panels across four domains for the last 24 hours.

It helps to:
- Track geofence crossings, speeding, and driver behavior in real time
- Detect GPS signal degradation and external power anomalies
- Monitor temperature excursions and engine health
- Track cargo door events and unauthorized access

---

## Why This Dashboard is Important

### Security
- Geofence violation tracking prevents unauthorized vehicle movement
- Risk zone exposure measurement identifies high-threat areas
- After-hours trip detection flags policy violations
- GPS gap and GNSS degradation monitoring detects tamper attempts

### Safety
- Overspeed and driver performance events are leading crash indicators
- Night driving monitoring addresses the highest-risk driving period
- Panic button tracking enables emergency response

### Asset Condition
- Temperature excursion detection protects sensitive cargo
- Battery voltage monitoring prevents breakdowns
- Engine temperature alerts enable preventive maintenance

### Cargo Security
- Door open event tracking detects unauthorized access
- Door open duration analysis identifies loading/unloading anomalies

---

## Target Audience

### Security Operations
- Real-time zone violation and GPS anomaly monitoring

### Safety Managers
- Speeding and driver behavior event analysis

### Fleet / Asset Managers
- Overall fleet health and condition overview

### Logistics / Cargo Managers
- Door event monitoring and cargo integrity

---

## Dashboard Elements

### Top-Level KPIs (8 panels)

| Panel | Type | Description |
|-------|------|-------------|
| Geofence crossings (24h) | KPI | Zone visit entries in the last 24 hours |
| Overspeed trips (24h) | KPI | Trips exceeding vehicle speed limit |
| Driver performance braking (24h) | KPI | Harsh braking events |
| Driver performance acceleration (24h) | KPI | Harsh acceleration events |
| Temp excursions (25–75°C) | KPI | Temperature sensor readings in anomalous range |
| GNSS degraded (<3 sats, moving) | KPI | Moving records with fewer than 3 satellites |
| Door events / alarm 969 (24h) | KPI | Door sensor events and alarm event 969 |
| Panic / SOS (24h) | KPI | Panic button activations (event 811) |

---

### Security Section

| Panel | Type | Description |
|-------|------|-------------|
| Zone crossings by zone (top 15) | Bar chart | Top 15 zones by number of crossings |
| Risk-tagged vs other zone visits | Bar chart | Zone visits split by risk tag vs other |
| Hourly GNSS degraded (<3 sats, moving) | Bar chart | Hourly distribution of GPS degradation |
| Hourly avg satellites (moving) | Line chart | Average satellite count by hour |
| Geofence violation (crossings) | KPI | Detailed geofence crossing count |
| Risk zone exposure (h) | KPI | Hours spent in risk-tagged zones |
| After-hours trips (08–19) | KPI | Trips outside business hours |
| Unplanned stops ≥20 min | KPI | Stops of 20+ min outside zones |
| Risk zone dwell >15 min | KPI | Visits to risk zones exceeding 15 min |
| Stale GPS >30 min | KPI | Devices with no GPS update for 30+ min |
| External power anomalies | KPI | Supply voltage drop events |
| Battery-only (TBD) | KPI | Reserved for battery-only operation detection |
| GNSS degraded (<3 sats) | KPI | Total GNSS degradation events |
| GPS gaps >15 min | KPI | Gaps between consecutive GPS points |
| Security — detail | Table | Detailed zone & GNSS degraded rows |

---

### Safety Section

| Panel | Type | Description |
|-------|------|-------------|
| Overspeed trips (24h) | KPI | Trips with max speed > vehicle limit |
| Overspeed time (min) | KPI | Total minutes above speed limit |
| Driver performance braking (24h) | KPI | Braking events count |
| Driver performance acceleration (24h) | KPI | Acceleration events count |
| High-risk zone visits | KPI | Visits to zones tagged as high-risk |
| Night driving (23–05h) | KPI | Trips during night hours |
| Driver panic button (24h) | KPI | Panic/SOS button activations |
| Driver inactive >3h | KPI | Drivers with no activity for 3+ hours |
| Top vehicles by overspeed trips | Bar chart | Vehicles ranked by speeding trips |
| Hourly overspeed vs driver performance | Bar chart | Hourly breakdown of speed and performance events |
| Speeding & driver performance events | Table | Detailed event log |

---

### Condition Section

| Panel | Type | Description |
|-------|------|-------------|
| Temp excursions (25–75°C) | KPI | Temperature anomaly events |
| Reefer out-of-band (unique objects) | KPI | Refrigerator units with out-of-range readings |
| Battery voltage drop | KPI | Vehicles with battery voltage below threshold |
| Engine temperature alerts | KPI | Engine overheating detections |
| Condition — sensor readings | Table | Detailed sensor readings log |

---

### Cargo Security Section

| Panel | Type | Description |
|-------|------|-------------|
| Door open events (24h) | KPI | Total door opening events |
| Unauthorized door open | KPI | Door opens outside business hours or zones |
| Door open duration (min) | KPI | Total minutes doors were open |
| Cargo — door events by vehicle (top 15) | Bar chart | Top 15 vehicles by door event count |
| Cargo — door timeline | Table | Chronological door event log |

---

## Logic Behind Calculations

### Geofence Crossings
Counted from `processed_common_data.zone_visits` — entries within the last 24 hours, joined to active objects.

### Speeding
Trips from `processed_common_data.trips` where `max_speed` exceeds the vehicle limit from `raw_business_data.vehicles.max_speed` (default 70 km/h).

### Driver Performance Events
Sourced from `processed_common_data.driver_performance_events` — includes braking, acceleration, turns, lane changes.

### Temperature Excursions
Sensor readings from `raw_telematics_data.inputs` joined via `raw_business_data.sensor_description` for temperature sensors, filtered for values in the 25–75°C anomalous range.

### GNSS Degradation
Records from `raw_telematics_data.tracking_data_core` where `satellites < 3` and the device was moving (speed > 0).

### Door Events
Boolean sensor inputs from `raw_telematics_data.inputs` matched via `sensor_description` to door-type sensors, combined with event 969 from `tracking_data_core`.

### Risk Zone Tagging
Zones linked to `raw_business_data.tags` and `raw_business_data.tag_links` to identify risk-tagged geofences.

---

## Data layer (client DB refactor)

| Change | Summary |
|--------|---------|
| Processing schema | **processed_common_data** instead of business_data |
| Trips | Table **trips**, **trip_*** columns (trip_start_time, trip_distance_meters, …) |
| Master / raw objects | **raw_business_data**; telematics — **raw_telematics_data** |
| Events | Code labels: **processed_common_data.event_description** |
| Device settings | **processed_common_data.device_settings** (key–value on full sync) |
| Hourly sensors | **processed_common_data.sensors_data_by_hours**, **value_title** — client-facing value label |

SQL infrastructure: 19_trips.sql / 20_generate_trips.sql replaced 18_tracks.sql / 20_generate_tracks.sql; 02_update_description_parameters.sql renamed.
