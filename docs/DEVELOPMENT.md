# Development Guide

## Table of Contents

1. [Getting Started](#getting-started)
2. [Development Workflow](#development-workflow)
3. [Code Standards](#code-standards)
4. [Testing](#testing)
5. [Debugging](#debugging)
6. [Common Tasks](#common-tasks)
7. [Troubleshooting](#troubleshooting)

## Getting Started

### Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: v8.0.0 or higher
- **PostgreSQL**: v14.0 or higher
- **Docker**: For Redis (optional, can use local Redis)

### Initial Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd sql-report-dash
   ```

2. **Run automated setup**
   ```bash
   npm run dev:setup
   ```

   This script will:
   - Check prerequisites
   - Create `.env` files
   - Install dependencies
   - Set up the database
   - Start services

3. **Verify installation**
   - Frontend: http://localhost:8080
   - Backend: http://localhost:3001
   - Health check: http://localhost:3001/health

### Manual Setup (Alternative)

If automated setup fails, follow these steps:

1. **Install dependencies**
   ```bash
   npm install
   cd backend && npm install && cd ..
   ```

2. **Set up environment variables**
   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env with your configuration
   ```

3. **Set up PostgreSQL**
   ```bash
   createdb -U your_user reports_app_db
   psql -U your_user -d reports_app_db -f init-db.sql
   ```

4. **Start Redis** (Docker)
   ```bash
   docker run -d --name redis-dev -p 6379:6379 redis:7-alpine
   ```

5. **Start services**
   ```bash
   # Terminal 1: Backend
   npm run dev:backend

   # Terminal 2: Frontend
   npm run dev
   ```

## Development Workflow

### Branch Strategy

- **main**: Production-ready code
- **develop**: Integration branch for features
- **feature/***: Feature branches
- **bugfix/***: Bug fix branches
- **hotfix/***: Critical production fixes

### Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start frontend dev server |
| `npm run dev:backend` | Start backend dev server |
| `npm run dev:full` | Start both frontend and backend |
| `npm run build` | Build frontend for production |
| `npm run build:backend` | Build backend for production |
| `npm run lint` | Lint frontend code |
| `npm run lint:backend` | Lint backend code |
| `npm run lint:all` | Lint both frontend and backend |

### Hot Module Replacement

The frontend uses Vite's HMR for instant updates:
- Component changes: Instant update
- Style changes: Instant update
- State changes: Preserved during HMR

The backend uses `tsx watch` for automatic restarts:
- File changes trigger server restart
- Database connections are maintained

### Code Organization

#### Frontend Structure

```
src/
├── components/       # Reusable UI components
│   ├── layout/      # App shell (header, sidebar)
│   ├── menu/        # Menu management
│   ├── reports/     # Report visualizations
│   └── ui/          # Base UI components (shadcn)
├── pages/           # Route components
├── layout/          # Dashboard editor
│   ├── geometry/    # Layout algorithms
│   ├── state/       # Editor state
│   └── ui/          # Canvas components
├── services/        # API services
├── hooks/           # Custom React hooks
├── types/           # TypeScript definitions
└── utils/           # Utility functions
```

#### Backend Structure

```
backend/src/
├── routes/          # API route handlers
├── services/        # Business logic
├── middleware/      # Express middleware
└── utils/           # Utilities
```

### Git Workflow

1. **Create feature branch**
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Make changes and commit**
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

3. **Push and create PR**
   ```bash
   git push origin feature/my-feature
   # Create PR on GitHub
   ```

4. **Code review and merge**
   - PR must pass CI checks
   - Requires approval from maintainer
   - Merge to `develop` branch

### Commit Message Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting)
- `refactor:` Code refactoring
- `test:` Adding tests
- `chore:` Maintenance tasks

Examples:
```
feat: add pie chart visualization
fix: resolve SQL injection vulnerability
docs: update API documentation
refactor: simplify dashboard editor state
```

## Code Standards

### TypeScript

- **Strict Mode**: Always enabled
- **No `any`**: Use proper types or `unknown`
- **Interfaces**: Prefer interfaces over types for object shapes
- **Enums**: Use enums for fixed sets of values

**Example:**
```typescript
// Good
interface User {
  id: string;
  email: string;
  role: UserRole;
}

enum UserRole {
  Admin = 'admin',
  Editor = 'editor',
  Viewer = 'viewer'
}

// Bad
const user: any = { ... };
```

### React Components

- **Functional Components**: Always use functional components
- **Hooks**: Use hooks for state and side effects
- **Props Interface**: Define props interface above component
- **Default Props**: Use default parameters

**Example:**
```typescript
interface ButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

export function Button({ 
  label, 
  onClick, 
  variant = 'primary' 
}: ButtonProps) {
  return (
    <button onClick={onClick} className={variant}>
      {label}
    </button>
  );
}
```

### Naming Conventions

- **Components**: PascalCase (`UserProfile.tsx`)
- **Files**: Match component name or kebab-case (`user-profile.ts`)
- **Functions**: camelCase (`getUserData()`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRIES`)
- **Types/Interfaces**: PascalCase (`UserData`)

### File Organization

- **One component per file**: Each component in its own file
- **Co-locate related files**: Keep related files together
- **Index files**: Use index files for clean imports

**Example:**
```
components/
  Button/
    Button.tsx
    Button.test.tsx
    Button.stories.tsx
    index.ts
```

### Error Handling

#### Frontend

- **Try-catch**: Use try-catch for async operations
- **Error Boundaries**: Use error boundaries for component errors
- **User-Friendly Messages**: Show user-friendly error messages

**Example:**
```typescript
try {
  const result = await apiService.executeSQL(query);
  setData(result);
} catch (error) {
  console.error('Query execution failed:', error);
  toast.error('Failed to execute query. Please try again.');
}
```

#### Backend

- **Custom Errors**: Use CustomError class
- **Error Middleware**: Centralized error handling
- **Logging**: Log errors with context

**Example:**
```typescript
if (!user) {
  throw new CustomError('User not found', 404);
}

try {
  await dbService.executeQuery(sql);
} catch (error) {
  logger.error('Database error', { error, sql });
  throw new CustomError('Database operation failed', 500);
}
```

### State Management

#### When to Use Zustand

- Global application state
- Dashboard editor state
- Authentication state
- Settings that persist across pages

#### When to Use React Query

- Server state (API responses)
- Caching and synchronization
- Background refetching
- Optimistic updates

#### When to Use Local State

- Component-specific state
- Form inputs
- UI state (modals, dropdowns)
- Temporary calculations

### Performance Best Practices

1. **Memoization**: Use `React.memo` for expensive components
2. **useMemo/useCallback**: Memoize expensive calculations and callbacks
3. **Code Splitting**: Lazy load routes and heavy components
4. **Virtual Scrolling**: For large lists (future enhancement)

**Example:**
```typescript
const expensiveValue = useMemo(() => {
  return computeExpensiveValue(data);
}, [data]);

const handleClick = useCallback(() => {
  doSomething(id);
}, [id]);
```

## Testing

### Frontend Testing

**Unit Tests:**
```bash
npm test
```

**Component Tests:**
- Test component rendering
- Test user interactions
- Test props and state

**Example:**
```typescript
import { render, screen } from '@testing-library/react';
import { Button } from './Button';

test('renders button with label', () => {
  render(<Button label="Click me" onClick={() => {}} />);
  expect(screen.getByText('Click me')).toBeInTheDocument();
});
```

### Backend Testing

**Unit Tests:**
```bash
cd backend && npm test
```

**Integration Tests:**
- Test API endpoints
- Test database operations
- Test middleware

**Example:**
```typescript
import request from 'supertest';
import { app } from '../src/index';

test('GET /health returns 200', async () => {
  const response = await request(app).get('/health');
  expect(response.status).toBe(200);
  expect(response.body.status).toBe('healthy');
});
```

### Test Coverage

- **Target**: 80% code coverage
- **Critical Paths**: 100% coverage for security-critical code
- **Visual Components**: Test user interactions

## Debugging

### Frontend Debugging

1. **React DevTools**: Install browser extension
2. **Console Logging**: Use `console.log` sparingly (remove before commit)
3. **Breakpoints**: Use browser DevTools breakpoints
4. **React Query DevTools**: For debugging server state

### Backend Debugging

1. **VS Code Debugger**: Configure launch.json
2. **Winston Logs**: Check `backend/logs/app.log`
3. **Database Logs**: Enable PostgreSQL query logging
4. **Postman/Insomnia**: Test API endpoints

### Common Debugging Scenarios

**Issue: Component not updating**
- Check if state is being updated
- Verify dependencies in useEffect
- Check React Query cache

**Issue: API request failing**
- Check network tab in DevTools
- Verify authentication token
- Check backend logs

**Issue: Database connection error**
- Verify DATABASE_URL environment variable
- Check PostgreSQL is running
- Verify database exists

## Common Tasks

### Adding a New Visualization Type

1. **Create component** (`src/components/reports/visualizations/`)
   ```typescript
   export function NewVisualComponent({ visual, editMode, onEdit }) {
     // Component implementation
   }
   ```

2. **Add to renderer** (`src/components/reports/GrafanaDashboardRenderer.tsx`)
   ```typescript
   case 'new-visual':
     return <NewVisualComponent ... />;
   ```

3. **Update types** (`src/types/report-schema.ts`)
   ```typescript
   export interface NewVisual extends BaseVisual {
     type: 'new-visual';
     options: NewVisualOptions;
   }
   ```

### Adding a New API Endpoint

1. **Create route handler** (`backend/src/routes/`)
   ```typescript
   router.get('/new-endpoint', authenticateToken, async (req, res) => {
     // Handler implementation
   });
   ```

2. **Register route** (`backend/src/index.ts`)
   ```typescript
   app.use('/api', newRoutes);
   ```

3. **Add to API service** (`src/services/api.ts`)
   ```typescript
   async newEndpoint(): Promise<ApiResponse<NewData>> {
     return this.request('/api/new-endpoint');
   }
   ```

### Database Schema

The application stores user settings in a `dashboard_studio_meta_data` schema on the user's external database. This schema is automatically expected to exist when users connect.

**Schema Structure:**
- `dashboard_studio_meta_data.users` - User accounts
- `dashboard_studio_meta_data.user_roles` - User role assignments
- `dashboard_studio_meta_data.sections` - Menu sections
- `dashboard_studio_meta_data.reports` - Report definitions
- `dashboard_studio_meta_data.global_variables` - Shared variables

**Schema Setup:**
The schema must be created on the user's external database before first use. Contact your database administrator for setup instructions.

**TypeScript Types:**
Update types in `src/types/` if schema changes are needed.

### Environment Variables

**Frontend**: Use `import.meta.env.VITE_*`
```typescript
const apiUrl = import.meta.env.VITE_API_BASE_URL;
```

**Backend**: Use `process.env.*`
```typescript
const port = process.env.PORT || 3001;
```

## Troubleshooting

### Port Already in Use

```bash
# Find process using port
lsof -i :3001
lsof -i :8080

# Kill process
kill -9 <PID>

# Or use stop script
npm run dev:stop
```

### Database Connection Issues

```bash
# Check PostgreSQL is running
brew services list | grep postgresql

# Test connection
psql -U user -d reports_app_db -c "SELECT 1;"

# Check environment variable
echo $DATABASE_URL
```

### Module Not Found Errors

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Backend
cd backend
rm -rf node_modules package-lock.json
npm install
```

### TypeScript Errors

```bash
# Clear TypeScript cache
rm -rf node_modules/.cache
rm -rf .tsbuildinfo

# Restart TypeScript server in VS Code
# Cmd+Shift+P -> "TypeScript: Restart TS Server"
```

### Build Errors

```bash
# Clear build cache
rm -rf dist
rm -rf backend/dist

# Rebuild
npm run build
npm run build:backend
```

### Redis Connection Issues

```bash
# Check Redis container
docker ps | grep redis

# Restart Redis
docker restart redis-dev

# Test connection
docker exec redis-dev redis-cli ping
```

## Additional Resources

- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [React Query Documentation](https://tanstack.com/query/latest)

