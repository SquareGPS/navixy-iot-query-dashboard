# API Documentation

## Table of Contents

1. [Authentication](#authentication)
2. [SQL Execution](#sql-execution)
3. [Reports](#reports)
4. [Menu Management](#menu-management)
5. [Settings](#settings)
6. [Health Checks](#health-checks)
7. [Error Handling](#error-handling)

## Base URL

- **Development**: `http://localhost:3001`
- **Production**: `https://yourdomain.com`

All endpoints require authentication unless otherwise specified.

## Authentication

### Login

Authenticate a user and receive a JWT token.

**Endpoint:** `POST /api/auth/login`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "admin"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Status Codes:**
- `200`: Success
- `400`: Missing email or password
- `401`: Invalid credentials

### Get Current User

Get information about the authenticated user.

**Endpoint:** `GET /api/auth/me`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "admin"
  }
}
```

## SQL Execution

### Execute SQL Query

Execute a parameterized SQL query against the configured data database.

**Endpoint:** `POST /api/sql-new/execute`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "dialect": "postgresql",
  "statement": "SELECT * FROM users WHERE id = $userId AND status = $status",
  "params": {
    "userId": 123,
    "status": "active"
  },
  "limits": {
    "timeout_ms": 30000,
    "max_rows": 1000
  },
  "read_only": true
}
```

**Response:**
```json
{
  "columns": [
    { "name": "id", "type": "integer" },
    { "name": "email", "type": "text" },
    { "name": "status", "type": "text" }
  ],
  "rows": [
    [123, "user@example.com", "active"],
    [124, "user2@example.com", "active"]
  ],
  "stats": {
    "rowCount": 2,
    "elapsedMs": 45,
    "usedParamCount": 2
  }
}
```

**Error Response:**
```json
{
  "error": {
    "code": "SQL_ERROR",
    "message": "Column 'invalid_column' does not exist",
    "details": {
      "position": 15,
      "hint": "Perhaps you meant 'id'"
    }
  }
}
```

**Status Codes:**
- `200`: Success
- `400`: Invalid request (missing statement, invalid params)
- `401`: Unauthorized
- `403`: SQL validation failed (non-SELECT query)
- `500`: Database error

**Security Notes:**
- Only SELECT queries are allowed
- All user input must be passed via `params` object
- Query timeout enforced (default 30 seconds)
- Row limit enforced (default 1000 rows)
- Results are cached in Redis

### Clear Cache

Clear the SQL query result cache.

**Endpoint:** `POST /api/sql/clear-cache`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Cache cleared successfully"
}
```

## Reports

### Get All Reports

Retrieve all reports for the authenticated user.

**Endpoint:** `GET /api/reports`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "reports": [
    {
      "id": "uuid",
      "title": "Sales Dashboard",
      "subtitle": "Monthly sales overview",
      "slug": "sales-dashboard",
      "section_id": "uuid",
      "sort_index": 0,
      "report_schema": { ... },
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-02T00:00:00Z"
    }
  ]
}
```

### Get Report by ID

Retrieve a specific report by its ID.

**Endpoint:** `GET /api/reports/:id`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "report": {
    "id": "uuid",
    "title": "Sales Dashboard",
    "subtitle": "Monthly sales overview",
    "slug": "sales-dashboard",
    "section_id": "uuid",
    "sort_index": 0,
    "report_schema": {
      "title": "Sales Dashboard",
      "panels": [ ... ]
    },
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-02T00:00:00Z"
  }
}
```

**Status Codes:**
- `200`: Success
- `404`: Report not found

### Create Report

Create a new report.

**Endpoint:** `POST /api/reports`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "New Dashboard",
  "subtitle": "Dashboard description",
  "slug": "new-dashboard",
  "section_id": "uuid",
  "sort_order": 0,
  "report_schema": {
    "title": "New Dashboard",
    "panels": []
  }
}
```

**Response:**
```json
{
  "success": true,
  "report": {
    "id": "uuid",
    "title": "New Dashboard",
    ...
  }
}
```

**Status Codes:**
- `201`: Created
- `400`: Invalid request
- `401`: Unauthorized

### Update Report

Update an existing report.

**Endpoint:** `PUT /api/reports/:id`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "Updated Dashboard",
  "subtitle": "Updated description",
  "report_schema": {
    "title": "Updated Dashboard",
    "panels": [ ... ]
  }
}
```

**Response:**
```json
{
  "success": true,
  "report": {
    "id": "uuid",
    "title": "Updated Dashboard",
    ...
  }
}
```

**Status Codes:**
- `200`: Success
- `400`: Invalid request
- `401`: Unauthorized
- `404`: Report not found

## Menu Management

### Get Menu Tree

Retrieve the complete menu tree structure.

**Endpoint:** `GET /api/v1/menu/tree`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `include_deleted` (optional): Include soft-deleted items (default: `false`)

**Response:**
```json
{
  "sections": [
    {
      "id": "uuid",
      "name": "Sales",
      "sort_index": 0,
      "version": 1
    }
  ],
  "rootReports": [
    {
      "id": "uuid",
      "name": "Overview",
      "sort_index": 0,
      "version": 1
    }
  ],
  "sectionReports": {
    "section-uuid": [
      {
        "id": "uuid",
        "name": "Monthly Sales",
        "sort_index": 0,
        "version": 1
      }
    ]
  }
}
```

### Reorder Menu

Bulk reorder sections and reports in a single operation.

**Endpoint:** `PATCH /api/v1/menu/reorder`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Required Role:** `admin` or `editor`

**Request Body:**
```json
{
  "sections": [
    {
      "id": "uuid",
      "sortOrder": 100,
      "version": 1
    }
  ],
  "reports": [
    {
      "id": "uuid",
      "sortOrder": 200,
      "sectionId": "section-uuid",
      "version": 1
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "sections": [
    {
      "id": "uuid",
      "version": 2
    }
  ],
  "reports": [
    {
      "id": "uuid",
      "version": 2
    }
  ]
}
```

**Status Codes:**
- `200`: Success
- `400`: Invalid request
- `401`: Unauthorized
- `403`: Forbidden (insufficient permissions)
- `409`: Version conflict (optimistic locking)

**Notes:**
- Uses optimistic locking via version numbers
- All operations are atomic (transaction)
- Returns new version numbers for updated items

### Rename Section

Rename a menu section.

**Endpoint:** `PATCH /api/v1/sections/:id`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Required Role:** `admin` or `editor`

**Request Body:**
```json
{
  "name": "New Section Name",
  "version": 1
}
```

**Response:**
```json
{
  "success": true,
  "section": {
    "id": "uuid",
    "name": "New Section Name",
    "version": 2
  }
}
```

### Rename Report

Rename a report.

**Endpoint:** `PATCH /api/v1/reports/:id`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Required Role:** `admin` or `editor`

**Request Body:**
```json
{
  "name": "New Report Name",
  "version": 1
}
```

**Response:**
```json
{
  "success": true,
  "report": {
    "id": "uuid",
    "name": "New Report Name",
    "version": 2
  }
}
```

### Delete Section

Soft-delete a section.

**Endpoint:** `PATCH /api/v1/sections/:id/delete`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Required Role:** `admin` or `editor`

**Request Body:**
```json
{
  "strategy": "move_children_to_root"
}
```

**Strategies:**
- `move_children_to_root`: Move child reports to root level
- `delete_children`: Delete all child reports

**Response:**
```json
{
  "success": true,
  "message": "Section deleted successfully"
}
```

### Delete Report

Soft-delete a report.

**Endpoint:** `PATCH /api/v1/reports/:id/delete`

**Headers:**
```
Authorization: Bearer <token>
```

**Required Role:** `admin` or `editor`

**Response:**
```json
{
  "success": true,
  "message": "Report deleted successfully"
}
```

### Restore Section

Restore a soft-deleted section.

**Endpoint:** `PATCH /api/v1/sections/:id/restore`

**Headers:**
```
Authorization: Bearer <token>
```

**Required Role:** `admin` or `editor`

**Response:**
```json
{
  "success": true,
  "section": {
    "id": "uuid",
    "name": "Restored Section",
    ...
  }
}
```

### Restore Report

Restore a soft-deleted report.

**Endpoint:** `PATCH /api/v1/reports/:id/restore`

**Headers:**
```
Authorization: Bearer <token>
```

**Required Role:** `admin` or `editor`

**Response:**
```json
{
  "success": true,
  "report": {
    "id": "uuid",
    "title": "Restored Report",
    ...
  }
}
```

## Settings

### Get App Settings

Retrieve application settings.

**Endpoint:** `GET /api/settings`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "settings": {
    "organization_name": "My Organization",
    "timezone": "UTC",
    "external_db_url": "postgresql://...",
    "external_db_host": "localhost",
    "external_db_port": 5432,
    "external_db_name": "data_db",
    "external_db_user": "readonly_user",
    "external_db_ssl": true
  }
}
```

### Update App Settings

Update application settings.

**Endpoint:** `PUT /api/settings`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Required Role:** `admin`

**Request Body:**
```json
{
  "organization_name": "Updated Organization",
  "timezone": "America/New_York",
  "external_db_host": "new-host.example.com",
  "external_db_port": 5432
}
```

**Response:**
```json
{
  "success": true,
  "settings": {
    "organization_name": "Updated Organization",
    ...
  }
}
```

### Test Database Connection

Test connection to the external data database.

**Endpoint:** `POST /api/settings/test-connection`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Required Role:** `admin`

**Request Body:**
```json
{
  "external_db_host": "localhost",
  "external_db_port": 5432,
  "external_db_name": "data_db",
  "external_db_user": "readonly_user",
  "external_db_password": "password",
  "external_db_ssl": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Connection successful",
  "result": {
    "version": "PostgreSQL 15.0"
  }
}
```

## Health Checks

### Basic Health Check

Check if the API is running.

**Endpoint:** `GET /health`

**No authentication required**

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00Z",
  "uptime": 3600,
  "environment": "production",
  "version": "1.0.0"
}
```

### Detailed Health Check

Get detailed health information including database and Redis status.

**Endpoint:** `GET /health/detailed`

**No authentication required**

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00Z",
  "uptime": 3600,
  "environment": "production",
  "version": "1.0.0",
  "services": {
    "database": {
      "status": "connected",
      "pool_size": 10,
      "active_connections": 2
    },
    "redis": {
      "status": "connected",
      "ping": "PONG"
    }
  }
}
```

## Error Handling

### Error Response Format

All errors follow a consistent format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "Additional error details"
    }
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `MISSING_STATEMENT` | 400 | SQL statement is required |
| `INVALID_PARAMS` | 400 | Invalid parameters object |
| `SQL_ERROR` | 500 | Database query error |
| `SQL_VALIDATION_FAILED` | 403 | Query validation failed (non-SELECT) |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VERSION_CONFLICT` | 409 | Optimistic locking conflict |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |

### Rate Limiting

Rate limiting is applied to all authenticated endpoints:

- **Window**: 15 minutes (configurable)
- **Limit**: 1000 requests per window (configurable)
- **Headers**: Rate limit information in response headers:
  - `X-RateLimit-Limit`: Request limit
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Reset timestamp

**Rate Limit Exceeded Response:**
```json
{
  "error": "Too many requests from this IP, please try again later."
}
```

## Pagination

Currently, pagination is handled client-side for reports and menu items. Future versions may include server-side pagination with query parameters:

```
GET /api/reports?page=1&pageSize=20
```

## Filtering and Sorting

Filtering and sorting are currently handled client-side. Future versions may include server-side filtering:

```
GET /api/reports?filter[section_id]=uuid&sort=title
```

