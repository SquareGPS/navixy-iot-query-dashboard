
## Data layer

### Tables used

| Table | Purpose |
|-------|---------|
| processed_common_data.driver_performance_events | All behavior events (idle, aggressive, RPM, overspeeding) |
| processed_common_data.trips | Trips — for high speed and route-based impact |
| raw_business_data.objects | Object directory (label, device_id) |
| raw_business_data.vehicles | Speed limits (max_speed) |
| raw_business_data.employees | Driver-to-object linkage |

### Client DB refactor

| Change | Summary |
|--------|---------|
| Processing schema | **processed_common_data** instead of business_data |
| Trips | Table **trips**, **trip_*** columns (trip_start_time, trip_distance_meters, …) |
| Master / raw objects | **raw_business_data**; telematics — **raw_telematics_data** |
| Events | Code labels: **processed_common_data.event_description** |
| Device settings | **processed_common_data.device_settings** (key–value on full sync) |
| Hourly sensors | **processed_common_data.sensors_data_by_hours**, **value_title** — client-facing value label |

SQL infrastructure: 19_trips.sql / 20_generate_trips.sql replaced 18_tracks.sql / 20_generate_tracks.sql; 02_update_description_parameters.sql renamed.
