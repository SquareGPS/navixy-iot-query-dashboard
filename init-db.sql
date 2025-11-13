-- Initialize the reports_app_db database
-- This script sets up the complete database schema for the SQL Report Dashboard

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types
CREATE TYPE public.app_role AS ENUM ('admin', 'editor', 'viewer');

-- ==========================================
-- Tables
-- ==========================================

-- App settings table
CREATE TABLE public.app_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    timezone TEXT DEFAULT 'UTC',
    external_db_url TEXT,
    external_db_host TEXT,
    external_db_port INTEGER DEFAULT 5432,
    external_db_name TEXT,
    external_db_user TEXT,
    external_db_password TEXT,
    external_db_ssl BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Users table
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT, -- Nullable to support token-based authentication
    email_confirmed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    last_sign_in_at TIMESTAMP WITH TIME ZONE,
    raw_user_meta_data JSONB,
    raw_app_meta_data JSONB,
    is_super_admin BOOLEAN DEFAULT false
);

-- User roles table
CREATE TABLE public.user_roles (
    user_id UUID NOT NULL,
    role TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    PRIMARY KEY (user_id, role)
);

-- Sections table
CREATE TABLE public.sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    version INTEGER NOT NULL DEFAULT 1
);

-- Reports table
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subtitle TEXT,
    slug TEXT,
  report_schema JSONB NOT NULL,
    section_id UUID,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    version INTEGER NOT NULL DEFAULT 1
);

-- Global variables table
CREATE TABLE public.global_variables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label TEXT NOT NULL UNIQUE,
    description TEXT,
    value TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ==========================================
-- Foreign Key Constraints
-- ==========================================

ALTER TABLE public.user_roles 
ADD CONSTRAINT fk_user_roles_user_id 
FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.sections 
ADD CONSTRAINT fk_sections_created_by 
FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.reports 
ADD CONSTRAINT fk_reports_section 
FOREIGN KEY (section_id) REFERENCES public.sections(id) ON DELETE SET NULL;

ALTER TABLE public.reports 
ADD CONSTRAINT fk_reports_created_by 
FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.reports 
ADD CONSTRAINT fk_reports_updated_by 
FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- ==========================================
-- Functions
-- ==========================================

-- Mock authentication function for local development
CREATE OR REPLACE FUNCTION public.auth_uid()
RETURNS UUID
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- For local development, return a fixed admin user ID
  -- In production, replace with actual authentication system
  RETURN '00000000-0000-0000-0000-000000000001'::UUID;
END;
$$;

-- Check if a user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Check if a user is admin or editor
CREATE OR REPLACE FUNCTION public.is_admin_or_editor(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'editor')
  )
$$;

