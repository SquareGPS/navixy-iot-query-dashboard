# Architecture Documentation

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Patterns](#architecture-patterns)
3. [Frontend Architecture](#frontend-architecture)
4. [Backend Architecture](#backend-architecture)
5. [Data Flow](#data-flow)
6. [Security Architecture](#security-architecture)
7. [Performance Considerations](#performance-considerations)
8. [Design Decisions](#design-decisions)

## System Overview

SQL Report Dashboard is a full-stack TypeScript application following a modern, component-based architecture. The system is designed for scalability, maintainability, and security.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Pages      │  │  Components  │  │    Hooks     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Services   │  │    State     │  │    Utils     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP/REST API
                            │
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Node.js/Express)                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Routes     │  │  Middleware  │  │   Services   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────┐  ┌──────────────┐                       │
│  │   Database   │  │    Redis     │                       │
│  │   Service    │  │   Service    │                       │
│  └──────────────┘  └──────────────┘                       │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼──────┐  ┌─────────▼────────┐  ┌──────▼──────┐
│  PostgreSQL  │  │      Redis       │  │ PostgreSQL  │
│  (App DB)    │  │     (Cache)      │  │ (Data DB)    │
└──────────────┘  └──────────────────┘  └──────────────┘
```

### Technology Stack

**Frontend:**
- React 18.3+ with TypeScript
- Vite for build tooling
- Zustand for state management
- React Query for server state
- DnD Kit for drag-and-drop
- Recharts for data visualization
- Tailwind CSS + shadcn/ui for styling

**Backend:**
- Node.js 18+ with TypeScript
- Express.js for HTTP server
- PostgreSQL for data persistence
- Redis for caching
- Winston for logging
- JWT for authentication

## Architecture Patterns

### Frontend Patterns

#### 1. Component Composition
- **Atomic Design**: Components are organized hierarchically (atoms → molecules → organisms)
- **Container/Presentational**: Separation of logic (containers) and presentation (components)
- **Compound Components**: Complex UI patterns built from smaller components

#### 2. State Management
- **Zustand**: Global application state (dashboard editor, authentication)
- **React Query**: Server state caching and synchronization
- **Local State**: Component-specific state using `useState`/`useReducer`

#### 3. Data Fetching
- **Service Layer**: Centralized API communication (`src/services/api.ts`)
- **React Query Hooks**: Automatic caching, refetching, and error handling
- **Optimistic Updates**: Immediate UI updates with rollback on error

#### 4. Layout System
- **Grid-Based Layout**: 24-column grid system (Grafana-compatible)
- **Command Pattern**: Immutable state updates via command functions
- **Geometry Algorithms**: Collision detection, auto-packing, snapping

### Backend Patterns

#### 1. Layered Architecture
```
Routes (HTTP Layer)
    ↓
Middleware (Auth, Validation, Error Handling)
    ↓
Services (Business Logic)
    ↓
Database Service (Data Access)
```

#### 2. Service Pattern
- **Singleton Services**: DatabaseService, RedisService
- **Dependency Injection**: Services injected via getInstance()
- **Connection Pooling**: Efficient database connection management

#### 3. Middleware Chain
- **Authentication**: JWT token validation
- **Authorization**: Role-based access control
- **Validation**: Input validation and SQL query validation
- **Error Handling**: Centralized error processing

#### 4. Security Patterns
- **Parameterized Queries**: SQL injection prevention
- **SELECT-Only Enforcement**: Read-only database access
- **Rate Limiting**: DDoS and abuse protection
- **Input Sanitization**: XSS prevention

## Frontend Architecture

### Directory Structure

```
src/
├── components/          # Reusable UI components
│   ├── layout/         # App shell components
│   ├── menu/           # Menu management
│   ├── reports/        # Report visualizations
│   └── ui/             # shadcn/ui components
├── pages/              # Route components
├── layout/             # Dashboard editor
│   ├── geometry/       # Layout algorithms
│   ├── state/          # Editor state management
│   └── ui/             # Canvas and panels
├── services/           # API service layer
├── hooks/              # Custom React hooks
├── types/              # TypeScript definitions
└── utils/              # Utility functions
```

### Key Components

#### Dashboard Editor (`src/layout/`)
The dashboard editor is a sophisticated drag-and-drop system:

- **Canvas**: Main container managing drag-and-drop lifecycle
- **PanelCard**: Draggable panel wrapper
- **RowHeader**: Collapsible row container
- **Geometry Algorithms**: 
  - Collision detection (`collisions.ts`)
  - Auto-packing (`autopack.ts`)
  - Grid snapping (`grid.ts`)
  - Row management (`rows.ts`)

#### State Management (`src/layout/state/`)

**Editor Store (Zustand):**
```typescript
{
  dashboard: GrafanaDashboard | null;
  selectedPanelId: number | null;
  isEditingLayout: boolean;
  history: GrafanaDashboard[];
  historyIndex: number;
}
```

**Commands Pattern:**
- `cmdMovePanel()`: Move panel to new position
- `cmdResizePanel()`: Resize panel dimensions
- `cmdMovePanelToRow()`: Move panel into/out of row
- `cmdReorderRows()`: Reorder row sequence
- Undo/redo via history stack

#### Visualization Components (`src/components/reports/`)

Each visualization follows a consistent pattern:

1. **Data Fetching**: `useEffect` hook fetches data via `apiService.executeSQL()`
2. **State Management**: Loading, error, and data states
3. **Rendering**: Chart library (Recharts) or custom components
4. **Edit Mode**: Hover overlay with edit button

**Visualization Types:**
- `BarChartComponent`: Bar/column charts with stacking
- `PieChartComponent`: Pie/donut charts with legends
- `TableVisualComponent`: Paginated data tables
- `TileVisualComponent`: Single metric displays

### Data Flow

#### Query Execution Flow

```
User Input (SQL Editor)
    ↓
useSqlExecution Hook
    ↓
apiService.executeSQL()
    ↓
POST /api/sql-new/execute
    ↓
Backend: validateSQLQuery middleware
    ↓
Backend: DatabaseService.executeQuery()
    ↓
PostgreSQL Query Execution
    ↓
Response Transformation
    ↓
React Query Cache Update
    ↓
Component Re-render
```

#### Dashboard Editing Flow

```
User Drag Action
    ↓
Canvas.handleDragStart()
    ↓
Canvas.handleDragEnd()
    ↓
cmdMovePanel() / cmdMovePanelToRow()
    ↓
Editor Store Update (Zustand)
    ↓
History Push (Undo/Redo)
    ↓
Component Re-render
    ↓
onDashboardChange Callback
    ↓
ReportView.saveDashboard()
    ↓
POST /api/reports/:id
    ↓
Database Update
```

## Backend Architecture

### Directory Structure

```
backend/src/
├── index.ts            # Application entry point
├── routes/             # API route handlers
│   ├── app.ts         # Auth, settings, reports
│   ├── menu.ts        # Menu management
│   ├── sql-new.ts     # SQL execution
│   └── health.ts       # Health checks
├── services/           # Business logic
│   ├── database.ts    # Database service
│   └── redis.ts       # Redis service
├── middleware/         # Express middleware
│   ├── auth.ts        # Authentication
│   └── errorHandler.ts # Error handling
└── utils/             # Utilities
    ├── logger.ts      # Winston logger
    └── sqlValidationIntegration.ts # SQL validation
```

### Service Layer

#### DatabaseService
Singleton service managing PostgreSQL connections:

- **Connection Pools**: Separate pools for app DB and query DB
- **Query Execution**: Parameterized queries with timeout
- **Transaction Management**: ACID-compliant transactions
- **Connection Lifecycle**: Graceful shutdown handling

#### RedisService
Singleton service for caching:

- **Query Result Caching**: SHA-256 hashed cache keys
- **TTL Management**: Configurable expiration times
- **Connection Pooling**: Efficient Redis connection reuse

### Route Handlers

#### SQL Execution (`/api/sql-new/execute`)
1. **Validation**: SQL query validation middleware
2. **Cache Check**: Redis lookup for cached results
3. **Query Execution**: Parameterized query execution
4. **Result Transformation**: Column type detection, row formatting
5. **Cache Storage**: Store results in Redis
6. **Response**: JSON response with columns, rows, stats

#### Menu Management (`/api/v1/menu/*`)
1. **Authentication**: JWT token validation
2. **Authorization**: Role-based access control
3. **Transaction**: Database transaction for atomicity
4. **Optimistic Locking**: Version-based concurrency control
5. **Response**: Updated menu tree

### Database Schema

#### Core Tables

**users**: User accounts and authentication
**user_roles**: Role assignments (admin, editor, viewer)
**sections**: Menu sections (hierarchical)
**reports**: Report definitions with Grafana schema
**app_settings**: Application configuration

#### Key Features

- **Soft Deletes**: `is_deleted` flag for data retention
- **Version Tracking**: Optimistic concurrency control
- **Audit Fields**: `created_at`, `updated_at`, `created_by`, `updated_by`
- **JSONB Storage**: Flexible schema storage for Grafana dashboards

## Data Flow

### Authentication Flow

```
Login Request
    ↓
POST /api/auth/login
    ↓
DatabaseService.authenticateUser()
    ↓
bcrypt.compare() password verification
    ↓
JWT Token Generation
    ↓
Response with token
    ↓
Frontend: Store token in localStorage
    ↓
Subsequent Requests: Authorization header
```

### Report Creation Flow

```
User Creates Report
    ↓
ReportView Component
    ↓
POST /api/reports
    ↓
Backend: Validate schema
    ↓
Database: Insert report record
    ↓
Response with report ID
    ↓
Frontend: Navigate to report view
    ↓
GET /api/reports/:id
    ↓
Render dashboard from schema
```

### Query Execution Flow

```
User Executes SQL Query
    ↓
Frontend: Build request with parameters
    ↓
POST /api/sql-new/execute
    ↓
Backend: Validate SQL (SELECT-only)
    ↓
Backend: Check Redis cache
    ↓
If cached: Return cached result
    ↓
If not cached:
    ├── Execute query on data DB
    ├── Transform results
    ├── Store in Redis cache
    └── Return results
```

## Security Architecture

### Defense in Depth

#### Layer 1: Input Validation
- **SQL Validation**: SELECT-only enforcement via AST parsing
- **Parameter Binding**: Parameterized queries prevent injection
- **Type Validation**: Zod schemas for request validation
- **Sanitization**: XSS prevention in user inputs

#### Layer 2: Authentication & Authorization
- **JWT Tokens**: Stateless authentication
- **Role-Based Access**: admin, editor, viewer roles
- **Token Expiration**: Configurable expiration times
- **Refresh Tokens**: (Future enhancement)

#### Layer 3: Rate Limiting
- **Express Rate Limit**: Request throttling
- **IP-Based**: Per-IP request limits
- **Configurable**: Environment-based limits

#### Layer 4: Database Security
- **Read-Only Access**: SELECT-only queries enforced
- **Connection Pooling**: Prevents connection exhaustion
- **Query Timeouts**: Prevents long-running queries
- **Row Limits**: Prevents large result sets

### SQL Injection Prevention

The application uses multiple layers of protection:

1. **AST Parsing**: `node-sql-parser` validates query structure
2. **SELECT-Only Enforcement**: Only SELECT statements allowed
3. **Parameterized Queries**: All user input via parameters
4. **Type Checking**: Parameter type validation

## Performance Considerations

### Frontend Optimization

- **Code Splitting**: Route-based code splitting via Vite
- **Lazy Loading**: Components loaded on demand
- **Memoization**: React.memo for expensive components
- **Virtual Scrolling**: (Future enhancement for large tables)

### Backend Optimization

- **Connection Pooling**: Efficient database connection reuse
- **Query Caching**: Redis caching for repeated queries
- **Compression**: Gzip compression for responses
- **Pagination**: Row limits prevent large result sets

### Caching Strategy

**Cache Key Generation:**
```typescript
SHA256(JSON.stringify({
  statement: sqlQuery,
  params: sortedParams
}))
```

**Cache Invalidation:**
- TTL-based expiration
- Manual invalidation via `/api/sql/clear-cache`
- Cache warming for frequently accessed queries

## Design Decisions

### Why Grafana-Compatible Schema?

- **Industry Standard**: Widely adopted dashboard format
- **Import/Export**: Easy migration and sharing
- **Tool Compatibility**: Works with Grafana ecosystem
- **Future Integration**: Potential Grafana integration

### Why Zustand Over Redux?

- **Simplicity**: Less boilerplate code
- **Performance**: Better performance for our use case
- **TypeScript**: Excellent TypeScript support
- **Bundle Size**: Smaller bundle size

### Why React Query?

- **Automatic Caching**: Reduces redundant API calls
- **Background Refetching**: Keeps data fresh
- **Optimistic Updates**: Better UX
- **Error Handling**: Built-in retry logic

### Why Separate App DB and Data DB?

- **Security**: Isolated credentials for data access
- **Scalability**: Independent scaling
- **Performance**: Optimized connection pools
- **Flexibility**: Support multiple data sources

### Why PostgreSQL?

- **JSONB Support**: Native JSON storage for schemas
- **Performance**: Excellent query performance
- **ACID Compliance**: Data integrity guarantees
- **Ecosystem**: Rich tooling and extensions

## Future Architecture Considerations

### Planned Enhancements

1. **Microservices**: Split into smaller services
2. **GraphQL API**: More flexible querying
3. **WebSocket Support**: Real-time dashboard updates
4. **Multi-Tenancy**: Support multiple organizations
5. **Plugin System**: Extensible visualization types

### Scalability Path

1. **Horizontal Scaling**: Load balancer + multiple backend instances
2. **Database Replication**: Read replicas for query execution
3. **CDN**: Static asset delivery
4. **Message Queue**: Async job processing
5. **Caching Layer**: Distributed Redis cluster

