/**
 * DO NOT EDIT — GENERATED FILE.
 *
 * Regenerate with:  cd backend && npm run build:agent-corpus
 * Source of truth:  backend/scripts/build-agent-corpus.mjs over repo-root schemas/*.json
 *
 * Why this is a generated, committed .ts module and not a runtime read or a JSON
 * import — both alternatives work locally and fail only in Docker:
 *  1. schemas/ is outside the backend Docker build context (docker-compose.yml
 *     `context: ./backend`; Dockerfile `COPY . .`), so readFileSync('../schemas/...')
 *     works under tsx watch and throws ENOENT in the production image.
 *  2. Only dist/ survives into the runtime image (`COPY --from=builder /app/dist ./dist`),
 *     so the data must live inside a compiled module.
 *  3. `rootDir: "./src"` makes a static import from ../schemas a TS6059 error. Note
 *     `resolveJsonModule: true` IS set — it governs whether TS understands a JSON
 *     module; rootDir and the Docker context are what kill the import.
 *  4. Node ESM would additionally need `with { type: 'json' }`, which
 *     `verbatimModuleSyntax` will not synthesize; there is zero precedent for a JSON
 *     import anywhere in backend/src.
 *
 * Panels dropped by the generator (see PANEL_EXCLUSIONS and drop rule (a) there):
 *   05-heavy-machinery-engine-operation-schema.json panel id 6 — Workload by band (7d): ORDER BY category, series names columns the SELECT does not project (object_label, engine_hours, load_band). Fails at execution with 42703 and has never worked in this app — it renders as an error tile today (PF-1).
 *   05-heavy-machinery-engine-operation-schema.json panel id 11 — empty SQL statement
 *   (drop rule (a)): renders as a dead "No SQL configured" tile.
 *
 * Shipped: 6 entries, 52 panels, 49 SQL statements.
 *   fleet-anomaly: 9 panels
 *   fleet-reports: 11 panels
 *   engine-operation: 9 panels
 *   leasing: 9 panels
 *   vehicle-mileage: 5 panels
 *   driver-performance: 9 panels
 */

export interface CorpusEntry {
  id: string;
  keywords: readonly string[];
  schema: Record<string, unknown>;
}

