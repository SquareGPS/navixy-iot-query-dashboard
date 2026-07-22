# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-07-22

First tagged release. The Navixy IoT Query Dashboard is a full-stack TypeScript
application for building and viewing SQL-based reports and interactive dashboards
over IoT and telematics data, with a Grafana-compatible dashboard schema.

### Added

- **SQL reporting** — run parameterized SQL against PostgreSQL with a read-only
  `SELECT` guard, result caching (Redis), and CSV/PDF export.
- **Interactive dashboards** — bar, pie, table, and tile panels with a
  drag-and-drop grid editor (autopack, collision handling, resize, undo/redo).
- **Composite reports** — multi-series charts and a location map with GPS-column
  detection and geocoding.
- **Grafana-compatible schema** — import/export dashboard definitions to fit
  existing Grafana workflows.
- **Hierarchical report menu** with role-based access control and JWT auth.
- **Full-stack setup** — React 18 + Vite frontend, Node.js + Express backend,
  PostgreSQL, and Redis, with Docker Compose and a one-command dev bootstrap.

### Notes

- Requires Node.js 18+ and PostgreSQL 14+; Redis is optional (Docker-provisioned).
- Licensed under MPL-2.0.

[1.0.0]: https://github.com/Navixy/navixy-iot-query-dashboard/releases/tag/v1.0.0
