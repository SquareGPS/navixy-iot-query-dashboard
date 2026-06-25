
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
