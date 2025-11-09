-- ==========================================
-- SQL Report Dashboard - Simple Database Initialization
-- ==========================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create auth schema and function first
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT '00000000-0000-0000-0000-000000000001'::UUID;
$$;

-- Create authenticated role
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated;
    END IF;
END
$$;

-- ==========================================
-- Authentication Tables
-- ==========================================

-- Users table
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  email_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_sign_in_at TIMESTAMPTZ,
  raw_user_meta_data JSONB DEFAULT '{}',
  raw_app_meta_data JSONB DEFAULT '{}',
  is_super_admin BOOLEAN DEFAULT FALSE,
  confirmed_at TIMESTAMPTZ DEFAULT NOW(),
  recovery_sent_at TIMESTAMPTZ,
  new_email TEXT,
  invited_at TIMESTAMPTZ,
  action_link TEXT,
  email_change_sent_at TIMESTAMPTZ,
  new_phone TEXT,
  phone_change_sent_at TIMESTAMPTZ,
  phone_confirmed_at TIMESTAMPTZ,
  phone_change TEXT,
  email_change TEXT,
  email_change_confirm_status SMALLINT DEFAULT 0,
  banned_until TIMESTAMPTZ,
  reauthentication_token TEXT,
  reauthentication_sent_at TIMESTAMPTZ,
  is_sso_user BOOLEAN DEFAULT FALSE NOT NULL,
  deleted_at TIMESTAMPTZ,
  is_anonymous BOOLEAN DEFAULT FALSE NOT NULL,
  created_at_legacy TEXT,
  updated_at_legacy TEXT,
  email_confirmed_at_legacy TEXT,
  phone_confirmed_at_legacy TEXT,
  confirmed_at_legacy TEXT,
  email_change_sent_at_legacy TEXT,
  recovery_sent_at_legacy TEXT,
  reauthentication_sent_at_legacy TEXT,
  last_sign_in_at_legacy TEXT,
  invited_at_legacy TEXT,
  action_link_legacy TEXT,
  email_change_legacy TEXT,
  phone_change_legacy TEXT,
  phone_change_sent_at_legacy TEXT,
  banned_until_legacy TEXT,
  deleted_at_legacy TEXT,
  is_sso_user_legacy TEXT,
  is_anonymous_legacy TEXT,
  aud TEXT,
  role TEXT,
  aal TEXT,
  factor_id TEXT,
  not_after TEXT
);

