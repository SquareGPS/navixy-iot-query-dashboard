# Development Setup

## Local Development (Recommended)

For local development, run the frontend separately using Vite dev server for hot reload:

```bash
# Terminal 1: Start backend services (PostgreSQL, Redis, Backend API)
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

### Local Development
- Create `.env.local` (see `.env.local.example`)
- Set `VITE_DEFAULT_METABASE_DB_CONNECTION_URL` for prepopulated connection string
- Vite automatically loads `.env.local` in dev mode

### Production / EC2
- Set environment variables in `.env` file (see `.env.example`)
- Build frontend with: `npm run build`
- Frontend environment variables are embedded at build time

## Docker Services

**Default (dev mode):**
- `postgres` - PostgreSQL database
- `redis` - Redis cache
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
npm run docker:up              # Start backend services (no frontend)

# Production
npm run build                  # Build frontend
npm run docker:up:prod         # Start all services including frontend

# Management
npm run docker:logs            # View logs
npm run docker:down            # Stop all services
```