export const AGENT_CORPUS: readonly CorpusEntry[] = [
  {
    id: 'fleet-anomaly',
    keywords: ['anomaly', 'anomalies', 'alert', 'fault', 'incident', 'exception', 'outlier', 'problem'],
    schema: {
      "id": null,
      "uid": "generated-dashboard",
      "tags": [],
      "time": {
        "to": "now",
        "from": "now-30d"
      },
      "links": [],
      "style": "dark",
      "title": "Fleet Anomaly Monitor",
      "panels": [
        {
          "id": 1,
          "type": "kpi",
          "title": "Total Vehicles",
          "gridPos": {
            "h": 5,
            "w": 6,
            "x": 0,
            "y": 0
          },
          "options": {
            "textMode": "auto",
            "colorMode": "value"
          },
          "x-navixy": {
            "sql": {
              "params": {},
              "statement": "SELECT COUNT(*) AS value FROM raw_business_data.objects WHERE is_deleted IS NOT TRUE"
            },
            "verify": {
              "max_rows": 1
            },
            "dataset": {
              "shape": "kpi",
              "columns": {
                "value": {
                  "type": "integer"
                }
              }
            }
          }
        },
        {
          "id": 2,
          "type": "kpi",
          "title": "GPS Offline 3+ Days",
          "gridPos": {
            "h": 5,
            "w": 6,
            "x": 6,
            "y": 0
          },
          "options": {
            "textMode": "auto",
            "colorMode": "value"
          },
          "x-navixy": {
            "sql": {
              "params": {},
              "statement": "WITH last_activity AS (SELECT device_id, MAX(device_time) AS last_device_time FROM raw_telematics_data.tracking_data_core WHERE event_id IN (2, 802, 803, 804, 811) AND latitude <> 0 AND longitude <> 0 GROUP BY device_id) SELECT COUNT(*) AS value FROM raw_business_data.objects o LEFT JOIN last_activity la ON o.device_id = la.device_id WHERE o.is_deleted IS NOT TRUE AND (la.last_device_time IS NULL OR la.last_device_time < NOW() - INTERVAL '3 days')"
            },
            "verify": {
              "max_rows": 1
            },
            "dataset": {
              "shape": "kpi",
              "columns": {
                "value": {
                  "type": "integer"
                }
              }
            }
          }
        },
        {
          "id": 3,
          "type": "kpi",
          "title": "Long Stops 24h+ This Month",
          "gridPos": {
            "h": 5,
            "w": 6,
            "x": 12,
            "y": 0
          },
          "options": {
            "textMode": "auto",
            "colorMode": "value"
          },
          "x-navixy": {
            "sql": {
              "params": {},
              "statement": "WITH trip_gaps AS (SELECT device_id, EXTRACT(EPOCH FROM (LEAD(trip_start_time) OVER (PARTITION BY device_id ORDER BY trip_start_time) - trip_end_time)) / 3600 AS gap_hours FROM processed_common_data.trips WHERE trip_start_time >= DATE_TRUNC('month', NOW())) SELECT COUNT(DISTINCT device_id) AS value FROM trip_gaps WHERE gap_hours >= 24"
            },
            "verify": {
              "max_rows": 1
            },
            "dataset": {
              "shape": "kpi",
              "columns": {
                "value": {
                  "type": "integer"
                }
              }
            }
          }
        },
        {
          "id": 4,
          "type": "kpi",
          "title": "Zone Exits 3+ This Month",
          "gridPos": {
            "h": 5,
            "w": 6,
            "x": 18,
            "y": 0
          },
          "options": {
            "textMode": "auto",
            "colorMode": "value"
          },
          "x-navixy": {
            "sql": {
              "params": {},
              "statement": "SELECT COUNT(*) AS value FROM (SELECT zv.device_id FROM processed_common_data.zone_visits zv JOIN raw_business_data.objects o ON o.device_id = zv.device_id WHERE o.is_deleted IS NOT TRUE AND zv.exit_time IS NOT NULL AND zv.enter_time >= DATE_TRUNC('month', NOW()) GROUP BY zv.device_id HAVING COUNT(*) >= 3) t"
            },
            "verify": {
              "max_rows": 1
            },
            "dataset": {
              "shape": "kpi",
              "columns": {
                "value": {
                  "type": "integer"
                }
              }
            }
          }
        },
        {
          "id": 5,
          "type": "barchart",
          "title": "Top 15 Vehicles by Mileage (30 Days)",
          "gridPos": {
            "h": 14,
            "w": 12,
            "x": 0,
            "y": 5
          },
          "options": {
            "orientation": "horizontal"
          },
          "x-navixy": {
            "sql": {
              "params": {},
              "statement": "SELECT COALESCE(o.object_label, 'device_' || t.device_id) AS object_label, ROUND(COALESCE(SUM(t.trip_distance_meters), 0) / 1000.0, 2) AS mileage_km FROM raw_business_data.objects o LEFT JOIN processed_common_data.trips t ON o.device_id = t.device_id AND t.trip_start_time >= NOW() - INTERVAL '30 days' WHERE o.is_deleted IS NOT TRUE GROUP BY o.object_label, t.device_id ORDER BY mileage_km DESC LIMIT 15"
            },
            "verify": {
              "max_rows": 15
            },
            "dataset": {
              "shape": "category_value",
              "columns": {
                "mileage_km": {
                  "type": "number"
                },
                "object_label": {
                  "type": "string"
                }
              }
            }
          }
        },
        {
          "id": 6,
          "type": "piechart",
          "title": "GPS Signal Status",
          "gridPos": {
            "h": 14,
            "w": 12,
            "x": 12,
            "y": 5
          },
          "options": {
            "pieType": "donut"
          },
          "x-navixy": {
            "sql": {
              "params": {},
              "statement": "WITH last_activity AS (SELECT device_id, MAX(device_time) AS last_device_time FROM raw_telematics_data.tracking_data_core WHERE event_id IN (2, 802, 803, 804, 811) AND latitude <> 0 AND longitude <> 0 GROUP BY device_id), classified AS (SELECT CASE WHEN la.last_device_time IS NULL OR la.last_device_time < NOW() - INTERVAL '3 days' THEN 'Offline (3d+)' WHEN la.last_device_time < NOW() - INTERVAL '1 day' THEN 'Warning (1-3d)' ELSE 'Active (24h)' END AS status FROM raw_business_data.objects o LEFT JOIN last_activity la ON o.device_id = la.device_id WHERE o.is_deleted IS NOT TRUE) SELECT status AS gps_status, COUNT(*) AS object_count FROM classified GROUP BY status ORDER BY status"
            },
            "verify": {
              "max_rows": 10
            },
            "dataset": {
              "shape": "pie",
              "columns": {
                "object_count": {
                  "type": "integer"
                },
                "gps_status": {
                  "type": "string"
                }
              }
            }
          }
        },
        {
          "id": 7,
          "type": "barchart",
          "title": "Top 10 Vehicles by Zone Exits This Month",
          "gridPos": {
            "h": 15,
            "w": 24,
            "x": 0,
            "y": 19
          },
          "options": {
            "orientation": "horizontal"
          },
          "x-navixy": {
            "sql": {
              "params": {},
              "statement": "SELECT COALESCE(o.object_label, 'device_' || o.device_id) AS object_label, COUNT(*) AS zone_exit_count FROM processed_common_data.zone_visits zv JOIN raw_business_data.objects o ON o.device_id = zv.device_id WHERE o.is_deleted IS NOT TRUE AND zv.exit_time IS NOT NULL AND zv.enter_time >= DATE_TRUNC('month', NOW()) GROUP BY o.object_label, o.device_id ORDER BY zone_exit_count DESC LIMIT 10"
            },
            "verify": {
              "max_rows": 10
            },
            "dataset": {
              "shape": "category_value",
              "columns": {
                "zone_exit_count": {
                  "type": "integer"
                },
                "object_label": {
                  "type": "string"
                }
              }
            }
          }
        },
        {
          "id": 8,
          "type": "table",
          "title": "Vehicles GPS Offline 3+ Days",
          "gridPos": {
            "h": 15,
            "w": 12,
            "x": 0,
            "y": 34
          },
          "options": {
            "showHeader": true
          },
          "x-navixy": {
            "sql": {
              "params": {},
              "statement": "WITH last_activity AS (SELECT device_id, MAX(device_time) AS last_device_time FROM raw_telematics_data.tracking_data_core WHERE event_id IN (2, 802, 803, 804, 811) AND latitude <> 0 AND longitude <> 0 GROUP BY device_id) SELECT COALESCE(o.object_label, 'device_' || o.device_id) AS vehicle, ROUND(COALESCE(EXTRACT(EPOCH FROM (NOW() - la.last_device_time)) / 86400, 9999)::numeric, 1) AS days_offline FROM raw_business_data.objects o LEFT JOIN last_activity la ON o.device_id = la.device_id WHERE o.is_deleted IS NOT TRUE AND (la.last_device_time IS NULL OR la.last_device_time < NOW() - INTERVAL '3 days') ORDER BY days_offline DESC"
            },
            "verify": {
              "max_rows": 500
            },
            "dataset": {
              "shape": "table",
              "columns": {}
            }
          }
        },
        {
          "id": 9,
          "type": "table",
          "title": "Vehicles with Long Stops 24h+",
          "gridPos": {
            "h": 15,
            "w": 12,
            "x": 12,
            "y": 34
          },
          "options": {
            "showHeader": true
          },
          "x-navixy": {
            "sql": {
              "params": {},
              "statement": "WITH trip_gaps AS (SELECT o.object_label, o.device_id, EXTRACT(EPOCH FROM (LEAD(t.trip_start_time) OVER (PARTITION BY t.device_id ORDER BY t.trip_start_time) - t.trip_end_time)) / 3600 AS gap_hours FROM processed_common_data.trips t JOIN raw_business_data.objects o ON o.device_id = t.device_id AND o.is_deleted IS NOT TRUE WHERE t.trip_start_time >= DATE_TRUNC('month', NOW())) SELECT COALESCE(object_label, 'device_' || device_id) AS vehicle, ROUND(MAX(gap_hours)::numeric, 1) AS max_stop_hours, COUNT(*) FILTER (WHERE gap_hours >= 24) AS long_stop_count FROM trip_gaps WHERE gap_hours >= 24 GROUP BY object_label, device_id ORDER BY max_stop_hours DESC"
            },
            "verify": {
              "max_rows": 500
            },
            "dataset": {
              "shape": "table",
              "columns": {
                "vehicle": {
                  "type": "string"
                },
                "max_stop_hours": {
                  "type": "number"
                },
                "long_stop_count": {
                  "type": "integer"
                }
              }
            }
          }
        }
      ]
    },
  },
  {
    id: 'fleet-reports',
    keywords: ['map', 'location', 'geo', 'position', 'route'],
    schema: {
      "id": null,
      "uid": "fleet-reports-dashboard",
      "tags": [
        "fleet",
        "telematics",
        "reports"
      ],
      "time": {
        "to": "now",
        "from": "now-30d"
      },
      "links": [],
      "style": "dark",
      "title": "Fleet Reports Dashboard",
      "panels": [
        {
          "id": 1,
          "type": "kpi",
          "title": "Online Units",
          "gridPos": {
            "h": 5,
            "w": 6,
            "x": 0,
            "y": 0
          },
          "options": {
            "textMode": "auto",
            "colorMode": "value"
          },
          "x-navixy": {
            "sql": {
              "params": {},
              "statement": "WITH last_message AS (SELECT device_id, MAX(device_time) AS last_device_time FROM raw_telematics_data.tracking_data_core WHERE event_id IN (2, 802, 803, 804, 811) GROUP BY device_id), classified AS (SELECT o.device_id, CASE WHEN lm.last_device_time IS NULL THEN 'offline' WHEN lm.last_device_time >= (NOW() - INTERVAL '24 hours') THEN 'online' ELSE 'offline' END AS connection_status FROM raw_business_data.objects o LEFT JOIN last_message lm ON lm.device_id = o.device_id WHERE o.is_deleted IS NOT TRUE) SELECT COUNT(*) AS value FROM classified WHERE connection_status = 'online'"
            },
            "verify": {
              "max_rows": 1
            },
            "dataset": {
              "shape": "kpi",
              "columns": {
                "value": {
                  "type": "number"
                }
              }
            }
          }
        },
        {
          "id": 2,
          "type": "kpi",
          "title": "Offline Units",
          "gridPos": {
            "h": 5,
            "w": 6,
            "x": 6,
            "y": 0
          },
          "options": {
            "textMode": "auto",
            "colorMode": "value"
          },
          "x-navixy": {
            "sql": {
              "params": {},
              "statement": "WITH last_message AS (SELECT device_id, MAX(device_time) AS last_device_time FROM raw_telematics_data.tracking_data_core WHERE event_id IN (2, 802, 803, 804, 811) GROUP BY device_id), classified AS (SELECT o.device_id, CASE WHEN lm.last_device_time IS NULL THEN 'offline' WHEN lm.last_device_time >= (NOW() - INTERVAL '24 hours') THEN 'online' ELSE 'offline' END AS connection_status FROM raw_business_data.objects o LEFT JOIN last_message lm ON lm.device_id = o.device_id WHERE o.is_deleted IS NOT TRUE) SELECT COUNT(*) AS value FROM classified WHERE connection_status = 'offline'"
            },
            "verify": {
              "max_rows": 1
            },
            "dataset": {
              "shape": "kpi",
              "columns": {
                "value": {
                  "type": "number"
                }
              }
            }
          }
        },
        {
          "id": 3,
          "type": "kpi",
          "title": "Units Inactive >5 Days",
          "gridPos": {
            "h": 5,
            "w": 6,
            "x": 12,
            "y": 0
          },
          "options": {
            "textMode": "auto"
          },
          "x-navixy": {
            "sql": {
              "params": {},
              "statement": "WITH last_activity AS (SELECT device_id, MAX(device_time) AS last_device_time FROM raw_telematics_data.tracking_data_core WHERE event_id IN (2, 802, 803, 804, 811) GROUP BY device_id), inactive AS (SELECT o.device_id FROM raw_business_data.objects o LEFT JOIN last_activity la ON la.device_id = o.device_id WHERE o.is_deleted IS NOT TRUE AND (la.last_device_time IS NULL OR la.last_device_time < NOW() - INTERVAL '5 days')) SELECT COUNT(*) AS value FROM inactive"
            },
            "verify": {
              "max_rows": 1
            },
            "dataset": {
              "shape": "kpi",
              "columns": {
                "value": {
                  "type": "number"
                }
              }
            }
          }
        },
        {
          "id": 4,
          "type": "kpi",
          "title": "Speeding Violations (30d)",
          "gridPos": {
            "h": 5,
            "w": 6,
            "x": 18,
            "y": 0
          },
          "options": {
            "textMode": "auto"
          },
          "x-navixy": {
            "sql": {
              "params": {},
              "statement": "WITH params AS (SELECT CURRENT_DATE - INTERVAL '30 days' AS date_from, CURRENT_TIMESTAMP AS date_to, 120 AS speed_limit_kmh), core_with_speed_kmh AS (SELECT c.device_id, c.speed / 100.0 AS speed_kmh, COALESCE(v.max_speed, p.speed_limit_kmh) AS speed_limit_kmh FROM raw_telematics_data.tracking_data_core c JOIN raw_business_data.objects o ON o.device_id = c.device_id AND o.is_deleted IS NOT TRUE LEFT JOIN raw_business_data.vehicles v ON v.object_id = o.object_id CROSS JOIN params p WHERE c.device_time >= p.date_from AND c.device_time <= p.date_to AND c.speed IS NOT NULL AND c.event_id IN (2, 802, 803, 804, 811) AND c.latitude <> 0 AND c.longitude <> 0), violations AS (SELECT 1 AS n FROM core_with_speed_kmh WHERE speed_kmh > speed_limit_kmh) SELECT COUNT(*) AS value FROM violations"
            },
            "verify": {
              "max_rows": 1
            },
            "dataset": {
              "shape": "kpi",
              "columns": {
                "value": {
                  "type": "number"
                }
              }
            }
          }
        },
        {
          "id": 5,
          "type": "piechart",
          "title": "Units Online / Offline",
          "gridPos": {
            "h": 13,
            "w": 12,
            "x": 0,
            "y": 5
          },
          "options": {
            "pieType": "donut"
          },
          "x-navixy": {
            "sql": {
              "params": {},
              "statement": "WITH last_message AS (SELECT device_id, MAX(device_time) AS last_device_time FROM raw_telematics_data.tracking_data_core WHERE event_id IN (2, 802, 803, 804, 811) GROUP BY device_id), classified AS (SELECT o.device_id, CASE WHEN lm.last_device_time IS NULL THEN 'offline' WHEN lm.last_device_time >= (NOW() - INTERVAL '24 hours') THEN 'online' ELSE 'offline' END AS connection_status FROM raw_business_data.objects o LEFT JOIN last_message lm ON lm.device_id = o.device_id WHERE o.is_deleted IS NOT TRUE) SELECT connection_status AS connection_status, COUNT(*) AS object_count FROM classified GROUP BY connection_status ORDER BY connection_status"
            },
            "verify": {
              "max_rows": 10
            },
            "dataset": {
              "shape": "pie",
              "columns": {
                "object_count": {
                  "type": "integer"
                },
                "connection_status": {
                  "type": "string"
                }
              }
            }
          }
        },
        {
          "id": 6,
          "type": "barchart",
          "title": "Kilometers by Zone (last month)",
          "gridPos": {
            "h": 13,
            "w": 12,
            "x": 12,
            "y": 5
          },
          "options": {
            "orientation": "vertical"
          },
          "x-navixy": {
            "sql": {
              "params": {},
              "statement": "WITH trip_with_zone AS (SELECT DISTINCT ON (t.device_id, t.trip_start_time) t.device_id, t.trip_start_time, t.trip_distance_meters, zg.zone_label FROM processed_common_data.trips t LEFT JOIN processed_common_data.zones_geom zg ON ST_DWithin(ST_SetSRID(ST_MakePoint(t.longitude_start, t.latitude_start), 4326)::geography, zg.zone_geom, 0) WHERE t.trip_start_time >= CURRENT_DATE - INTERVAL '1 month' AND t.trip_start_time < CURRENT_DATE ORDER BY t.device_id, t.trip_start_time, zg.zone_id NULLS LAST) SELECT COALESCE(zone_label, 'Unknown') AS zone_label, ROUND(SUM(trip_distance_meters) / 1000.0, 2) AS mileage_km FROM trip_with_zone GROUP BY COALESCE(zone_label, 'Unknown') ORDER BY mileage_km DESC"
            },
            "verify": {
              "max_rows": 500
            },
            "dataset": {
              "shape": "category_value",
              "columns": {
                "mileage_km": {
                  "type": "number"
                },
                "zone_label": {
                  "type": "string"
                }
              }
            }
          }
        },
        {
          "id": 11,
          "type": "geomap",
          "title": "Last known location",
          "gridPos": {
            "h": 13,
            "w": 24,
            "x": 0,
            "y": 18
          },
          "options": {},
          "x-navixy": {
            "sql": {
              "params": {},
              "statement": "SELECT c.latitude / 1e7 AS lat, c.longitude / 1e7 AS lon, c.device_id, o.object_label, c.device_time AS last_seen FROM (SELECT DISTINCT ON (device_id) device_id, device_time, latitude, longitude FROM raw_telematics_data.tracking_data_core WHERE event_id IN (2, 802, 803, 804, 811) AND latitude <> 0 AND longitude <> 0 ORDER BY device_id, device_time DESC) c JOIN raw_business_data.objects o ON o.device_id = c.device_id AND o.is_deleted IS NOT TRUE ORDER BY c.device_id"
            },
            "verify": {
              "max_rows": 5000
            },
            "dataset": {
              "shape": "table",
              "columns": {}
            }
          }
        },
        {
          "id": 7,
          "type": "table",
          "title": "Supply Voltage by Unit (last 1 hour)",
          "gridPos": {
            "h": 14,
            "w": 24,
            "x": 0,
            "y": 31
          },
          "options": {
            "legend": {
              "placement": "bottom",
              "showLegend": true
            }
          },
          "x-navixy": {
            "sql": {
              "params": {},
              "statement": "SELECT s.device_id, COALESCE(s.object_label, 'device_' || s.device_id) AS unit, ROUND(AVG(s.value_avg)::numeric, 2) AS avg_v, ROUND(MIN(s.value_min)::numeric, 2) AS min_v, ROUND(MAX(s.value_max)::numeric, 2) AS max_v, MAX(s.hour_bucket) AS last_seen FROM processed_common_data.sensors_data_by_hours s JOIN raw_business_data.sensor_description sd ON sd.device_id = s.device_id AND sd.input_label = s.sensor_name WHERE sd.sensor_type = 'power' AND sd.units_type = 24 AND s.hour_bucket >= date_trunc('hour', NOW()) - INTERVAL '1 hour' GROUP BY s.device_id, s.object_label ORDER BY avg_v ASC NULLS LAST"
            },
            "verify": {
              "max_rows": 5000
            },
            "dataset": {
              "shape": "table",
              "columns": {
                "unit": {
                  "type": "string"
                },
                "avg_v": {
                  "type": "number"
                },
                "max_v": {
                  "type": "number"
                },
                "min_v": {
                  "type": "number"
                },
                "device_id": {
                  "type": "integer"
                },
                "last_seen": {
                  "type": "timestamptz"
                }
              }
            }
          }
        },
        {
          "id": 8,
          "type": "table",
          "title": "Speeding Violations (last 30 days)",
          "gridPos": {
            "h": 13,
            "w": 24,
            "x": 0,
            "y": 45
          },
          "options": {
            "showHeader": true
          },
          "x-navixy": {
            "sql": {
              "params": {},
              "statement": "WITH params AS (SELECT CURRENT_DATE - INTERVAL '30 days' AS date_from, CURRENT_TIMESTAMP AS date_to, 120 AS speed_limit_kmh), core_with_speed_kmh AS (SELECT c.device_id, c.device_time, c.latitude / 1e7 AS latitude, c.longitude / 1e7 AS longitude, c.speed / 100.0 AS speed_kmh, o.object_label, COALESCE(v.max_speed, p.speed_limit_kmh) AS speed_limit_kmh FROM raw_telematics_data.tracking_data_core c JOIN raw_business_data.objects o ON o.device_id = c.device_id AND o.is_deleted IS NOT TRUE LEFT JOIN raw_business_data.vehicles v ON v.object_id = o.object_id CROSS JOIN params p WHERE c.device_time >= p.date_from AND c.device_time <= p.date_to AND c.speed IS NOT NULL AND c.event_id IN (2, 802, 803, 804, 811) AND c.latitude <> 0 AND c.longitude <> 0), violations AS (SELECT device_id, object_label, device_time AS violation_time, latitude, longitude, speed_kmh, speed_limit_kmh, speed_kmh - speed_limit_kmh AS excess_kmh FROM core_with_speed_kmh WHERE speed_kmh > speed_limit_kmh) SELECT device_id, object_label, violation_time, ROUND(latitude::numeric, 6) AS latitude, ROUND(longitude::numeric, 6) AS longitude, ROUND(speed_kmh::numeric, 2) AS speed_kmh, ROUND(speed_limit_kmh::numeric, 2) AS speed_limit_kmh, ROUND(excess_kmh::numeric, 2) AS excess_kmh FROM violations ORDER BY violation_time DESC LIMIT 500"
            },
            "verify": {
              "max_rows": 500
            },
            "dataset": {
              "shape": "table",
              "columns": {}
            }
          }
        },
        {
          "id": 9,
          "type": "table",
          "title": "Units Inactive More Than 1 Days",
          "gridPos": {
            "h": 14,
            "w": 24,
            "x": 0,
            "y": 58
          },
          "options": {
            "showHeader": true
          },
          "x-navixy": {
            "sql": {
              "params": {},
              "statement": "WITH last_activity AS (SELECT device_id, MAX(device_time) AS last_device_time FROM raw_telematics_data.tracking_data_core WHERE event_id IN (2, 802, 803, 804, 811) GROUP BY device_id), inactive_units AS (SELECT o.device_id, o.object_id, o.object_label, o.client_id, o.group_id, la.last_device_time, EXTRACT(DAY FROM (NOW() - la.last_device_time)) AS days_inactive FROM raw_business_data.objects o LEFT JOIN last_activity la ON la.device_id = o.device_id WHERE o.is_deleted IS NOT TRUE AND (la.last_device_time IS NULL OR la.last_device_time < NOW() - INTERVAL '1 days')) SELECT device_id, object_id, object_label, client_id, group_id, last_device_time, COALESCE(days_inactive::int, 999) AS days_inactive FROM inactive_units ORDER BY last_device_time ASC NULLS LAST LIMIT 500"
            },
            "verify": {
              "max_rows": 500
            },
            "dataset": {
              "shape": "table",
              "columns": {
                "group_id": {
                  "type": "integer"
                },
                "client_id": {
                  "type": "integer"
                },
                "device_id": {
                  "type": "integer"
                },
                "object_id": {
                  "type": "integer"
                },
                "object_label": {
                  "type": "string"
                },
                "days_inactive": {
                  "type": "integer"
                },
                "last_device_time": {
                  "type": "timestamptz"
                }
              }
            }
          }
        },
        {
          "id": 10,
          "type": "table",
          "title": "Average Mileage by Unit (last 30 days)",
          "gridPos": {
            "h": 16,
            "w": 24,
            "x": 0,
            "y": 72
          },
          "options": {
            "showHeader": true
          },
          "x-navixy": {
            "sql": {
              "params": {},
              "statement": "WITH params AS (SELECT CURRENT_DATE - INTERVAL '30 days' AS date_from, CURRENT_DATE AS date_to), mileage_per_unit AS (SELECT t.device_id, o.object_label, o.object_id, COUNT(*) AS trip_count, SUM(t.trip_distance_meters) AS total_distance_meters FROM processed_common_data.trips t JOIN raw_business_data.objects o ON o.device_id = t.device_id AND o.is_deleted IS NOT TRUE CROSS JOIN params p WHERE t.trip_start_time >= p.date_from AND t.trip_start_time < p.date_to + INTERVAL '1 day' GROUP BY t.device_id, o.object_label, o.object_id) SELECT device_id, object_id, object_label, trip_count, ROUND(total_distance_meters / 1000.0, 2) AS total_km, ROUND((total_distance_meters / 1000.0) / NULLIF(trip_count, 0), 2) AS avg_mileage_per_trip_km FROM mileage_per_unit ORDER BY total_distance_meters DESC LIMIT 500"
            },
            "verify": {
              "max_rows": 500
            },
            "dataset": {
              "shape": "table",
              "columns": {}
            }
          }
        }
      ],
      "refresh": "1m",
      "version": 1,
      "editable": true,
      "timezone": "browser",
      "x-navixy": {
        "execution": {
          "dialect": "postgresql",
          "endpoint": "/api/v1/sql/run",
          "max_rows": 10000,
          "read_only": true,
          "timeout_ms": 30000
        },
        "parameters": {
          "bindings": {}
        },
        "schemaVersion": "1.0.0"
      },
      "templating": {
        "list": [],
        "enable": false
      },
      "timepicker": {
        "now": true,
        "enable": true,
        "hidden": false,
        "collapse": false,
        "time_options": [
          "5m",
          "15m",
          "1h",
          "6h",
          "12h",
          "24h",
          "7d",
          "30d"
        ],
        "refresh_intervals": [
          "10s",
          "30s",
          "1m",
          "5m"
        ]
      },
      "annotations": {
        "list": [
          {
            "hide": true,
            "name": "Annotations & Alerts",
            "type": "dashboard",
            "enable": true,
            "builtIn": 1,
            "iconColor": "rgba(0, 211, 255, 1)"
          }
        ]
      },
      "description": "Dashboard based on sql_scripts/reports: speeding, inactive units, kilometers by zone, supply voltage, online/offline, average mileage.",
      "graphTooltip": 1,
      "schemaVersion": 38
    },
  },
  {
    id: 'engine-operation',
    keywords: ['engine', 'machinery', 'excavator', 'idle', 'idling', 'runtime'],
    schema: {
      "id": null,
      "uid": "heavy-machinery-dashboard",
      "tags": [
        "heavy-machinery",
        "engine",
        "workload",
        "operator"
      ],
      "time": {
        "to": "now",
        "from": "now-7d"
      },
      "links": [],
      "style": "dark",
      "title": "Heavy Machinery – Actual engine operation",
      "panels": [
        {
          "id": 1,
          "type": "kpi",
          "title": "Total engine hours (1d)",
          "gridPos": {
            "h": 5,
            "w": 6,
            "x": 0,
            "y": 0
          },
          "options": {
            "textMode": "auto",
            "colorMode": "value",
            "graphMode": "none"
          },
          "x-navixy": {
            "sql": {
              "params": {},
              "statement": "WITH rpm_bounds AS (SELECT 800::int AS light_lo, 1100::int AS light_hi, 1101::int AS med_lo, 1650::int AS med_hi, 1651::int AS heavy_lo, 2200::int AS heavy_hi), points AS (SELECT i.device_id FROM raw_telematics_data.inputs i JOIN raw_business_data.sensor_description sd ON i.device_id = sd.device_id AND i.sensor_name = sd.input_label WHERE sd.sensor_id IS NOT NULL AND (sd.sensor_type = 'rpm' OR LOWER(COALESCE(sd.sensor_units,'')) LIKE '%rpm%') AND i.device_time >= now() - interval '1 day'), classified AS (SELECT p.device_id FROM points p CROSS JOIN rpm_bounds b) SELECT ROUND((COUNT(*) * 5.0/60.0)::numeric, 1) AS value FROM classified c JOIN raw_business_data.objects o ON o.device_id = c.device_id AND o.is_deleted IS NOT TRUE"
            },
            "verify": {
              "max_rows": 1
            },
            "dataset": {
              "shape": "kpi",
              "columns": {
                "value": {
                  "type": "number"
                }
              }
            }
          }
        },
        {
          "id": 2,
          "type": "kpi",
          "title": "Zone visits (1d)",
          "gridPos": {
            "h": 5,
            "w": 6,
            "x": 6,
            "y": 0
          },
          "options": {
            "textMode": "auto",
            "colorMode": "value",
            "graphMode": "none"
          },
          "x-navixy": {
            "sql": {
              "params": {},
              "statement": "SELECT COUNT(*)::bigint AS value FROM processed_common_data.zone_visits WHERE enter_time >= now() - interval '1 day'"
            },
            "verify": {
              "max_rows": 1
            },
            "dataset": {
              "shape": "kpi",
              "columns": {
                "value": {
                  "type": "integer"
                }
              }
            }
          }
        },
        {
          "id": 3,
          "type": "kpi",
          "title": "Units with temp >95°C (1d)",
          "gridPos": {
            "h": 5,
            "w": 6,
            "x": 12,
            "y": 0
          },
          "options": {
            "textMode": "auto",
            "colorMode": "value",
            "graphMode": "none"
          },
          "x-navixy": {
            "sql": {
              "params": {},
              "statement": "WITH inputs AS (\r\n  SELECT\r\n    i.device_id,\r\n    i.device_time,\r\n    i.sensor_name,\r\n    i.value::float AS val\r\n  FROM raw_telematics_data.inputs i\r\n  WHERE i.device_time >= now() - interval '1 day'\r\n),\r\ntemp_readings AS (\r\n  SELECT\r\n    i.device_id,\r\n    (i.val / NULLIF(sd.divider, 0)) * sd.multiplier AS temp_c\r\n  FROM inputs i\r\n  JOIN raw_business_data.sensor_description sd\r\n    ON i.device_id = sd.device_id\r\n   AND i.sensor_name = sd.input_label\r\n  WHERE sd.sensor_type = 'temperature'\r\n     OR LOWER(COALESCE(sd.input_label, '')) LIKE '%temp%'\r\n),\r\nby_object AS (\r\n  SELECT o.object_id\r\n  FROM temp_readings t\r\n  JOIN raw_business_data.objects o\r\n    ON o.device_id = t.device_id\r\n   AND o.is_deleted IS NOT TRUE\r\n  GROUP BY o.object_id\r\n  HAVING MAX(t.temp_c) > 95\r\n)\r\nSELECT COUNT(*) AS value\r\nFROM by_object;"
            },
            "verify": {
              "max_rows": 1
            },
            "dataset": {
              "shape": "kpi",
              "columns": {}
            }
          }
        },
        {
          "id": 4,
          "type": "kpi",
          "title": "Unauthorized km (1d)",
          "gridPos": {
            "h": 5,
            "w": 6,
            "x": 18,
            "y": 0
          },
          "options": {
            "textMode": "auto",
            "colorMode": "value",
            "graphMode": "none"
          },
          "x-navixy": {
            "sql": {
              "params": {},
              "statement": "WITH time_classified_trips AS (SELECT t.trip_distance_meters, CASE WHEN EXTRACT(DOW FROM t.trip_start_time) IN (0, 6) THEN 'weekend' WHEN EXTRACT(HOUR FROM t.trip_start_time) BETWEEN 9 AND 18 THEN 'authorized' ELSE 'unauthorized' END AS time_category FROM processed_common_data.trips t WHERE t.trip_start_time >= now() - interval '1 day') SELECT COALESCE(ROUND(SUM(trip_distance_meters)/1000.0, 0), 0)::bigint AS value FROM time_classified_trips WHERE time_category = 'unauthorized'"
            },
            "verify": {
              "max_rows": 1
            },
            "dataset": {
              "shape": "kpi",
              "columns": {
                "value": {
                  "type": "number"
                }
              }
            }
          }
        },
        {
          "id": 5,
          "type": "piechart",
          "title": "Usage by time category (30d)",
          "gridPos": {
            "h": 14,
            "w": 12,
            "x": 0,
            "y": 5
          },
          "options": {
            "pieType": "donut"
          },
          "x-navixy": {
            "sql": {
              "params": {},
              "statement": "WITH time_classified_trips AS (SELECT t.device_id, CASE WHEN EXTRACT(DOW FROM t.trip_start_time) IN (0, 6) THEN 'weekend_usage' WHEN EXTRACT(HOUR FROM t.trip_start_time) BETWEEN 9 AND 18 THEN 'authorized_work_time' ELSE 'unauthorized_non_work_time' END AS time_category, t.trip_distance_meters FROM processed_common_data.trips t WHERE t.trip_start_time >= now() - interval '30 days') SELECT time_category AS time_category, ROUND(SUM(trip_distance_meters)/1000.0, 0) AS mileage_km FROM time_classified_trips GROUP BY time_category ORDER BY time_category"
            },
            "verify": {
              "max_rows": 10
            },
            "dataset": {
              "shape": "pie",
              "columns": {
                "mileage_km": {
                  "type": "number"
                },
                "time_category": {
                  "type": "string"
                }
              }
            }
          }
        },
        {
          "id": 7,
          "type": "piechart",
          "title": "Zone visits by zone (7d)",
          "gridPos": {
            "h": 14,
            "w": 12,
            "x": 12,
            "y": 5
          },
          "options": {
            "pieType": "donut"
          },
          "x-navixy": {
            "sql": {
              "params": {},
              "statement": "SELECT COALESCE(zg.zone_label, 'Unknown') AS zone_label, COUNT(*)::bigint AS visit_count FROM processed_common_data.zone_visits zv LEFT JOIN processed_common_data.zones_geom zg ON zg.zone_id = zv.zone_id WHERE zv.enter_time >= now() - interval '7 days' GROUP BY zg.zone_label ORDER BY visit_count DESC LIMIT 15"
            },
            "verify": {
              "max_rows": 15
            },
            "dataset": {
              "shape": "pie",
              "columns": {
                "visit_count": {
                  "type": "number"
                },
                "zone_label": {
                  "type": "string"
                }
              }
            }
          }
        },
        {
          "id": 9,
          "type": "barchart",
          "title": "Distance km by unit (1d)",
          "gridPos": {
            "h": 14,
            "w": 12,
            "x": 0,
            "y": 19
          },
          "options": {
            "orientation": "vertical"
          },
          "x-navixy": {
            "sql": {
              "params": {},
              "statement": "SELECT o.object_label AS object_label, ROUND(SUM(t.trip_distance_meters)/1000.0, 1)::numeric AS mileage_km,  'km' AS metric_type \r\nFROM processed_common_data.trips t JOIN raw_business_data.objects o ON o.device_id = t.device_id AND o.is_deleted IS NOT TRUE \r\nWHERE t.trip_start_time >= now() - interval '1 day' \r\nGROUP BY o.object_label ORDER BY mileage_km DESC NULLS LAST LIMIT 50"
            },
            "verify": {
              "max_rows": 50
            },
            "dataset": {
              "shape": "category_value",
              "columns": {
                "object_label": {
                  "type": "string"
                },
                "mileage_km": {
                  "type": "number"
                },
                "metric_type": {
                  "type": "string"
                }
              }
            }
          }
        },
        {
          "id": 8,
          "type": "barchart",
          "title": "Trips by unit (1d)",
          "gridPos": {
            "h": 14,
            "w": 12,
            "x": 12,
            "y": 19
          },
          "options": {
            "orientation": "vertical"
          },
          "x-navixy": {
            "sql": {
              "params": {},
              "statement": "SELECT o.object_label AS object_label,  COUNT(*)::bigint AS trip_count, 'trips' AS metric_type  \r\nFROM processed_common_data.trips t JOIN raw_business_data.objects o ON o.device_id = t.device_id AND o.is_deleted IS NOT TRUE \r\nWHERE t.trip_start_time >= now() - interval '1 day' \r\nGROUP BY o.object_label ORDER BY trip_count DESC LIMIT 50"
            },
            "verify": {
              "max_rows": 50
            },
            "dataset": {
              "shape": "category_value",
              "columns": {
                "object_label": {
                  "type": "string"
                },
                "trip_count": {
                  "type": "integer"
                },
                "metric_type": {
                  "type": "string"
                }
              }
            }
          }
        },
        {
          "id": 10,
          "type": "table",
          "title": "Recent zone visits",
          "gridPos": {
            "h": 21,
            "w": 24,
            "x": 0,
            "y": 33
          },
          "options": {
            "showHeader": true
          },
          "x-navixy": {
            "sql": {
              "params": {},
              "statement": "SELECT o.object_label, zg.zone_label, zv.enter_time, zv.exit_time, trim(leading '0' from to_char(interval '0' + zv.duration, 'HH24:MI:SS')) AS duration \r\nFROM processed_common_data.zone_visits zv \r\nJOIN raw_business_data.objects o ON o.device_id = zv.device_id AND o.is_deleted IS NOT TRUE LEFT JOIN processed_common_data.zones_geom zg ON zg.zone_id = zv.zone_id \r\nWHERE zv.enter_time >= now() - interval '7 days'  \r\nORDER BY zv.enter_time DESC LIMIT 20"
            },
            "verify": {
              "max_rows": 20
            },
            "dataset": {
              "shape": "table",
              "columns": {}
            }
          }
        }
      ],
      "refresh": "5m",
      "version": 1,
      "editable": true,
      "timezone": "browser",
      "x-navixy": {
        "execution": {
          "dialect": "postgresql",
          "endpoint": "/api/v1/sql/run",
          "max_rows": 10000,
          "read_only": true,
          "timeout_ms": 30000
        },
        "parameters": {
          "bindings": {}
        },
        "schemaVersion": "1.0.0"
      },
      "templating": {
        "list": [],
        "enable": false
      },
      "timepicker": {
        "now": true,
        "enable": true,
        "hidden": false,
        "collapse": false,
        "time_options": [
          "5m",
          "15m",
          "1h",
          "6h",
          "12h",
          "24h",
          "7d",
          "30d"
        ],
        "refresh_intervals": [
          "1m",
          "5m"
        ]
      },
      "annotations": {
        "list": [
          {
            "hide": true,
            "name": "Annotations & Alerts",
            "type": "dashboard",
            "enable": true,
            "builtIn": 1,
            "iconColor": "rgba(0, 211, 255, 1)"
          }
        ]
      },
      "description": "Workload, usage by time, zone visits, overheating, operator scoring. Idle (ignition ON, engine OFF) excluded — no data in current dataset.",
      "graphTooltip": 1,
      "schemaVersion": 38
    },
  },
  {
    id: 'leasing',
    keywords: ['leasing', 'lease', 'rental', 'contract', 'customer', 'billing'],
    schema: {
      "id": null,
      "uid": "leasing-dashboard",
      "tags": [
        "example",
        "getting-started"
      ],
      "time": {
        "to": "now",
        "from": "now-72h"
      },
      "links": [],
      "style": "dark",
      "title": "Leasing Dashboard",
      "panels": [
        {
          "id": 12,
          "type": "piechart",
          "title": "Vehicles with nearest expiry dates",
          "gridPos": {
            "h": 12,
            "w": 12,
            "x": 0,
            "y": 0
          },
          "options": {
            "pieType": "donut"
          },
          "x-navixy": {
            "sql": {
              "params": {},
              "statement": "WITH expiry_data AS (SELECT CASE WHEN v.free_insurance_valid_till_date IS NOT NULL AND (v.liability_insurance_valid_till IS NULL OR v.free_insurance_valid_till_date <= v.liability_insurance_valid_till) THEN v.free_insurance_valid_till_date WHEN v.liability_insurance_valid_till IS NOT NULL THEN v.liability_insurance_valid_till ELSE NULL END AS nearest_expiry_date FROM raw_business_data.vehicles v), categorized_data AS (SELECT CASE WHEN (DATE(nearest_expiry_date) - CURRENT_DATE)::INTEGER < 0 THEN 'Expired' WHEN (DATE(nearest_expiry_date) - CURRENT_DATE)::INTEGER >= 0 AND (DATE(nearest_expiry_date) - CURRENT_DATE)::INTEGER < 30 THEN 'Expires within 30 days' ELSE 'Others' END AS insurance_status FROM expiry_data WHERE nearest_expiry_date IS NOT NULL) SELECT insurance_status, COUNT(*) AS vehicle_count FROM categorized_data GROUP BY insurance_status ORDER BY CASE insurance_status WHEN 'Expired' THEN 1 WHEN 'Expires within 30 days' THEN 2 WHEN 'Others' THEN 3 END"
            },
            "verify": {
              "max_rows": 1000
            },
            "dataset": {
              "shape": "pie",
              "columns": {
                "vehicle_count": {
                  "type": "integer"
                },
                "insurance_status": {
                  "type": "string"
                }
              }
            }
          }
        },
        {
          "id": 11,
          "type": "piechart",
          "title": "Drivers with nearest expiry dates",
          "gridPos": {
            "h": 12,
            "w": 12,
            "x": 12,
            "y": 0
          },
          "options": {
            "pieType": "donut"
          },
          "x-navixy": {
            "sql": {
              "params": {},
              "statement": "SELECT CASE WHEN (DATE(e.driver_license_valid_till) - CURRENT_DATE)::INTEGER < 0 THEN 'Expired' ELSE 'Others' END AS license_status, COUNT(*) AS driver_count FROM raw_business_data.employees e WHERE e.driver_license_valid_till IS NOT NULL GROUP BY license_status ORDER BY license_status"
            },
            "verify": {
              "max_rows": 1000
            },
            "dataset": {
              "shape": "pie",
              "columns": {
                "driver_count": {
                  "type": "integer"
                },
                "license_status": {
                  "type": "string"
                }
              }
            }
          }
        },
        {
          "id": 13,
          "type": "barchart",
          "title": "Driver Performance Braking Events",
          "gridPos": {
            "h": 14,
            "w": 24,
            "x": 0,
            "y": 12
          },
          "options": {
            "textMode": "auto"
          },
          "x-navixy": {
            "sql": {
              "params": {},
              "statement": "SELECT TO_CHAR(DATE(hde.device_time), 'DD-MM') AS event_date, COUNT(*) AS event_count, CASE WHEN hde.speed_kmh >= 100 THEN 'Critical' ELSE 'Warning' END AS severity FROM processed_common_data.driver_performance_events hde WHERE hde.device_time >= NOW() - INTERVAL '72 hours' AND hde.device_time < NOW() AND hde.event_type IN ('Driver performance braking', 'Driver performance braking and turn') GROUP BY DATE(hde.device_time), CASE WHEN hde.speed_kmh >= 100 THEN 'Critical' ELSE 'Warning' END ORDER BY DATE(hde.device_time), CASE WHEN hde.speed_kmh >= 100 THEN 'Critical' ELSE 'Warning' END"
            },
            "verify": {
              "max_rows": 1000
            },
            "dataset": {
              "shape": "category_value",
              "columns": {
                "event_count": {
                  "type": "integer"
                },
                "severity": {
                  "type": "string"
                },
                "event_date": {
                  "type": "string"
                }
              }
            },
            "visualization": {
              "sortOrder": "none",
              "colorPalette": "vibrant"
            }
          }
        },
        {
          "id": 15,
          "type": "barchart",
          "title": "Sudden Turns / Cornering",
          "gridPos": {
            "h": 14,
            "w": 24,
            "x": 0,
            "y": 26
          },
          "options": {
            "orientation": "vertical"
          },
          "x-navixy": {
            "sql": {
              "params": {},
              "statement": "SELECT TO_CHAR(DATE(hde.device_time), 'DD-MM') AS event_date, COUNT(*) AS event_count, CASE WHEN hde.speed_kmh >= 80 THEN 'Critical' ELSE 'Warning' END AS severity FROM processed_common_data.driver_performance_events hde WHERE hde.device_time >= NOW() - INTERVAL '72 hours' AND hde.device_time < NOW() AND hde.event_type IN ('Driver performance turn', 'Driver performance quick lane change', 'Driver performance acceleration and turn', 'Driver performance braking and turn') GROUP BY DATE(hde.device_time), CASE WHEN hde.speed_kmh >= 80 THEN 'Critical' ELSE 'Warning' END ORDER BY DATE(hde.device_time), CASE WHEN hde.speed_kmh >= 80 THEN 'Critical' ELSE 'Warning' END"
            },
            "verify": {
              "max_rows": 1000
            },
            "dataset": {
              "shape": "category_value",
              "columns": {
                "event_count": {
                  "type": "integer"
                },
                "severity": {
                  "type": "string"
                },
                "event_date": {
                  "type": "string"
                }
              }
            },
            "visualization": {
              "stacking": "percent",
              "colorPalette": "classic"
            }
          }
        },
        {
          "id": 20,
          "type": "barchart",
          "title": "Driver Performance Acceleration Events",
          "gridPos": {
            "h": 15,
            "w": 24,
            "x": 0,
            "y": 40
          },
          "options": {
            "orientation": "vertical"
          },
          "x-navixy": {
            "sql": {
              "params": {},
              "statement": "SELECT TO_CHAR(DATE(hde.device_time), 'DD-MM') AS event_date, COUNT(*) AS event_count, CASE WHEN hde.speed_kmh >= 100 THEN 'Critical' ELSE 'Warning' END AS severity FROM processed_common_data.driver_performance_events hde WHERE hde.device_time >= NOW() - INTERVAL '72 hours' AND hde.device_time < NOW() AND hde.event_type IN ('Driver performance acceleration', 'Driver performance acceleration and turn') GROUP BY DATE(hde.device_time), CASE WHEN hde.speed_kmh >= 100 THEN 'Critical' ELSE 'Warning' END ORDER BY DATE(hde.device_time), CASE WHEN hde.speed_kmh >= 100 THEN 'Critical' ELSE 'Warning' END"
            },
            "verify": {
              "max_rows": 1000
            },
            "dataset": {
              "shape": "category_value",
              "columns": {
                "event_date": {
                  "type": "string"
                },
                "event_count": {
                  "type": "integer"
                },
                "severity": {
                  "type": "string"
                }
              }
            },
            "visualization": {
              "colorPalette": "vibrant"
            }
          }
        },
        {
          "id": 16,
          "type": "stat",
          "title": "Total Idle Events",
          "gridPos": {
            "h": 5,
            "w": 8,
            "x": 0,
            "y": 55
          },
          "options": {
            "textMode": "auto"
          },
          "x-navixy": {
            "sql": {
              "params": {},
              "statement": "WITH ign AS (SELECT device_id, device_time, value::int AS ign_on FROM raw_telematics_data.states WHERE state_name = 'ignition'), spd AS (SELECT device_id, device_time, speed/100.0 AS kmh FROM raw_telematics_data.tracking_data_core), merged AS (SELECT i.device_id, i.device_time, i.ign_on, s.kmh, LEAD(i.device_time) OVER (PARTITION BY i.device_id ORDER BY i.device_time) AS next_time FROM ign i LEFT JOIN spd s ON s.device_id = i.device_id AND s.device_time = i.device_time) SELECT COUNT(*) AS value FROM merged m WHERE m.ign_on = 1 AND (m.kmh IS NULL OR m.kmh < 5) AND m.next_time IS NOT NULL AND EXTRACT(EPOCH FROM (m.next_time - m.device_time))/60 >= 5"
            },
            "verify": {
              "max_rows": 1000
            },
            "dataset": {
              "shape": "kpi",
              "columns": {}
            }
          }
        },
        {
          "id": 6,
          "type": "kpi",
          "title": "Total Idle Time(min)",
          "gridPos": {
            "h": 5,
            "w": 8,
            "x": 8,
            "y": 55
          },
          "options": {
            "textMode": "auto"
          },
          "x-navixy": {
            "sql": {
              "params": {},
              "statement": "WITH ign AS (SELECT device_id, device_time, value::int AS ign_on FROM raw_telematics_data.states WHERE state_name = 'ignition'), spd AS (SELECT device_id, device_time, speed/100 AS kmh FROM raw_telematics_data.tracking_data_core), merged AS (SELECT i.device_id, i.device_time, i.ign_on, s.kmh, LEAD(i.device_time) OVER (PARTITION BY i.device_id ORDER BY i.device_time) AS next_time FROM ign i LEFT JOIN spd s ON s.device_id = i.device_id AND s.device_time = i.device_time) SELECT round(COALESCE(SUM(EXTRACT(EPOCH FROM (m.next_time - m.device_time))/60), 0), 0) AS value FROM merged m WHERE m.ign_on = 1 AND (m.kmh IS NULL OR m.kmh < 5) AND m.next_time IS NOT NULL AND EXTRACT(EPOCH FROM (m.next_time - m.device_time))/60 >= 5"
            },
            "verify": {
              "max_rows": 1000
            },
            "dataset": {
              "shape": "kpi",
              "columns": {}
            }
          }
        },
        {
          "id": 19,
          "type": "stat",
          "title": "Average Idle Duration(min)",
          "gridPos": {
            "h": 5,
            "w": 8,
            "x": 16,
            "y": 55
          },
          "options": {
            "textMode": "auto"
          },
          "x-navixy": {
            "sql": {
              "params": {},
              "statement": "WITH ign AS (SELECT device_id, device_time, value::int AS ign_on FROM raw_telematics_data.states WHERE state_name = 'ignition'), spd AS (SELECT device_id, device_time, speed/100.0 AS kmh FROM raw_telematics_data.tracking_data_core), merged AS (SELECT i.device_id, i.device_time, i.ign_on, s.kmh, LEAD(i.device_time) OVER (PARTITION BY i.device_id ORDER BY i.device_time) AS next_time FROM ign i LEFT JOIN spd s ON s.device_id = i.device_id AND s.device_time = i.device_time) SELECT round(COALESCE(AVG(EXTRACT(EPOCH FROM (m.next_time - m.device_time))/60), 0),0) AS value FROM merged m WHERE m.ign_on = 1 AND (m.kmh IS NULL OR m.kmh < 5) AND m.next_time IS NOT NULL AND EXTRACT(EPOCH FROM (m.next_time - m.device_time))/60 >= 5"
            },
            "verify": {
              "max_rows": 1000
            },
            "dataset": {
              "shape": "kpi",
              "columns": {}
            }
          }
        },
        {
          "id": 14,
          "type": "table",
          "title": "Total Driver Performance Events",
          "gridPos": {
            "h": 20,
            "w": 24,
            "x": 0,
            "y": 60
          },
          "options": {
            "orientation": "vertical"
          },
          "x-navixy": {
            "sql": {
              "params": {},
              "statement": "SELECT hde.event_type, o.object_label AS unit, to_char(hde.device_time, 'YYYY-MM-DD HH24:MI:SS') AS event_datetime, DATE(hde.device_time) AS event_date, hde.device_time::time AS event_time, ROUND(hde.latitude::numeric, 6) AS latitude, ROUND(hde.longitude::numeric, 6) AS longitude, COALESCE(zg.zone_label, ROUND(hde.latitude::numeric, 4)::text || ', ' || ROUND(hde.longitude::numeric, 4)::text) AS place, CASE WHEN hde.speed_kmh >= 100 THEN 'Critical' ELSE 'Warning' END AS severity, ROUND(hde.speed_kmh, 1) AS speed_kmh FROM processed_common_data.driver_performance_events hde JOIN raw_business_data.objects o ON o.device_id = hde.device_id AND o.is_deleted IS NOT TRUE LEFT JOIN LATERAL (SELECT zg.zone_label FROM processed_common_data.zones_geom zg WHERE ST_Within(ST_SetSRID(ST_MakePoint(hde.longitude, hde.latitude), 4326), zg.zone_geom::geometry) LIMIT 1) zg ON true WHERE hde.device_time >= NOW() - INTERVAL '72 hours' AND hde.device_time < NOW() ORDER BY hde.device_time DESC LIMIT 1000"
            },
            "verify": {
              "max_rows": 1000
            },
            "dataset": {
              "shape": "table",
              "columns": {
                "unit": {
                  "type": "string"
                },
                "place": {
                  "type": "string"
                },
                "latitude": {
                  "type": "number"
                },
                "severity": {
                  "type": "string"
                },
                "longitude": {
                  "type": "number"
                },
                "event_date": {
                  "type": "date"
                },
                "event_time": {
                  "type": "string"
                },
                "event_type": {
                  "type": "string"
                },
                "event_datetime": {
                  "type": "timestamptz"
                },
                "rate_kmh_per_sec": {
                  "type": "number"
                }
              }
            },
            "visualization": {
              "colorPalette": "vibrant"
            }
          }
        }
      ],
      "refresh": "30s",
      "version": 1,
      "editable": true,
      "timezone": "browser",
      "x-navixy": {
        "execution": {
          "dialect": "postgresql",
          "endpoint": "/api/v1/sql/run",
          "max_rows": 1000,
          "read_only": true,
          "timeout_ms": 5000,
          "allowed_schemas": [
            "demo_data"
          ]
        },
        "parameters": {
          "bindings": {
            "to": "NULL",
            "from": "NULL",
            "tenant_id": "NULL"
          }
        },
        "schemaVersion": "1.0.0"
      },
      "templating": {
        "list": [
          {
            "name": "var_tenant",
            "type": "constant",
            "label": "Tenant",
            "query": "demo-tenant-id",
            "current": {
              "text": "Demo Tenant",
              "value": "demo-tenant-id"
            },
            "options": [
              {
                "text": "Demo Tenant",
                "value": "demo-tenant-id",
                "selected": true
              }
            ]
          }
        ],
        "enable": true
      },
      "timepicker": {
        "now": true,
        "enable": true,
        "hidden": false,
        "collapse": false,
        "time_options": [
          "5m",
          "15m",
          "1h",
          "6h",
          "12h",
          "24h"
        ],
        "refresh_intervals": [
          "5s",
          "10s",
          "30s",
          "1m",
          "5m",
          "15m",
          "30m",
          "1h"
        ]
      },
      "annotations": {
        "list": [
          {
            "hide": true,
            "name": "Annotations & Alerts",
            "type": "dashboard",
            "enable": true,
            "target": {
              "tags": [],
              "type": "dashboard",
              "limit": 100,
              "matchAny": false
            },
            "builtIn": 1,
            "iconColor": "rgba(0, 211, 255, 1)",
            "datasource": {
              "uid": "-- Dashboard --",
              "type": "dashboard"
            }
          }
        ]
      },
      "description": "Leasing dashboard",
      "graphTooltip": 1,
      "schemaVersion": 38
    },
  },
  {
    id: 'vehicle-mileage',
    keywords: ['mileage', 'distance', 'odometer', 'km', 'kilometre', 'kilometer', 'travel'],
    schema: {
      "id": 1,
      "uid": "vehicle-mileage",
      "tags": [
        "example",
        "getting-started"
      ],
      "time": {
        "to": "now",
        "from": "now-72h"
      },
      "links": [],
      "style": "dark",
      "title": "Vehicle Mileage Dashboard",
      "panels": [
        {
          "id": 7,
          "type": "piechart",
          "title": "Mileage Distribution",
          "gridPos": {
            "h": 10,
            "w": 12,
            "x": 0,
            "y": 0
          },
          "options": {
            "pieType": "donut"
          },
          "x-navixy": {
            "sql": {
              "params": {},
              "statement": "WITH time_classified_trips AS (SELECT t.trip_distance_meters, CASE WHEN EXTRACT(DOW FROM t.trip_start_time) IN (0, 6) THEN 'weekend' WHEN EXTRACT(HOUR FROM t.trip_start_time) BETWEEN 9 AND 17 THEN 'work_time' ELSE 'non_work_time' END AS time_category FROM processed_common_data.trips t WHERE t.trip_start_time >= CURRENT_DATE - INTERVAL '1 month' AND t.trip_start_time < CURRENT_DATE) SELECT time_category AS time_category, round(SUM(trip_distance_meters) / 1000.0, 0) AS mileage_km FROM time_classified_trips GROUP BY time_category ORDER BY time_category"
            },
            "verify": {
              "max_rows": 1000
            },
            "dataset": {
              "shape": "pie",
              "columns": {
                "time_category": {
                  "type": "string"
                },
                "mileage_km": {
                  "type": "number"
                }
              }
            }
          }
        },
        {
          "id": 2,
          "type": "barchart",
          "title": "Mileage Distribution By Weeks, km",
          "gridPos": {
            "h": 16,
            "w": 12,
            "x": 12,
            "y": 0
          },
          "options": {
            "valueMode": "color",
            "displayMode": "gradient",
            "orientation": "horizontal",
            "showUnfilled": true
          },
          "x-navixy": {
            "sql": {
              "params": {},
              "statement": "WITH time_classified_trips AS (SELECT t.trip_distance_meters, DATE_TRUNC('week', t.trip_start_time)::DATE AS week_start_date, CASE WHEN EXTRACT(DOW FROM t.trip_start_time) IN (0, 6) THEN 'weekend' WHEN EXTRACT(HOUR FROM t.trip_start_time) BETWEEN 9 AND 17 THEN 'work_time' ELSE 'non_work_time' END AS time_category FROM processed_common_data.trips t WHERE t.trip_start_time >= CURRENT_DATE - INTERVAL '1 month' AND t.trip_start_time < CURRENT_DATE) SELECT week_start_date AS week_start_date, ROUND(SUM(trip_distance_meters) / 1000.0, 0) AS mileage_km, time_category AS time_category FROM time_classified_trips GROUP BY week_start_date, time_category ORDER BY week_start_date, time_category"
            },
            "verify": {
              "max_rows": 10
            },
            "dataset": {
              "shape": "category_value",
              "columns": {
                "week_start_date": {
                  "type": "string"
                },
                "mileage_km": {
                  "type": "number"
                },
                "time_category": {
                  "type": "string"
                }
              }
            },
            "visualization": {
              "stacking": "stacked",
              "orientation": "vertical",
              "colorPalette": "modern"
            }
          }
        },
        {
          "id": 6,
          "type": "kpi",
          "title": "Mileage per Vehicle, km",
          "gridPos": {
            "h": 6,
            "w": 6,
            "x": 0,
            "y": 10
          },
          "options": {
            "textMode": "auto"
          },
          "x-navixy": {
            "sql": {
              "params": {},
              "statement": "WITH vehicle_mileage AS (SELECT t.device_id, SUM(t.trip_distance_meters) / 1000.0 AS total_km FROM processed_common_data.trips t WHERE t.trip_start_time >= CURRENT_DATE - INTERVAL '1 month' AND t.trip_start_time < CURRENT_DATE GROUP BY t.device_id) SELECT ROUND(AVG(total_km), 0) AS value FROM vehicle_mileage"
            },
            "verify": {
              "max_rows": 1000
            },
            "dataset": {
              "shape": "kpi",
              "columns": {
                "value": {
                  "type": "number"
                }
              }
            }
          }
        },
        {
          "id": 1,
          "type": "kpi",
          "title": "Total Mileage, km",
          "gridPos": {
            "h": 6,
            "w": 6,
            "x": 6,
            "y": 10
          },
          "options": {
            "textMode": "auto",
            "colorMode": "value",
            "graphMode": "none",
            "justifyMode": "auto",
            "orientation": "auto"
          },
          "x-navixy": {
            "sql": {
              "params": {},
              "statement": "SELECT ROUND(SUM(t.trip_distance_meters) / 1000.0, 0) AS value FROM processed_common_data.trips t WHERE t.trip_start_time >= CURRENT_DATE - INTERVAL '1 month' AND t.trip_start_time < CURRENT_DATE"
            },
            "verify": {
              "max_rows": 1
            },
            "dataset": {
              "shape": "kpi",
              "columns": {
                "value": {
                  "type": "number"
                }
              }
            }
          }
        },
        {
          "id": 9,
          "type": "timeseries",
          "title": "Messages Over Time",
          "gridPos": {
            "h": 13,
            "w": 24,
            "x": 0,
            "y": 16
          },
          "options": {
            "legend": {
              "calcs": [],
              "placement": "bottom",
              "showLegend": true,
              "displayMode": "list"
            },
            "tooltip": {
              "mode": "single",
              "sort": "none"
            }
          },
          "x-navixy": {
            "sql": {
              "params": {},
              "statement": "WITH daily_mileage_by_department AS (SELECT DATE(t.trip_start_time) AS track_date, COALESCE(d.department_label, 'Unknown') AS department_label, SUM(t.trip_distance_meters) / 1000.0 AS distance_km FROM processed_common_data.trips t LEFT JOIN raw_business_data.objects o ON t.device_id = o.device_id LEFT JOIN raw_business_data.employees e ON o.object_id = e.object_id LEFT JOIN raw_business_data.departments d ON d.department_id = e.department_id WHERE t.trip_start_time >= CURRENT_DATE - INTERVAL '1 month' AND t.trip_start_time < CURRENT_DATE GROUP BY DATE(t.trip_start_time), d.department_label) SELECT track_date AS track_date, ROUND(SUM(CASE WHEN department_label = 'Drivers' THEN distance_km ELSE 0 END), 0) AS \"Drivers\", ROUND(SUM(CASE WHEN department_label = 'Logistics' THEN distance_km ELSE 0 END), 0) AS \"Logistics\", ROUND(SUM(CASE WHEN department_label = 'Sales' THEN distance_km ELSE 0 END), 0) AS \"Sales\" FROM daily_mileage_by_department GROUP BY track_date ORDER BY track_date"
            },
            "verify": {
              "max_rows": 1000
            },
            "dataset": {
              "shape": "time_value",
              "columns": {}
            },
            "visualization": {
              "lineStyle": "solid",
              "colorPalette": "modern",
              "interpolation": "linear",
              "legendPosition": "top"
            }
          }
        }
      ],
      "refresh": "30s",
      "version": 1,
      "editable": true,
      "timezone": "browser",
      "x-navixy": {
        "execution": {
          "dialect": "postgresql",
          "endpoint": "/api/v1/sql/run",
          "max_rows": 1000,
          "read_only": true,
          "timeout_ms": 5000,
          "allowed_schemas": [
            "demo_data"
          ]
        },
        "parameters": {
          "bindings": {
            "to": "NULL",
            "from": "NULL",
            "tenant_id": "NULL"
          }
        },
        "schemaVersion": "1.0.0"
      },
      "templating": {
        "list": [
          {
            "name": "var_tenant",
            "type": "constant",
            "label": "Tenant",
            "query": "demo-tenant-id",
            "current": {
              "text": "Demo Tenant",
              "value": "demo-tenant-id"
            },
            "options": [
              {
                "text": "Demo Tenant",
                "value": "demo-tenant-id",
                "selected": true
              }
            ]
          }
        ],
        "enable": true
      },
      "timepicker": {
        "now": true,
        "enable": true,
        "hidden": false,
        "collapse": false,
        "time_options": [
          "5m",
          "15m",
          "1h",
          "6h",
          "12h",
          "24h"
        ],
        "refresh_intervals": [
          "5s",
          "10s",
          "30s",
          "1m",
          "5m",
          "15m",
          "30m",
          "1h"
        ]
      },
      "annotations": {
        "list": [
          {
            "hide": true,
            "name": "Annotations & Alerts",
            "type": "dashboard",
            "enable": true,
            "builtIn": 1,
            "iconColor": "rgba(0, 211, 255, 1)"
          }
        ]
      },
      "description": "vehicle-mileage",
      "graphTooltip": 1,
      "schemaVersion": 38
    },
  },
  {
    id: 'driver-performance',
    keywords: ['driver', 'driving', 'score', 'behaviour', 'behavior', 'safety', 'harsh'],
    schema: {
      "id": null,
      "uid": "driving-score-dashboard",
      "tags": [
        "fleet",
        "driving",
        "safety",
        "score"
      ],
      "time": {
        "to": "now",
        "from": "now-1M"
      },
      "links": [],
      "style": "dark",
      "title": "Driving Score Dashboard",
      "panels": [
        {
          "id": 1,
          "type": "kpi",
          "title": "Total Vehicles",
          "gridPos": {
            "h": 4,
            "w": 8,
            "x": 0,
            "y": 0
          },
          "options": {
            "textMode": "auto",
            "colorMode": "value"
          },
          "x-navixy": {
            "sql": {
              "params": {},
              "statement": "SELECT COUNT(*) AS value FROM raw_business_data.objects WHERE is_deleted IS NOT TRUE"
            },
            "verify": {
              "max_rows": 1
            },
            "dataset": {
              "shape": "kpi",
              "columns": {
                "value": {
                  "type": "integer"
                }
              }
            }
          }
        },
        {
          "id": 2,
          "type": "kpi",
          "title": "Avg Driving Score",
          "gridPos": {
            "h": 4,
            "w": 8,
            "x": 8,
            "y": 0
          },
          "options": {
            "textMode": "auto",
            "colorMode": "value"
          },
          "x-navixy": {
            "sql": {
              "params": {},
              "statement": "WITH perf AS (SELECT hde.device_id, COUNT(*) FILTER (WHERE hde.event_type IN ('Driver performance braking', 'Driver performance braking and turn')) AS brake_cnt, COUNT(*) FILTER (WHERE hde.event_type IN ('Driver performance turn', 'Driver performance quick lane change')) AS turn_cnt, COUNT(*) FILTER (WHERE hde.event_type = 'overspeeding') AS speed_cnt FROM processed_common_data.driver_performance_events hde WHERE hde.device_time >= NOW() - INTERVAL '1 month' AND hde.device_time < NOW() GROUP BY hde.device_id), vm AS (SELECT o.device_id, ROUND(SUM(t.trip_distance_meters) / 1000.0, 2) AS mileage_km FROM raw_business_data.objects o LEFT JOIN processed_common_data.trips t ON t.device_id = o.device_id AND t.trip_start_time >= NOW() - INTERVAL '1 month' AND t.trip_start_time < NOW() WHERE o.is_deleted IS NOT TRUE GROUP BY o.device_id HAVING COALESCE(SUM(t.trip_distance_meters), 0) > 0) SELECT ROUND(AVG(GREATEST(0, 100 - 1.0 * COALESCE(p.brake_cnt, 0) / vm.mileage_km * 100 - 1.0 * COALESCE(p.turn_cnt, 0) / vm.mileage_km * 100 - 3.0 * COALESCE(p.speed_cnt, 0) / vm.mileage_km * 100))::numeric, 1) AS value FROM vm LEFT JOIN perf p ON p.device_id = vm.device_id"
            },
            "verify": {
              "max_rows": 1
            },
            "dataset": {
              "shape": "kpi",
              "columns": {
                "value": {
                  "type": "number"
                }
              }
            }
          }
        },
        {
          "id": 3,
          "type": "kpi",
          "title": "Total Events",
          "gridPos": {
            "h": 4,
            "w": 8,
            "x": 16,
            "y": 0
          },
          "options": {
            "textMode": "auto",
            "colorMode": "value"
          },
          "x-navixy": {
            "sql": {
              "params": {},
              "statement": "SELECT COUNT(*) AS value FROM processed_common_data.driver_performance_events WHERE device_time >= NOW() - INTERVAL '1 month' AND device_time < NOW()"
            },
            "verify": {
              "max_rows": 1
            },
            "dataset": {
              "shape": "kpi",
              "columns": {
                "value": {
                  "type": "integer"
                }
              }
            }
          }
        },
        {
          "id": 100,
          "type": "text",
          "title": "Block 1 – Vehicle Rating",
          "gridPos": {
            "h": 3,
            "w": 24,
            "x": 0,
            "y": 4
          },
          "options": {
            "mode": "markdown",
            "content": "## Block 1 – Vehicle Rating"
          }
        },
        {
          "id": 7,
          "type": "table",
          "title": "Vehicle Rating",
          "gridPos": {
            "h": 18,
            "w": 24,
            "x": 0,
            "y": 6
          },
          "options": {
            "showHeader": true
          },
          "x-navixy": {
            "sql": {
              "params": {},
              "statement": "WITH perf AS (SELECT hde.device_id, COUNT(*) FILTER (WHERE hde.event_type IN ('Driver performance acceleration', 'Driver performance acceleration and turn')) AS accel_cnt, COUNT(*) FILTER (WHERE hde.event_type IN ('Driver performance braking', 'Driver performance braking and turn')) AS brake_cnt, COUNT(*) FILTER (WHERE hde.event_type IN ('Driver performance turn', 'Driver performance quick lane change')) AS turn_cnt, COUNT(*) FILTER (WHERE hde.event_type = 'overspeeding') AS speed_cnt, COUNT(*) FILTER (WHERE hde.event_type = 'idle over 5 min' AND hde.extra_value >= 1500) AS idle_cnt, COUNT(*) FILTER (WHERE hde.event_type = 'seatbelt') AS belt_cnt, COUNT(*) FILTER (WHERE hde.event_type = 'rpm exceeded') AS rpm_cnt FROM processed_common_data.driver_performance_events hde WHERE hde.device_time >= NOW() - INTERVAL '1 month' AND hde.device_time < NOW() GROUP BY hde.device_id), vm AS (SELECT o.device_id, o.object_label, COALESCE(v.model, o.model, '—') AS vehicle_model, COALESCE(e.last_name || ' ' || e.first_name, '—') AS driver_name, ROUND(SUM(t.trip_distance_meters) / 1000.0, 2) AS mileage_km FROM raw_business_data.objects o LEFT JOIN raw_business_data.vehicles v ON v.object_id = o.object_id LEFT JOIN raw_business_data.employees e ON e.object_id = o.object_id AND e.is_deleted IS NOT TRUE LEFT JOIN processed_common_data.trips t ON t.device_id = o.device_id AND t.trip_start_time >= NOW() - INTERVAL '1 month' AND t.trip_start_time < NOW() WHERE o.is_deleted IS NOT TRUE GROUP BY o.device_id, o.object_label, v.model, o.model, e.last_name, e.first_name HAVING COALESCE(SUM(t.trip_distance_meters), 0) > 0) SELECT vm.object_label AS vehicle, vm.driver_name, vm.vehicle_model, vm.mileage_km, ROUND(3.0 * COALESCE(p.accel_cnt, 0) / vm.mileage_km * 100, 2) AS accel_score, ROUND(1.0 * COALESCE(p.brake_cnt, 0) / vm.mileage_km * 100, 2) AS brake_score, ROUND(1.0 * COALESCE(p.turn_cnt, 0) / vm.mileage_km * 100, 2) AS turn_score, ROUND(1.0 * COALESCE(p.idle_cnt, 0) / vm.mileage_km * 100, 2) AS idle_score, ROUND(1.0 * COALESCE(p.belt_cnt, 0) / vm.mileage_km * 100, 2) AS belt_score, ROUND(1.0 * COALESCE(p.rpm_cnt, 0) / vm.mileage_km * 100, 2) AS rpm_score, ROUND(3.0 * COALESCE(p.speed_cnt, 0) / vm.mileage_km * 100, 2) AS speed_score, GREATEST(0, ROUND((100 - 1.0 * COALESCE(p.brake_cnt, 0) / vm.mileage_km * 100 - 1.0 * COALESCE(p.turn_cnt, 0) / vm.mileage_km * 100 - 1.0 * COALESCE(p.idle_cnt, 0) / vm.mileage_km * 100 - 1.0 * COALESCE(p.belt_cnt, 0) / vm.mileage_km * 100 - 1.0 * COALESCE(p.rpm_cnt, 0) / vm.mileage_km * 100 - 3.0 * COALESCE(p.speed_cnt, 0) / vm.mileage_km * 100)::numeric, 2)) AS total_score FROM vm LEFT JOIN perf p ON p.device_id = vm.device_id ORDER BY total_score DESC"
            },
            "verify": {
              "max_rows": 500
            },
            "dataset": {
              "shape": "table",
              "columns": {
                "vehicle": {
                  "type": "string"
                },
                "rpm_score": {
                  "type": "number"
                },
                "belt_score": {
                  "type": "number"
                },
                "idle_score": {
                  "type": "number"
                },
                "mileage_km": {
                  "type": "number"
                },
                "turn_score": {
                  "type": "number"
                },
                "accel_score": {
                  "type": "number"
                },
                "brake_score": {
                  "type": "number"
                },
                "driver_name": {
                  "type": "string"
                },
                "speed_score": {
                  "type": "number"
                },
                "total_score": {
                  "type": "number"
                },
                "vehicle_model": {
                  "type": "string"
                }
              }
            }
          }
        },
        {
          "id": 200,
          "type": "text",
          "title": "Block 2 – Violation Counts",
          "gridPos": {
            "h": 3,
            "w": 24,
            "x": 0,
            "y": 24
          },
          "options": {
            "mode": "markdown",
            "content": "## Block 2 – Violation Counts"
          }
        },
        {
          "id": 17,
          "type": "table",
          "title": "Violation Counts",
          "gridPos": {
            "h": 18,
            "w": 24,
            "x": 0,
            "y": 26
          },
          "options": {
            "showHeader": true
          },
          "x-navixy": {
            "sql": {
              "params": {},
              "statement": "WITH perf AS (SELECT hde.device_id, COUNT(*) FILTER (WHERE hde.event_type IN ('Driver performance acceleration', 'Driver performance acceleration and turn')) AS accel_cnt, COUNT(*) FILTER (WHERE hde.event_type IN ('Driver performance braking', 'Driver performance braking and turn')) AS brake_cnt, COUNT(*) FILTER (WHERE hde.event_type IN ('Driver performance turn', 'Driver performance quick lane change')) AS turn_cnt, COUNT(*) FILTER (WHERE hde.event_type = 'overspeeding') AS speed_cnt, COUNT(*) FILTER (WHERE hde.event_type = 'idle over 5 min' AND hde.extra_value >= 1500) AS idle_cnt, COUNT(*) FILTER (WHERE hde.event_type = 'seatbelt') AS belt_cnt, COUNT(*) FILTER (WHERE hde.event_type = 'rpm exceeded') AS rpm_cnt FROM processed_common_data.driver_performance_events hde WHERE hde.device_time >= NOW() - INTERVAL '1 month' AND hde.device_time < NOW() GROUP BY hde.device_id), vi AS (SELECT o.device_id, o.object_label, COALESCE(e.last_name || ' ' || e.first_name, '—') AS driver_name, COALESCE(g.group_label, '—') AS group_label FROM raw_business_data.objects o LEFT JOIN raw_business_data.employees e ON e.object_id = o.object_id AND e.is_deleted IS NOT TRUE LEFT JOIN raw_business_data.groups g ON g.group_id = o.group_id WHERE o.is_deleted IS NOT TRUE) SELECT vi.object_label AS vehicle, vi.driver_name, vi.group_label, COALESCE(p.accel_cnt, 0) AS acceleration, COALESCE(p.brake_cnt, 0) AS braking, COALESCE(p.turn_cnt, 0) AS sharp_turn, COALESCE(p.idle_cnt, 0) AS idle, COALESCE(p.belt_cnt, 0) AS seatbelt, COALESCE(p.rpm_cnt, 0) AS rpm_exceeded, COALESCE(p.speed_cnt, 0) AS speeding FROM vi LEFT JOIN perf p ON p.device_id = vi.device_id WHERE COALESCE(p.accel_cnt, 0) + COALESCE(p.brake_cnt, 0) + COALESCE(p.turn_cnt, 0) + COALESCE(p.idle_cnt, 0) + COALESCE(p.belt_cnt, 0) + COALESCE(p.rpm_cnt, 0) + COALESCE(p.speed_cnt, 0) > 0 ORDER BY COALESCE(p.accel_cnt, 0) + COALESCE(p.brake_cnt, 0) + COALESCE(p.turn_cnt, 0) + COALESCE(p.idle_cnt, 0) + COALESCE(p.belt_cnt, 0) + COALESCE(p.rpm_cnt, 0) + COALESCE(p.speed_cnt, 0) DESC"
            },
            "verify": {
              "max_rows": 500
            },
            "dataset": {
              "shape": "table",
              "columns": {
                "idle": {
                  "type": "integer"
                },
                "braking": {
                  "type": "integer"
                },
                "vehicle": {
                  "type": "string"
                },
                "seatbelt": {
                  "type": "integer"
                },
                "speeding": {
                  "type": "integer"
                },
                "sharp_turn": {
                  "type": "integer"
                },
                "driver_name": {
                  "type": "string"
                },
                "group_label": {
                  "type": "string"
                },
                "acceleration": {
                  "type": "integer"
                },
                "rpm_exceeded": {
                  "type": "integer"
                }
              }
            }
          }
        },
        {
          "id": 300,
          "type": "text",
          "title": "Block 3 – Violations Detail",
          "gridPos": {
            "h": 3,
            "w": 24,
            "x": 0,
            "y": 44
          },
          "options": {
            "mode": "markdown",
            "content": "## Block 3 – Violations Detail"
          }
        },
        {
          "id": 23,
          "type": "table",
          "title": "Violations Detail",
          "gridPos": {
            "h": 20,
            "w": 24,
            "x": 0,
            "y": 46
          },
          "options": {
            "showHeader": true
          },
          "x-navixy": {
            "sql": {
              "params": {},
              "statement": "WITH obj AS (SELECT o.device_id, o.object_label, COALESCE(e.last_name || ' ' || e.first_name, '—') AS driver_name, COALESCE(g.group_label, '—') AS group_label FROM raw_business_data.objects o LEFT JOIN raw_business_data.employees e ON e.object_id = o.object_id AND e.is_deleted IS NOT TRUE LEFT JOIN raw_business_data.groups g ON g.group_id = o.group_id WHERE o.is_deleted IS NOT TRUE) SELECT to_char(hde.device_time, 'YYYY-MM-DD HH24:MI:SS') AS violation_time, o.group_label, CASE WHEN hde.event_type = 'overspeeding' THEN 'Speeding' WHEN hde.event_type = 'idle over 5 min' THEN 'Idling' WHEN hde.event_type = 'seatbelt' THEN 'Seatbelt' WHEN hde.event_type = 'rpm exceeded' THEN 'RPM Exceeded' ELSE hde.event_type END AS event, CASE WHEN hde.event_type = 'overspeeding' THEN ROUND(hde.speed_kmh, 1)::text || ' km/h' WHEN hde.event_type = 'idle over 5 min' THEN 'Idle ' || COALESCE(ROUND(hde.extra_value / 60.0)::int::text || ' min', '?') WHEN hde.event_type = 'seatbelt' THEN 'Moving without seatbelt at ' || ROUND(hde.speed_kmh, 1)::text || ' km/h' WHEN hde.event_type = 'rpm exceeded' THEN 'RPM ' || COALESCE(ROUND(hde.extra_value)::int::text, '> 5000') ELSE COALESCE(ROUND(hde.speed_kmh, 1)::text || ' km/h', '—') END AS violation_type, ROUND(hde.latitude::numeric, 6) AS latitude, ROUND(hde.longitude::numeric, 6) AS longitude, hde.speed_kmh, o.driver_name, COALESCE(o.object_label, 'device_' || hde.device_id) AS vehicle FROM processed_common_data.driver_performance_events hde JOIN obj o ON o.device_id = hde.device_id WHERE hde.device_time >= NOW() - INTERVAL '1 month' AND hde.device_time < NOW() AND NOT (hde.event_type = 'idle over 5 min' AND hde.extra_value < 1500) ORDER BY hde.device_time DESC"
            },
            "verify": {
              "max_rows": 500
            },
            "dataset": {
              "shape": "table",
              "columns": {
                "event": {
                  "type": "string"
                },
                "vehicle": {
                  "type": "string"
                },
                "latitude": {
                  "type": "number"
                },
                "longitude": {
                  "type": "number"
                },
                "speed_kmh": {
                  "type": "number"
                },
                "driver_name": {
                  "type": "string"
                },
                "group_label": {
                  "type": "string"
                },
                "violation_time": {
                  "type": "string"
                },
                "violation_type": {
                  "type": "string"
                }
              }
            }
          }
        }
      ],
      "refresh": "5m",
      "version": 1,
      "editable": true,
      "timezone": "browser",
      "x-navixy": {
        "execution": {
          "dialect": "postgresql",
          "endpoint": "/api/v1/sql/run",
          "max_rows": 10000,
          "read_only": true,
          "timeout_ms": 60000
        },
        "parameters": {
          "bindings": {}
        },
        "schemaVersion": "1.0.0"
      },
      "templating": {
        "list": [],
        "enable": false
      },
      "timepicker": {
        "now": true,
        "enable": true,
        "hidden": false,
        "collapse": false,
        "time_options": [
          "5m",
          "15m",
          "1h",
          "6h",
          "12h",
          "24h",
          "7d",
          "30d"
        ],
        "refresh_intervals": [
          "10s",
          "30s",
          "1m",
          "5m"
        ]
      },
      "annotations": {
        "list": [
          {
            "hide": true,
            "name": "Annotations & Alerts",
            "type": "dashboard",
            "enable": true,
            "builtIn": 1,
            "iconColor": "rgba(0, 211, 255, 1)"
          }
        ]
      },
      "description": "Driving Score Dashboard — single data source: processed_common_data.driver_performance_events. 3 blocks: Vehicle Rating (score per km), Violation Counts (raw counts), Violations Detail (individual events). No hypertable scans — all violations pre-aggregated by triggers on tracking_data_core, states, inputs.",
      "graphTooltip": 1,
      "schemaVersion": 38
    },
  },
];

export const DEFAULT_CORPUS_ID = 'fleet-anomaly';
