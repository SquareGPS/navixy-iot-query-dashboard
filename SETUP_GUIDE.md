# SQL Report Dashboard - Setup Guide

This guide covers both **Development Mode** and **Docker Mode** for running the SQL Report Dashboard.

## 🚀 Quick Start Options

### Option 1: Development Mode (Recommended for Development)
```bash
# Start everything with one command
npm run dev:setup

# Stop everything
npm run dev:stop
```

### Option 2: Docker Mode (Recommended for Production-like Environment)
```bash
# Start everything in Docker
npm run docker:up

# Stop everything
npm run docker:down
```

## 🔄 Switching Between Modes

You can easily switch between modes:

```bash
# Stop current mode
npm run dev:stop    # or npm run docker:down

# Start different mode
npm run dev:setup   # or npm run docker:up
```

## 📋 Detailed Comparison

| Feature | Development Mode | Docker Mode |
|---------|------------------|-------------|
| **Setup Time** | ~30 seconds | ~60 seconds |
| **Resource Usage** | Lower | Higher |
| **Hot Reload** | ✅ Full HMR | ✅ Backend HMR |
| **Database** | Local PostgreSQL | Containerized PostgreSQL |
| **Redis** | Docker container | Containerized Redis |
| **Environment** | Local files | Containerized |
| **Debugging** | Direct access | Container logs |
| **Production Similarity** | Lower | Higher |

## 🛠️ Development Mode Details

### What It Does
- Uses your local PostgreSQL installation
- Runs backend and frontend locally with hot reload
- Uses Redis in a lightweight Docker container
- Automatically sets up environment variables
- Provides detailed colored output

### Prerequisites
- Node.js (v18+)
- npm (v8+)
- PostgreSQL (v14+) running locally
- Docker (for Redis only)

### Commands
```bash
npm run dev:setup    # Complete setup and start
npm run dev:stop     # Stop all services
npm run dev          # Frontend only
npm run dev:backend  # Backend only
npm run dev:full     # Both (manual)
```

### Access Points
- **Frontend:** http://localhost:8080
- **Backend:** http://localhost:3001
- **Health Check:** http://localhost:3001/health

## 🐳 Docker Mode Details

### What It Does
- Runs all services in Docker containers
- Uses containerized PostgreSQL and Redis
- Provides production-like environment
- Isolated from your local system

### Prerequisites
- Docker
- Docker Compose (v2+)

### Commands
```bash
npm run docker:up     # Start all services
npm run docker:down   # Stop all services
npm run docker:logs   # View logs
npm run docker:build  # Rebuild containers
```

### Access Points
- **Frontend:** http://localhost:8080 (if frontend container exists)
- **Backend:** http://localhost:3001
- **Health Check:** http://localhost:3001/health

## 🔍 Troubleshooting

### Development Mode Issues

1. **"JWT_SECRET is not set"**
   ```bash
   # Solution: Run the setup script
   npm run dev:setup
   # Or manually set JWT_SECRET in backend/.env
   ```

2. **"Port already in use"**
   ```bash
   # Solution: Stop all services
   npm run dev:stop
   ```

### Docker Mode Issues

1. **"docker-compose: command not found"**
   ```bash
   # Solution: Use newer syntax
   docker compose up -d
   ```

2. **Port conflicts**
   ```bash
   # Solution: Stop development mode first
   npm run dev:stop
   docker compose down
   docker compose up -d
   ```

3. **Container startup issues**
   ```bash
   # Solution: Check logs
   docker compose logs backend
   ```

## 🎯 When to Use Each Mode

### Use Development Mode When:
- ✅ Actively developing features
- ✅ Need fast hot reload
- ✅ Want to debug with local tools
- ✅ Working on frontend changes
- ✅ Need quick iteration cycles

### Use Docker Mode When:
- ✅ Testing production-like environment
- ✅ Demonstrating to stakeholders
- ✅ Need isolated environment
- ✅ Working on deployment issues
- ✅ Testing with clean state

## 🔧 Advanced Usage

### Custom Environment Variables

Edit `backend/.env` file:
```env
JWT_SECRET=your_secret_here
PORT=3001
REDIS_URL=redis://localhost:6379
CORS_ALLOWED_ORIGINS=https://your-domain.com
```

**Note:** Database connections are provided by users at login time, not via environment variables.

### Running Individual Services

**Development Mode:**
```bash
# Backend only
cd backend && npm run dev

# Frontend only
npm run dev
```

**Docker Mode:**
```bash
# Specific service
docker compose up postgres redis -d
docker compose up backend -d
```

## 📊 Performance Comparison

| Metric | Development Mode | Docker Mode |
|--------|------------------|-------------|
| **Startup Time** | ~30s | ~60s |
| **Memory Usage** | ~200MB | ~500MB |
| **CPU Usage** | Lower | Higher |
| **Hot Reload Speed** | Instant | ~2s delay |

## 🚀 Production Deployment

For production deployment, use the Docker configuration as a base:

```bash
# Build production images
docker compose -f docker-compose.prod.yml build

# Deploy
docker compose -f docker-compose.prod.yml up -d
```

## 📝 Environment Variables Reference

This project uses **two separate `.env` files** for different purposes:

### 1. `backend/.env` - Backend Development Mode

**Used when:** Running backend in development mode (`npm run dev`, `npm run dev:backend`, `npm run dev:full`)

**Location:** `backend/.env` (copy from `backend/.env.example`)

**Example:**
```env
NODE_ENV=development
PORT=3001
JWT_SECRET=your_secure_jwt_secret_here
REDIS_URL=redis://localhost:6379
CORS_ALLOWED_ORIGINS=https://your-domain.com
```

### Database Configuration

This application uses **external databases** provided by users at login time:
- **IoT Database** - Source database for SQL queries
- **Settings Database** - Stores user settings in `dashboard_studio_meta_data` schema

No local database configuration is required.

### Setup

```bash
# Copy the example environment file
cp backend/.env.example backend/.env

# Generate a secure JWT secret and add it to the file
openssl rand -hex 32
```

See [backend/.env.example](./backend/.env.example) for complete configuration options.

---

## 🎉 You're All Set!

Both modes are now fully automated and ready to use. Choose the mode that best fits your current needs:

- **Development Mode** for active development
- **Docker Mode** for production-like testing

Happy coding! 🚀
