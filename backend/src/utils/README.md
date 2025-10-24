# SQL Validation System

This directory contains a comprehensive SQL validation system designed to prevent SQL injection attacks and ensure that only safe, read-only SELECT queries are executed against external PostgreSQL databases.

## Overview

The SQL validation system provides multiple layers of security:

1. **Syntax Validation**: Uses sqlglot with PostgreSQL dialect to parse and validate SQL syntax
2. **Statement Type Validation**: Ensures only SELECT statements are allowed
3. **Security Validation**: Blocks dangerous functions, operations, and patterns
4. **Structure Validation**: Validates CTEs, subqueries, and complex query structures

## Components

### Core Modules

- **`sqlSelectGuard.ts`**: Main validation logic using sqlglot
- **`sqlValidationIntegration.ts`**: Express.js integration utilities
- **`sqlValidator.ts`**: Legacy validator (deprecated, kept for compatibility)

### Test Files

- **`__tests__/sqlSelectGuard.test.ts`**: Comprehensive unit tests

## Usage

### Basic Validation

```typescript
import { SQLSelectGuard } from './sqlSelectGuard.js';

// Validate a SQL query
try {
  SQLSelectGuard.assertSafeSelect('SELECT * FROM users WHERE active = true');
  console.log('Query is safe');
} catch (error) {
  if (error instanceof SelectValidationError) {
    console.error('Validation failed:', error.issues);
  }
}

// Non-throwing validation
const result = SQLSelectGuard.validate('SELECT * FROM users');
if (result.valid) {
  console.log('Query is safe');
} else {
  console.error('Validation issues:', result.issues);
}
```

### Express.js Integration

```typescript
import { validateSQLQuery, withSQLValidation } from './sqlValidationIntegration.js';

// As middleware
router.post('/query', validateSQLQuery, (req, res) => {
  // SQL is already validated
  const { sql } = req.body;
  // ... execute query
});

// As wrapper
router.post('/query', withSQLValidation((req, res) => {
  // SQL is already validated
  const { sql } = req.body;
  // ... execute query
}));
```

## Validation Rules

### Allowed Operations

✅ **SELECT statements**
```sql
SELECT * FROM users;
SELECT id, name FROM users WHERE active = true;
SELECT COUNT(*) FROM orders;
```

✅ **Set operations (UNION, INTERSECT, EXCEPT)**
```sql
SELECT * FROM users UNION SELECT * FROM admins;
SELECT * FROM active_users INTERSECT SELECT * FROM premium_users;
```

✅ **Common Table Expressions (CTEs)**
```sql
WITH cte AS (SELECT 1 AS n) SELECT * FROM cte;
WITH RECURSIVE cte AS (...) SELECT * FROM cte;
```

✅ **Subqueries**
```sql
SELECT * FROM users WHERE id IN (SELECT user_id FROM orders);
SELECT * FROM (SELECT * FROM users) AS subquery;
```

✅ **PostgreSQL-specific features**
```sql
SELECT * FROM users WHERE name ILIKE '%john%';
SELECT * FROM users WHERE created_at AT TIME ZONE 'UTC';
SELECT * FROM users WHERE data @> '{"status": "active"}'::jsonb;
SELECT DISTINCT ON (category) * FROM products;
```

### Blocked Operations

❌ **Multiple statements**
```sql
SELECT 1; SELECT 2;  -- MULTI_STATEMENT
```

❌ **Non-SELECT statements**
```sql
INSERT INTO users VALUES (1, 'test');  -- NOT_SELECT
UPDATE users SET name = 'test';        -- NOT_SELECT
DELETE FROM users;                     -- NOT_SELECT
CREATE TABLE test (id INT);            -- NOT_SELECT
DROP TABLE users;                      -- NOT_SELECT
```

❌ **SELECT INTO statements**
```sql
SELECT * INTO new_table FROM users;    -- SELECT_INTO
```

❌ **Row locking clauses**
```sql
SELECT * FROM users FOR UPDATE;        -- LOCKING
SELECT * FROM users FOR SHARE;         -- LOCKING
```

❌ **Non-SELECT CTEs**
```sql
WITH i AS (INSERT INTO test VALUES (1)) SELECT 1;  -- NON_SELECT_CTE
```

