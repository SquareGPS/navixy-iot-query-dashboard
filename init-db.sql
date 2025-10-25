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
    organization_name TEXT DEFAULT 'Reports MVP',
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
  password_hash TEXT NOT NULL,
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
    sort_index INTEGER NOT NULL DEFAULT 0,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Reports table
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subtitle TEXT,
    slug TEXT,
  report_schema JSONB NOT NULL,
    section_id UUID,
    sort_index INTEGER NOT NULL DEFAULT 0,
    created_by UUID,
    updated_by UUID,
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
    schema ? 'title' AND
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

-- ==========================================
-- Indexes
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);
CREATE INDEX IF NOT EXISTS idx_sections_sort_index ON public.sections(sort_index);
CREATE INDEX IF NOT EXISTS idx_reports_section_id ON public.reports(section_id);
CREATE INDEX IF NOT EXISTS idx_reports_sort_index ON public.reports(sort_index);
CREATE INDEX IF NOT EXISTS idx_reports_created_by ON public.reports(created_by);

-- ==========================================
-- Initial Data
-- ==========================================

-- Default app settings
INSERT INTO public.app_settings (id, organization_name, timezone)
VALUES (1, 'Reports MVP', 'UTC')
ON CONFLICT (id) DO UPDATE SET
  organization_name = EXCLUDED.organization_name,
  timezone = EXCLUDED.timezone,
  updated_at = now();

-- Default admin user (password: admin123)
INSERT INTO public.users (id, email, password_hash, email_confirmed_at, is_super_admin)
VALUES (
  '00000000-0000-0000-0000-000000000001'::UUID, 
  'admin@example.com',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- admin123
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
INSERT INTO public.sections (id, name, sort_index, created_by) 
VALUES (
  '00000000-0000-0000-0000-000000000002'::UUID, 
  'Default Section', 
  0, 
  '00000000-0000-0000-0000-000000000001'::UUID
)
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- Demo Data Tables (for testing)
-- ==========================================

-- Vehicles table
CREATE TABLE public.vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id TEXT UNIQUE NOT NULL,
    make TEXT,
    model TEXT,
    year INTEGER,
    color TEXT,
    license_plate TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Trips table
CREATE TABLE public.trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id TEXT NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    start_location TEXT,
    end_location TEXT,
    distance_km DECIMAL(10,2),
    fuel_consumed_liters DECIMAL(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Parking events table
CREATE TABLE public.parking_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id TEXT NOT NULL,
    location TEXT NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Speeding events table
CREATE TABLE public.speeding_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id TEXT NOT NULL,
    speed_kmh INTEGER NOT NULL,
    speed_limit_kmh INTEGER NOT NULL,
    location TEXT,
    event_time TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert sample data
INSERT INTO public.vehicles (vehicle_id, make, model, year, color, license_plate) VALUES
('V001', 'Toyota', 'Camry', 2022, 'Silver', 'ABC-123'),
('V002', 'Honda', 'Civic', 2021, 'Blue', 'XYZ-789'),
('V003', 'Ford', 'Focus', 2023, 'Red', 'DEF-456');

INSERT INTO public.trips (vehicle_id, start_time, end_time, start_location, end_location, distance_km, fuel_consumed_liters) VALUES
('V001', '2024-01-15 08:00:00', '2024-01-15 09:30:00', 'Office', 'Airport', 45.5, 3.2),
('V002', '2024-01-15 10:00:00', '2024-01-15 11:15:00', 'Home', 'Mall', 12.3, 0.8),
('V003', '2024-01-15 14:00:00', '2024-01-15 15:45:00', 'Warehouse', 'Port', 67.8, 4.5);

INSERT INTO public.parking_events (vehicle_id, location, start_time, end_time, duration_minutes) VALUES
('V001', 'Airport Terminal A', '2024-01-15 09:30:00', '2024-01-15 12:00:00', 150),
('V002', 'Mall Parking Lot', '2024-01-15 11:15:00', '2024-01-15 13:30:00', 135),
('V003', 'Port Warehouse', '2024-01-15 15:45:00', '2024-01-15 18:00:00', 135);

INSERT INTO public.speeding_events (vehicle_id, speed_kmh, speed_limit_kmh, location, event_time) VALUES
('V001', 85, 60, 'Highway 101', '2024-01-15 08:45:00'),
('V002', 75, 50, 'Main Street', '2024-01-15 10:30:00'),
('V003', 95, 70, 'Interstate 5', '2024-01-15 15:15:00');

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO danilnezhdanov;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO danilnezhdanov;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO danilnezhdanov;