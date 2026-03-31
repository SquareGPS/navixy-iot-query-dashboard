# Fleet Reports Dashboard

- **File:** `03-fleet-reports-dashboard-schema.json`
- **UID:** `fleet-reports-dashboard`
- **Default period:** `now-30d -> now`
- **Purpose:** Real-time operational status of the fleet.
- **What it shows:** KPIs for online/offline objects, communication status distribution, and other summary telematics metrics.

## Goal

Instant operational snapshot — how many vehicles are currently connected, how many have lost signal, and how recent the last message is.

## Metrics

- Number of online / standby / offline / no-signal objects
- Distribution of vehicles by communication status (%)
- Time of last message from each device
- Number of devices with no contact for more than N hours

## Logic

For each `device_id`, the maximum `device_time` from `tracking_data_core` is retrieved, then the difference from `NOW()` is calculated. Devices are classified against thresholds (e.g.: <5 min — online, 5–60 min — standby, 1–24 h — offline, >24 h — no signal). Results are joined with `raw_business_data.objects` for object labels.

## Business Value

First line of control for dispatchers and operators. Enables immediate response to vehicle connectivity loss, initiating equipment checks or diagnosing device silence.