-- Validate report schema structure
CREATE OR REPLACE FUNCTION public.validate_report_schema(schema JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
BEGIN
  IF schema IS NULL THEN
    RETURN FALSE;
  END IF;
  
  IF NOT (
    schema ? 'meta' AND
    schema ? 'rows' AND
    jsonb_typeof(schema->'rows') = 'array'
  ) THEN
    RETURN FALSE;
  END IF;
  
  IF NOT (
    schema->'meta' ? 'schema_version' AND
    schema->'meta' ? 'last_updated' AND
    schema->'meta' ? 'updated_by'
  ) THEN
    RETURN FALSE;
  END IF;
  
  IF jsonb_array_length(schema->'rows') = 0 THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$;

-- Extract SQL queries from report schema
CREATE OR REPLACE FUNCTION public.get_report_queries(report_uuid UUID)
RETURNS TABLE(query_type TEXT, visual_label TEXT, sql_query TEXT, row_index INTEGER)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
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
    public.reports r,
    jsonb_array_elements(r.report_schema->'rows') WITH ORDINALITY AS rows(row_value, row_idx)
  WHERE 
    r.id = report_uuid
    AND row_value->>'type' IN ('tiles', 'table');
END;
$$;

-- Execute SQL query and return JSONB result
CREATE OR REPLACE FUNCTION public.execute_sql(query TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result JSONB;
BEGIN
  -- For security, you might want to restrict this function in production
  EXECUTE format('SELECT jsonb_agg(row_to_json(t.*)) FROM (%s) t', query) INTO result;
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- ==========================================
-- Row Level Security (RLS)
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_variables ENABLE ROW LEVEL SECURITY;

-- App settings policies
CREATE POLICY "Only admins can view settings" ON public.app_settings
  FOR SELECT USING (has_role(auth_uid(), 'admin'));

CREATE POLICY "Admins can manage settings" ON public.app_settings
  FOR ALL USING (has_role(auth_uid(), 'admin'));

-- User roles policies
CREATE POLICY "Authenticated users can view roles" ON public.user_roles
  FOR SELECT USING (true);

CREATE POLICY "Admins and editors can manage roles" ON public.user_roles
  FOR ALL USING (is_admin_or_editor(auth_uid()));

-- Sections policies
CREATE POLICY "Users can view sections" ON public.sections
  FOR SELECT USING (true);

CREATE POLICY "Admins and editors can manage sections" ON public.sections
  FOR ALL USING (is_admin_or_editor(auth_uid()));

-- Reports policies
CREATE POLICY "Users can view reports" ON public.reports
  FOR SELECT USING (true);

CREATE POLICY "Admins and editors can manage reports" ON public.reports
  FOR ALL USING (is_admin_or_editor(auth_uid()));

-- Global variables policies
CREATE POLICY "Users can view global variables" ON public.global_variables
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage global variables" ON public.global_variables
  FOR ALL USING (has_role(auth_uid(), 'admin'));

-- ==========================================
-- Menu Editor Functions
-- ==========================================

-- Create function to get next sort order for inserting between items
CREATE OR REPLACE FUNCTION public.get_next_sort_order(
  _parent_section_id UUID DEFAULT NULL,
  _after_sort_order INTEGER DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  next_order INTEGER;
BEGIN
  IF _after_sort_order IS NULL THEN
    -- Insert at beginning
    SELECT COALESCE(MIN(sort_order) - 1000, 1000)
    INTO next_order
    FROM public.reports
    WHERE section_id = _parent_section_id 
      AND is_deleted = FALSE;
  ELSE
    -- Insert after specified item
    SELECT COALESCE(MIN(sort_order), _after_sort_order + 2000)
    INTO next_order
    FROM public.reports
    WHERE section_id = _parent_section_id 
      AND is_deleted = FALSE
      AND sort_order > _after_sort_order;
    
    -- If no items after, just add 1000
    IF next_order IS NULL THEN
      next_order := _after_sort_order + 1000;
    ELSE
      -- Calculate midpoint
      next_order := (_after_sort_order + next_order) / 2;
      
      -- If midpoint is same as after_sort_order, renumber the group
      IF next_order = _after_sort_order THEN
        -- Trigger renumbering by returning a special value
        next_order := -1;
      END IF;
    END IF;
  END IF;
  
  RETURN next_order;
END;
$$;

-- Create function to renumber sort orders in a group
CREATE OR REPLACE FUNCTION public.renumber_sort_orders(
  _parent_section_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  rec RECORD;
  new_order INTEGER := 1000;
BEGIN
  -- Renumber reports in the specified container
  FOR rec IN 
    SELECT id 
    FROM public.reports
    WHERE section_id = _parent_section_id 
      AND is_deleted = FALSE
    ORDER BY sort_order
  LOOP
    UPDATE public.reports 
    SET sort_order = new_order
    WHERE id = rec.id;
    
    new_order := new_order + 1000;
  END LOOP;
END;
$$;

-- Create function to get menu tree structure
CREATE OR REPLACE FUNCTION public.get_menu_tree(_include_deleted BOOLEAN DEFAULT FALSE)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'sections', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', id,
          'name', name,
          'sortOrder', sort_order,
          'version', version
        ) ORDER BY sort_order
      )
      FROM (
        SELECT id, name, sort_order, version
        FROM public.sections
        WHERE (_include_deleted = TRUE OR is_deleted = FALSE)
        ORDER BY sort_order
      ) s
    ),
    'rootReports', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', id,
          'name', title,
          'sortOrder', sort_order,
          'version', version
        ) ORDER BY sort_order
      )
      FROM (
        SELECT id, title, sort_order, version
        FROM public.reports
        WHERE section_id IS NULL 
          AND (_include_deleted = TRUE OR is_deleted = FALSE)
        ORDER BY sort_order
      ) r
    ),
    'sectionReports', (
      SELECT jsonb_object_agg(
        section_id::text,
        reports
      )
      FROM (
        SELECT 
          section_id,
          jsonb_agg(
            jsonb_build_object(
              'id', id,
              'name', title,
              'sortOrder', sort_order,
              'version', version
            ) ORDER BY sort_order
          ) as reports
        FROM public.reports
        WHERE section_id IS NOT NULL 
          AND (_include_deleted = TRUE OR is_deleted = FALSE)
        GROUP BY section_id
      ) grouped_reports
    )
  ) INTO result;
  
  RETURN result;
