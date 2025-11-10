# Docker Setup Guide

This guide ensures a smooth Docker setup every time you start the application.

## Quick Start

```bash
# Start all services (automatically sets up .env if needed)
npm run docker:start

# Or use the script directly
./scripts/docker-start.sh up -d
```

## First Time Setup

The `docker-start.sh` script automatically:
1. ✅ Checks if `.env` file exists
2. ✅ Creates `.env` from `.env.example` if missing
3. ✅ Generates a secure `JWT_SECRET` if not set
4. ✅ Validates Docker is running
5. ✅ Starts all services

## Manual Setup (if needed)

If you prefer to set up manually:

1. **Copy the example environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Generate a JWT secret:**
   ```bash
   openssl rand -hex 32
   ```

3. **Add the secret to `.env`:**
   ```bash
   JWT_SECRET=your_generated_secret_here
   ```

4. **Start Docker Compose:**
   ```bash
   docker compose up -d
   ```

## Environment Variables

### Required
- `JWT_SECRET` - Secret key for JWT token signing (auto-generated if missing)

### Optional (with defaults)
- `POSTGRES_DB` - Database name (default: `reports_app_db`)
- `POSTGRES_USER` - Database user (default: `reports_user`)
- `POSTGRES_PASSWORD` - Database password (default: `postgres`)
- `REPORT_SCHEMA_URL` - URL to report schema repository

## Common Commands

```bash
# Start services
npm run docker:start

# Stop services
npm run docker:stop

# View logs
npm run docker:logs

# Restart services
npm run docker:restart

# Stop and remove volumes (fresh start)
docker compose down -v
```

## Troubleshooting

### JWT_SECRET Warning
If you see a warning about JWT_SECRET not being set:
```bash
# The script will auto-generate it, or manually:
openssl rand -hex 32 > .env
echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env
```

### Port Already in Use
```bash
# Stop existing containers
docker compose down

# Or check what's using the port
lsof -i :3001  # Backend
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis
```

### Database Issues
```bash
# Reset database (WARNING: deletes all data)
docker compose down -v
docker compose up -d
```

## Services

- **Backend API**: http://localhost:3001
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379
- **Health Check**: http://localhost:3001/health

## Default Credentials

- **Email**: admin@example.com
- **Password**: admin123

## Notes

- The `.env` file is gitignored for security
- Never commit `.env` to version control
- The script automatically generates a secure JWT_SECRET if missing
- Database is initialized automatically on first start via `init-db.sql`

