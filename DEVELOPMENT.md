# Development Setup

## Architecture Overview

The dashboard application connects to **client databases** for both:
1. **User Settings Storage** - Uses `CLIENT_SETTINGS_DB_USER` from environment with password from login URL
2. **SQL Query Execution** - Uses username from the user's login URL (iotDbUrl)

Both connections use the same host/port/database/password extracted from the user's login URL, but with different usernames (roles) for different purposes:
- SQL queries use the role from the login URL
- Settings storage uses `CLIENT_SETTINGS_DB_USER` role (same password)

## Local Development (Recommended)

For local development, run the frontend separately using Vite dev server for hot reload:

```bash
# Terminal 1: Start backend services (Redis + Backend API)
npm run docker:up

# Terminal 2: Start frontend dev server
npm run dev

# Access:
# - Frontend: http://localhost:8080 (Vite dev server with hot reload)
# - Backend API: http://localhost:3001
```

**Benefits:**
- ✅ Fast hot reload during development
- ✅ Easy debugging with browser DevTools
- ✅ No need to rebuild frontend for every change

## Production / EC2 Deployment

For production deployment, use Docker Compose with the production profile:

```bash
# Build frontend first
npm run build

# Start all services including frontend (nginx)
npm run docker:up:prod

# Or manually:
docker compose --profile production up -d
```

**Access:**
- Frontend: http://localhost:80 (nginx serving static files)
- Backend API: http://localhost:3001

## Environment Variables

### Required Backend Variables

The following environment variables are **required** for the backend:

| Variable | Description |
|----------|-------------|
| `CLIENT_SETTINGS_DB_USER` | Username for connecting to client database for settings storage (password taken from login URL) |
| `JWT_SECRET` | Secret key for JWT token signing |

### Local Development
- Create `backend/.env` (see `backend/.env.example`)
- Set `CLIENT_SETTINGS_DB_USER` (password is taken from the user's login URL)
- Create `.env.local` (see `.env.local.example`) for frontend variables

### Production / EC2
- Set environment variables in `.env` file (see `.env.example`)
- Build frontend with: `npm run build`
- Frontend environment variables are embedded at build time

## Docker Services

**Default (dev mode):**
- `redis` - Redis cache for query results
- `backend` - Node.js backend API

**Production profile:**
- All above services +
- `frontend` - Nginx serving static frontend files

**Analytics profile (optional):**
- `analytics` - Python analytics service

## Quick Commands

```bash
# Local development
npm run dev                    # Start Vite dev server
npm run docker:up              # Start backend services (Redis + Backend)

# Production
npm run build                  # Build frontend
npm run docker:up:prod         # Start all services including frontend

# Management
npm run docker:logs            # View logs
npm run docker:down            # Stop all services
```

## Database Schema

The application stores user settings in a `dashboard_studio_meta_data` schema on the user's external database. The following tables are expected:

- `dashboard_studio_meta_data.users` - User accounts
- `dashboard_studio_meta_data.user_roles` - User role assignments
- `dashboard_studio_meta_data.global_variables` - Dashboard-wide variables
- `dashboard_studio_meta_data.sections` - Report sections/folders
- `dashboard_studio_meta_data.reports` - Dashboard reports with schemas

**Note:** The schema must be set up on the user's database before first use. Contact your database administrator for setup.
