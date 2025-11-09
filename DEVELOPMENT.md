# SQL Report Dashboard

A modern, full-stack application for creating and managing SQL reports with interactive dashboards.

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v18 or higher)
- **npm** (v8 or higher)
- **PostgreSQL** (v14 or higher)
- **Docker** (for Redis)

### One-Command Setup

```bash
npm run dev:setup
```

This single command will:
- ✅ Check all prerequisites
- ✅ Set up environment variables
- ✅ Start PostgreSQL (if not running)
- ✅ Create the database (if it doesn't exist)
- ✅ Start Redis in Docker
- ✅ Install all dependencies
- ✅ Start both frontend and backend servers

### Access Your Application

- **Frontend:** http://localhost:8080 (or http://localhost:8081)
- **Backend API:** http://localhost:3001
- **Health Check:** http://localhost:3001/health

### Stop All Services

```bash
npm run dev:stop
```

## 🛠️ Manual Setup (if needed)

### 1. Environment Setup

The setup script automatically creates `backend/.env` with the correct configuration:

```env
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://danilnezhdanov@localhost:5432/reports_app_db
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev_jwt_secret_key_change_in_production
```

### 2. Database Setup

```bash
# Start PostgreSQL
brew services start postgresql@14

# Create database
createdb -U danilnezhdanov reports_app_db
```

### 3. Redis Setup

```bash
# Start Redis in Docker
docker run -d --name redis-dev -p 6379:6379 redis:7-alpine
```

### 4. Install Dependencies

```bash
# Frontend
npm install

# Backend
cd backend && npm install && cd ..
```

### 5. Start Services

```bash
# Start backend
cd backend
DATABASE_URL="postgresql://danilnezhdanov@localhost:5432/reports_app_db" npm run dev

# Start frontend (in another terminal)
npm run dev
```

## 📁 Project Structure

```
sql-report-dash/
├── src/                    # Frontend React application
│   ├── components/         # Reusable UI components
│   ├── pages/             # Page components
│   ├── services/         # API services
│   └── types/            # TypeScript type definitions
├── backend/               # Backend Node.js/Express API
│   ├── src/
│   │   ├── routes/       # API routes
│   │   ├── services/     # Business logic
│   │   ├── middleware/   # Express middleware
│   │   └── utils/        # Utility functions
│   └── .env              # Environment variables
├── scripts/              # Development scripts
│   ├── setup-dev.sh     # Automated setup script
│   └── stop-dev.sh      # Stop all services script
└── docker-compose.yml    # Docker services configuration
```

## 🔧 Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev:setup` | Complete automated setup and start |
| `npm run dev:stop` | Stop all development services |
| `npm run dev` | Start frontend only |
| `npm run dev:backend` | Start backend only |
| `npm run dev:full` | Start both frontend and backend |
| `npm run build` | Build frontend for production |
| `npm run build:backend` | Build backend for production |
| `npm run lint` | Lint frontend code |
| `npm run lint:backend` | Lint backend code |

## 🐳 Docker Development

For a completely containerized development environment:

```bash
# Start all services in Docker
npm run docker:up

# View logs
npm run docker:logs

# Stop all services
npm run docker:down
```

## 🔍 Troubleshooting

### Common Issues

1. **"DATABASE_URL environment variable is required"**
   - Run `npm run dev:setup` to ensure proper environment setup
   - Or manually set: `DATABASE_URL="postgresql://danilnezhdanov@localhost:5432/reports_app_db"`

2. **"Port already in use"**
   - Run `npm run dev:stop` to stop all services
   - Or manually kill processes: `pkill -f "tsx watch"` and `pkill -f "vite"`

3. **PostgreSQL connection issues**
   - Ensure PostgreSQL is running: `brew services start postgresql@14`
   - Check if database exists: `psql -U danilnezhdanov -d reports_app_db -c "SELECT 1;"`

4. **Redis connection issues**
   - Start Redis container: `docker run -d --name redis-dev -p 6379:6379 redis:7-alpine`
   - Test connection: `docker exec redis-dev redis-cli ping`

### Reset Everything

If you encounter persistent issues:

```bash
# Stop all services
npm run dev:stop

# Remove Redis container
docker stop redis-dev && docker rm redis-dev

# Kill any remaining processes
pkill -f "tsx watch" && pkill -f "vite"

# Start fresh
npm run dev:setup
```

## 📝 Environment Variables

This project uses **two separate `.env` files** for different purposes:

### 1. `backend/.env` - Backend Development Mode

**Used when:** Running backend in development mode (`npm run dev`, `npm run dev:backend`, `npm run dev:full`)

**Location:** `backend/.env` (copy from `backend/.env.example`)

**Key Variables:**

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Backend server port | `3001` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://danilnezhdanov@localhost:5432/reports_app_db` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `JWT_SECRET` | JWT signing secret (REQUIRED) | Must be set |
| `JWT_EXPIRES_IN` | JWT expiration time | `24h` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | `300000` (5 minutes) |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `5000` |
| `REPORT_SCHEMA_URL` | Example dashboard schema URL | See `backend/.env.example` |
| `LOG_LEVEL` | Logging level | `info` |
| `LOG_FILE` | Log file path | `logs/app.log` |

### 2. `.env` (root) - Docker Compose Mode

**Used when:** Running services via Docker Compose (`npm run docker:up`, `docker-compose up`)

**Location:** `.env` in project root (copy from `.env.example`)

**Key Variables:**

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_SECRET` | JWT signing secret (REQUIRED) | Must be set |
| `POSTGRES_DB` | PostgreSQL database name | `reports_app_db` |
| `POSTGRES_USER` | PostgreSQL username | `danilnezhdanov` |
| `POSTGRES_PASSWORD` | PostgreSQL password | `postgres` |
| `REPORT_SCHEMA_URL` | Example dashboard schema URL | See `.env.example` |

### Setup

The `npm run dev:setup` command automatically creates `backend/.env` from `backend/.env.example` if it doesn't exist.

For Docker Compose, manually copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
# Edit .env with your values
```

## 🚀 Production Deployment

For production deployment, see the `docker-compose.yml` file and ensure all environment variables are properly configured for your production environment.

## 📚 Additional Resources

- [Backend API Documentation](./backend/README.md)
- [Frontend Component Library](./src/components/README.md)
- [Database Schema](./init-db.sql)