END;
$$;

-- ==========================================
-- Indexes
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);
CREATE INDEX IF NOT EXISTS idx_sections_sort_order ON public.sections(sort_order);
CREATE INDEX IF NOT EXISTS idx_sections_is_deleted_sort_order ON public.sections(is_deleted, sort_order);
CREATE INDEX IF NOT EXISTS idx_sections_updated_at ON public.sections(updated_at);
CREATE INDEX IF NOT EXISTS idx_reports_section_id ON public.reports(section_id);
CREATE INDEX IF NOT EXISTS idx_reports_sort_order ON public.reports(sort_order);
CREATE INDEX IF NOT EXISTS idx_reports_is_deleted_parent_section_sort_order ON public.reports(is_deleted, section_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_reports_updated_at ON public.reports(updated_at);
CREATE INDEX IF NOT EXISTS idx_reports_created_by ON public.reports(created_by);
CREATE INDEX IF NOT EXISTS idx_global_variables_label ON public.global_variables(label);

-- ==========================================
-- Initial Data
-- ==========================================

-- Default app settings
INSERT INTO public.app_settings (id, timezone)
VALUES (1, 'UTC')
ON CONFLICT (id) DO UPDATE SET
  timezone = EXCLUDED.timezone,
  updated_at = now();

-- Default admin user (password: admin123)
INSERT INTO public.users (id, email, password_hash, email_confirmed_at, is_super_admin)
VALUES (
  '00000000-0000-0000-0000-000000000001'::UUID, 
  'admin@example.com',
  '$2a$10$II1oY4f/PntIIkkDX53tFOiePrvbwLgLHfhDiXmMzwDgl5Azq6SBu', -- admin123
  NOW(),
  true
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  email_confirmed_at = EXCLUDED.email_confirmed_at,
  is_super_admin = EXCLUDED.is_super_admin;

-- Default admin role
INSERT INTO public.user_roles (user_id, role) 
VALUES ('00000000-0000-0000-0000-000000000001'::UUID, 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Default section
INSERT INTO public.sections (id, name, sort_order, created_by) 
VALUES (
  '00000000-0000-0000-0000-000000000002'::UUID, 
  'Default Section', 
  0, 
  '00000000-0000-0000-0000-000000000001'::UUID
)
ON CONFLICT (id) DO NOTHING;


-- ==========================================
-- Database Setup Complete
-- ==========================================

-- Grant permissions
-- Note: The username will be set by POSTGRES_USER environment variable
-- This uses CURRENT_USER to grant permissions to the user that created the database
DO $$
DECLARE
    db_user TEXT;
BEGIN
    -- Get the current database user
    db_user := current_user;
    
    -- Grant permissions to the current user
    EXECUTE format('GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO %I', db_user);
    EXECUTE format('GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO %I', db_user);
    EXECUTE format('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO %I', db_user);
END $$;