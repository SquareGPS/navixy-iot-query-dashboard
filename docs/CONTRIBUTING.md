# Contributing Guide

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Process](#development-process)
4. [Pull Request Process](#pull-request-process)
5. [Coding Standards](#coding-standards)
6. [Testing Requirements](#testing-requirements)
7. [Documentation](#documentation)

## Code of Conduct

### Our Standards

- Be respectful and inclusive
- Welcome constructive feedback
- Focus on what is best for the community
- Show empathy towards other community members

### Unacceptable Behavior

- Harassment or discriminatory language
- Trolling or insulting comments
- Personal or political attacks
- Publishing others' private information

## Getting Started

### Prerequisites

Before contributing, ensure you have:

1. **Development Environment**
   - Node.js v18+
   - PostgreSQL v14+
   - Git
   - Code editor (VS Code recommended)

2. **Knowledge**
   - TypeScript/JavaScript
   - React
   - Express.js
   - SQL/PostgreSQL

### Setting Up for Contribution

1. **Fork the repository**
   ```bash
   # Fork on GitHub, then clone your fork
   git clone https://github.com/your-username/navixy-datahub-dashboard.git
   cd navixy-datahub-dashboard
   ```

2. **Add upstream remote**
   ```bash
   git remote add upstream https://github.com/DanilNezhdanov/navixy-datahub-dashboard.git
   ```

3. **Create development branch**
   ```bash
   git checkout -b develop
   git push -u origin develop
   ```

4. **Install dependencies**
   ```bash
   npm install
   cd backend && npm install && cd ..
   ```

5. **Set up environment**
   ```bash
   cp backend/env.example backend/.env
   # Edit backend/.env with your local configuration
   ```

6. **Run setup**
   ```bash
   npm run dev:setup
   ```

## Development Process

### Branch Naming

Use descriptive branch names:

- `feature/add-pie-chart`: New features
- `bugfix/fix-sql-injection`: Bug fixes
- `hotfix/critical-security-fix`: Critical fixes
- `docs/update-api-docs`: Documentation updates
- `refactor/simplify-state`: Code refactoring

### Workflow

1. **Create feature branch**
   ```bash
   git checkout develop
   git pull upstream develop
   git checkout -b feature/my-feature
   ```

2. **Make changes**
   - Write code following coding standards
   - Add tests for new functionality
   - Update documentation

3. **Commit changes**
   ```bash
   git add .
   git commit -m "feat: add new feature description"
   ```

4. **Keep branch updated**
   ```bash
   git fetch upstream
   git rebase upstream/develop
   ```

5. **Push to your fork**
   ```bash
   git push origin feature/my-feature
   ```

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

**Format:**
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style (formatting, missing semicolons)
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(charts): add pie chart visualization component

Add PieChartComponent with donut style support, customizable
legends, and tooltip positioning.

Closes #123
```

```
fix(api): resolve SQL injection vulnerability

Use parameterized queries for all user inputs in SQL execution
endpoint.

Fixes #456
```

## Pull Request Process

### Before Submitting

- [ ] Code follows style guidelines
- [ ] Tests added/updated and passing
- [ ] Documentation updated
- [ ] No console.log statements (use logger)
- [ ] No commented-out code
- [ ] Branch is up to date with develop

### PR Checklist

1. **Title**: Clear, descriptive title
2. **Description**: 
   - What changes were made
   - Why changes were made
   - How to test
   - Screenshots (if UI changes)
3. **Linked Issues**: Reference related issues
4. **Labels**: Add appropriate labels

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
Steps to test:
1. Step one
2. Step two

## Checklist
- [ ] Code follows style guidelines
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No console.log statements
- [ ] Branch is up to date
```

### Review Process

1. **Automated Checks**
   - CI/CD pipeline runs tests
   - Linting checks
   - Type checking

2. **Code Review**
   - Maintainer reviews code
   - Address feedback
   - Make requested changes

3. **Approval**
   - At least one approval required
   - All checks must pass
   - Conflicts resolved

4. **Merge**
   - Squash and merge (preferred)
   - Delete branch after merge

## Coding Standards

### TypeScript

- **Strict Mode**: Always enabled
- **No `any`**: Use proper types
- **Interfaces**: Prefer interfaces for object shapes
- **Type Guards**: Use type guards for runtime checks

**Example:**
```typescript
// Good
interface User {
  id: string;
  email: string;
}

function isUser(value: unknown): value is User {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'email' in value
  );
}

// Bad
function processUser(user: any) {
  // ...
}
```

### React Components

- **Functional Components**: Always use functional components
- **Hooks**: Use hooks for state and side effects
- **Props Interface**: Define props interface
- **Default Props**: Use default parameters

**Example:**
```typescript
interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export function Button({ 
  label, 
  onClick, 
  disabled = false 
}: ButtonProps) {
  return (
    <button onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}
```

### Error Handling

- **Try-Catch**: Always use try-catch for async operations
- **Error Messages**: User-friendly error messages
- **Logging**: Log errors with context
- **Error Boundaries**: Use error boundaries for component errors

**Example:**
```typescript
try {
  const result = await apiService.executeSQL(query);
  return result;
} catch (error) {
  logger.error('SQL execution failed', { error, query });
  throw new CustomError('Failed to execute query', 500);
}
```

### Performance

- **Memoization**: Use React.memo for expensive components
- **useMemo/useCallback**: Memoize expensive calculations
- **Lazy Loading**: Lazy load routes and heavy components
- **Code Splitting**: Split code at route level

### Security

- **SQL Injection**: Always use parameterized queries
- **XSS Prevention**: Sanitize user inputs
- **Authentication**: Verify authentication on protected routes
- **Authorization**: Check user permissions

## Testing Requirements

### Unit Tests

- **Coverage**: Aim for 80%+ coverage
- **Critical Paths**: 100% coverage for security-critical code
- **Naming**: Descriptive test names

**Example:**
```typescript
describe('Button Component', () => {
  it('should render with label', () => {
    render(<Button label="Click me" onClick={() => {}} />);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('should call onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<Button label="Click me" onClick={handleClick} />);
    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### Integration Tests

- **API Endpoints**: Test API endpoints
- **Database Operations**: Test database operations
- **User Flows**: Test complete user flows

### E2E Tests

- **Critical Paths**: Test critical user paths
- **Cross-Browser**: Test in multiple browsers
- **Accessibility**: Test accessibility

## Documentation

### Code Documentation

- **JSDoc Comments**: Document public functions
- **Inline Comments**: Explain complex logic
- **README Updates**: Update README for new features

**Example:**
```typescript
/**
 * Executes a SQL query with parameterized inputs
 * 
 * @param sql - SQL query string with parameter placeholders
 * @param params - Parameter values keyed by parameter name
 * @param options - Execution options (timeout, row limit)
 * @returns Query result with columns and rows
 * @throws {CustomError} If query execution fails
 */
async function executeSQL(
  sql: string,
  params: Record<string, unknown>,
  options?: ExecutionOptions
): Promise<QueryResult> {
  // Implementation
}
```

### API Documentation

- **Update API.md**: Document new endpoints
- **Request/Response Examples**: Include examples
- **Error Codes**: Document error codes

### User Documentation

- **Update README**: Update README for user-facing changes
- **Screenshots**: Add screenshots for UI changes
- **Migration Guides**: Document migration steps

## Questions?

If you have questions:

1. Check existing documentation
2. Search existing issues
3. Ask in discussions
4. Create an issue with question label

## Recognition

Contributors will be:

- Listed in CONTRIBUTORS.md
- Credited in release notes
- Appreciated by the community

Thank you for contributing! 🎉

