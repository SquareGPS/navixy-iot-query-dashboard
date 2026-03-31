# Heavy Machinery – Actual Engine Operation

- **File:** `05-heavy-machinery-engine-operation-schema.json`
- **UID:** `heavy-machinery-dashboard`
- **Default period:** `now-7d -> now`
- **Purpose:** Actual load and operation of heavy equipment based on RPM/event data.
- **What it shows:** Engine operating hours, zone visits, equipment load metrics, and operational KPIs.

## Goal

Measure actual engine runtime for heavy equipment, zone visits, and total load broken down by vehicle and driver.

## Metrics

- Engine operating hours per day / over the period (per vehicle and driver)
- Number and duration of geozone visits
- Operating time vs idle time ratio
- Overload vs underutilization (comparison against standard)

## Logic

Engine state data is taken from `raw_telematics_data.states` (filtered by `state_name = 'ignition'` or from `sensor_description` where `sensor_type = 'engine'`). State transitions `0→1` record engine-on, `1→0` record engine-off. The difference between timestamps gives operating duration in hours. Driver assignment uses a `LATERAL JOIN` on `driver_history` for the closest driver change event prior to the operating period. Zone visits are counted using `ST_DWithin` in PostGIS.

## Business Value

Key tool for scheduling maintenance by engine hours, calculating rental rates (equipment leasing), identifying overloaded units, and optimizing workload distribution among operators.
