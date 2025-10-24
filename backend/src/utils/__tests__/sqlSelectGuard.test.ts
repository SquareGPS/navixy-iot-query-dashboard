import { SQLSelectGuard, SelectValidationError } from '../sqlSelectGuard.js';

describe('SQLSelectGuard', () => {
  describe('Valid SQL queries', () => {
    const validQueries = [
      'SELECT 1',
      'SELECT * FROM users',
      'SELECT id, name FROM users WHERE active = true',
      'SELECT COUNT(*) FROM orders WHERE created_at > NOW() - INTERVAL \'1 day\'',
      'SELECT u.name, o.total FROM users u JOIN orders o ON u.id = o.user_id',
      'SELECT * FROM users WHERE name ILIKE \'%john%\'',
      'SELECT DISTINCT ON (category) * FROM products ORDER BY category, price',
      'SELECT * FROM users WHERE created_at AT TIME ZONE \'UTC\'',
      'SELECT * FROM users WHERE id::text = \'123\'',
      'SELECT * FROM a UNION SELECT * FROM b',
      'SELECT * FROM a INTERSECT SELECT * FROM b',
      'SELECT * FROM a EXCEPT SELECT * FROM b',
      'WITH cte AS (SELECT 1 AS n) SELECT * FROM cte',
      'WITH cte1 AS (SELECT 1 AS a), cte2 AS (SELECT 2 AS b) SELECT * FROM cte1 UNION SELECT * FROM cte2',
      'SELECT * FROM (SELECT id, name FROM users) AS subquery',
      'SELECT * FROM users WHERE id IN (SELECT user_id FROM orders)',
      'SELECT * FROM users WHERE EXISTS (SELECT 1 FROM orders WHERE orders.user_id = users.id)',
      'SELECT * FROM users ORDER BY name NULLS FIRST',
      'SELECT * FROM users LIMIT 10 OFFSET 20',
      'SELECT * FROM users GROUP BY department HAVING COUNT(*) > 5',
      'SELECT * FROM users WINDOW w AS (PARTITION BY department ORDER BY salary)',
      'SELECT *, ROW_NUMBER() OVER w FROM users WINDOW w AS (PARTITION BY department ORDER BY salary)',
      'SELECT * FROM users WHERE name SIMILAR TO \'%test%\'',
      'SELECT * FROM users WHERE data @> \'{"key": "value"}\'::jsonb',
      'SELECT * FROM users WHERE tags && ARRAY[\'admin\', \'user\']',
    ];

    test.each(validQueries)('should allow valid query: %s', (sql) => {
      expect(() => SQLSelectGuard.assertSafeSelect(sql)).not.toThrow();
    });

    test.each(validQueries)('should return valid=true for: %s', (sql) => {
      const result = SQLSelectGuard.validate(sql);
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
  });

  describe('Invalid SQL queries', () => {
    describe('MULTI_STATEMENT', () => {
      const multiStatementQueries = [
        'SELECT 1; SELECT 2',
        'SELECT * FROM users; SELECT * FROM orders',
        'SELECT 1; INSERT INTO test VALUES (1)',
        'SELECT 1; UPDATE users SET name = \'test\'',
        'SELECT 1; DELETE FROM users',
        'SELECT 1; DROP TABLE users',
        'SELECT 1; CREATE TABLE test (id INT)',
        'SELECT 1; ALTER TABLE users ADD COLUMN test VARCHAR(50)',
        'SELECT 1; TRUNCATE TABLE users',
        'SELECT 1; GRANT SELECT ON users TO public',
        'SELECT 1; REVOKE SELECT ON users FROM public',
        'SELECT 1; COPY users TO \'/tmp/users.csv\'',
        'SELECT 1; EXECUTE \'SELECT 1\'',
        'SELECT 1; CALL procedure_name()',
        'SELECT 1; DO $$ BEGIN END $$',
      ];

      test.each(multiStatementQueries)('should reject multi-statement: %s', (sql) => {
        expect(() => SQLSelectGuard.assertSafeSelect(sql)).toThrow(SelectValidationError);
      });

      test.each(multiStatementQueries)('should return MULTI_STATEMENT error for: %s', (sql) => {
        const result = SQLSelectGuard.validate(sql);
        expect(result.valid).toBe(false);
        expect(result.issues.some(issue => issue.code === 'MULTI_STATEMENT')).toBe(true);
      });
    });

    describe('NOT_SELECT', () => {
      const nonSelectQueries = [
        'VALUES (1, 2, 3)',
        'EXPLAIN SELECT 1',
        'EXPLAIN ANALYZE SELECT 1',
        'EXPLAIN (FORMAT JSON) SELECT 1',
        'CALL procedure_name()',
        'DO $$ BEGIN END $$',
        'INSERT INTO users VALUES (1, \'test\')',
        'UPDATE users SET name = \'test\'',
        'DELETE FROM users',
        'CREATE TABLE test (id INT)',
        'DROP TABLE test',
        'ALTER TABLE users ADD COLUMN test VARCHAR(50)',
        'TRUNCATE TABLE users',
        'COPY users FROM \'/tmp/users.csv\'',
        'COPY users TO \'/tmp/users.csv\'',
        'GRANT SELECT ON users TO public',
        'REVOKE SELECT ON users FROM public',
        'EXECUTE \'SELECT 1\'',
        'MERGE INTO users USING orders ON users.id = orders.user_id',
        'UPSERT INTO users VALUES (1, \'test\')',
        'REPLACE INTO users VALUES (1, \'test\')',
      ];

      test.each(nonSelectQueries)('should reject non-SELECT: %s', (sql) => {
        expect(() => SQLSelectGuard.assertSafeSelect(sql)).toThrow(SelectValidationError);
      });

      test.each(nonSelectQueries)('should return NOT_SELECT error for: %s', (sql) => {
        const result = SQLSelectGuard.validate(sql);
        expect(result.valid).toBe(false);
        expect(result.issues.some(issue => issue.code === 'NOT_SELECT')).toBe(true);
      });
    });

    describe('SELECT_INTO', () => {
      const selectIntoQueries = [
        'SELECT * INTO new_table FROM users',
        'SELECT id, name INTO temp_users FROM users WHERE active = true',
        'SELECT * INTO TEMP TABLE temp_users FROM users',
        'SELECT * INTO UNLOGGED TABLE temp_users FROM users',
        'SELECT * INTO users_backup FROM users',
      ];

      test.each(selectIntoQueries)('should reject SELECT INTO: %s', (sql) => {
        expect(() => SQLSelectGuard.assertSafeSelect(sql)).toThrow(SelectValidationError);
      });

      test.each(selectIntoQueries)('should return SELECT_INTO error for: %s', (sql) => {
        const result = SQLSelectGuard.validate(sql);
        expect(result.valid).toBe(false);
        expect(result.issues.some(issue => issue.code === 'SELECT_INTO')).toBe(true);
      });
    });

    describe('LOCKING', () => {
      const lockingQueries = [
        'SELECT * FROM users FOR UPDATE',
        'SELECT * FROM users FOR NO KEY UPDATE',
        'SELECT * FROM users FOR SHARE',
        'SELECT * FROM users FOR KEY SHARE',
        'SELECT * FROM users WHERE id = 1 FOR UPDATE',
        'SELECT * FROM users ORDER BY name FOR UPDATE',
        'SELECT * FROM users LIMIT 10 FOR UPDATE',
        'SELECT * FROM users FOR UPDATE NOWAIT',
        'SELECT * FROM users FOR UPDATE SKIP LOCKED',
        'SELECT * FROM users FOR UPDATE OF users',
        'SELECT * FROM users u JOIN orders o ON u.id = o.user_id FOR UPDATE OF u',
      ];

      test.each(lockingQueries)('should reject locking clause: %s', (sql) => {
        expect(() => SQLSelectGuard.assertSafeSelect(sql)).toThrow(SelectValidationError);
      });

      test.each(lockingQueries)('should return LOCKING error for: %s', (sql) => {
        const result = SQLSelectGuard.validate(sql);
        expect(result.valid).toBe(false);
        expect(result.issues.some(issue => issue.code === 'LOCKING')).toBe(true);
      });
    });

    describe('NON_SELECT_CTE', () => {
      const nonSelectCTEQueries = [
        'WITH i AS (INSERT INTO test VALUES (1)) SELECT 1',
        'WITH u AS (UPDATE users SET name = \'test\') SELECT 1',
        'WITH d AS (DELETE FROM users) SELECT 1',
        'WITH c AS (CREATE TABLE test (id INT)) SELECT 1',
        'WITH dr AS (DROP TABLE test) SELECT 1',
        'WITH a AS (ALTER TABLE users ADD COLUMN test VARCHAR(50)) SELECT 1',
        'WITH t AS (TRUNCATE TABLE users) SELECT 1',
        'WITH g AS (GRANT SELECT ON users TO public) SELECT 1',
        'WITH r AS (REVOKE SELECT ON users FROM public) SELECT 1',
        'WITH cp AS (COPY users FROM \'/tmp/users.csv\') SELECT 1',
        'WITH e AS (EXECUTE \'SELECT 1\') SELECT 1',
        'WITH call AS (CALL procedure_name()) SELECT 1',
        'WITH do AS (DO $$ BEGIN END $$) SELECT 1',
        'WITH m AS (MERGE INTO users USING orders ON users.id = orders.user_id) SELECT 1',
        'WITH upsert AS (UPSERT INTO users VALUES (1, \'test\')) SELECT 1',
        'WITH replace AS (REPLACE INTO users VALUES (1, \'test\')) SELECT 1',
      ];

      test.each(nonSelectCTEQueries)('should reject non-SELECT CTE: %s', (sql) => {
        expect(() => SQLSelectGuard.assertSafeSelect(sql)).toThrow(SelectValidationError);
      });

      test.each(nonSelectCTEQueries)('should return NON_SELECT_CTE error for: %s', (sql) => {
        const result = SQLSelectGuard.validate(sql);
        expect(result.valid).toBe(false);
        expect(result.issues.some(issue => issue.code === 'NON_SELECT_CTE')).toBe(true);
      });
    });

    describe('BLOCKED_FUNC', () => {
      const blockedFunctionQueries = [
        'SELECT pg_sleep(5)',
        'SELECT pg_terminate_backend(123)',
        'SELECT pg_cancel_backend(123)',
        'SELECT pg_read_file(\'/etc/passwd\')',
        'SELECT pg_read_binary_file(\'/etc/passwd\')',
        'SELECT pg_write_file(\'/tmp/test.txt\', \'content\')',
        'SELECT lo_import(\'/tmp/file.txt\')',
        'SELECT lo_export(123, \'/tmp/file.txt\')',
        'SELECT dblink_connect(\'conn\', \'host=localhost\')',
        'SELECT dblink_connect_u(\'conn\', \'host=localhost\')',
        'SELECT pg_logdir_ls()',
        'SELECT pg_ls_dir(\'/tmp\')',
        'SELECT pg_stat_file(\'/etc/passwd\')',
        'SELECT pg_reload_conf()',
        'SELECT pg_rotate_logfile()',
        'SELECT current_user',
        'SELECT session_user',
        'SELECT user',
        'SELECT current_database()',
        'SELECT current_schema()',
        'SELECT current_schemas()',
        'SELECT version()',
        'SELECT has_database_privilege(\'test\', \'CONNECT\')',
        'SELECT has_schema_privilege(\'public\', \'USAGE\')',
        'SELECT has_table_privilege(\'users\', \'SELECT\')',
        'SELECT has_column_privilege(\'users\', \'id\', \'SELECT\')',
        'SELECT has_function_privilege(\'func_name\', \'EXECUTE\')',
        'SELECT has_language_privilege(\'plpgsql\', \'USAGE\')',
        'SELECT has_sequence_privilege(\'seq_name\', \'USAGE\')',
        'SELECT has_tablespace_privilege(\'tablespace\', \'CREATE\')',
        'SELECT has_type_privilege(\'type_name\', \'USAGE\')',
        'SELECT * FROM users WHERE id = pg_sleep(1)',
        'SELECT COUNT(*) FROM users WHERE name = current_user',
        'SELECT * FROM users WHERE created_at > (NOW() - INTERVAL \'1 day\') AND pg_sleep(0) = 0',
      ];

      test.each(blockedFunctionQueries)('should reject blocked function: %s', (sql) => {
        expect(() => SQLSelectGuard.assertSafeSelect(sql)).toThrow(SelectValidationError);
      });

      test.each(blockedFunctionQueries)('should return BLOCKED_FUNC error for: %s', (sql) => {
        const result = SQLSelectGuard.validate(sql);
        expect(result.valid).toBe(false);
        expect(result.issues.some(issue => issue.code === 'BLOCKED_FUNC')).toBe(true);
      });
    });

    describe('Empty and malformed queries', () => {
      const emptyQueries = [
        '',
        '   ',
        '-- comment only',
        '/* comment only */',
        ';',
        'SELECT;',
        'SELECT FROM',
        'SELECT * FROM',
      ];

      test.each(emptyQueries)('should reject empty/malformed: "%s"', (sql) => {
        expect(() => SQLSelectGuard.assertSafeSelect(sql)).toThrow(SelectValidationError);
      });
    });
  });

  describe('Error handling', () => {
    test('should provide detailed error messages', () => {
      const sql = 'SELECT 1; SELECT 2; INSERT INTO test VALUES (1)';
      
      try {
        SQLSelectGuard.assertSafeSelect(sql);
        fail('Expected SelectValidationError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SelectValidationError);
        expect(error.issues).toHaveLength(1);
        expect(error.issues[0].code).toBe('MULTI_STATEMENT');
      }
    });

    test('should handle multiple validation issues', () => {
      const sql = 'SELECT pg_sleep(1); INSERT INTO test VALUES (1)';
      
      try {
        SQLSelectGuard.assertSafeSelect(sql);
        fail('Expected SelectValidationError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SelectValidationError);
        expect(error.issues).toHaveLength(1); // Only MULTI_STATEMENT should be caught first
        expect(error.issues[0].code).toBe('MULTI_STATEMENT');
      }
    });

    test('should handle parse errors gracefully', () => {
      const sql = 'SELECT * FROM users WHERE invalid syntax here';
      
      const result = SQLSelectGuard.validate(sql);
      expect(result.valid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].code).toBe('PARSE_ERROR');
    });
  });

  describe('Edge cases', () => {
    test('should handle complex nested queries', () => {
      const sql = `
        WITH RECURSIVE cte AS (
          SELECT id, name, parent_id, 1 as level
          FROM categories
          WHERE parent_id IS NULL
          UNION ALL
          SELECT c.id, c.name, c.parent_id, cte.level + 1
          FROM categories c
          JOIN cte ON c.parent_id = cte.id
        )
        SELECT * FROM cte
        ORDER BY level, name
      `;
      
      expect(() => SQLSelectGuard.assertSafeSelect(sql)).not.toThrow();
    });

    test('should handle window functions', () => {
      const sql = `
        SELECT 
          name,
          salary,
          ROW_NUMBER() OVER (PARTITION BY department ORDER BY salary DESC) as rank,
          LAG(salary) OVER (PARTITION BY department ORDER BY salary) as prev_salary
        FROM employees
      `;
      
      expect(() => SQLSelectGuard.assertSafeSelect(sql)).not.toThrow();
    });

    test('should handle JSON operations', () => {
      const sql = `
        SELECT 
          data->>'name' as name,
          data->'address'->>'city' as city,
          data @> '{"status": "active"}' as is_active
        FROM users
        WHERE data ? 'email'
      `;
      
      expect(() => SQLSelectGuard.assertSafeSelect(sql)).not.toThrow();
    });

    test('should handle array operations', () => {
      const sql = `
        SELECT 
          name,
          tags,
          array_length(tags, 1) as tag_count,
          'admin' = ANY(tags) as is_admin
        FROM users
        WHERE tags && ARRAY['admin', 'user']
      `;
      
      expect(() => SQLSelectGuard.assertSafeSelect(sql)).not.toThrow();
    });
  });
});
