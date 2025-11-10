# Quick Start Guide

## 🚀 Local Development

```bash
# 1. Start backend services (PostgreSQL, Redis, Backend)
npm run docker:up

# 2. Start frontend dev server (in another terminal)
npm run dev

# Access: http://localhost:8080
```

## 🐳 Production / EC2 Deployment

```bash
# 1. Build frontend
npm run build

# 2. Start all services including frontend
npm run docker:up:prod

# Access: http://localhost:80
```

## 📋 Service Overview

**Local Development:**
- ✅ Frontend: Vite dev server (port 8080) - Hot reload
- ✅ Backend: Docker (port 3001)
- ✅ Database: Docker (port 5432)
- ✅ Redis: Docker (port 6379)

**Production:**
- ✅ Frontend: Nginx in Docker (port 80)
- ✅ Backend: Docker (port 3001)
- ✅ Database: Docker (port 5432)
- ✅ Redis: Docker (port 6379)

See `DEVELOPMENT.md` for detailed documentation.
