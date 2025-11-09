# Global Variables Migration Guide

## Overview

The global variables feature has been added to the application. This guide explains how to apply the migration for both new and existing databases.

## For New Deployments (Docker)

The `init-db.sql` file has been updated to include the `global_variables` table. When you start a fresh Docker container, the table will be created automatically.

```bash
# Fresh Docker deployment
docker compose up -d postgres
```

The PostgreSQL container will automatically run `init-db.sql` on first startup, creating all tables including `global_variables`.

## For Existing Databases

If you have an existing database, you need to run the migration manually:

### Option 1: Using psql (Recommended)

```bash
# Connect to your database
psql -U your_username -d reports_app_db

# Run the migration
\i migrations/add_global_variables.sql

# Or directly:
psql -U your_username -d reports_app_db -f migrations/add_global_variables.sql
```

### Option 2: Using Docker

If your database is running in Docker:

```bash
# Copy migration file to container
docker cp migrations/add_global_variables.sql sql-report-postgres:/tmp/

# Execute migration
docker exec -i sql-report-postgres psql -U danilnezhdanov -d reports_app_db -f /tmp/add_global_variables.sql
```

### Option 3: Direct SQL Execution

You can also execute the SQL directly:

```bash
psql -U your_username -d reports_app_db << EOF
-- Copy contents from migrations/add_global_variables.sql
CREATE TABLE IF NOT EXISTS public.global_variables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label TEXT NOT NULL UNIQUE,
    description TEXT,
    value TEXT,
    is_reserved BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_global_variables_label ON public.global_variables(label);
CREATE INDEX IF NOT EXISTS idx_global_variables_is_reserved ON public.global_variables(is_reserved);

INSERT INTO public.global_variables (label, description, is_reserved)
VALUES ('__client_id', 'Client identifier for multi-tenant scenarios', TRUE)
ON CONFLICT (label) DO NOTHING;

ALTER TABLE public.global_variables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view global variables" ON public.global_variables
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage global variables" ON public.global_variables
  FOR ALL USING (has_role(auth_uid(), 'admin'));
EOF
```

## Verification

After running the migration, verify that the table was created:

```sql
-- Check if table exists
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name = 'global_variables'
);

-- Check table structure
\d public.global_variables

-- Check if reserved variable exists
SELECT * FROM public.global_variables WHERE label = '__client_id';
```

## Rollback (if needed)

If you need to rollback the migration:

```sql
-- Drop policies
DROP POLICY IF EXISTS "Users can view global variables" ON public.global_variables;
DROP POLICY IF EXISTS "Admins can manage global variables" ON public.global_variables;

-- Drop table (WARNING: This will delete all global variables!)
DROP TABLE IF EXISTS public.global_variables;
```

## Notes

- The migration uses `CREATE TABLE IF NOT EXISTS` and `ON CONFLICT DO NOTHING`, so it's safe to run multiple times
- The reserved variable `__client_id` will be created automatically
- All users can view global variables, but only admins can create/update/delete them
- Global variables are automatically available in SQL queries using `${variable_name}` syntax