-- User roles table
CREATE TABLE public.user_roles (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin','editor','viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- Application Tables
-- ==========================================

-- Sections (report groups)
CREATE TABLE public.sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sort_index INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reports
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID REFERENCES public.sections(id) ON DELETE SET NULL,
  slug TEXT UNIQUE,
  title TEXT NOT NULL,
  sort_index INT NOT NULL DEFAULT 0,
  report_schema JSONB NOT NULL,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- App-wide settings
CREATE TABLE public.app_settings (
  id INT PRIMARY KEY DEFAULT 1,
  timezone TEXT DEFAULT 'UTC',
  external_db_url TEXT,
  external_db_host TEXT,
  external_db_port INTEGER DEFAULT 5432,
  external_db_name TEXT,
  external_db_user TEXT,
  external_db_password TEXT,
  external_db_ssl BOOLEAN DEFAULT FALSE,
  CHECK (id = 1)
);

-- ==========================================
-- Functions
-- ==========================================

-- Function to execute SQL safely
CREATE OR REPLACE FUNCTION public.execute_sql(query TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  EXECUTE format('SELECT jsonb_agg(row_to_json(t.*)) FROM (%s) t', query) INTO result;
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- Function to validate Grafana dashboard schema structure
CREATE OR REPLACE FUNCTION public.validate_report_schema(schema JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  -- Basic validation: must have required top-level fields
  IF schema IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if this is a Grafana dashboard format
  IF schema ? 'panels' AND jsonb_typeof(schema->'panels') = 'array' THEN
    -- Grafana dashboard format validation (title/subtitle at root level are non-conforming and ignored)
    IF NOT (
      jsonb_array_length(schema->'panels') > 0
    ) THEN
      RETURN FALSE;
    END IF;
    
    -- Validate each panel has required x-navixy configuration
    FOR i IN 0..jsonb_array_length(schema->'panels') - 1 LOOP
      DECLARE
        panel JSONB := schema->'panels'->i;
      BEGIN
        IF NOT (
          panel ? 'type' AND
          panel ? 'title' AND
          panel ? 'x-navixy' AND
          panel->'x-navixy' ? 'sql' AND
          panel->'x-navixy'->'sql' ? 'statement'
        ) THEN
          RETURN FALSE;
        END IF;
      END;
    END LOOP;
    
    RETURN TRUE;
  END IF;
  
  -- Legacy format validation (for backward compatibility) - title/subtitle at root level are non-conforming and ignored
  IF NOT (
    schema ? 'meta' AND
    schema ? 'rows' AND
    jsonb_typeof(schema->'rows') = 'array'
  ) THEN
    RETURN FALSE;
  END IF;
  
  -- Check meta has required fields
  IF NOT (
    schema->'meta' ? 'schema_version' AND
    schema->'meta' ? 'last_updated' AND
    schema->'meta' ? 'updated_by'
  ) THEN
    RETURN FALSE;
  END IF;
  
  -- Check rows array is not empty
  IF jsonb_array_length(schema->'rows') = 0 THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$;

-- Helper function to extract report data (supports both Grafana and legacy formats)
CREATE OR REPLACE FUNCTION public.get_report_queries(report_uuid UUID)
RETURNS TABLE(
  query_type TEXT,
  visual_label TEXT,
  sql_query TEXT,
  row_index INTEGER
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH report_data AS (
    SELECT report_schema FROM public.reports WHERE id = report_uuid
  ),
  grafana_queries AS (
    SELECT 
      (panel->>'type')::TEXT as query_type,
      (panel->>'title')::TEXT as visual_label,
      (panel->'x-navixy'->'sql'->>'statement')::TEXT as sql_query,
      panel_idx as row_index
    FROM 
      report_data,
      jsonb_array_elements(report_schema->'panels') WITH ORDINALITY AS panels(panel, panel_idx)
    WHERE 
      report_schema ? 'panels'
      AND panel ? 'x-navixy'
      AND panel->'x-navixy' ? 'sql'
  ),
  legacy_queries AS (
    SELECT 
      (row_value->>'type')::TEXT as query_type,
      (
        CASE 
          WHEN row_value->>'type' = 'tiles' THEN 
            (row_value->'visuals'->0->>'label')::TEXT
          WHEN row_value->>'type' = 'table' THEN 
            (row_value->'visuals'->0->>'label')::TEXT
          ELSE NULL
        END
      ) as visual_label,
      (
        CASE 
          WHEN row_value->>'type' = 'tiles' THEN 
            (row_value->'visuals'->0->'query'->>'sql')::TEXT
          WHEN row_value->>'type' = 'table' THEN 
            (row_value->'visuals'->0->'query'->>'sql')::TEXT
          ELSE NULL
        END
      ) as sql_query,
      row_idx as row_index
    FROM 
      report_data,
      jsonb_array_elements(report_schema->'rows') WITH ORDINALITY AS rows(row_value, row_idx)
    WHERE 
      report_schema ? 'rows'
      AND row_value->>'type' IN ('tiles', 'table')
  )
  SELECT * FROM grafana_queries
  UNION ALL
  SELECT * FROM legacy_queries;
END;
$$;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Security definer function to check if user is admin or editor
CREATE OR REPLACE FUNCTION public.is_admin_or_editor(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'editor')
  )
$$;

-- ==========================================
-- Row Level Security (RLS)
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view their own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- User roles policies
CREATE POLICY "Authenticated users can view roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and editors can manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.is_admin_or_editor(auth.uid()));

-- Sections policies
CREATE POLICY "Users can view sections"
  ON public.sections FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and editors can manage sections"
  ON public.sections FOR ALL
  TO authenticated
  USING (public.is_admin_or_editor(auth.uid()));

-- Reports policies
CREATE POLICY "Users can view reports"
  ON public.reports FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and editors can manage reports"
  ON public.reports FOR ALL
  TO authenticated
  USING (public.is_admin_or_editor(auth.uid()));

-- App settings policies
CREATE POLICY "Only admins can view settings"
  ON public.app_settings FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage settings"
  ON public.app_settings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ==========================================
-- Constraints and Indexes
-- ==========================================

-- Add constraint to validate schema
ALTER TABLE public.reports
ADD CONSTRAINT reports_valid_schema_check 
CHECK (validate_report_schema(report_schema));

-- Add indexes for performance
CREATE INDEX idx_reports_schema_meta ON public.reports USING gin ((report_schema->'meta'));
CREATE INDEX idx_reports_schema_slug ON public.reports ((report_schema->'meta'->>'slug'));
CREATE INDEX idx_users_email ON public.users (email);
CREATE INDEX idx_user_roles_role ON public.user_roles (role);

-- ==========================================
-- Initial Data
-- ==========================================

-- Insert default settings
INSERT INTO public.app_settings (id, timezone)
VALUES (1, 'UTC');

-- Create default admin user (password: admin123)
INSERT INTO public.users (id, email, password_hash, email_confirmed_at, is_super_admin)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'admin@example.com',
  '$2a$10$II1oY4f/PntIIkkDX53tFOiePrvbwLgLHfhDiXmMzwDgl5Azq6SBu', -- admin123
  NOW(),
  TRUE
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  email_confirmed_at = EXCLUDED.email_confirmed_at,
  is_super_admin = EXCLUDED.is_super_admin;

-- Assign admin role
INSERT INTO public.user_roles (user_id, role)
VALUES ('00000000-0000-0000-0000-000000000001', 'admin');

-- Seed sections
INSERT INTO public.sections (id, name, sort_index, created_by) VALUES
('00000000-0000-0000-0000-000000000001', 'Movement', 1, '00000000-0000-0000-0000-000000000001'),
('00000000-0000-0000-0000-000000000002', 'Driving Quality', 2, '00000000-0000-0000-0000-000000000001');

-- Grant permissions to authenticated role
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