❌ **Dangerous functions**
```sql
SELECT pg_sleep(5);                    -- BLOCKED_FUNC
SELECT pg_read_file('/etc/passwd');    -- BLOCKED_FUNC
SELECT current_user;                   -- BLOCKED_FUNC
```

## Error Codes

| Code | Description | Example |
|------|-------------|---------|
| `MULTI_STATEMENT` | Multiple SQL statements detected | `SELECT 1; SELECT 2;` |
| `NOT_SELECT` | Non-SELECT statement detected | `INSERT INTO users VALUES (1);` |
| `SELECT_INTO` | SELECT INTO statement detected | `SELECT * INTO new_table FROM users;` |
| `LOCKING` | Row locking clause detected | `SELECT * FROM users FOR UPDATE;` |
| `NON_SELECT_CTE` | CTE contains non-SELECT statement | `WITH i AS (INSERT INTO test VALUES (1)) SELECT 1;` |
| `BLOCKED_FUNC` | Dangerous function detected | `SELECT pg_sleep(5);` |
| `PARSE_ERROR` | SQL syntax error | `SELECT * FROM users WHERE invalid syntax` |
| `EMPTY_QUERY` | Empty or whitespace-only query | `   ` |

## Security Features

### Function Blocking

The system blocks dangerous PostgreSQL functions that could:
- Cause performance issues (`pg_sleep`)
- Access the file system (`pg_read_file`, `pg_write_file`)
- Terminate connections (`pg_terminate_backend`)
- Access system information (`current_user`, `version`)
- Check privileges (`has_database_privilege`)

### Input Sanitization

- Removes SQL comments (`--` and `/* */`)
- Normalizes whitespace
- Removes trailing semicolons
- Validates input type and presence

### AST-based Validation

Uses sqlglot's Abstract Syntax Tree (AST) to:
- Detect dangerous operations at the structural level
- Validate CTE contents recursively
- Identify function calls precisely
- Handle complex nested queries

## Configuration

### Dependencies

```json
{
  "dependencies": {
    "sqlglot": "^25.0.0"
  }
}
```

### Environment Variables

No additional environment variables are required. The system uses the existing database configuration.

## Testing

Run the test suite:

```bash
npm test -- --testPathPattern=sqlSelectGuard
```

The test suite includes:
- 50+ valid query examples
- 100+ invalid query examples
- Edge case testing
- Error handling validation
- Performance testing

## Performance Considerations

- **Parsing**: sqlglot parsing is fast for typical queries (< 1ms)
- **Caching**: Consider caching validation results for repeated queries
- **Memory**: AST traversal is memory-efficient
- **Timeout**: No built-in timeout; relies on database connection timeouts

## Migration from Legacy Validator

The old `SQLValidator` class is deprecated but maintained for compatibility. To migrate:

1. Replace `SQLValidator.validate()` with `SQLSelectGuard.validate()`
2. Update error handling to use `SelectValidationError`
3. Use the new integration utilities for Express.js

## Troubleshooting

### Common Issues

**"Parse Error" for valid PostgreSQL syntax**
- Ensure sqlglot version supports the PostgreSQL feature
- Check for unsupported syntax patterns

**"BLOCKED_FUNC" for legitimate functions**
- Add the function to the allowlist if it's safe
- Use a different approach if the function is necessary

**Performance issues with complex queries**
- Consider query optimization
- Implement query caching
- Use query timeouts

### Debug Mode

Enable detailed logging:

```typescript
import { logger } from './logger.js';

// The system automatically logs validation failures
logger.warn('SQL validation failed:', {
  sql: sql.substring(0, 100) + '...',
  issues: error.issues
});
```

## Contributing

When adding new validation rules:

1. Add test cases for both valid and invalid scenarios
2. Update this documentation
3. Consider performance impact
4. Ensure backward compatibility

## Security Notes

⚠️ **Important**: This validation system is a security layer, not a replacement for:
- Database-level Row Level Security (RLS)
- Proper authentication and authorization
- Input sanitization at the application level
- Regular security audits

The system provides defense-in-depth but should be used alongside other security measures.
