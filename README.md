# SQL Report Dashboard

A modern, full-stack web application for creating, managing, and viewing SQL-based reports with interactive dashboards. Built for teams who need self-service business intelligence without requiring deep SQL expertise.

## 🎯 Overview

SQL Report Dashboard enables users to:
- **Execute SQL queries** against PostgreSQL databases with built-in security guards
- **Create interactive dashboards** with multiple visualization types (bar charts, pie charts, tables, tiles)
- **Organize reports** in a hierarchical menu structure
- **Edit layouts** using an intuitive drag-and-drop interface
- **Share insights** with role-based access control

The application uses a Grafana-compatible dashboard schema, making it easy to import/export dashboard configurations and integrate with existing Grafana workflows.

## 🏗️ Architecture

This is a full-stack TypeScript application:

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL (application data) + PostgreSQL (query data source)
- **Cache**: Redis (query result caching)
- **Authentication**: JWT-based authentication

See [ARCHITECTURE.md](./docs/ARCHITECTURE.md) for detailed architecture documentation.

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v18 or higher)
- **npm** (v8 or higher)
- **PostgreSQL** (v14 or higher)
- **Docker** (optional, for Redis)

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

- **Frontend**: http://localhost:8080 (or http://localhost:8081)
- **Backend API**: http://localhost:3001
- **Health Check**: http://localhost:3001/health

### Stop All Services

```bash
npm run dev:stop
```

## 📁 Project Structure

```
sql-report-dash/
├── src/                          # Frontend React application
│   ├── components/               # Reusable UI components
│   │   ├── layout/               # Layout components (header, sidebar)
│   │   ├── menu/                 # Menu management components
│   │   ├── reports/              # Report visualization components
│   │   └── ui/                   # shadcn/ui components
│   ├── pages/                    # Page components (routes)
│   ├── layout/                   # Dashboard layout editor
│   │   ├── geometry/             # Layout geometry algorithms
│   │   ├── state/                # Zustand store for editor
│   │   └── ui/                   # Canvas and panel components
│   ├── services/                 # API service layer
│   ├── hooks/                    # React hooks
│   ├── types/                    # TypeScript type definitions
│   └── utils/                    # Utility functions
├── backend/                      # Backend Node.js/Express API
│   ├── src/
│   │   ├── routes/               # API route handlers
│   │   ├── services/             # Business logic services
│   │   ├── middleware/          # Express middleware (auth, error handling)
│   │   └── utils/               # Utility functions (logger, SQL validation)
│   └── .env                      # Environment variables
├── scripts/                      # Development scripts
├── migrations/                   # Database migration scripts
├── docs/                         # Documentation
└── docker-compose.yml           # Docker services configuration
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
| `npm run lint:all` | Lint both frontend and backend |

## 📚 Documentation

- **[Architecture Guide](./docs/ARCHITECTURE.md)** - System architecture, design decisions, and component structure
- **[API Documentation](./docs/API.md)** - Complete API reference
- **[Development Guide](./docs/DEVELOPMENT.md)** - Development workflows, coding standards, and best practices
- **[Deployment Guide](./docs/DEPLOYMENT.md)** - Production deployment instructions
- **[Contributing Guide](./docs/CONTRIBUTING.md)** - How to contribute to the project

## 🔒 Security Features

- **SQL Injection Prevention**: Parameterized queries with SELECT-only enforcement
- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: Protection against abuse
- **Input Validation**: Comprehensive validation on all inputs
- **CORS Configuration**: Controlled cross-origin resource sharing

## 🎨 Key Features

### Dashboard Editor
- Drag-and-drop panel positioning
- Resizable panels with grid snapping
- Collapsible row containers
- Auto-packing algorithm for optimal layout
- Undo/redo functionality

### Visualizations
- **Bar Charts**: Vertical/horizontal orientation, stacking, sorting
- **Pie Charts**: Donut style, customizable legends, tooltips
- **Tables**: Paginated data tables with column configuration
- **Tiles**: Single metric displays with formatting options

### SQL Execution
- Parameterized queries with type safety
- Query timeout controls
- Row limit enforcement
- Result caching with Redis
- Error handling and user-friendly messages

### Menu Management
- Hierarchical section organization
- Drag-and-drop reordering
- Soft delete with restore capability
- Version tracking

## 🐳 Docker Development

For a completely containerized development environment:

```bash
# Start all services in Docker (automatically sets up .env if needed)
npm run docker:start

# View logs
npm run docker:logs

# Stop all services
npm run docker:stop

# Restart services
npm run docker:restart
```

**First time setup?** The `docker:start` command automatically:
- Creates `.env` file from `.env.example` if missing
- Generates a secure `JWT_SECRET` if not set
- Validates Docker is running
- Starts all services

See [DOCKER_SETUP.md](./docs/DOCKER_SETUP.md) for detailed Docker setup instructions.

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

### Backend (.env)

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Backend server port | `3001` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://danilnezhdanov@localhost:5432/reports_app_db` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `JWT_SECRET` | JWT signing secret | `dev_jwt_secret_key_change_in_production` |
| `JWT_EXPIRES_IN` | JWT expiration time | `24h` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | `300000` (5 minutes) |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `5000` |
| `LOG_LEVEL` | Logging level | `info` |
| `LOG_FILE` | Log file path | `logs/app.log` |

See [backend/env.example](./backend/env.example) for complete configuration options.

## 🚀 Production Deployment

For production deployment, see [DEPLOYMENT.md](./docs/DEPLOYMENT.md).

## 📄 License

[Add your license here]

## 👥 Contributing

See [CONTRIBUTING.md](./docs/CONTRIBUTING.md) for contribution guidelines.

## 🆘 Support

For issues, questions, or feature requests, please open an issue on GitHub.

## 📦 Repository

**GitHub**: [https://github.com/DanilNezhdanov/navixy-datahub-dashboard](https://github.com/DanilNezhdanov/navixy-datahub-dashboard)

