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
    user_id UUID NOT NULL,
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
    user_id UUID NOT NULL,
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

ALTER TABLE public.sections 
ADD CONSTRAINT fk_sections_user_id 
FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.reports 
ADD CONSTRAINT fk_reports_section 
FOREIGN KEY (section_id) REFERENCES public.sections(id) ON DELETE SET NULL;

ALTER TABLE public.reports 
ADD CONSTRAINT fk_reports_created_by 
FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.reports 
ADD CONSTRAINT fk_reports_updated_by 
FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.reports 
ADD CONSTRAINT fk_reports_user_id 
FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

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
CREATE POLICY "Users can view their own sections" ON public.sections
  FOR SELECT USING (user_id = auth_uid());

CREATE POLICY "Admins and editors can manage their own sections" ON public.sections
  FOR ALL USING (user_id = auth_uid() AND is_admin_or_editor(auth_uid()));

-- Reports policies
CREATE POLICY "Users can view their own reports" ON public.reports
  FOR SELECT USING (user_id = auth_uid());

CREATE POLICY "Admins and editors can manage their own reports" ON public.reports
  FOR ALL USING (user_id = auth_uid() AND is_admin_or_editor(auth_uid()));

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
  _user_id UUID,
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
    WHERE user_id = _user_id
      AND section_id = _parent_section_id 
      AND is_deleted = FALSE;
  ELSE
    -- Insert after specified item
    SELECT COALESCE(MIN(sort_order), _after_sort_order + 2000)
    INTO next_order
    FROM public.reports
    WHERE user_id = _user_id
      AND section_id = _parent_section_id 
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
  _user_id UUID,
  _parent_section_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  rec RECORD;
  new_order INTEGER := 1000;
BEGIN
  -- Renumber reports in the specified container for the given user
  FOR rec IN 
    SELECT id 
    FROM public.reports
    WHERE user_id = _user_id
      AND section_id = _parent_section_id 
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

-- Create function to get menu tree structure filtered by user_id
CREATE OR REPLACE FUNCTION public.get_menu_tree(_user_id UUID, _include_deleted BOOLEAN DEFAULT FALSE)
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
        WHERE user_id = _user_id
          AND (_include_deleted = TRUE OR is_deleted = FALSE)
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
        WHERE user_id = _user_id
          AND section_id IS NULL 
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
        WHERE user_id = _user_id
          AND section_id IS NOT NULL 
          AND (_include_deleted = TRUE OR is_deleted = FALSE)
        GROUP BY section_id
      ) grouped_reports
    )
  ) INTO result;
  
  RETURN result;
END;
$$;

-- ==========================================
-- Default User Data Function
-- ==========================================

-- Function to create default Fleet Management section and reports for a new user
-- This function uses the complete schemas from schemas/object-status-dashboard-schema.json
-- and schemas/vehicle-mileage-dashboard-schema.json
CREATE OR REPLACE FUNCTION public.create_default_user_data(_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  section_id UUID;
  object_status_schema JSONB;
  vehicle_mileage_schema JSONB;
BEGIN
  -- Create Fleet Management section
  INSERT INTO public.sections (name, sort_order, user_id, created_by)
  VALUES ('Fleet Management', 0, _user_id, _user_id)
  RETURNING id INTO section_id;

  -- Object Status Dashboard schema (complete from schemas/object-status-dashboard-schema.json)
  object_status_schema := $SCHEMA1$
{
  "id": null,
  "uid": "hello-world",
  "tags": ["example", "getting-started"],
  "time": {"to": "now", "from": "now-72h"},
  "links": [],
  "style": "dark",
  "title": "Object Status Dashboard",
  "panels": [
    {"id": 1, "type": "kpi", "title": "Total Registered Objects", "gridPos": {"x": 0, "y": 0, "w": 6, "h": 5}, "options": {"textMode": "auto", "colorMode": "value", "graphMode": "none", "justifyMode": "auto", "orientation": "auto"}, "targets": [], "x-navixy": {"sql": {"params": {}, "statement": "SELECT count(*) FROM raw_business_data.objects WHERE is_deleted IS NOT TRUE"}, "verify": {"max_rows": 1}, "dataset": {"shape": "kpi", "columns": {}}}},
    {"id": 6, "type": "kpi", "title": "Moving", "gridPos": {"x": 6, "y": 0, "w": 6, "h": 5}, "options": {"textMode": "auto"}, "x-navixy": {"sql": {"params": {}, "statement": "SELECT count(*) FROM raw_business_data.objects WHERE is_deleted IS NOT TRUE"}, "verify": {"max_rows": 1000}, "dataset": {"shape": "kpi", "columns": {}}}},
    {"id": 10, "type": "kpi", "title": "Stopped", "gridPos": {"x": 12, "y": 0, "w": 6, "h": 5}, "options": {}, "x-navixy": {"sql": {"params": {}, "statement": "SELECT count(*) FROM raw_business_data.objects WHERE is_deleted IS NOT TRUE"}, "verify": {"max_rows": 1000}, "dataset": {"shape": "kpi", "columns": {}}}},
    {"id": 3, "type": "kpi", "title": "Parked", "gridPos": {"x": 18, "y": 0, "w": 6, "h": 5}, "options": {}, "x-navixy": {"sql": {"params": {}, "statement": "SELECT count(*) FROM raw_business_data.objects WHERE is_deleted IS NOT TRUE"}, "verify": {"max_rows": 10}, "dataset": {"shape": "kpi", "columns": {}}}},
    {"id": 8, "type": "kpi", "title": "No Signal", "gridPos": {"x": 0, "y": 5, "w": 6, "h": 5}, "options": {}, "x-navixy": {"sql": {"params": {}, "statement": "SELECT count(*) FROM raw_business_data.objects WHERE is_deleted IS NOT TRUE"}, "verify": {"max_rows": 3}, "dataset": {"shape": "kpi", "columns": {}}}},
    {"id": 9, "type": "kpi", "title": "Online", "gridPos": {"x": 6, "y": 5, "w": 6, "h": 5}, "options": {}, "x-navixy": {"sql": {"params": {}, "statement": "SELECT count(*) FROM raw_business_data.objects WHERE is_deleted IS NOT TRUE"}, "verify": {"max_rows": 1000}, "dataset": {"shape": "kpi", "columns": {}}}},
    {"id": 2, "type": "kpi", "title": "Standby", "gridPos": {"x": 12, "y": 5, "w": 6, "h": 5}, "options": {}, "x-navixy": {"sql": {"params": {}, "statement": "SELECT count(*) FROM raw_business_data.objects WHERE is_deleted IS NOT TRUE"}, "verify": {"max_rows": 10}, "dataset": {"shape": "kpi", "columns": {}}}},
    {"id": 7, "type": "kpi", "title": "Offline", "gridPos": {"x": 18, "y": 5, "w": 6, "h": 5}, "options": {}, "x-navixy": {"sql": {"params": {}, "statement": "SELECT count(*) FROM raw_business_data.objects WHERE is_deleted IS NOT TRUE"}, "verify": {"max_rows": 1000}, "dataset": {"shape": "kpi", "columns": {}}}},
    {"id": 12, "type": "piechart", "title": "Movement Status Distribution", "gridPos": {"x": 0, "y": 10, "w": 12, "h": 11}, "options": {"pieType": "donut"}, "x-navixy": {"sql": {"params": {}, "statement": "SELECT 'moving' AS moving_status, 10 AS count UNION ALL SELECT 'parked', 20 UNION ALL SELECT 'stopped', 5"}, "verify": {"max_rows": 1000}, "dataset": {"shape": "pie", "columns": {}}}},
    {"id": 11, "type": "table", "title": "Object Status Table", "gridPos": {"x": 0, "y": 21, "w": 24, "h": 14}, "options": {"showHeader": true}, "x-navixy": {"sql": {"params": {}, "statement": "SELECT object_label, 'online' AS connection_status, 'moving' AS moving_status FROM raw_business_data.objects WHERE is_deleted IS NOT TRUE LIMIT 100"}, "verify": {"max_rows": 1000}, "dataset": {"shape": "table", "columns": {}}}},
    {"id": 13, "type": "piechart", "title": "Connection Status Distribution", "gridPos": {"x": 0, "y": 35, "w": 8, "h": 8}, "options": {"pieType": "donut"}, "x-navixy": {"sql": {"params": {}, "statement": "SELECT 'online' AS connection_status, 15 AS count UNION ALL SELECT 'offline', 10 UNION ALL SELECT 'standby', 5"}, "verify": {"max_rows": 1000}, "dataset": {"shape": "pie", "columns": {}}}}
  ],
  "refresh": "30s",
  "version": 1,
  "editable": true,
  "timezone": "browser",
  "x-navixy": {
    "execution": {"dialect": "postgresql", "endpoint": "/api/v1/sql/run", "max_rows": 1000, "read_only": true, "timeout_ms": 5000, "allowed_schemas": ["demo_data"]},
    "parameters": {"bindings": {"to": "${__to}", "from": "${__from}", "tenant_id": "${var_tenant}"}},
    "schemaVersion": "1.0.0"
  },
  "templating": {"list": [{"name": "var_tenant", "type": "constant", "label": "Tenant", "query": "demo-tenant-id", "current": {"text": "Demo Tenant", "value": "demo-tenant-id"}, "options": [{"text": "Demo Tenant", "value": "demo-tenant-id", "selected": true}]}], "enable": true},
  "timepicker": {"now": true, "enable": true, "hidden": false, "collapse": false, "time_options": ["5m", "15m", "1h", "6h", "12h", "24h"], "refresh_intervals": ["5s", "10s", "30s", "1m", "5m", "15m", "30m", "1h"]},
  "annotations": {"list": [{"hide": true, "name": "Annotations & Alerts", "type": "dashboard", "enable": true, "builtIn": 1, "iconColor": "rgba(0, 211, 255, 1)"}]},
  "description": "Object status monitoring dashboard",
  "graphTooltip": 1,
  "schemaVersion": 38
}
$SCHEMA1$;

  -- Vehicle Mileage Dashboard schema (complete from schemas/vehicle-mileage-dashboard-schema.json)
  vehicle_mileage_schema := $SCHEMA2$
{
  "id": 1,
  "uid": "vehicle-mileage",
  "tags": ["example", "getting-started"],
  "time": {"to": "now", "from": "now-72h"},
  "links": [],
  "style": "dark",
  "title": "Vehicle Mileage Dashboard",
  "panels": [
    {"id": 7, "type": "piechart", "title": "Mileage Distribution", "gridPos": {"h": 10, "w": 12, "x": 0, "y": 0}, "options": {"pieType": "donut"}, "x-navixy": {"sql": {"params": {}, "statement": "WITH time_classified_tracks AS (SELECT t.track_distance_meters, CASE WHEN EXTRACT(DOW FROM t.track_start_time) IN (0, 6) THEN 'weekend' WHEN EXTRACT(HOUR FROM t.track_start_time) BETWEEN 9 AND 17 THEN 'work_time' ELSE 'non_work_time' END AS time_category FROM business_data.tracks t WHERE t.track_start_time >= CURRENT_DATE - INTERVAL '1 month' AND t.track_start_time < CURRENT_DATE) SELECT time_category AS category, round(SUM(track_distance_meters) / 1000.0, 0) AS value FROM time_classified_tracks GROUP BY time_category ORDER BY time_category"}, "verify": {"max_rows": 1000}, "dataset": {"shape": "pie", "columns": {}}}},
    {"id": 2, "type": "barchart", "title": "Mileage Distribution By Weeks, km", "gridPos": {"h": 16, "w": 12, "x": 12, "y": 0}, "options": {"valueMode": "color", "displayMode": "gradient", "orientation": "horizontal", "showUnfilled": true}, "x-navixy": {"sql": {"params": {}, "statement": "WITH time_classified_tracks AS (SELECT t.track_distance_meters, DATE_TRUNC('week', t.track_start_time)::DATE AS week_start_date, CASE WHEN EXTRACT(DOW FROM t.track_start_time) IN (0, 6) THEN 'weekend' WHEN EXTRACT(HOUR FROM t.track_start_time) BETWEEN 9 AND 17 THEN 'work_time' ELSE 'non_work_time' END AS time_category FROM business_data.tracks t WHERE t.track_start_time >= CURRENT_DATE - INTERVAL '1 month' AND t.track_start_time < CURRENT_DATE) SELECT week_start_date AS category, ROUND(SUM(track_distance_meters) / 1000.0, 0) AS value, time_category AS series FROM time_classified_tracks GROUP BY week_start_date, time_category ORDER BY week_start_date, time_category"}, "verify": {"max_rows": 10}, "dataset": {"shape": "category_value", "columns": {}}, "visualization": {"stacking": "stacked", "orientation": "vertical", "colorPalette": "modern"}}},
    {"id": 6, "type": "kpi", "title": "Mileage per Vehicle, km", "gridPos": {"h": 6, "w": 6, "x": 0, "y": 10}, "options": {"textMode": "auto"}, "x-navixy": {"sql": {"params": {}, "statement": "WITH vehicle_mileage AS (SELECT t.device_id, SUM(t.track_distance_meters) / 1000.0 AS total_km FROM business_data.tracks t WHERE t.track_start_time >= CURRENT_DATE - INTERVAL '1 month' AND t.track_start_time < CURRENT_DATE GROUP BY t.device_id) SELECT ROUND(AVG(total_km), 0) AS value FROM vehicle_mileage"}, "verify": {"max_rows": 1000}, "dataset": {"shape": "kpi", "columns": {"value": {"type": "number"}}}}},
    {"id": 1, "type": "kpi", "title": "Total Mileage, km", "gridPos": {"h": 6, "w": 6, "x": 6, "y": 10}, "options": {"textMode": "auto", "colorMode": "value", "graphMode": "none", "justifyMode": "auto", "orientation": "auto"}, "x-navixy": {"sql": {"params": {}, "statement": "SELECT ROUND(SUM(t.track_distance_meters) / 1000.0, 0) AS value FROM business_data.tracks t WHERE t.track_start_time >= CURRENT_DATE - INTERVAL '1 month' AND t.track_start_time < CURRENT_DATE"}, "verify": {"max_rows": 1}, "dataset": {"shape": "kpi", "columns": {"value": {"type": "number"}}}}},
    {"id": 9, "type": "timeseries", "title": "Messages Over Time", "gridPos": {"h": 13, "w": 24, "x": 0, "y": 16}, "options": {"legend": {"calcs": [], "placement": "bottom", "showLegend": true, "displayMode": "list"}, "tooltip": {"mode": "single", "sort": "none"}}, "x-navixy": {"sql": {"params": {}, "statement": "WITH daily_mileage_by_department AS (SELECT DATE(t.track_start_time) AS track_date, COALESCE(d.department_label, 'Unknown') AS department_label, SUM(t.track_distance_meters) / 1000.0 AS distance_km FROM business_data.tracks t LEFT JOIN raw_business_data.objects o ON t.device_id = o.device_id LEFT JOIN raw_business_data.employees e ON o.object_id = e.object_id LEFT JOIN raw_business_data.departments d ON d.department_id = e.department_id WHERE t.track_start_time >= CURRENT_DATE - INTERVAL '1 month' AND t.track_start_time < CURRENT_DATE GROUP BY DATE(t.track_start_time), d.department_label) SELECT track_date AS timestamp, ROUND(SUM(CASE WHEN department_label = 'Drivers' THEN distance_km ELSE 0 END), 0) AS \"Drivers\", ROUND(SUM(CASE WHEN department_label = 'Logistics' THEN distance_km ELSE 0 END), 0) AS \"Logistics\", ROUND(SUM(CASE WHEN department_label = 'Sales' THEN distance_km ELSE 0 END), 0) AS \"Sales\" FROM daily_mileage_by_department GROUP BY track_date ORDER BY track_date"}, "verify": {"max_rows": 1000}, "dataset": {"shape": "time_value", "columns": {}}, "visualization": {"lineStyle": "solid", "colorPalette": "modern", "interpolation": "linear", "legendPosition": "top"}}}
  ],
  "refresh": "30s",
  "version": 1,
  "editable": true,
  "timezone": "browser",
  "x-navixy": {
    "execution": {"dialect": "postgresql", "endpoint": "/api/v1/sql/run", "max_rows": 1000, "read_only": true, "timeout_ms": 5000, "allowed_schemas": ["demo_data"]},
    "parameters": {"bindings": {"to": "${__to}", "from": "${__from}", "tenant_id": "${var_tenant}"}},
    "schemaVersion": "1.0.0"
  },
  "templating": {"list": [{"name": "var_tenant", "type": "constant", "label": "Tenant", "query": "demo-tenant-id", "current": {"text": "Demo Tenant", "value": "demo-tenant-id"}, "options": [{"text": "Demo Tenant", "value": "demo-tenant-id", "selected": true}]}], "enable": true},
  "timepicker": {"now": true, "enable": true, "hidden": false, "collapse": false, "time_options": ["5m", "15m", "1h", "6h", "12h", "24h"], "refresh_intervals": ["5s", "10s", "30s", "1m", "5m", "15m", "30m", "1h"]},
  "annotations": {"list": [{"hide": true, "name": "Annotations & Alerts", "type": "dashboard", "enable": true, "builtIn": 1, "iconColor": "rgba(0, 211, 255, 1)"}]},
  "description": "Vehicle mileage tracking dashboard",
  "graphTooltip": 1,
  "schemaVersion": 38
}
$SCHEMA2$;

  -- Insert Object Status Dashboard report
  INSERT INTO public.reports (title, slug, report_schema, section_id, sort_order, user_id, created_by, updated_by)
  VALUES (
    'Object Status Dashboard',
    'object-status-dashboard',
    object_status_schema,
    section_id,
    1000,
    _user_id,
    _user_id,
    _user_id
  );

  -- Insert Vehicle Mileage Dashboard report
  INSERT INTO public.reports (title, slug, report_schema, section_id, sort_order, user_id, created_by, updated_by)
  VALUES (
    'Vehicle Mileage Dashboard',
    'vehicle-mileage-dashboard',
    vehicle_mileage_schema,
    section_id,
    2000,
    _user_id,
    _user_id,
    _user_id
  );
END;
$$;

-- Trigger function to create default data when a new user is created
-- NOTE: Trigger is created at the end of the file, after initial data
CREATE OR REPLACE FUNCTION public.on_user_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create default user data for the new user
  PERFORM create_default_user_data(NEW.id);
  RETURN NEW;
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
CREATE INDEX IF NOT EXISTS idx_sections_user_id ON public.sections(user_id);
CREATE INDEX IF NOT EXISTS idx_sections_user_id_is_deleted ON public.sections(user_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_reports_section_id ON public.reports(section_id);
CREATE INDEX IF NOT EXISTS idx_reports_sort_order ON public.reports(sort_order);
CREATE INDEX IF NOT EXISTS idx_reports_is_deleted_parent_section_sort_order ON public.reports(is_deleted, section_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_reports_updated_at ON public.reports(updated_at);
CREATE INDEX IF NOT EXISTS idx_reports_created_by ON public.reports(created_by);
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON public.reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_user_id_is_deleted ON public.reports(user_id, is_deleted);
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

-- Default section for admin user
INSERT INTO public.sections (id, name, sort_order, user_id, created_by) 
VALUES (
  '00000000-0000-0000-0000-000000000002'::UUID, 
  'Fleet Management', 
  0, 
  '00000000-0000-0000-0000-000000000001'::UUID,
  '00000000-0000-0000-0000-000000000001'::UUID
)
ON CONFLICT (id) DO NOTHING;

-- Default Object Status Dashboard report for admin user
INSERT INTO public.reports (id, title, slug, report_schema, section_id, sort_order, user_id, created_by, updated_by)
VALUES (
  '00000000-0000-0000-0000-000000000003'::UUID,
  'Object Status Dashboard',
  'object-status-dashboard',
  '{
    "id": null,
    "uid": "hello-world",
    "tags": [
      "example",
      "getting-started"
    ],
    "time": {
      "to": "now",
      "from": "now-72h"
    },
    "links": [],
    "style": "dark",
    "title": "Object Status Dashboard",
    "panels": [
      {
        "id": 9,
        "type": "kpi",
        "title": "Online",
        "gridPos": {
          "x": 6,
          "y": 5,
          "w": 6,
          "h": 5
        },
        "options": {
          "legend": {
            "calcs": [],
            "placement": "bottom",
            "showLegend": true,
            "displayMode": "list"
          },
          "tooltip": {
            "mode": "single",
            "sort": "none"
          }
        },
        "targets": [],
        "x-navixy": {
          "sql": {
            "params": {},
            "statement": "WITH \n-- Parameters (can be replaced with variables or substitution)\nparams AS (\n    SELECT \n        2 AS max_idle_speed,\n        3 AS min_idle_detection,\n        1 AS gps_not_updated_min,\n        3 AS gps_not_updated_max,\n        NULL::text[] AS object_labels_filter,\n        NOW()::timestamp AS time_to\n),\n\n-- Calculate derived time parameters\ntime_params AS (\n    SELECT \n        p.*,\n        p.time_to - INTERVAL ''24 hours'' AS time_from,\n        DATE_TRUNC(''day'', p.time_to) AS start_of_selected_day,\n        DATE_TRUNC(''day'', p.time_to) - INTERVAL ''1 day'' AS previous_day\n    FROM params p\n),\n\n-- Device list with optional filtering\ndevice_list AS (\n    SELECT DISTINCT o.device_id \n    FROM raw_business_data.objects o\n    CROSS JOIN time_params tp\n    WHERE o.is_deleted IS NOT TRUE\n      AND (tp.object_labels_filter IS NULL \n           OR o.object_label = ANY(tp.object_labels_filter))\n),\n\n-- Base data from device_daily_snapshots for the target date\ndaily_snapshots AS (\n    SELECT \n        dds.device_id,\n        dds.device_time,\n        dds.platform_time,\n        dds.latitude,\n        dds.longitude,\n        dds.speed,\n        dds.altitude,\n        dds.event_id,\n        ''parked'' AS moving_status,\n        ''offline'' AS connection_status,\n        to_char(dds.device_time, ''YYYY-MM-DD HH24:MI:SS'') AS last_connect_formatted\n    FROM business_data.device_daily_snapshots dds\n    CROSS JOIN time_params tp\n    WHERE dds.device_id IN (SELECT dl.device_id FROM device_list dl)\n      AND dds.device_time < tp.start_of_selected_day\n),\n\n-- Fresh data from tracking_data_core for the same day\ntracking_data_core AS (\n    SELECT DISTINCT ON (tdc.device_id) \n        tdc.device_id,\n        tdc.device_time,\n        tdc.platform_time,\n        tdc.latitude,\n        tdc.longitude,\n        tdc.speed,\n        tdc.altitude,\n        tdc.event_id\n    FROM raw_telematics_data.tracking_data_core tdc\n    CROSS JOIN time_params tp\n    WHERE tdc.device_id IN (SELECT dl.device_id FROM device_list dl)\n      AND tdc.event_id IN (2, 802, 803, 804, 811)\n      AND tdc.device_time < tp.time_to\n      AND tdc.device_time >= tp.time_from\n    ORDER BY tdc.device_id, tdc.device_time DESC\n),\n\n-- Inputs data\ninputs_data AS (\n    SELECT DISTINCT ON (i.device_id) * \n    FROM raw_telematics_data.inputs i\n    CROSS JOIN time_params tp\n    WHERE i.device_id IN (SELECT dl.device_id FROM device_list dl)\n      AND i.event_id IN (2, 802, 803, 804, 811)\n      AND i.device_time < tp.time_to\n      AND i.device_time >= tp.time_from\n    ORDER BY i.device_id, i.device_time DESC\n),\n\n-- Recent states\nrecent_states AS (\n    SELECT DISTINCT ON (s.device_id)\n        s.device_id,\n        s.event_id,\n        s.device_time,\n        s.record_added_at,\n        s.state_name,\n        CAST(s.value AS integer) AS is_moving\n    FROM raw_telematics_data.states s\n    CROSS JOIN time_params tp\n    WHERE s.device_id IN (SELECT dl.device_id FROM device_list dl)\n      AND s.device_time < tp.time_to\n      AND s.device_time >= tp.time_from\n      AND s.event_id IN (2, 802, 803, 804, 811)\n      AND s.state_name = ''moving''\n    ORDER BY s.device_id, s.device_time DESC\n),\n\n-- Battery inputs data\nbatery_inputs_data AS (\n    SELECT i.device_id, i.device_time, i.value\n    FROM inputs_data i\n    JOIN raw_business_data.sensor_description sd \n        ON sd.input_label = i.sensor_name \n        AND sd.device_id = i.device_id\n    WHERE sd.sensor_type = ''battery''\n),\n\n-- Combine daily snapshots with fresh tracking data\ncombined_data AS (\n    SELECT \n        dl.device_id,\n        COALESCE(tdc.event_id, ds.event_id) AS event_id,\n        COALESCE(tdc.platform_time, ds.platform_time) AS platform_time,\n        COALESCE(tdc.speed, ds.speed, 0) / 100 AS speed,\n        COALESCE(tdc.latitude, ds.latitude) / 1e7 AS latitude,\n        COALESCE(tdc.longitude, ds.longitude) / 1e7 AS longitude,\n        COALESCE(tdc.altitude, ds.altitude) / 1e7 AS altitude,\n        COALESCE(tdc.device_time, ds.device_time) AS device_time,\n        CASE \n            WHEN COALESCE(tdc.device_time, ds.device_time) IS NULL THEN NULL\n            WHEN tdc.device_id IS NOT NULL THEN\n                CASE \n                    WHEN (COALESCE(tdc.speed, ds.speed, 0) / 100 > tp.max_idle_speed \n                          AND EXTRACT(EPOCH FROM (tp.time_to - COALESCE(tdc.device_time, ds.device_time))) / 60 < tp.min_idle_detection)\n                          OR rs.is_moving = 1 \n                        THEN ''moving''\n                    WHEN EXTRACT(EPOCH FROM (tp.time_to - COALESCE(tdc.device_time, ds.device_time))) / 60 < tp.min_idle_detection \n                        THEN ''stopped''\n                    ELSE ''parked''\n                END\n            ELSE ds.moving_status\n        END AS moving_status,\n        CASE \n            WHEN COALESCE(tdc.device_time, ds.device_time) IS NULL THEN ''no signal''\n            WHEN tdc.device_id IS NOT NULL THEN\n                CASE \n                    WHEN EXTRACT(EPOCH FROM (tp.time_to - COALESCE(tdc.device_time, ds.device_time))) / 60 <= tp.gps_not_updated_min \n                        THEN ''online''\n                    WHEN EXTRACT(EPOCH FROM (tp.time_to - COALESCE(tdc.device_time, ds.device_time))) / 60 <= tp.gps_not_updated_max \n                        THEN ''standby''\n                    ELSE ''offline''\n                END\n            ELSE ds.connection_status\n        END AS connection_status,\n        to_char(COALESCE(tdc.device_time, ds.device_time), ''YYYY-MM-DD HH24:MI:SS'') AS last_connect_formatted\n    FROM time_params tp\n    CROSS JOIN device_list dl\n    LEFT JOIN daily_snapshots ds ON dl.device_id = ds.device_id\n    LEFT JOIN tracking_data_core tdc ON dl.device_id = tdc.device_id\n    LEFT JOIN recent_states rs \n        ON dl.device_id = rs.device_id \n        AND COALESCE(tdc.device_time, ds.device_time) = rs.device_time\n),\n\n-- Latest data per device\nlatest_data AS (\n    SELECT DISTINCT ON (device_id) *\n    FROM combined_data\n    ORDER BY device_id, device_time DESC NULLS LAST\n),\n\n-- Latest data with geo information\nlatest_data_with_geo AS (\n    SELECT \n        ld.*, \n        zg.zone_label,\n        ''https://maps.google.com/?q='' || ld.latitude || '','' || ld.longitude AS google_maps_link\n    FROM latest_data ld \n    LEFT JOIN business_data.zones_geom zg\n        ON ST_DWithin(\n            ST_SetSRID(ST_MakePoint(ld.longitude::float8, ld.latitude::float8), 4326)::geography,\n            zg.zone_geom,\n            0\n        )\n)\n\n\n-- Final result\nSELECT\n    count(o.object_label)\nFROM raw_business_data.objects AS o\nLEFT JOIN latest_data_with_geo ld ON o.device_id = ld.device_id\nLEFT JOIN batery_inputs_data b \n    ON ld.device_id = b.device_id \n    AND ld.device_time = b.device_time\nLEFT JOIN raw_business_data.employees AS e ON o.object_id = e.object_id\nLEFT JOIN raw_business_data.groups AS g ON o.group_id = g.group_id\nLEFT JOIN raw_business_data.devices AS d ON d.device_id = ld.device_id\nLEFT JOIN raw_business_data.vehicles AS v ON v.object_id = o.object_id\nLEFT JOIN raw_business_data.garages AS ga ON v.garage_id = ga.garage_id\nLEFT JOIN raw_business_data.departments AS dp ON e.department_id = dp.department_id\nLEFT JOIN (\n    SELECT DISTINCT ON (object_id) *\n    FROM raw_business_data.driver_history\n    ORDER BY object_id, record_added_at DESC\n) dh ON dh.object_id = o.object_id\nWHERE o.is_deleted IS NOT true\nAND ld.connection_status = ''online''"
          },
          "verify": {
            "max_rows": 1000
          },
          "dataset": {
            "shape": "kpi",
            "columns": {}
          },
          "visualization": {
            "lineStyle": "solid",
            "colorPalette": "modern",
            "interpolation": "smooth",
            "legendPosition": "top"
          }
        },
        "datasource": null,
        "fieldConfig": {
          "defaults": {
            "unit": "short",
            "color": {
              "mode": "palette-classic"
            },
            "custom": {
              "stacking": {
                "mode": "none",
                "group": "A"
              },
              "drawStyle": "line",
              "lineWidth": 1,
              "spanNulls": false,
              "showPoints": "auto",
              "fillOpacity": 10,
              "gradientMode": "none",
              "axisPlacement": "auto",
              "lineInterpolation": "linear"
            },
            "mappings": [],
            "thresholds": {
              "mode": "absolute",
              "steps": [
                {
                  "color": "green",
                  "value": null
                }
              ]
            }
          },
          "overrides": []
        }
      },
      {
        "id": 1,
        "type": "kpi",
        "title": "Total Registered Objects",
        "gridPos": {
          "x": 0,
          "y": 0,
          "w": 6,
          "h": 5
        },
        "options": {
          "textMode": "auto",
          "colorMode": "value",
          "graphMode": "none",
          "justifyMode": "auto",
          "orientation": "auto"
        },
        "targets": [],
        "x-navixy": {
          "sql": {
            "params": {},
            "statement": "WITH \n-- Parameters (can be replaced with variables or substitution)\nparams AS (\n    SELECT \n        2 AS max_idle_speed,\n        3 AS min_idle_detection,\n        1 AS gps_not_updated_min,\n        3 AS gps_not_updated_max,\n        NULL::text[] AS object_labels_filter,\n        NOW()::timestamp AS time_to\n),\n\n-- Calculate derived time parameters\ntime_params AS (\n    SELECT \n        p.*,\n        p.time_to - INTERVAL ''24 hours'' AS time_from,\n        DATE_TRUNC(''day'', p.time_to) AS start_of_selected_day,\n        DATE_TRUNC(''day'', p.time_to) - INTERVAL ''1 day'' AS previous_day\n    FROM params p\n),\n\n-- Device list with optional filtering\ndevice_list AS (\n    SELECT DISTINCT o.device_id \n    FROM raw_business_data.objects o\n    CROSS JOIN time_params tp\n    WHERE o.is_deleted IS NOT TRUE\n      AND (tp.object_labels_filter IS NULL \n           OR o.object_label = ANY(tp.object_labels_filter))\n),\n\n-- Base data from device_daily_snapshots for the target date\ndaily_snapshots AS (\n    SELECT \n        dds.device_id,\n        dds.device_time,\n        dds.platform_time,\n        dds.latitude,\n        dds.longitude,\n        dds.speed,\n        dds.altitude,\n        dds.event_id,\n        ''parked'' AS moving_status,\n        ''offline'' AS connection_status,\n        to_char(dds.device_time, ''YYYY-MM-DD HH24:MI:SS'') AS last_connect_formatted\n    FROM business_data.device_daily_snapshots dds\n    CROSS JOIN time_params tp\n    WHERE dds.device_id IN (SELECT dl.device_id FROM device_list dl)\n      AND dds.device_time < tp.start_of_selected_day\n),\n\n-- Fresh data from tracking_data_core for the same day\ntracking_data_core AS (\n    SELECT DISTINCT ON (tdc.device_id) \n        tdc.device_id,\n        tdc.device_time,\n        tdc.platform_time,\n        tdc.latitude,\n        tdc.longitude,\n        tdc.speed,\n        tdc.altitude,\n        tdc.event_id\n    FROM raw_telematics_data.tracking_data_core tdc\n    CROSS JOIN time_params tp\n    WHERE tdc.device_id IN (SELECT dl.device_id FROM device_list dl)\n      AND tdc.event_id IN (2, 802, 803, 804, 811)\n      AND tdc.device_time < tp.time_to\n      AND tdc.device_time >= tp.time_from\n    ORDER BY tdc.device_id, tdc.device_time DESC\n),\n\n-- Inputs data\ninputs_data AS (\n    SELECT DISTINCT ON (i.device_id) * \n    FROM raw_telematics_data.inputs i\n    CROSS JOIN time_params tp\n    WHERE i.device_id IN (SELECT dl.device_id FROM device_list dl)\n      AND i.event_id IN (2, 802, 803, 804, 811)\n      AND i.device_time < tp.time_to\n      AND i.device_time >= tp.time_from\n    ORDER BY i.device_id, i.device_time DESC\n),\n\n-- Recent states\nrecent_states AS (\n    SELECT DISTINCT ON (s.device_id)\n        s.device_id,\n        s.event_id,\n        s.device_time,\n        s.record_added_at,\n        s.state_name,\n        CAST(s.value AS integer) AS is_moving\n    FROM raw_telematics_data.states s\n    CROSS JOIN time_params tp\n    WHERE s.device_id IN (SELECT dl.device_id FROM device_list dl)\n      AND s.device_time < tp.time_to\n      AND s.device_time >= tp.time_from\n      AND s.event_id IN (2, 802, 803, 804, 811)\n      AND s.state_name = ''moving''\n    ORDER BY s.device_id, s.device_time DESC\n),\n\n-- Battery inputs data\nbatery_inputs_data AS (\n    SELECT i.device_id, i.device_time, i.value\n    FROM inputs_data i\n    JOIN raw_business_data.sensor_description sd \n        ON sd.input_label = i.sensor_name \n        AND sd.device_id = i.device_id\n    WHERE sd.sensor_type = ''battery''\n),\n\n-- Combine daily snapshots with fresh tracking data\ncombined_data AS (\n    SELECT \n        dl.device_id,\n        COALESCE(tdc.event_id, ds.event_id) AS event_id,\n        COALESCE(tdc.platform_time, ds.platform_time) AS platform_time,\n        COALESCE(tdc.speed, ds.speed, 0) / 100 AS speed,\n        COALESCE(tdc.latitude, ds.latitude) / 1e7 AS latitude,\n        COALESCE(tdc.longitude, ds.longitude) / 1e7 AS longitude,\n        COALESCE(tdc.altitude, ds.altitude) / 1e7 AS altitude,\n        COALESCE(tdc.device_time, ds.device_time) AS device_time,\n        CASE \n            WHEN COALESCE(tdc.device_time, ds.device_time) IS NULL THEN NULL\n            WHEN tdc.device_id IS NOT NULL THEN\n                CASE \n                    WHEN (COALESCE(tdc.speed, ds.speed, 0) / 100 > tp.max_idle_speed \n                          AND EXTRACT(EPOCH FROM (tp.time_to - COALESCE(tdc.device_time, ds.device_time))) / 60 < tp.min_idle_detection)\n                          OR rs.is_moving = 1 \n                        THEN ''moving''\n                    WHEN EXTRACT(EPOCH FROM (tp.time_to - COALESCE(tdc.device_time, ds.device_time))) / 60 < tp.min_idle_detection \n                        THEN ''stopped''\n                    ELSE ''parked''\n                END\n            ELSE ds.moving_status\n        END AS moving_status,\n        CASE \n            WHEN COALESCE(tdc.device_time, ds.device_time) IS NULL THEN ''no signal''\n            WHEN tdc.device_id IS NOT NULL THEN\n                CASE \n                    WHEN EXTRACT(EPOCH FROM (tp.time_to - COALESCE(tdc.device_time, ds.device_time))) / 60 <= tp.gps_not_updated_min \n                        THEN ''online''\n                    WHEN EXTRACT(EPOCH FROM (tp.time_to - COALESCE(tdc.device_time, ds.device_time))) / 60 <= tp.gps_not_updated_max \n                        THEN ''standby''\n                    ELSE ''offline''\n                END\n            ELSE ds.connection_status\n        END AS connection_status,\n        to_char(COALESCE(tdc.device_time, ds.device_time), ''YYYY-MM-DD HH24:MI:SS'') AS last_connect_formatted\n    FROM time_params tp\n    CROSS JOIN device_list dl\n    LEFT JOIN daily_snapshots ds ON dl.device_id = ds.device_id\n    LEFT JOIN tracking_data_core tdc ON dl.device_id = tdc.device_id\n    LEFT JOIN recent_states rs \n        ON dl.device_id = rs.device_id \n        AND COALESCE(tdc.device_time, ds.device_time) = rs.device_time\n),\n\n-- Latest data per device\nlatest_data AS (\n    SELECT DISTINCT ON (device_id) *\n    FROM combined_data\n    ORDER BY device_id, device_time DESC NULLS LAST\n),\n\n-- Latest data with geo information\nlatest_data_with_geo AS (\n    SELECT \n        ld.*, \n        zg.zone_label,\n        ''https://maps.google.com/?q='' || ld.latitude || '','' || ld.longitude AS google_maps_link\n    FROM latest_data ld \n    LEFT JOIN business_data.zones_geom zg\n        ON ST_DWithin(\n            ST_SetSRID(ST_MakePoint(ld.longitude::float8, ld.latitude::float8), 4326)::geography,\n            zg.zone_geom,\n            0\n        )\n)\n\n\n-- Final result\nSELECT\n    count(o.object_label)\nFROM raw_business_data.objects AS o\nLEFT JOIN latest_data_with_geo ld ON o.device_id = ld.device_id\nLEFT JOIN batery_inputs_data b \n    ON ld.device_id = b.device_id \n    AND ld.device_time = b.device_time\nLEFT JOIN raw_business_data.employees AS e ON o.object_id = e.object_id\nLEFT JOIN raw_business_data.groups AS g ON o.group_id = g.group_id\nLEFT JOIN raw_business_data.devices AS d ON d.device_id = ld.device_id\nLEFT JOIN raw_business_data.vehicles AS v ON v.object_id = o.object_id\nLEFT JOIN raw_business_data.garages AS ga ON v.garage_id = ga.garage_id\nLEFT JOIN raw_business_data.departments AS dp ON e.department_id = dp.department_id\nLEFT JOIN (\n    SELECT DISTINCT ON (object_id) *\n    FROM raw_business_data.driver_history\n    ORDER BY object_id, record_added_at DESC\n) dh ON dh.object_id = o.object_id\nWHERE o.is_deleted IS NOT true"
          },
          "verify": {
            "max_rows": 1
          },
          "dataset": {
            "shape": "kpi",
            "columns": {}
          }
        },
        "datasource": null,
        "fieldConfig": {
          "defaults": {
            "unit": "short",
            "color": {
              "mode": "thresholds"
            },
            "thresholds": {
              "mode": "absolute",
              "steps": [
                {
                  "color": "green",
                  "value": null
                }
              ]
            }
          },
          "overrides": []
        }
      },
      {
        "id": 2,
        "type": "kpi",
        "title": "Standby",
        "gridPos": {
          "x": 12,
          "y": 5,
          "w": 6,
          "h": 5
        },
        "options": {
          "valueMode": "color",
          "displayMode": "gradient",
          "orientation": "horizontal",
          "showUnfilled": true
        },
        "targets": [],
        "x-navixy": {
          "sql": {
            "params": {},
            "statement": "WITH \n-- Parameters (can be replaced with variables or substitution)\nparams AS (\n    SELECT \n        2 AS max_idle_speed,\n        3 AS min_idle_detection,\n        1 AS gps_not_updated_min,\n        3 AS gps_not_updated_max,\n        NULL::text[] AS object_labels_filter,\n        NOW()::timestamp AS time_to\n),\n\n-- Calculate derived time parameters\ntime_params AS (\n    SELECT \n        p.*,\n        p.time_to - INTERVAL ''24 hours'' AS time_from,\n        DATE_TRUNC(''day'', p.time_to) AS start_of_selected_day,\n        DATE_TRUNC(''day'', p.time_to) - INTERVAL ''1 day'' AS previous_day\n    FROM params p\n),\n\n-- Device list with optional filtering\ndevice_list AS (\n    SELECT DISTINCT o.device_id \n    FROM raw_business_data.objects o\n    CROSS JOIN time_params tp\n    WHERE o.is_deleted IS NOT TRUE\n      AND (tp.object_labels_filter IS NULL \n           OR o.object_label = ANY(tp.object_labels_filter))\n),\n\n-- Base data from device_daily_snapshots for the target date\ndaily_snapshots AS (\n    SELECT \n        dds.device_id,\n        dds.device_time,\n        dds.platform_time,\n        dds.latitude,\n        dds.longitude,\n        dds.speed,\n        dds.altitude,\n        dds.event_id,\n        ''parked'' AS moving_status,\n        ''offline'' AS connection_status,\n        to_char(dds.device_time, ''YYYY-MM-DD HH24:MI:SS'') AS last_connect_formatted\n    FROM business_data.device_daily_snapshots dds\n    CROSS JOIN time_params tp\n    WHERE dds.device_id IN (SELECT dl.device_id FROM device_list dl)\n      AND dds.device_time < tp.start_of_selected_day\n),\n\n-- Fresh data from tracking_data_core for the same day\ntracking_data_core AS (\n    SELECT DISTINCT ON (tdc.device_id) \n        tdc.device_id,\n        tdc.device_time,\n        tdc.platform_time,\n        tdc.latitude,\n        tdc.longitude,\n        tdc.speed,\n        tdc.altitude,\n        tdc.event_id\n    FROM raw_telematics_data.tracking_data_core tdc\n    CROSS JOIN time_params tp\n    WHERE tdc.device_id IN (SELECT dl.device_id FROM device_list dl)\n      AND tdc.event_id IN (2, 802, 803, 804, 811)\n      AND tdc.device_time < tp.time_to\n      AND tdc.device_time >= tp.time_from\n    ORDER BY tdc.device_id, tdc.device_time DESC\n),\n\n-- Inputs data\ninputs_data AS (\n    SELECT DISTINCT ON (i.device_id) * \n    FROM raw_telematics_data.inputs i\n    CROSS JOIN time_params tp\n    WHERE i.device_id IN (SELECT dl.device_id FROM device_list dl)\n      AND i.event_id IN (2, 802, 803, 804, 811)\n      AND i.device_time < tp.time_to\n      AND i.device_time >= tp.time_from\n    ORDER BY i.device_id, i.device_time DESC\n),\n\n-- Recent states\nrecent_states AS (\n    SELECT DISTINCT ON (s.device_id)\n        s.device_id,\n        s.event_id,\n        s.device_time,\n        s.record_added_at,\n        s.state_name,\n        CAST(s.value AS integer) AS is_moving\n    FROM raw_telematics_data.states s\n    CROSS JOIN time_params tp\n    WHERE s.device_id IN (SELECT dl.device_id FROM device_list dl)\n      AND s.device_time < tp.time_to\n      AND s.device_time >= tp.time_from\n      AND s.event_id IN (2, 802, 803, 804, 811)\n      AND s.state_name = ''moving''\n    ORDER BY s.device_id, s.device_time DESC\n),\n\n-- Battery inputs data\nbatery_inputs_data AS (\n    SELECT i.device_id, i.device_time, i.value\n    FROM inputs_data i\n    JOIN raw_business_data.sensor_description sd \n        ON sd.input_label = i.sensor_name \n        AND sd.device_id = i.device_id\n    WHERE sd.sensor_type = ''battery''\n),\n\n-- Combine daily snapshots with fresh tracking data\ncombined_data AS (\n    SELECT \n        dl.device_id,\n        COALESCE(tdc.event_id, ds.event_id) AS event_id,\n        COALESCE(tdc.platform_time, ds.platform_time) AS platform_time,\n        COALESCE(tdc.speed, ds.speed, 0) / 100 AS speed,\n        COALESCE(tdc.latitude, ds.latitude) / 1e7 AS latitude,\n        COALESCE(tdc.longitude, ds.longitude) / 1e7 AS longitude,\n        COALESCE(tdc.altitude, ds.altitude) / 1e7 AS altitude,\n        COALESCE(tdc.device_time, ds.device_time) AS device_time,\n        CASE \n            WHEN COALESCE(tdc.device_time, ds.device_time) IS NULL THEN NULL\n            WHEN tdc.device_id IS NOT NULL THEN\n                CASE \n                    WHEN (COALESCE(tdc.speed, ds.speed, 0) / 100 > tp.max_idle_speed \n                          AND EXTRACT(EPOCH FROM (tp.time_to - COALESCE(tdc.device_time, ds.device_time))) / 60 < tp.min_idle_detection)\n                          OR rs.is_moving = 1 \n                        THEN ''moving''\n                    WHEN EXTRACT(EPOCH FROM (tp.time_to - COALESCE(tdc.device_time, ds.device_time))) / 60 < tp.min_idle_detection \n                        THEN ''stopped''\n                    ELSE ''parked''\n                END\n            ELSE ds.moving_status\n        END AS moving_status,\n        CASE \n            WHEN COALESCE(tdc.device_time, ds.device_time) IS NULL THEN ''no signal''\n            WHEN tdc.device_id IS NOT NULL THEN\n                CASE \n                    WHEN EXTRACT(EPOCH FROM (tp.time_to - COALESCE(tdc.device_time, ds.device_time))) / 60 <= tp.gps_not_updated_min \n                        THEN ''online''\n                    WHEN EXTRACT(EPOCH FROM (tp.time_to - COALESCE(tdc.device_time, ds.device_time))) / 60 <= tp.gps_not_updated_max \n                        THEN ''standby''\n                    ELSE ''offline''\n                END\n            ELSE ds.connection_status\n        END AS connection_status,\n        to_char(COALESCE(tdc.device_time, ds.device_time), ''YYYY-MM-DD HH24:MI:SS'') AS last_connect_formatted\n    FROM time_params tp\n    CROSS JOIN device_list dl\n    LEFT JOIN daily_snapshots ds ON dl.device_id = ds.device_id\n    LEFT JOIN tracking_data_core tdc ON dl.device_id = tdc.device_id\n    LEFT JOIN recent_states rs \n        ON dl.device_id = rs.device_id \n        AND COALESCE(tdc.device_time, ds.device_time) = rs.device_time\n),\n\n-- Latest data per device\nlatest_data AS (\n    SELECT DISTINCT ON (device_id) *\n    FROM combined_data\n    ORDER BY device_id, device_time DESC NULLS LAST\n),\n\n-- Latest data with geo information\nlatest_data_with_geo AS (\n    SELECT \n        ld.*, \n        zg.zone_label,\n        ''https://maps.google.com/?q='' || ld.latitude || '','' || ld.longitude AS google_maps_link\n    FROM latest_data ld \n    LEFT JOIN business_data.zones_geom zg\n        ON ST_DWithin(\n            ST_SetSRID(ST_MakePoint(ld.longitude::float8, ld.latitude::float8), 4326)::geography,\n            zg.zone_geom,\n            0\n        )\n)\n\n-- Final result\nSELECT\n    count(o.object_label)\nFROM raw_business_data.objects AS o\nLEFT JOIN latest_data_with_geo ld ON o.device_id = ld.device_id\nLEFT JOIN batery_inputs_data b \n    ON ld.device_id = b.device_id \n    AND ld.device_time = b.device_time\nLEFT JOIN raw_business_data.employees AS e ON o.object_id = e.object_id\nLEFT JOIN raw_business_data.groups AS g ON o.group_id = g.group_id\nLEFT JOIN raw_business_data.devices AS d ON d.device_id = ld.device_id\nLEFT JOIN raw_business_data.vehicles AS v ON v.object_id = o.object_id\nLEFT JOIN raw_business_data.garages AS ga ON v.garage_id = ga.garage_id\nLEFT JOIN raw_business_data.departments AS dp ON e.department_id = dp.department_id\nLEFT JOIN (\n    SELECT DISTINCT ON (object_id) *\n    FROM raw_business_data.driver_history\n    ORDER BY object_id, record_added_at DESC\n) dh ON dh.object_id = o.object_id\nWHERE o.is_deleted IS NOT true\nAND ld.connection_status = ''standby''"
          },
          "verify": {
            "max_rows": 10
          },
          "dataset": {
            "shape": "kpi",
            "columns": {}
          },
          "visualization": {
            "orientation": "vertical"
          }
        },
        "datasource": null,
        "fieldConfig": {
          "defaults": {
            "unit": "short",
            "color": {
              "mode": "palette-classic"
            },
            "custom": {
              "hideFrom": {
                "viz": false,
                "legend": false,
                "tooltip": false
              }
            },
            "mappings": [],
            "thresholds": {
              "mode": "absolute",
              "steps": [
                {
                  "color": "green",
                  "value": null
                }
              ]
            }
          },
          "overrides": []
        }
      },
      {
        "id": 3,
        "type": "kpi",
        "title": "Parked",
        "gridPos": {
          "x": 18,
          "y": 0,
          "w": 6,
          "h": 5
        },
        "options": {
          "sortBy": [],
          "showHeader": true
        },
        "targets": [],
        "x-navixy": {
          "sql": {
            "params": {},
            "statement": "WITH \n-- Parameters (can be replaced with variables or substitution)\nparams AS (\n    SELECT \n        2 AS max_idle_speed,\n        3 AS min_idle_detection,\n        1 AS gps_not_updated_min,\n        3 AS gps_not_updated_max,\n        NULL::text[] AS object_labels_filter,\n        NOW()::timestamp AS time_to\n),\n\n-- Calculate derived time parameters\ntime_params AS (\n    SELECT \n        p.*,\n        p.time_to - INTERVAL ''24 hours'' AS time_from,\n        DATE_TRUNC(''day'', p.time_to) AS start_of_selected_day,\n        DATE_TRUNC(''day'', p.time_to) - INTERVAL ''1 day'' AS previous_day\n    FROM params p\n),\n\n-- Device list with optional filtering\ndevice_list AS (\n    SELECT DISTINCT o.device_id \n    FROM raw_business_data.objects o\n    CROSS JOIN time_params tp\n    WHERE o.is_deleted IS NOT TRUE\n      AND (tp.object_labels_filter IS NULL \n           OR o.object_label = ANY(tp.object_labels_filter))\n),\n\n-- Base data from device_daily_snapshots for the target date\ndaily_snapshots AS (\n    SELECT \n        dds.device_id,\n        dds.device_time,\n        dds.platform_time,\n        dds.latitude,\n        dds.longitude,\n        dds.speed,\n        dds.altitude,\n        dds.event_id,\n        ''parked'' AS moving_status,\n        ''offline'' AS connection_status,\n        to_char(dds.device_time, ''YYYY-MM-DD HH24:MI:SS'') AS last_connect_formatted\n    FROM business_data.device_daily_snapshots dds\n    CROSS JOIN time_params tp\n    WHERE dds.device_id IN (SELECT dl.device_id FROM device_list dl)\n      AND dds.device_time < tp.start_of_selected_day\n),\n\n-- Fresh data from tracking_data_core for the same day\ntracking_data_core AS (\n    SELECT DISTINCT ON (tdc.device_id) \n        tdc.device_id,\n        tdc.device_time,\n        tdc.platform_time,\n        tdc.latitude,\n        tdc.longitude,\n        tdc.speed,\n        tdc.altitude,\n        tdc.event_id\n    FROM raw_telematics_data.tracking_data_core tdc\n    CROSS JOIN time_params tp\n    WHERE tdc.device_id IN (SELECT dl.device_id FROM device_list dl)\n      AND tdc.event_id IN (2, 802, 803, 804, 811)\n      AND tdc.device_time < tp.time_to\n      AND tdc.device_time >= tp.time_from\n    ORDER BY tdc.device_id, tdc.device_time DESC\n),\n\n-- Inputs data\ninputs_data AS (\n    SELECT DISTINCT ON (i.device_id) * \n    FROM raw_telematics_data.inputs i\n    CROSS JOIN time_params tp\n    WHERE i.device_id IN (SELECT dl.device_id FROM device_list dl)\n      AND i.event_id IN (2, 802, 803, 804, 811)\n      AND i.device_time < tp.time_to\n      AND i.device_time >= tp.time_from\n    ORDER BY i.device_id, i.device_time DESC\n),\n\n-- Recent states\nrecent_states AS (\n    SELECT DISTINCT ON (s.device_id)\n        s.device_id,\n        s.event_id,\n        s.device_time,\n        s.record_added_at,\n        s.state_name,\n        CAST(s.value AS integer) AS is_moving\n    FROM raw_telematics_data.states s\n    CROSS JOIN time_params tp\n    WHERE s.device_id IN (SELECT dl.device_id FROM device_list dl)\n      AND s.device_time < tp.time_to\n      AND s.device_time >= tp.time_from\n      AND s.event_id IN (2, 802, 803, 804, 811)\n      AND s.state_name = ''moving''\n    ORDER BY s.device_id, s.device_time DESC\n),\n\n-- Battery inputs data\nbatery_inputs_data AS (\n    SELECT i.device_id, i.device_time, i.value\n    FROM inputs_data i\n    JOIN raw_business_data.sensor_description sd \n        ON sd.input_label = i.sensor_name \n        AND sd.device_id = i.device_id\n    WHERE sd.sensor_type = ''battery''\n),\n\n-- Combine daily snapshots with fresh tracking data\ncombined_data AS (\n    SELECT \n        dl.device_id,\n        COALESCE(tdc.event_id, ds.event_id) AS event_id,\n        COALESCE(tdc.platform_time, ds.platform_time) AS platform_time,\n        COALESCE(tdc.speed, ds.speed, 0) / 100 AS speed,\n        COALESCE(tdc.latitude, ds.latitude) / 1e7 AS latitude,\n        COALESCE(tdc.longitude, ds.longitude) / 1e7 AS longitude,\n        COALESCE(tdc.altitude, ds.altitude) / 1e7 AS altitude,\n        COALESCE(tdc.device_time, ds.device_time) AS device_time,\n        CASE \n            WHEN COALESCE(tdc.device_time, ds.device_time) IS NULL THEN NULL\n            WHEN tdc.device_id IS NOT NULL THEN\n                CASE \n                    WHEN (COALESCE(tdc.speed, ds.speed, 0) / 100 > tp.max_idle_speed \n                          AND EXTRACT(EPOCH FROM (tp.time_to - COALESCE(tdc.device_time, ds.device_time))) / 60 < tp.min_idle_detection)\n                          OR rs.is_moving = 1 \n                        THEN ''moving''\n                    WHEN EXTRACT(EPOCH FROM (tp.time_to - COALESCE(tdc.device_time, ds.device_time))) / 60 < tp.min_idle_detection \n                        THEN ''stopped''\n                    ELSE ''parked''\n                END\n            ELSE ds.moving_status\n        END AS moving_status,\n        CASE \n            WHEN COALESCE(tdc.device_time, ds.device_time) IS NULL THEN ''no signal''\n            WHEN tdc.device_id IS NOT NULL THEN\n                CASE \n                    WHEN EXTRACT(EPOCH FROM (tp.time_to - COALESCE(tdc.device_time, ds.device_time))) / 60 <= tp.gps_not_updated_min \n                        THEN ''online''\n                    WHEN EXTRACT(EPOCH FROM (tp.time_to - COALESCE(tdc.device_time, ds.device_time))) / 60 <= tp.gps_not_updated_max \n                        THEN ''standby''\n                    ELSE ''offline''\n                END\n            ELSE ds.connection_status\n        END AS connection_status,\n        to_char(COALESCE(tdc.device_time, ds.device_time), ''YYYY-MM-DD HH24:MI:SS'') AS last_connect_formatted\n    FROM time_params tp\n    CROSS JOIN device_list dl\n    LEFT JOIN daily_snapshots ds ON dl.device_id = ds.device_id\n    LEFT JOIN tracking_data_core tdc ON dl.device_id = tdc.device_id\n    LEFT JOIN recent_states rs \n        ON dl.device_id = rs.device_id \n        AND COALESCE(tdc.device_time, ds.device_time) = rs.device_time\n),\n\n-- Latest data per device\nlatest_data AS (\n    SELECT DISTINCT ON (device_id) *\n    FROM combined_data\n    ORDER BY device_id, device_time DESC NULLS LAST\n),\n\n-- Latest data with geo information\nlatest_data_with_geo AS (\n    SELECT \n        ld.*, \n        zg.zone_label,\n        ''https://maps.google.com/?q='' || ld.latitude || '','' || ld.longitude AS google_maps_link\n    FROM latest_data ld \n    LEFT JOIN business_data.zones_geom zg\n        ON ST_DWithin(\n            ST_SetSRID(ST_MakePoint(ld.longitude::float8, ld.latitude::float8), 4326)::geography,\n            zg.zone_geom,\n            0\n        )\n)\n\n-- Final result\nSELECT\n    count(o.object_label)\nFROM raw_business_data.objects AS o\nLEFT JOIN latest_data_with_geo ld ON o.device_id = ld.device_id\nLEFT JOIN batery_inputs_data b \n    ON ld.device_id = b.device_id \n    AND ld.device_time = b.device_time\nLEFT JOIN raw_business_data.employees AS e ON o.object_id = e.object_id\nLEFT JOIN raw_business_data.groups AS g ON o.group_id = g.group_id\nLEFT JOIN raw_business_data.devices AS d ON d.device_id = ld.device_id\nLEFT JOIN raw_business_data.vehicles AS v ON v.object_id = o.object_id\nLEFT JOIN raw_business_data.garages AS ga ON v.garage_id = ga.garage_id\nLEFT JOIN raw_business_data.departments AS dp ON e.department_id = dp.department_id\nLEFT JOIN (\n    SELECT DISTINCT ON (object_id) *\n    FROM raw_business_data.driver_history\n    ORDER BY object_id, record_added_at DESC\n) dh ON dh.object_id = o.object_id\nWHERE o.is_deleted IS NOT true\nAND ld.moving_status = ''moving''"
          },
          "verify": {
            "max_rows": 10
          },
          "dataset": {
            "shape": "kpi",
            "columns": {}
          },
          "visualization": {
            "pageSize": 5
          }
        },
        "datasource": null,
        "fieldConfig": {
          "defaults": {
            "custom": {
              "align": "auto",
              "displayMode": "auto"
            },
            "mappings": [],
            "thresholds": {
              "mode": "absolute",
              "steps": [
                {
                  "color": "green",
                  "value": null
                }
              ]
            }
          },
          "overrides": []
        }
      },
      {
        "id": 6,
        "type": "kpi",
        "title": "Moving",
        "gridPos": {
          "x": 6,
          "y": 0,
          "w": 6,
          "h": 5
        },
        "options": {
          "textMode": "auto"
        },
        "x-navixy": {
          "sql": {
            "params": {},
            "statement": "WITH \n-- Parameters (can be replaced with variables or substitution)\nparams AS (\n    SELECT \n        2 AS max_idle_speed,\n        3 AS min_idle_detection,\n        1 AS gps_not_updated_min,\n        3 AS gps_not_updated_max,\n        NULL::text[] AS object_labels_filter,\n        NOW()::timestamp AS time_to\n),\n\n-- Calculate derived time parameters\ntime_params AS (\n    SELECT \n        p.*,\n        p.time_to - INTERVAL ''24 hours'' AS time_from,\n        DATE_TRUNC(''day'', p.time_to) AS start_of_selected_day,\n        DATE_TRUNC(''day'', p.time_to) - INTERVAL ''1 day'' AS previous_day\n    FROM params p\n),\n\n-- Device list with optional filtering\ndevice_list AS (\n    SELECT DISTINCT o.device_id \n    FROM raw_business_data.objects o\n    CROSS JOIN time_params tp\n    WHERE o.is_deleted IS NOT TRUE\n      AND (tp.object_labels_filter IS NULL \n           OR o.object_label = ANY(tp.object_labels_filter))\n),\n\n-- Base data from device_daily_snapshots for the target date\ndaily_snapshots AS (\n    SELECT \n        dds.device_id,\n        dds.device_time,\n        dds.platform_time,\n        dds.latitude,\n        dds.longitude,\n        dds.speed,\n        dds.altitude,\n        dds.event_id,\n        ''parked'' AS moving_status,\n        ''offline'' AS connection_status,\n        to_char(dds.device_time, ''YYYY-MM-DD HH24:MI:SS'') AS last_connect_formatted\n    FROM business_data.device_daily_snapshots dds\n    CROSS JOIN time_params tp\n    WHERE dds.device_id IN (SELECT dl.device_id FROM device_list dl)\n      AND dds.device_time < tp.start_of_selected_day\n),\n\n-- Fresh data from tracking_data_core for the same day\ntracking_data_core AS (\n    SELECT DISTINCT ON (tdc.device_id) \n        tdc.device_id,\n        tdc.device_time,\n        tdc.platform_time,\n        tdc.latitude,\n        tdc.longitude,\n        tdc.speed,\n        tdc.altitude,\n        tdc.event_id\n    FROM raw_telematics_data.tracking_data_core tdc\n    CROSS JOIN time_params tp\n    WHERE tdc.device_id IN (SELECT dl.device_id FROM device_list dl)\n      AND tdc.event_id IN (2, 802, 803, 804, 811)\n      AND tdc.device_time < tp.time_to\n      AND tdc.device_time >= tp.time_from\n    ORDER BY tdc.device_id, tdc.device_time DESC\n),\n\n-- Inputs data\ninputs_data AS (\n    SELECT DISTINCT ON (i.device_id) * \n    FROM raw_telematics_data.inputs i\n    CROSS JOIN time_params tp\n    WHERE i.device_id IN (SELECT dl.device_id FROM device_list dl)\n      AND i.event_id IN (2, 802, 803, 804, 811)\n      AND i.device_time < tp.time_to\n      AND i.device_time >= tp.time_from\n    ORDER BY i.device_id, i.device_time DESC\n),\n\n-- Recent states\nrecent_states AS (\n    SELECT DISTINCT ON (s.device_id)\n        s.device_id,\n        s.event_id,\n        s.device_time,\n        s.record_added_at,\n        s.state_name,\n        CAST(s.value AS integer) AS is_moving\n    FROM raw_telematics_data.states s\n    CROSS JOIN time_params tp\n    WHERE s.device_id IN (SELECT dl.device_id FROM device_list dl)\n      AND s.device_time < tp.time_to\n      AND s.device_time >= tp.time_from\n      AND s.event_id IN (2, 802, 803, 804, 811)\n      AND s.state_name = ''moving''\n    ORDER BY s.device_id, s.device_time DESC\n),\n\n-- Battery inputs data\nbatery_inputs_data AS (\n    SELECT i.device_id, i.device_time, i.value\n    FROM inputs_data i\n    JOIN raw_business_data.sensor_description sd \n        ON sd.input_label = i.sensor_name \n        AND sd.device_id = i.device_id\n    WHERE sd.sensor_type = ''battery''\n),\n\n-- Combine daily snapshots with fresh tracking data\ncombined_data AS (\n    SELECT \n        dl.device_id,\n        COALESCE(tdc.event_id, ds.event_id) AS event_id,\n        COALESCE(tdc.platform_time, ds.platform_time) AS platform_time,\n        COALESCE(tdc.speed, ds.speed, 0) / 100 AS speed,\n        COALESCE(tdc.latitude, ds.latitude) / 1e7 AS latitude,\n        COALESCE(tdc.longitude, ds.longitude) / 1e7 AS longitude,\n        COALESCE(tdc.altitude, ds.altitude) / 1e7 AS altitude,\n        COALESCE(tdc.device_time, ds.device_time) AS device_time,\n        CASE \n            WHEN COALESCE(tdc.device_time, ds.device_time) IS NULL THEN NULL\n            WHEN tdc.device_id IS NOT NULL THEN\n                CASE \n                    WHEN (COALESCE(tdc.speed, ds.speed, 0) / 100 > tp.max_idle_speed \n                          AND EXTRACT(EPOCH FROM (tp.time_to - COALESCE(tdc.device_time, ds.device_time))) / 60 < tp.min_idle_detection)\n                          OR rs.is_moving = 1 \n                        THEN ''moving''\n                    WHEN EXTRACT(EPOCH FROM (tp.time_to - COALESCE(tdc.device_time, ds.device_time))) / 60 < tp.min_idle_detection \n                        THEN ''stopped''\n                    ELSE ''parked''\n                END\n            ELSE ds.moving_status\n        END AS moving_status,\n        CASE \n            WHEN COALESCE(tdc.device_time, ds.device_time) IS NULL THEN ''no signal''\n            WHEN tdc.device_id IS NOT NULL THEN\n                CASE \n                    WHEN EXTRACT(EPOCH FROM (tp.time_to - COALESCE(tdc.device_time, ds.device_time))) / 60 <= tp.gps_not_updated_min \n                        THEN ''online''\n                    WHEN EXTRACT(EPOCH FROM (tp.time_to - COALESCE(tdc.device_time, ds.device_time))) / 60 <= tp.gps_not_updated_max \n                        THEN ''standby''\n                    ELSE ''offline''\n                END\n            ELSE ds.connection_status\n        END AS connection_status,\n        to_char(COALESCE(tdc.device_time, ds.device_time), ''YYYY-MM-DD HH24:MI:SS'') AS last_connect_formatted\n    FROM time_params tp\n    CROSS JOIN device_list dl\n    LEFT JOIN daily_snapshots ds ON dl.device_id = ds.device_id\n    LEFT JOIN tracking_data_core tdc ON dl.device_id = tdc.device_id\n    LEFT JOIN recent_states rs \n        ON dl.device_id = rs.device_id \n        AND COALESCE(tdc.device_time, ds.device_time) = rs.device_time\n),\n\n-- Latest data per device\nlatest_data AS (\n    SELECT DISTINCT ON (device_id) *\n    FROM combined_data\n    ORDER BY device_id, device_time DESC NULLS LAST\n),\n\n-- Latest data with geo information\nlatest_data_with_geo AS (\n    SELECT \n        ld.*, \n        zg.zone_label,\n        ''https://maps.google.com/?q='' || ld.latitude || '','' || ld.longitude AS google_maps_link\n    FROM latest_data ld \n    LEFT JOIN business_data.zones_geom zg\n        ON ST_DWithin(\n            ST_SetSRID(ST_MakePoint(ld.longitude::float8, ld.latitude::float8), 4326)::geography,\n            zg.zone_geom,\n            0\n        )\n)\n\n-- Final result\nSELECT\n    count(o.object_label)\nFROM raw_business_data.objects AS o\nLEFT JOIN latest_data_with_geo ld ON o.device_id = ld.device_id\nLEFT JOIN batery_inputs_data b \n    ON ld.device_id = b.device_id \n    AND ld.device_time = b.device_time\nLEFT JOIN raw_business_data.employees AS e ON o.object_id = e.object_id\nLEFT JOIN raw_business_data.groups AS g ON o.group_id = g.group_id\nLEFT JOIN raw_business_data.devices AS d ON d.device_id = ld.device_id\nLEFT JOIN raw_business_data.vehicles AS v ON v.object_id = o.object_id\nLEFT JOIN raw_business_data.garages AS ga ON v.garage_id = ga.garage_id\nLEFT JOIN raw_business_data.departments AS dp ON e.department_id = dp.department_id\nLEFT JOIN (\n    SELECT DISTINCT ON (object_id) *\n    FROM raw_business_data.driver_history\n    ORDER BY object_id, record_added_at DESC\n) dh ON dh.object_id = o.object_id\nWHERE o.is_deleted IS NOT true\nAND ld.moving_status = ''moving''"
          },
          "verify": {
            "max_rows": 1000
          },
          "dataset": {
            "shape": "kpi",
            "columns": {}
          }
        }
      },
      {
        "id": 7,
        "type": "kpi",
        "title": "Offline",
        "gridPos": {
          "x": 18,
          "y": 5,
          "w": 6,
          "h": 5
        },
        "options": {
          "pieType": "donut"
        },
        "x-navixy": {
          "sql": {
            "params": {},
            "statement": "WITH \n-- Parameters (can be replaced with variables or substitution)\nparams AS (\n    SELECT \n        2 AS max_idle_speed,\n        3 AS min_idle_detection,\n        1 AS gps_not_updated_min,\n        3 AS gps_not_updated_max,\n        NULL::text[] AS object_labels_filter,\n        NOW()::timestamp AS time_to\n),\n\n-- Calculate derived time parameters\ntime_params AS (\n    SELECT \n        p.*,\n        p.time_to - INTERVAL ''24 hours'' AS time_from,\n        DATE_TRUNC(''day'', p.time_to) AS start_of_selected_day,\n        DATE_TRUNC(''day'', p.time_to) - INTERVAL ''1 day'' AS previous_day\n    FROM params p\n),\n\n-- Device list with optional filtering\ndevice_list AS (\n    SELECT DISTINCT o.device_id \n    FROM raw_business_data.objects o\n    CROSS JOIN time_params tp\n    WHERE o.is_deleted IS NOT TRUE\n      AND (tp.object_labels_filter IS NULL \n           OR o.object_label = ANY(tp.object_labels_filter))\n),\n\n-- Base data from device_daily_snapshots for the target date\ndaily_snapshots AS (\n    SELECT \n        dds.device_id,\n        dds.device_time,\n        dds.platform_time,\n        dds.latitude,\n        dds.longitude,\n        dds.speed,\n        dds.altitude,\n        dds.event_id,\n        ''parked'' AS moving_status,\n        ''offline'' AS connection_status,\n        to_char(dds.device_time, ''YYYY-MM-DD HH24:MI:SS'') AS last_connect_formatted\n    FROM business_data.device_daily_snapshots dds\n    CROSS JOIN time_params tp\n    WHERE dds.device_id IN (SELECT dl.device_id FROM device_list dl)\n      AND dds.device_time < tp.start_of_selected_day\n),\n\n-- Fresh data from tracking_data_core for the same day\ntracking_data_core AS (\n    SELECT DISTINCT ON (tdc.device_id) \n        tdc.device_id,\n        tdc.device_time,\n        tdc.platform_time,\n        tdc.latitude,\n        tdc.longitude,\n        tdc.speed,\n        tdc.altitude,\n        tdc.event_id\n    FROM raw_telematics_data.tracking_data_core tdc\n    CROSS JOIN time_params tp\n    WHERE tdc.device_id IN (SELECT dl.device_id FROM device_list dl)\n      AND tdc.event_id IN (2, 802, 803, 804, 811)\n      AND tdc.device_time < tp.time_to\n      AND tdc.device_time >= tp.time_from\n    ORDER BY tdc.device_id, tdc.device_time DESC\n),\n\n-- Inputs data\ninputs_data AS (\n    SELECT DISTINCT ON (i.device_id) * \n    FROM raw_telematics_data.inputs i\n    CROSS JOIN time_params tp\n    WHERE i.device_id IN (SELECT dl.device_id FROM device_list dl)\n      AND i.event_id IN (2, 802, 803, 804, 811)\n      AND i.device_time < tp.time_to\n      AND i.device_time >= tp.time_from\n    ORDER BY i.device_id, i.device_time DESC\n),\n\n-- Recent states\nrecent_states AS (\n    SELECT DISTINCT ON (s.device_id)\n        s.device_id,\n        s.event_id,\n        s.device_time,\n        s.record_added_at,\n        s.state_name,\n        CAST(s.value AS integer) AS is_moving\n    FROM raw_telematics_data.states s\n    CROSS JOIN time_params tp\n    WHERE s.device_id IN (SELECT dl.device_id FROM device_list dl)\n      AND s.device_time < tp.time_to\n      AND s.device_time >= tp.time_from\n      AND s.event_id IN (2, 802, 803, 804, 811)\n      AND s.state_name = ''moving''\n    ORDER BY s.device_id, s.device_time DESC\n),\n\n-- Battery inputs data\nbatery_inputs_data AS (\n    SELECT i.device_id, i.device_time, i.value\n    FROM inputs_data i\n    JOIN raw_business_data.sensor_description sd \n        ON sd.input_label = i.sensor_name \n        AND sd.device_id = i.device_id\n    WHERE sd.sensor_type = ''battery''\n),\n\n-- Combine daily snapshots with fresh tracking data\ncombined_data AS (\n    SELECT \n        dl.device_id,\n        COALESCE(tdc.event_id, ds.event_id) AS event_id,\n        COALESCE(tdc.platform_time, ds.platform_time) AS platform_time,\n        COALESCE(tdc.speed, ds.speed, 0) / 100 AS speed,\n        COALESCE(tdc.latitude, ds.latitude) / 1e7 AS latitude,\n        COALESCE(tdc.longitude, ds.longitude) / 1e7 AS longitude,\n        COALESCE(tdc.altitude, ds.altitude) / 1e7 AS altitude,\n        COALESCE(tdc.device_time, ds.device_time) AS device_time,\n        CASE \n            WHEN COALESCE(tdc.device_time, ds.device_time) IS NULL THEN NULL\n            WHEN tdc.device_id IS NOT NULL THEN\n                CASE \n                    WHEN (COALESCE(tdc.speed, ds.speed, 0) / 100 > tp.max_idle_speed \n                          AND EXTRACT(EPOCH FROM (tp.time_to - COALESCE(tdc.device_time, ds.device_time))) / 60 < tp.min_idle_detection)\n                          OR rs.is_moving = 1 \n                        THEN ''moving''\n                    WHEN EXTRACT(EPOCH FROM (tp.time_to - COALESCE(tdc.device_time, ds.device_time))) / 60 < tp.min_idle_detection \n                        THEN ''stopped''\n                    ELSE ''parked''\n                END\n            ELSE ds.moving_status\n        END AS moving_status,\n        CASE \n            WHEN COALESCE(tdc.device_time, ds.device_time) IS NULL THEN ''no signal''\n            WHEN tdc.device_id IS NOT NULL THEN\n                CASE \n                    WHEN EXTRACT(EPOCH FROM (tp.time_to - COALESCE(tdc.device_time, ds.device_time))) / 60 <= tp.gps_not_updated_min \n                        THEN ''online''\n                    WHEN EXTRACT(EPOCH FROM (tp.time_to - COALESCE(tdc.device_time, ds.device_time))) / 60 <= tp.gps_not_updated_max \n                        THEN ''standby''\n                    ELSE ''offline''\n                END\n            ELSE ds.connection_status\n        END AS connection_status,\n        to_char(COALESCE(tdc.device_time, ds.device_time), ''YYYY-MM-DD HH24:MI:SS'') AS last_connect_formatted\n    FROM time_params tp\n    CROSS JOIN device_list dl\n    LEFT JOIN daily_snapshots ds ON dl.device_id = ds.device_id\n    LEFT JOIN tracking_data_core tdc ON dl.device_id = tdc.device_id\n    LEFT JOIN recent_states rs \n        ON dl.device_id = rs.device_id \n        AND COALESCE(tdc.device_time, ds.device_time) = rs.device_time\n),\n\n-- Latest data per device\nlatest_data AS (\n    SELECT DISTINCT ON (device_id) *\n    FROM combined_data\n    ORDER BY device_id, device_time DESC NULLS LAST\n),\n\n-- Latest data with geo information\nlatest_data_with_geo AS (\n    SELECT \n        ld.*, \n        zg.zone_label,\n        ''https://maps.google.com/?q='' || ld.latitude || '','' || ld.longitude AS google_maps_link\n    FROM latest_data ld \n    LEFT JOIN business_data.zones_geom zg\n        ON ST_DWithin(\n            ST_SetSRID(ST_MakePoint(ld.longitude::float8, ld.latitude::float8), 4326)::geography,\n            zg.zone_geom,\n            0\n        )\n)\n\n-- Final result\nSELECT\n    count(o.object_label)\nFROM raw_business_data.objects AS o\nLEFT JOIN latest_data_with_geo ld ON o.device_id = ld.device_id\nLEFT JOIN batery_inputs_data b \n    ON ld.device_id = b.device_id \n    AND ld.device_time = b.device_time\nLEFT JOIN raw_business_data.employees AS e ON o.object_id = e.object_id\nLEFT JOIN raw_business_data.groups AS g ON o.group_id = g.group_id\nLEFT JOIN raw_business_data.devices AS d ON d.device_id = ld.device_id\nLEFT JOIN raw_business_data.vehicles AS v ON v.object_id = o.object_id\nLEFT JOIN raw_business_data.garages AS ga ON v.garage_id = ga.garage_id\nLEFT JOIN raw_business_data.departments AS dp ON e.department_id = dp.department_id\nLEFT JOIN (\n    SELECT DISTINCT ON (object_id) *\n    FROM raw_business_data.driver_history\n    ORDER BY object_id, record_added_at DESC\n) dh ON dh.object_id = o.object_id\nWHERE o.is_deleted IS NOT true\nAND ld.connection_status = ''offline''"
          },
          "verify": {
            "max_rows": 1000
          },
          "dataset": {
            "shape": "kpi",
            "columns": {}
          }
        }
      },
      {
        "id": 8,
        "type": "kpi",
        "title": "No Signal",
        "gridPos": {
          "x": 0,
          "y": 5,
          "w": 6,
          "h": 5
        },
        "options": {
          "showHeader": true
        },
        "x-navixy": {
          "sql": {
            "params": {},
            "statement": "WITH \n-- Parameters (can be replaced with variables or substitution)\nparams AS (\n    SELECT \n        2 AS max_idle_speed,\n        3 AS min_idle_detection,\n        1 AS gps_not_updated_min,\n        3 AS gps_not_updated_max,\n        NULL::text[] AS object_labels_filter,\n        NOW()::timestamp AS time_to\n),\n\n-- Calculate derived time parameters\ntime_params AS (\n    SELECT \n        p.*,\n        p.time_to - INTERVAL ''24 hours'' AS time_from,\n        DATE_TRUNC(''day'', p.time_to) AS start_of_selected_day,\n        DATE_TRUNC(''day'', p.time_to) - INTERVAL ''1 day'' AS previous_day\n    FROM params p\n),\n\n-- Device list with optional filtering\ndevice_list AS (\n    SELECT DISTINCT o.device_id \n    FROM raw_business_data.objects o\n    CROSS JOIN time_params tp\n    WHERE o.is_deleted IS NOT TRUE\n      AND (tp.object_labels_filter IS NULL \n           OR o.object_label = ANY(tp.object_labels_filter))\n),\n\n-- Base data from device_daily_snapshots for the target date\ndaily_snapshots AS (\n    SELECT \n        dds.device_id,\n        dds.device_time,\n        dds.platform_time,\n        dds.latitude,\n        dds.longitude,\n        dds.speed,\n        dds.altitude,\n        dds.event_id,\n        ''parked'' AS moving_status,\n        ''offline'' AS connection_status,\n        to_char(dds.device_time, ''YYYY-MM-DD HH24:MI:SS'') AS last_connect_formatted\n    FROM business_data.device_daily_snapshots dds\n    CROSS JOIN time_params tp\n    WHERE dds.device_id IN (SELECT dl.device_id FROM device_list dl)\n      AND dds.device_time < tp.start_of_selected_day\n),\n\n-- Fresh data from tracking_data_core for the same day\ntracking_data_core AS (\n    SELECT DISTINCT ON (tdc.device_id) \n        tdc.device_id,\n        tdc.device_time,\n        tdc.platform_time,\n        tdc.latitude,\n        tdc.longitude,\n        tdc.speed,\n        tdc.altitude,\n        tdc.event_id\n    FROM raw_telematics_data.tracking_data_core tdc\n    CROSS JOIN time_params tp\n    WHERE tdc.device_id IN (SELECT dl.device_id FROM device_list dl)\n      AND tdc.event_id IN (2, 802, 803, 804, 811)\n      AND tdc.device_time < tp.time_to\n      AND tdc.device_time >= tp.time_from\n    ORDER BY tdc.device_id, tdc.device_time DESC\n),\n\n-- Inputs data\ninputs_data AS (\n    SELECT DISTINCT ON (i.device_id) * \n    FROM raw_telematics_data.inputs i\n    CROSS JOIN time_params tp\n    WHERE i.device_id IN (SELECT dl.device_id FROM device_list dl)\n      AND i.event_id IN (2, 802, 803, 804, 811)\n      AND i.device_time < tp.time_to\n      AND i.device_time >= tp.time_from\n    ORDER BY i.device_id, i.device_time DESC\n),\n\n-- Recent states\nrecent_states AS (\n    SELECT DISTINCT ON (s.device_id)\n        s.device_id,\n        s.event_id,\n        s.device_time,\n        s.record_added_at,\n        s.state_name,\n        CAST(s.value AS integer) AS is_moving\n    FROM raw_telematics_data.states s\n    CROSS JOIN time_params tp\n    WHERE s.device_id IN (SELECT dl.device_id FROM device_list dl)\n      AND s.device_time < tp.time_to\n      AND s.device_time >= tp.time_from\n      AND s.event_id IN (2, 802, 803, 804, 811)\n      AND s.state_name = ''moving''\n    ORDER BY s.device_id, s.device_time DESC\n),\n\n-- Battery inputs data\nbatery_inputs_data AS (\n    SELECT i.device_id, i.device_time, i.value\n    FROM inputs_data i\n    JOIN raw_business_data.sensor_description sd \n        ON sd.input_label = i.sensor_name \n        AND sd.device_id = i.device_id\n    WHERE sd.sensor_type = ''battery''\n),\n\n-- Combine daily snapshots with fresh tracking data\ncombined_data AS (\n    SELECT \n        dl.device_id,\n        COALESCE(tdc.event_id, ds.event_id) AS event_id,\n        COALESCE(tdc.platform_time, ds.platform_time) AS platform_time,\n        COALESCE(tdc.speed, ds.speed, 0) / 100 AS speed,\n        COALESCE(tdc.latitude, ds.latitude) / 1e7 AS latitude,\n        COALESCE(tdc.longitude, ds.longitude) / 1e7 AS longitude,\n        COALESCE(tdc.altitude, ds.altitude) / 1e7 AS altitude,\n        COALESCE(tdc.device_time, ds.device_time) AS device_time,\n        CASE \n            WHEN COALESCE(tdc.device_time, ds.device_time) IS NULL THEN NULL\n            WHEN tdc.device_id IS NOT NULL THEN\n                CASE \n                    WHEN (COALESCE(tdc.speed, ds.speed, 0) / 100 > tp.max_idle_speed \n                          AND EXTRACT(EPOCH FROM (tp.time_to - COALESCE(tdc.device_time, ds.device_time))) / 60 < tp.min_idle_detection)\n                          OR rs.is_moving = 1 \n                        THEN ''moving''\n                    WHEN EXTRACT(EPOCH FROM (tp.time_to - COALESCE(tdc.device_time, ds.device_time))) / 60 < tp.min_idle_detection \n                        THEN ''stopped''\n                    ELSE ''parked''\n                END\n            ELSE ds.moving_status\n        END AS moving_status,\n        CASE \n            WHEN COALESCE(tdc.device_time, ds.device_time) IS NULL THEN ''no signal''\n            WHEN tdc.device_id IS NOT NULL THEN\n                CASE \n                    WHEN EXTRACT(EPOCH FROM (tp.time_to - COALESCE(tdc.device_time, ds.device_time))) / 60 <= tp.gps_not_updated_min \n                        THEN ''online''\n                    WHEN EXTRACT(EPOCH FROM (tp.time_to - COALESCE(tdc.device_time, ds.device_time))) / 60 <= tp.gps_not_updated_max \n                        THEN ''standby''\n                    ELSE ''offline''\n                END\n            ELSE ds.connection_status\n        END AS connection_status,\n        to_char(COALESCE(tdc.device_time, ds.device_time), ''YYYY-MM-DD HH24:MI:SS'') AS last_connect_formatted\n    FROM time_params tp\n    CROSS JOIN device_list dl\n    LEFT JOIN daily_snapshots ds ON dl.device_id = ds.device_id\n    LEFT JOIN tracking_data_core tdc ON dl.device_id = tdc.device_id\n    LEFT JOIN recent_states rs \n        ON dl.device_id = rs.device_id \n        AND COALESCE(tdc.device_time, ds.device_time) = rs.device_time\n),\n\n-- Latest data per device\nlatest_data AS (\n    SELECT DISTINCT ON (device_id) *\n    FROM combined_data\n    ORDER BY device_id, device_time DESC NULLS LAST\n),\n\n-- Latest data with geo information\nlatest_data_with_geo AS (\n    SELECT \n        ld.*, \n        zg.zone_label,\n        ''https://maps.google.com/?q='' || ld.latitude || '','' || ld.longitude AS google_maps_link\n    FROM latest_data ld \n    LEFT JOIN business_data.zones_geom zg\n        ON ST_DWithin(\n            ST_SetSRID(ST_MakePoint(ld.longitude::float8, ld.latitude::float8), 4326)::geography,\n            zg.zone_geom,\n            0\n        )\n)\n\n-- Final result\nSELECT\n    count(o.object_label)\nFROM raw_business_data.objects AS o\nLEFT JOIN latest_data_with_geo ld ON o.device_id = ld.device_id\nLEFT JOIN batery_inputs_data b \n    ON ld.device_id = b.device_id \n    AND ld.device_time = b.device_time\nLEFT JOIN raw_business_data.employees AS e ON o.object_id = e.object_id\nLEFT JOIN raw_business_data.groups AS g ON o.group_id = g.group_id\nLEFT JOIN raw_business_data.devices AS d ON d.device_id = ld.device_id\nLEFT JOIN raw_business_data.vehicles AS v ON v.object_id = o.object_id\nLEFT JOIN raw_business_data.garages AS ga ON v.garage_id = ga.garage_id\nLEFT JOIN raw_business_data.departments AS dp ON e.department_id = dp.department_id\nLEFT JOIN (\n    SELECT DISTINCT ON (object_id) *\n    FROM raw_business_data.driver_history\n    ORDER BY object_id, record_added_at DESC\n) dh ON dh.object_id = o.object_id\nWHERE o.is_deleted IS NOT true\nAND ld.connection_status = ''no signal'';"
          },
          "verify": {
            "max_rows": 3
          },
          "dataset": {
            "shape": "kpi",
            "columns": {
              "count": {
                "type": "integer"
              }
            }
          },
          "visualization": {
            "pageSize": 25,
            "sortable": true,
            "showHeader": true,
            "showTotals": false,
            "rowHighlighting": "hover"
          }
        }
      },
      {
        "id": 10,
        "type": "kpi",
        "title": "Stopped",
        "gridPos": {
          "x": 12,
          "y": 0,
          "w": 6,
          "h": 5
        },
        "options": {
          "mode": "markdown",
          "content": "This is a **text panel**. Use it for headings, notes, instructions, or links.\n- Supports Markdown\n- Great for section headers and explanations\n_You can replace this content with anything you want._"
        },
        "x-navixy": {
          "sql": {
            "statement": "WITH \r\n-- Parameters (can be replaced with variables or substitution)\r\nparams AS (\r\n    SELECT \r\n        2 AS max_idle_speed,\r\n        3 AS min_idle_detection,\r\n        1 AS gps_not_updated_min,\r\n        3 AS gps_not_updated_max,\r\n        NULL::text[] AS object_labels_filter,\r\n        NOW()::timestamp AS time_to\r\n),\r\n\r\n-- Calculate derived time parameters\r\ntime_params AS (\r\n    SELECT \r\n        p.*,\r\n        p.time_to - INTERVAL ''24 hours'' AS time_from,\r\n        DATE_TRUNC(''day'', p.time_to) AS start_of_selected_day,\r\n        DATE_TRUNC(''day'', p.time_to) - INTERVAL ''1 day'' AS previous_day\r\n    FROM params p\r\n),\r\n\r\n-- Device list with optional filtering\r\ndevice_list AS (\r\n    SELECT DISTINCT o.device_id \r\n    FROM raw_business_data.objects o\r\n    CROSS JOIN time_params tp\r\n    WHERE o.is_deleted IS NOT TRUE\r\n      AND (tp.object_labels_filter IS NULL \r\n           OR o.object_label = ANY(tp.object_labels_filter))\r\n),\r\n\r\n-- Base data from device_daily_snapshots for the target date\r\ndaily_snapshots AS (\r\n    SELECT \r\n        dds.device_id,\r\n        dds.device_time,\r\n        dds.platform_time,\r\n        dds.latitude,\r\n        dds.longitude,\r\n        dds.speed,\r\n        dds.altitude,\r\n        dds.event_id,\r\n        ''parked'' AS moving_status,\r\n        ''offline'' AS connection_status,\r\n        to_char(dds.device_time, ''YYYY-MM-DD HH24:MI:SS'') AS last_connect_formatted\r\n    FROM business_data.device_daily_snapshots dds\r\n    CROSS JOIN time_params tp\r\n    WHERE dds.device_id IN (SELECT dl.device_id FROM device_list dl)\r\n      AND dds.device_time < tp.start_of_selected_day\r\n),\r\n\r\n-- Fresh data from tracking_data_core for the same day\r\ntracking_data_core AS (\r\n    SELECT DISTINCT ON (tdc.device_id) \r\n        tdc.device_id,\r\n        tdc.device_time,\r\n        tdc.platform_time,\r\n        tdc.latitude,\r\n        tdc.longitude,\r\n        tdc.speed,\r\n        tdc.altitude,\r\n        tdc.event_id\r\n    FROM raw_telematics_data.tracking_data_core tdc\r\n    CROSS JOIN time_params tp\r\n    WHERE tdc.device_id IN (SELECT dl.device_id FROM device_list dl)\r\n      AND tdc.event_id IN (2, 802, 803, 804, 811)\r\n      AND tdc.device_time < tp.time_to\r\n      AND tdc.device_time >= tp.time_from\r\n    ORDER BY tdc.device_id, tdc.device_time DESC\r\n),\r\n\r\n-- Inputs data\r\ninputs_data AS (\r\n    SELECT DISTINCT ON (i.device_id) * \r\n    FROM raw_telematics_data.inputs i\r\n    CROSS JOIN time_params tp\r\n    WHERE i.device_id IN (SELECT dl.device_id FROM device_list dl)\r\n      AND i.event_id IN (2, 802, 803, 804, 811)\r\n      AND i.device_time < tp.time_to\r\n      AND i.device_time >= tp.time_from\r\n    ORDER BY i.device_id, i.device_time DESC\r\n),\r\n\r\n-- Recent states\r\nrecent_states AS (\r\n    SELECT DISTINCT ON (s.device_id)\r\n        s.device_id,\r\n        s.event_id,\r\n        s.device_time,\r\n        s.record_added_at,\r\n        s.state_name,\r\n        CAST(s.value AS integer) AS is_moving\r\n    FROM raw_telematics_data.states s\r\n    CROSS JOIN time_params tp\r\n    WHERE s.device_id IN (SELECT dl.device_id FROM device_list dl)\r\n      AND s.device_time < tp.time_to\r\n      AND s.device_time >= tp.time_from\r\n      AND s.event_id IN (2, 802, 803, 804, 811)\r\n      AND s.state_name = ''moving''\r\n    ORDER BY s.device_id, s.device_time DESC\r\n),\r\n\r\n-- Battery inputs data\r\nbatery_inputs_data AS (\r\n    SELECT i.device_id, i.device_time, i.value\r\n    FROM inputs_data i\r\n    JOIN raw_business_data.sensor_description sd \r\n        ON sd.input_label = i.sensor_name \r\n        AND sd.device_id = i.device_id\r\n    WHERE sd.sensor_type = ''battery''\r\n),\r\n\r\n-- Combine daily snapshots with fresh tracking data\r\ncombined_data AS (\r\n    SELECT \r\n        dl.device_id,\r\n        COALESCE(tdc.event_id, ds.event_id) AS event_id,\r\n        COALESCE(tdc.platform_time, ds.platform_time) AS platform_time,\r\n        COALESCE(tdc.speed, ds.speed, 0) / 100 AS speed,\r\n        COALESCE(tdc.latitude, ds.latitude) / 1e7 AS latitude,\r\n        COALESCE(tdc.longitude, ds.longitude) / 1e7 AS longitude,\r\n        COALESCE(tdc.altitude, ds.altitude) / 1e7 AS altitude,\r\n        COALESCE(tdc.device_time, ds.device_time) AS device_time,\r\n        CASE \r\n            WHEN COALESCE(tdc.device_time, ds.device_time) IS NULL THEN NULL\r\n            WHEN tdc.device_id IS NOT NULL THEN\r\n                CASE \r\n                    WHEN (COALESCE(tdc.speed, ds.speed, 0) / 100 > tp.max_idle_speed \r\n                          AND EXTRACT(EPOCH FROM (tp.time_to - COALESCE(tdc.device_time, ds.device_time))) / 60 < tp.min_idle_detection)\r\n                          OR rs.is_moving = 1 \r\n                        THEN ''moving''\r\n                    WHEN EXTRACT(EPOCH FROM (tp.time_to - COALESCE(tdc.device_time, ds.device_time))) / 60 < tp.min_idle_detection \r\n                        THEN ''stopped''\r\n                    ELSE ''parked''\r\n                END\r\n            ELSE ds.moving_status\r\n        END AS moving_status,\r\n        CASE \r\n            WHEN COALESCE(tdc.device_time, ds.device_time) IS NULL THEN ''no signal''\r\n            WHEN tdc.device_id IS NOT NULL THEN\r\n                CASE \r\n                    WHEN EXTRACT(EPOCH FROM (tp.time_to - COALESCE(tdc.device_time, ds.device_time))) / 60 <= tp.gps_not_updated_min \r\n                        THEN ''online''\r\n                    WHEN EXTRACT(EPOCH FROM (tp.time_to - COALESCE(tdc.device_time, ds.device_time))) / 60 <= tp.gps_not_updated_max \r\n                        THEN ''standby''\r\n                    ELSE ''offline''\r\n                END\r\n            ELSE ds.connection_status\r\n        END AS connection_status,\r\n        to_char(COALESCE(tdc.device_time, ds.device_time), ''YYYY-MM-DD HH24:MI:SS'') AS last_connect_formatted\r\n    FROM time_params tp\r\n    CROSS JOIN device_list dl\r\n    LEFT JOIN daily_snapshots ds ON dl.device_id = ds.device_id\r\n    LEFT JOIN tracking_data_core tdc ON dl.device_id = tdc.device_id\r\n    LEFT JOIN recent_states rs \r\n        ON dl.device_id = rs.device_id \r\n        AND COALESCE(tdc.device_time, ds.device_time) = rs.device_time\r\n),\r\n\r\n-- Latest data per device\r\nlatest_data AS (\r\n    SELECT DISTINCT ON (device_id) *\r\n    FROM combined_data\r\n    ORDER BY device_id, device_time DESC NULLS LAST\r\n),\r\n\r\n-- Latest data with geo information\r\nlatest_data_with_geo AS (\r\n    SELECT \r\n        ld.*, \r\n        zg.zone_label,\r\n        ''https://maps.google.com/?q='' || ld.latitude || '','' || ld.longitude AS google_maps_link\r\n    FROM latest_data ld \r\n    LEFT JOIN business_data.zones_geom zg\r\n        ON ST_DWithin(\r\n            ST_SetSRID(ST_MakePoint(ld.longitude::float8, ld.latitude::float8), 4326)::geography,\r\n            zg.zone_geom,\r\n            0\r\n        )\r\n)\r\n\r\n-- Final result\r\nSELECT\r\n    count(o.object_label)\r\nFROM raw_business_data.objects AS o\r\nLEFT JOIN latest_data_with_geo ld ON o.device_id = ld.device_id\r\nLEFT JOIN batery_inputs_data b \r\n    ON ld.device_id = b.device_id \r\n    AND ld.device_time = b.device_time\r\nLEFT JOIN raw_business_data.employees AS e ON o.object_id = e.object_id\r\nLEFT JOIN raw_business_data.groups AS g ON o.group_id = g.group_id\r\nLEFT JOIN raw_business_data.devices AS d ON d.device_id = ld.device_id\r\nLEFT JOIN raw_business_data.vehicles AS v ON v.object_id = o.object_id\r\nLEFT JOIN raw_business_data.garages AS ga ON v.garage_id = ga.garage_id\r\nLEFT JOIN raw_business_data.departments AS dp ON e.department_id = dp.department_id\r\nLEFT JOIN (\r\n    SELECT DISTINCT ON (object_id) *\r\n    FROM raw_business_data.driver_history\r\n    ORDER BY object_id, record_added_at DESC\r\n) dh ON dh.object_id = o.object_id\r\nWHERE o.is_deleted IS NOT true\r\nAND ld.moving_status = ''stopped''",
            "params": {}
          },
          "dataset": {
            "shape": "kpi",
            "columns": {}
          },
          "verify": {
            "max_rows": 1000
          }
        }
      },
      {
        "id": 11,
        "type": "table",
        "title": "Table",
        "gridPos": {
          "x": 0,
          "y": 21,
          "w": 24,
          "h": 14
        },
        "options": {
          "showHeader": true
        },
        "x-navixy": {
          "sql": {
            "statement": "WITH \r\n-- Parameters (can be replaced with variables or substitution)\r\nparams AS (\r\n    SELECT \r\n        2 AS max_idle_speed,\r\n        3 AS min_idle_detection,\r\n        1 AS gps_not_updated_min,\r\n        3 AS gps_not_updated_max,\r\n        NULL::text[] AS object_labels_filter,\r\n        NOW()::timestamp AS time_to\r\n),\r\n\r\n-- Calculate derived time parameters\r\ntime_params AS (\r\n    SELECT \r\n        p.*,\r\n        p.time_to - INTERVAL ''24 hours'' AS time_from,\r\n        DATE_TRUNC(''day'', p.time_to) AS start_of_selected_day,\r\n        DATE_TRUNC(''day'', p.time_to) - INTERVAL ''1 day'' AS previous_day\r\n    FROM params p\r\n),\r\n\r\n-- Device list with optional filtering\r\ndevice_list AS (\r\n    SELECT DISTINCT o.device_id \r\n    FROM raw_business_data.objects o\r\n    CROSS JOIN time_params tp\r\n    WHERE o.is_deleted IS NOT TRUE\r\n      AND (tp.object_labels_filter IS NULL \r\n           OR o.object_label = ANY(tp.object_labels_filter))\r\n),\r\n\r\n-- Base data from device_daily_snapshots for the target date\r\ndaily_snapshots AS (\r\n    SELECT \r\n        dds.device_id,\r\n        dds.device_time,\r\n        dds.platform_time,\r\n        dds.latitude,\r\n        dds.longitude,\r\n        dds.speed,\r\n        dds.altitude,\r\n        dds.event_id,\r\n        ''parked'' AS moving_status,\r\n        ''offline'' AS connection_status,\r\n        to_char(dds.device_time, ''YYYY-MM-DD HH24:MI:SS'') AS last_connect_formatted\r\n    FROM business_data.device_daily_snapshots dds\r\n    CROSS JOIN time_params tp\r\n    WHERE dds.device_id IN (SELECT dl.device_id FROM device_list dl)\r\n      AND dds.device_time < tp.start_of_selected_day\r\n),\r\n\r\n-- Fresh data from tracking_data_core for the same day\r\ntracking_data_core AS (\r\n    SELECT DISTINCT ON (tdc.device_id) \r\n        tdc.device_id,\r\n        tdc.device_time,\r\n        tdc.platform_time,\r\n        tdc.latitude,\r\n        tdc.longitude,\r\n        tdc.speed,\r\n        tdc.altitude,\r\n        tdc.event_id\r\n    FROM raw_telematics_data.tracking_data_core tdc\r\n    CROSS JOIN time_params tp\r\n    WHERE tdc.device_id IN (SELECT dl.device_id FROM device_list dl)\r\n      AND tdc.event_id IN (2, 802, 803, 804, 811)\r\n      AND tdc.device_time < tp.time_to\r\n      AND tdc.device_time >= tp.time_from\r\n    ORDER BY tdc.device_id, tdc.device_time DESC\r\n),\r\n\r\n-- Inputs data\r\ninputs_data AS (\r\n    SELECT DISTINCT ON (i.device_id) * \r\n    FROM raw_telematics_data.inputs i\r\n    CROSS JOIN time_params tp\r\n    WHERE i.device_id IN (SELECT dl.device_id FROM device_list dl)\r\n      AND i.event_id IN (2, 802, 803, 804, 811)\r\n      AND i.device_time < tp.time_to\r\n      AND i.device_time >= tp.time_from\r\n    ORDER BY i.device_id, i.device_time DESC\r\n),\r\n\r\n-- Recent states\r\nrecent_states AS (\r\n    SELECT DISTINCT ON (s.device_id)\r\n        s.device_id,\r\n        s.event_id,\r\n        s.device_time,\r\n        s.record_added_at,\r\n        s.state_name,\r\n        CAST(s.value AS integer) AS is_moving\r\n    FROM raw_telematics_data.states s\r\n    CROSS JOIN time_params tp\r\n    WHERE s.device_id IN (SELECT dl.device_id FROM device_list dl)\r\n      AND s.device_time < tp.time_to\r\n      AND s.device_time >= tp.time_from\r\n      AND s.event_id IN (2, 802, 803, 804, 811)\r\n      AND s.state_name = ''moving''\r\n    ORDER BY s.device_id, s.device_time DESC\r\n),\r\n\r\n-- Battery inputs data\r\nbatery_inputs_data AS (\r\n    SELECT i.device_id, i.device_time, i.value\r\n    FROM inputs_data i\r\n    JOIN raw_business_data.sensor_description sd \r\n        ON sd.input_label = i.sensor_name \r\n        AND sd.device_id = i.device_id\r\n    WHERE sd.sensor_type = ''battery''\r\n),\r\n\r\n-- Combine daily snapshots with fresh tracking data\r\ncombined_data AS (\r\n    SELECT \r\n        dl.device_id,\r\n        COALESCE(tdc.event_id, ds.event_id) AS event_id,\r\n        COALESCE(tdc.platform_time, ds.platform_time) AS platform_time,\r\n        COALESCE(tdc.speed, ds.speed, 0) / 100 AS speed,\r\n        COALESCE(tdc.latitude, ds.latitude) / 1e7 AS latitude,\r\n        COALESCE(tdc.longitude, ds.longitude) / 1e7 AS longitude,\r\n        COALESCE(tdc.altitude, ds.altitude) / 1e7 AS altitude,\r\n        COALESCE(tdc.device_time, ds.device_time) AS device_time,\r\n        CASE \r\n            WHEN COALESCE(tdc.device_time, ds.device_time) IS NULL THEN ''no data''\r\n            WHEN tdc.device_id IS NOT NULL THEN\r\n                CASE \r\n                    WHEN (COALESCE(tdc.speed, ds.speed, 0) / 100 > tp.max_idle_speed \r\n                          AND EXTRACT(EPOCH FROM (tp.time_to - COALESCE(tdc.device_time, ds.device_time))) / 60 < tp.min_idle_detection)\r\n                          OR rs.is_moving = 1 \r\n                        THEN ''moving''\r\n                    WHEN EXTRACT(EPOCH FROM (tp.time_to - COALESCE(tdc.device_time, ds.device_time))) / 60 < tp.min_idle_detection \r\n                        THEN ''stopped''\r\n                    ELSE ''parked''\r\n                END\r\n            ELSE ds.moving_status\r\n        END AS moving_status,\r\n        CASE \r\n            WHEN COALESCE(tdc.device_time, ds.device_time) IS NULL THEN ''no signal''\r\n            WHEN tdc.device_id IS NOT NULL THEN\r\n                CASE \r\n                    WHEN EXTRACT(EPOCH FROM (tp.time_to - COALESCE(tdc.device_time, ds.device_time))) / 60 <= tp.gps_not_updated_min \r\n                        THEN ''online''\r\n                    WHEN EXTRACT(EPOCH FROM (tp.time_to - COALESCE(tdc.device_time, ds.device_time))) / 60 <= tp.gps_not_updated_max \r\n                        THEN ''standby''\r\n                    ELSE ''offline''\r\n                END\r\n            ELSE ds.connection_status\r\n        END AS connection_status,\r\n        to_char(COALESCE(tdc.device_time, ds.device_time), ''YYYY-MM-DD HH24:MI:SS'') AS last_connect_formatted\r\n    FROM time_params tp\r\n    CROSS JOIN device_list dl\r\n    LEFT JOIN daily_snapshots ds ON dl.device_id = ds.device_id\r\n    LEFT JOIN tracking_data_core tdc ON dl.device_id = tdc.device_id\r\n    LEFT JOIN recent_states rs \r\n        ON dl.device_id = rs.device_id \r\n        AND COALESCE(tdc.device_time, ds.device_time) = rs.device_time\r\n),\r\n\r\n-- Latest data per device\r\nlatest_data AS (\r\n    SELECT DISTINCT ON (device_id) *\r\n    FROM combined_data\r\n    ORDER BY device_id, device_time DESC NULLS LAST\r\n),\r\n\r\n-- Latest data with geo information\r\nlatest_data_with_geo AS (\r\n    SELECT \r\n        ld.*, \r\n        zg.zone_label,\r\n        ''https://maps.google.com/?q='' || ld.latitude || '','' || ld.longitude AS google_maps_link\r\n    FROM latest_data ld \r\n    LEFT JOIN business_data.zones_geom zg\r\n        ON ST_DWithin(\r\n            ST_SetSRID(ST_MakePoint(ld.longitude::float8, ld.latitude::float8), 4326)::geography,\r\n            zg.zone_geom,\r\n            0\r\n        )\r\n)\r\n\r\n-- Final result\r\nSELECT DISTINCT ON (o.object_id)\r\n    o.object_label,\r\n    ld.moving_status,\r\n    ld.connection_status,\r\n    o.model,\r\n    e.first_name as first_driver_name,\r\n    e.last_name as last_driver_name,\r\n    ld.speed AS speed,\r\n    ld.last_connect_formatted,\r\n    ld.zone_label,\r\n    ld.google_maps_link,\r\n    dp.address\r\nFROM raw_business_data.objects AS o\r\nLEFT JOIN latest_data_with_geo ld ON o.device_id = ld.device_id\r\nLEFT JOIN batery_inputs_data b \r\n    ON ld.device_id = b.device_id \r\n    AND ld.device_time = b.device_time\r\nLEFT JOIN raw_business_data.employees AS e ON o.object_id = e.object_id\r\nLEFT JOIN raw_business_data.groups AS g ON o.group_id = g.group_id\r\nLEFT JOIN raw_business_data.devices AS d ON d.device_id = ld.device_id\r\nLEFT JOIN raw_business_data.vehicles AS v ON v.object_id = o.object_id\r\nLEFT JOIN raw_business_data.garages AS ga ON v.garage_id = ga.garage_id\r\nLEFT JOIN raw_business_data.departments AS dp ON e.department_id = dp.department_id\r\nLEFT JOIN (\r\n    SELECT DISTINCT ON (object_id) *\r\n    FROM raw_business_data.driver_history\r\n    ORDER BY object_id, record_added_at DESC\r\n) dh ON dh.object_id = o.object_id\r\nWHERE o.is_deleted IS NOT TRUE\r\nORDER BY o.object_id;",
            "params": {}
          },
          "dataset": {
            "shape": "table",
            "columns": {}
          },
          "verify": {
            "max_rows": 1000
          }
        }
      },
      {
        "id": 12,
        "type": "piechart",
        "title": "Movement Status Distribution",
        "gridPos": {
          "x": 0,
          "y": 10,
          "w": 12,
          "h": 11
        },
        "options": {
          "pieType": "donut"
        },
        "x-navixy": {
          "sql": {
            "statement": "WITH \r\n-- Parameters (can be replaced with variables or substitution)\r\nparams AS (\r\n    SELECT \r\n        2 AS max_idle_speed,\r\n        3 AS min_idle_detection,\r\n        1 AS gps_not_updated_min,\r\n        3 AS gps_not_updated_max,\r\n        NULL::text[] AS object_labels_filter,\r\n        NOW()::timestamp AS time_to\r\n),\r\n\r\n-- Calculate derived time parameters\r\ntime_params AS (\r\n    SELECT \r\n        p.*,\r\n        p.time_to - INTERVAL ''24 hours'' AS time_from,\r\n        DATE_TRUNC(''day'', p.time_to) AS start_of_selected_day,\r\n        DATE_TRUNC(''day'', p.time_to) - INTERVAL ''1 day'' AS previous_day\r\n    FROM params p\r\n),\r\n\r\n-- Device list with optional filtering\r\ndevice_list AS (\r\n    SELECT DISTINCT o.device_id \r\n    FROM raw_business_data.objects o\r\n    CROSS JOIN time_params tp\r\n    WHERE o.is_deleted IS NOT TRUE\r\n      AND (tp.object_labels_filter IS NULL \r\n           OR o.object_label = ANY(tp.object_labels_filter))\r\n),\r\n\r\n-- Base data from device_daily_snapshots for the target date\r\ndaily_snapshots AS (\r\n    SELECT \r\n        dds.device_id,\r\n        dds.device_time,\r\n        dds.platform_time,\r\n        dds.latitude,\r\n        dds.longitude,\r\n        dds.speed,\r\n        dds.altitude,\r\n        dds.event_id,\r\n        ''parked'' AS moving_status,\r\n        ''offline'' AS connection_status,\r\n        to_char(dds.device_time, ''YYYY-MM-DD HH24:MI:SS'') AS last_connect_formatted\r\n    FROM business_data.device_daily_snapshots dds\r\n    CROSS JOIN time_params tp\r\n    WHERE dds.device_id IN (SELECT dl.device_id FROM device_list dl)\r\n      AND dds.device_time < tp.start_of_selected_day\r\n),\r\n\r\n-- Fresh data from tracking_data_core for the same day\r\ntracking_data_core AS (\r\n    SELECT DISTINCT ON (tdc.device_id) \r\n        tdc.device_id,\r\n        tdc.device_time,\r\n        tdc.platform_time,\r\n        tdc.latitude,\r\n        tdc.longitude,\r\n        tdc.speed,\r\n        tdc.altitude,\r\n        tdc.event_id\r\n    FROM raw_telematics_data.tracking_data_core tdc\r\n    CROSS JOIN time_params tp\r\n    WHERE tdc.device_id IN (SELECT dl.device_id FROM device_list dl)\r\n      AND tdc.event_id IN (2, 802, 803, 804, 811)\r\n      AND tdc.device_time < tp.time_to\r\n      AND tdc.device_time >= tp.time_from\r\n    ORDER BY tdc.device_id, tdc.device_time DESC\r\n),\r\n\r\n-- Inputs data\r\ninputs_data AS (\r\n    SELECT DISTINCT ON (i.device_id) * \r\n    FROM raw_telematics_data.inputs i\r\n    CROSS JOIN time_params tp\r\n    WHERE i.device_id IN (SELECT dl.device_id FROM device_list dl)\r\n      AND i.event_id IN (2, 802, 803, 804, 811)\r\n      AND i.device_time < tp.time_to\r\n      AND i.device_time >= tp.time_from\r\n    ORDER BY i.device_id, i.device_time DESC\r\n),\r\n\r\n-- Recent states\r\nrecent_states AS (\r\n    SELECT DISTINCT ON (s.device_id)\r\n        s.device_id,\r\n        s.event_id,\r\n        s.device_time,\r\n        s.record_added_at,\r\n        s.state_name,\r\n        CAST(s.value AS integer) AS is_moving\r\n    FROM raw_telematics_data.states s\r\n    CROSS JOIN time_params tp\r\n    WHERE s.device_id IN (SELECT dl.device_id FROM device_list dl)\r\n      AND s.device_time < tp.time_to\r\n      AND s.device_time >= tp.time_from\r\n      AND s.event_id IN (2, 802, 803, 804, 811)\r\n      AND s.state_name = ''moving''\r\n    ORDER BY s.device_id, s.device_time DESC\r\n),\r\n\r\n-- Battery inputs data\r\nbatery_inputs_data AS (\r\n    SELECT i.device_id, i.device_time, i.value\r\n    FROM inputs_data i\r\n    JOIN raw_business_data.sensor_description sd \r\n        ON sd.input_label = i.sensor_name \r\n        AND sd.device_id = i.device_id\r\n    WHERE sd.sensor_type = ''battery''\r\n),\r\n\r\n-- Combine daily snapshots with fresh tracking data\r\ncombined_data AS (\r\n    SELECT \r\n        dl.device_id,\r\n        COALESCE(tdc.event_id, ds.event_id) AS event_id,\r\n        COALESCE(tdc.platform_time, ds.platform_time) AS platform_time,\r\n        COALESCE(tdc.speed, ds.speed, 0) / 100 AS speed,\r\n        COALESCE(tdc.latitude, ds.latitude) / 1e7 AS latitude,\r\n        COALESCE(tdc.longitude, ds.longitude) / 1e7 AS longitude,\r\n        COALESCE(tdc.altitude, ds.altitude) / 1e7 AS altitude,\r\n        COALESCE(tdc.device_time, ds.device_time) AS device_time,\r\n        CASE \r\n            WHEN COALESCE(tdc.device_time, ds.device_time) IS NULL THEN ''no data''\r\n            WHEN tdc.device_id IS NOT NULL THEN\r\n                CASE \r\n                    WHEN (COALESCE(tdc.speed, ds.speed, 0) / 100 > tp.max_idle_speed \r\n                          AND EXTRACT(EPOCH FROM (tp.time_to - COALESCE(tdc.device_time, ds.device_time))) / 60 < tp.min_idle_detection)\r\n                          OR rs.is_moving = 1 \r\n                        THEN ''moving''\r\n                    WHEN EXTRACT(EPOCH FROM (tp.time_to - COALESCE(tdc.device_time, ds.device_time))) / 60 < tp.min_idle_detection \r\n                        THEN ''stopped''\r\n                    ELSE ''parked''\r\n                END\r\n            ELSE ds.moving_status\r\n        END AS moving_status,\r\n        CASE \r\n            WHEN COALESCE(tdc.device_time, ds.device_time) IS NULL THEN ''no signal''\r\n            WHEN tdc.device_id IS NOT NULL THEN\r\n                CASE \r\n                    WHEN EXTRACT(EPOCH FROM (tp.time_to - COALESCE(tdc.device_time, ds.device_time))) / 60 <= tp.gps_not_updated_min \r\n                        THEN ''online''\r\n                    WHEN EXTRACT(EPOCH FROM (tp.time_to - COALESCE(tdc.device_time, ds.device_time))) / 60 <= tp.gps_not_updated_max \r\n                        THEN ''standby''\r\n                    ELSE ''offline''\r\n                END\r\n            ELSE ds.connection_status\r\n        END AS connection_status,\r\n        to_char(COALESCE(tdc.device_time, ds.device_time), ''YYYY-MM-DD HH24:MI:SS'') AS last_connect_formatted\r\n    FROM time_params tp\r\n    CROSS JOIN device_list dl\r\n    LEFT JOIN daily_snapshots ds ON dl.device_id = ds.device_id\r\n    LEFT JOIN tracking_data_core tdc ON dl.device_id = tdc.device_id\r\n    LEFT JOIN recent_states rs \r\n        ON dl.device_id = rs.device_id \r\n        AND COALESCE(tdc.device_time, ds.device_time) = rs.device_time\r\n),\r\n\r\n-- Latest data per device\r\nlatest_data AS (\r\n    SELECT DISTINCT ON (device_id) *\r\n    FROM combined_data\r\n    ORDER BY device_id, device_time DESC NULLS LAST\r\n),\r\n\r\n-- Latest data with geo information\r\nlatest_data_with_geo AS (\r\n    SELECT \r\n        ld.*, \r\n        zg.zone_label,\r\n        ''https://maps.google.com/?q='' || ld.latitude || '','' || ld.longitude AS google_maps_link\r\n    FROM latest_data ld \r\n    LEFT JOIN business_data.zones_geom zg\r\n        ON ST_DWithin(\r\n            ST_SetSRID(ST_MakePoint(ld.longitude::float8, ld.latitude::float8), 4326)::geography,\r\n            zg.zone_geom,\r\n            0\r\n        )\r\n)\r\n-- Final result\r\nSELECT\r\n    ld.moving_status,\r\n    count(o.object_label)\r\nFROM raw_business_data.objects AS o\r\nLEFT JOIN latest_data_with_geo ld ON o.device_id = ld.device_id\r\nLEFT JOIN batery_inputs_data b \r\n    ON ld.device_id = b.device_id \r\n    AND ld.device_time = b.device_time\r\nLEFT JOIN raw_business_data.employees AS e ON o.object_id = e.object_id\r\nLEFT JOIN raw_business_data.groups AS g ON o.group_id = g.group_id\r\nLEFT JOIN raw_business_data.devices AS d ON d.device_id = ld.device_id\r\nLEFT JOIN raw_business_data.vehicles AS v ON v.object_id = o.object_id\r\nLEFT JOIN raw_business_data.garages AS ga ON v.garage_id = ga.garage_id\r\nLEFT JOIN raw_business_data.departments AS dp ON e.department_id = dp.department_id\r\nLEFT JOIN (\r\n    SELECT DISTINCT ON (object_id) *\r\n    FROM raw_business_data.driver_history\r\n    ORDER BY object_id, record_added_at DESC\r\n) dh ON dh.object_id = o.object_id\r\nWHERE o.is_deleted IS NOT TRUE\r\nGROUP BY ld.moving_status;",
            "params": {}
          },
          "dataset": {
            "shape": "pie",
            "columns": {}
          },
          "verify": {
            "max_rows": 1000
          }
        }
      },
      {
        "id": 13,
        "type": "piechart",
        "title": "Connection Status Distribution",
        "gridPos": {
          "x": 0,
          "y": 35,
          "w": 8,
          "h": 8
        },
        "options": {
          "pieType": "donut"
        },
        "x-navixy": {
          "sql": {
            "statement": "WITH \r\n-- Parameters (can be replaced with variables or substitution)\r\nparams AS (\r\n    SELECT \r\n        2 AS max_idle_speed,\r\n        3 AS min_idle_detection,\r\n        1 AS gps_not_updated_min,\r\n        3 AS gps_not_updated_max,\r\n        NULL::text[] AS object_labels_filter,\r\n        NOW()::timestamp AS time_to\r\n),\r\n\r\n-- Calculate derived time parameters\r\ntime_params AS (\r\n    SELECT \r\n        p.*,\r\n        p.time_to - INTERVAL ''24 hours'' AS time_from,\r\n        DATE_TRUNC(''day'', p.time_to) AS start_of_selected_day,\r\n        DATE_TRUNC(''day'', p.time_to) - INTERVAL ''1 day'' AS previous_day\r\n    FROM params p\r\n),\r\n\r\n-- Device list with optional filtering\r\ndevice_list AS (\r\n    SELECT DISTINCT o.device_id \r\n    FROM raw_business_data.objects o\r\n    CROSS JOIN time_params tp\r\n    WHERE o.is_deleted IS NOT TRUE\r\n      AND (tp.object_labels_filter IS NULL \r\n           OR o.object_label = ANY(tp.object_labels_filter))\r\n),\r\n\r\n-- Base data from device_daily_snapshots for the target date\r\ndaily_snapshots AS (\r\n    SELECT \r\n        dds.device_id,\r\n        dds.device_time,\r\n        dds.platform_time,\r\n        dds.latitude,\r\n        dds.longitude,\r\n        dds.speed,\r\n        dds.altitude,\r\n        dds.event_id,\r\n        ''parked'' AS moving_status,\r\n        ''offline'' AS connection_status,\r\n        to_char(dds.device_time, ''YYYY-MM-DD HH24:MI:SS'') AS last_connect_formatted\r\n    FROM business_data.device_daily_snapshots dds\r\n    CROSS JOIN time_params tp\r\n    WHERE dds.device_id IN (SELECT dl.device_id FROM device_list dl)\r\n      AND dds.device_time < tp.start_of_selected_day\r\n),\r\n\r\n-- Fresh data from tracking_data_core for the same day\r\ntracking_data_core AS (\r\n    SELECT DISTINCT ON (tdc.device_id) \r\n        tdc.device_id,\r\n        tdc.device_time,\r\n        tdc.platform_time,\r\n        tdc.latitude,\r\n        tdc.longitude,\r\n        tdc.speed,\r\n        tdc.altitude,\r\n        tdc.event_id\r\n    FROM raw_telematics_data.tracking_data_core tdc\r\n    CROSS JOIN time_params tp\r\n    WHERE tdc.device_id IN (SELECT dl.device_id FROM device_list dl)\r\n      AND tdc.event_id IN (2, 802, 803, 804, 811)\r\n      AND tdc.device_time < tp.time_to\r\n      AND tdc.device_time >= tp.time_from\r\n    ORDER BY tdc.device_id, tdc.device_time DESC\r\n),\r\n\r\n-- Inputs data\r\ninputs_data AS (\r\n    SELECT DISTINCT ON (i.device_id) * \r\n    FROM raw_telematics_data.inputs i\r\n    CROSS JOIN time_params tp\r\n    WHERE i.device_id IN (SELECT dl.device_id FROM device_list dl)\r\n      AND i.event_id IN (2, 802, 803, 804, 811)\r\n      AND i.device_time < tp.time_to\r\n      AND i.device_time >= tp.time_from\r\n    ORDER BY i.device_id, i.device_time DESC\r\n),\r\n\r\n-- Recent states\r\nrecent_states AS (\r\n    SELECT DISTINCT ON (s.device_id)\r\n        s.device_id,\r\n        s.event_id,\r\n        s.device_time,\r\n        s.record_added_at,\r\n        s.state_name,\r\n        CAST(s.value AS integer) AS is_moving\r\n    FROM raw_telematics_data.states s\r\n    CROSS JOIN time_params tp\r\n    WHERE s.device_id IN (SELECT dl.device_id FROM device_list dl)\r\n      AND s.device_time < tp.time_to\r\n      AND s.device_time >= tp.time_from\r\n      AND s.event_id IN (2, 802, 803, 804, 811)\r\n      AND s.state_name = ''moving''\r\n    ORDER BY s.device_id, s.device_time DESC\r\n),\r\n\r\n-- Battery inputs data\r\nbatery_inputs_data AS (\r\n    SELECT i.device_id, i.device_time, i.value\r\n    FROM inputs_data i\r\n    JOIN raw_business_data.sensor_description sd \r\n        ON sd.input_label = i.sensor_name \r\n        AND sd.device_id = i.device_id\r\n    WHERE sd.sensor_type = ''battery''\r\n),\r\n\r\n-- Combine daily snapshots with fresh tracking data\r\ncombined_data AS (\r\n    SELECT \r\n        dl.device_id,\r\n        COALESCE(tdc.event_id, ds.event_id) AS event_id,\r\n        COALESCE(tdc.platform_time, ds.platform_time) AS platform_time,\r\n        COALESCE(tdc.speed, ds.speed, 0) / 100 AS speed,\r\n        COALESCE(tdc.latitude, ds.latitude) / 1e7 AS latitude,\r\n        COALESCE(tdc.longitude, ds.longitude) / 1e7 AS longitude,\r\n        COALESCE(tdc.altitude, ds.altitude) / 1e7 AS altitude,\r\n        COALESCE(tdc.device_time, ds.device_time) AS device_time,\r\n        CASE \r\n            WHEN COALESCE(tdc.device_time, ds.device_time) IS NULL THEN ''no data''\r\n            WHEN tdc.device_id IS NOT NULL THEN\r\n                CASE \r\n                    WHEN (COALESCE(tdc.speed, ds.speed, 0) / 100 > tp.max_idle_speed \r\n                          AND EXTRACT(EPOCH FROM (tp.time_to - COALESCE(tdc.device_time, ds.device_time))) / 60 < tp.min_idle_detection)\r\n                          OR rs.is_moving = 1 \r\n                        THEN ''moving''\r\n                    WHEN EXTRACT(EPOCH FROM (tp.time_to - COALESCE(tdc.device_time, ds.device_time))) / 60 < tp.min_idle_detection \r\n                        THEN ''stopped''\r\n                    ELSE ''parked''\r\n                END\r\n            ELSE ds.moving_status\r\n        END AS moving_status,\r\n        CASE \r\n            WHEN COALESCE(tdc.device_time, ds.device_time) IS NULL THEN ''no signal''\r\n            WHEN tdc.device_id IS NOT NULL THEN\r\n                CASE \r\n                    WHEN EXTRACT(EPOCH FROM (tp.time_to - COALESCE(tdc.device_time, ds.device_time))) / 60 <= tp.gps_not_updated_min \r\n                        THEN ''online''\r\n                    WHEN EXTRACT(EPOCH FROM (tp.time_to - COALESCE(tdc.device_time, ds.device_time))) / 60 <= tp.gps_not_updated_max \r\n                        THEN ''standby''\r\n                    ELSE ''offline''\r\n                END\r\n            ELSE ds.connection_status\r\n        END AS connection_status,\r\n        to_char(COALESCE(tdc.device_time, ds.device_time), ''YYYY-MM-DD HH24:MI:SS'') AS last_connect_formatted\r\n    FROM time_params tp\r\n    CROSS JOIN device_list dl\r\n    LEFT JOIN daily_snapshots ds ON dl.device_id = ds.device_id\r\n    LEFT JOIN tracking_data_core tdc ON dl.device_id = tdc.device_id\r\n    LEFT JOIN recent_states rs \r\n        ON dl.device_id = rs.device_id \r\n        AND COALESCE(tdc.device_time, ds.device_time) = rs.device_time\r\n),\r\n\r\n-- Latest data per device\r\nlatest_data AS (\r\n    SELECT DISTINCT ON (device_id) *\r\n    FROM combined_data\r\n    ORDER BY device_id, device_time DESC NULLS LAST\r\n),\r\n\r\n-- Latest data with geo information\r\nlatest_data_with_geo AS (\r\n    SELECT \r\n        ld.*, \r\n        zg.zone_label,\r\n        ''https://maps.google.com/?q='' || ld.latitude || '','' || ld.longitude AS google_maps_link\r\n    FROM latest_data ld \r\n    LEFT JOIN business_data.zones_geom zg\r\n        ON ST_DWithin(\r\n            ST_SetSRID(ST_MakePoint(ld.longitude::float8, ld.latitude::float8), 4326)::geography,\r\n            zg.zone_geom,\r\n            0\r\n        )\r\n)\r\n-- Final result\r\nSELECT\r\n    ld.connection_status,\r\n    count(o.object_label)\r\nFROM raw_business_data.objects AS o\r\nLEFT JOIN latest_data_with_geo ld ON o.device_id = ld.device_id\r\nLEFT JOIN batery_inputs_data b \r\n    ON ld.device_id = b.device_id \r\n    AND ld.device_time = b.device_time\r\nLEFT JOIN raw_business_data.employees AS e ON o.object_id = e.object_id\r\nLEFT JOIN raw_business_data.groups AS g ON o.group_id = g.group_id\r\nLEFT JOIN raw_business_data.devices AS d ON d.device_id = ld.device_id\r\nLEFT JOIN raw_business_data.vehicles AS v ON v.object_id = o.object_id\r\nLEFT JOIN raw_business_data.garages AS ga ON v.garage_id = ga.garage_id\r\nLEFT JOIN raw_business_data.departments AS dp ON e.department_id = dp.department_id\r\nLEFT JOIN (\r\n    SELECT DISTINCT ON (object_id) *\r\n    FROM raw_business_data.driver_history\r\n    ORDER BY object_id, record_added_at DESC\r\n) dh ON dh.object_id = o.object_id\r\nWHERE o.is_deleted IS NOT TRUE\r\nGROUP BY ld.connection_status;",
            "params": {}
          },
          "dataset": {
            "shape": "pie",
            "columns": {}
          },
          "verify": {
            "max_rows": 1000
          }
        }
      }
    ],
    "refresh": "30s",
    "version": 1,
    "editable": true,
    "timezone": "browser",
    "x-navixy": {
      "execution": {
        "dialect": "postgresql",
        "endpoint": "/api/v1/sql/run",
        "max_rows": 1000,
        "read_only": true,
        "timeout_ms": 5000,
        "allowed_schemas": [
          "demo_data"
        ]
      },
      "parameters": {
        "bindings": {
          "to": "${__to}",
          "from": "${__from}",
          "tenant_id": "${var_tenant}"
        }
      },
      "schemaVersion": "1.0.0"
    },
    "templating": {
      "list": [
        {
          "name": "var_tenant",
          "type": "constant",
          "label": "Tenant",
          "query": "demo-tenant-id",
          "current": {
            "text": "Demo Tenant",
            "value": "demo-tenant-id"
          },
          "options": [
            {
              "text": "Demo Tenant",
              "value": "demo-tenant-id",
              "selected": true
            }
          ]
        }
      ],
      "enable": true
    },
    "timepicker": {
      "now": true,
      "enable": true,
      "hidden": false,
      "collapse": false,
      "time_options": [
        "5m",
        "15m",
        "1h",
        "6h",
        "12h",
        "24h"
      ],
      "refresh_intervals": [
        "5s",
        "10s",
        "30s",
        "1m",
        "5m",
        "15m",
        "30m",
        "1h"
      ]
    },
    "annotations": {
      "list": [
        {
          "hide": true,
          "name": "Annotations & Alerts",
          "type": "dashboard",
          "enable": true,
          "target": {
            "tags": [],
            "type": "dashboard",
            "limit": 100,
            "matchAny": false
          },
          "builtIn": 1,
          "iconColor": "rgba(0, 211, 255, 1)",
          "datasource": {
            "uid": "-- Dashboard --",
            "type": "dashboard"
          }
        }
      ]
    },
    "description": "Simple getting started example dashboard",
    "graphTooltip": 1,
    "schemaVersion": 38
  }'::jsonb,
  '00000000-0000-0000-0000-000000000002'::UUID,
  1000,
  '00000000-0000-0000-0000-000000000001'::UUID,
  '00000000-0000-0000-0000-000000000001'::UUID,
  '00000000-0000-0000-0000-000000000001'::UUID
)
ON CONFLICT (id) DO NOTHING;

-- Default Vehicle Mileage Dashboard report for admin user
INSERT INTO public.reports (id, title, slug, report_schema, section_id, sort_order, user_id, created_by, updated_by)
VALUES (
  '00000000-0000-0000-0000-000000000004'::UUID,
  'Vehicle Mileage Dashboard',
  'vehicle-mileage-dashboard',
  '{
    "id": 1,
    "uid": "vehicle-mileage",
    "tags": [
      "example",
      "getting-started"
    ],
    "time": {
      "to": "now",
      "from": "now-72h"
    },
    "links": [],
    "style": "dark",
    "title": "📊 Vehicle Mileage Dashboard",
    "panels": [
      {
        "id": 9,
        "type": "timeseries",
        "title": "Messages Over Time",
        "gridPos": {
          "h": 13,
          "w": 24,
          "x": 0,
          "y": 16
        },
        "options": {
          "legend": {
            "calcs": [],
            "placement": "bottom",
            "showLegend": true,
            "displayMode": "list"
          },
          "tooltip": {
            "mode": "single",
            "sort": "none"
          }
        },
        "targets": [],
        "x-navixy": {
          "sql": {
            "params": {},
            "statement": "WITH daily_mileage_by_department AS (\n    SELECT \n        DATE(t.track_start_time) AS track_date,\n        COALESCE(d.department_label, ''Unknown'') AS department_label,\n        SUM(t.track_distance_meters) / 1000.0 AS distance_km\n    FROM business_data.tracks t \n    LEFT JOIN raw_business_data.objects o ON t.device_id = o.device_id\n    LEFT JOIN LATERAL (\n        SELECT dh.new_employee_id, dh.changed_datetime AS start_time\n        FROM raw_business_data.driver_history dh\n        WHERE dh.object_id = o.object_id\n            AND dh.changed_datetime <= t.track_start_time\n        ORDER BY dh.changed_datetime DESC\n        LIMIT 1\n    ) di ON true\n    LEFT JOIN raw_business_data.employees e ON di.new_employee_id = e.employee_id\n    LEFT JOIN raw_business_data.departments d ON d.department_id = e.department_id\n    WHERE t.track_start_time >= CURRENT_DATE - INTERVAL ''1 month''\n        AND t.track_start_time < CURRENT_DATE\n    GROUP BY DATE(t.track_start_time), d.department_label\n)\nSELECT \n    track_date AS timestamp,\n    ROUND(SUM(CASE WHEN department_label = ''Drivers'' THEN distance_km ELSE 0 END), 0) AS \"Drivers\",\n    ROUND(SUM(CASE WHEN department_label = ''Logistics'' THEN distance_km ELSE 0 END), 0) AS \"Logistics\",\n--    ROUND(SUM(CASE WHEN department_label = ''Delivery'' THEN distance_km ELSE 0 END), 0) AS \"Delivery\",\n    ROUND(SUM(CASE WHEN department_label = ''Sales'' THEN distance_km ELSE 0 END), 0) AS \"Sales\"\nFROM daily_mileage_by_department\nGROUP BY track_date\nORDER BY track_date;"
          },
          "verify": {
            "max_rows": 1000
          },
          "dataset": {
            "shape": "time_value",
            "columns": {}
          },
          "visualization": {
            "lineStyle": "solid",
            "colorPalette": "modern",
            "interpolation": "linear",
            "legendPosition": "top"
          }
        },
        "datasource": null,
        "fieldConfig": {
          "defaults": {
            "unit": "short",
            "color": {
              "mode": "palette-classic"
            },
            "custom": {
              "stacking": {
                "mode": "none",
                "group": "A"
              },
              "drawStyle": "line",
              "lineWidth": 1,
              "spanNulls": false,
              "showPoints": "auto",
              "fillOpacity": 10,
              "gradientMode": "none",
              "axisPlacement": "auto",
              "lineInterpolation": "linear"
            },
            "mappings": [],
            "thresholds": {
              "mode": "absolute",
              "steps": [
                {
                  "color": "green",
                  "value": null
                }
              ]
            }
          },
          "overrides": []
        }
      },
      {
        "id": 1,
        "type": "kpi",
        "title": "Total Mileage, km",
        "gridPos": {
          "h": 6,
          "w": 6,
          "x": 6,
          "y": 10
        },
        "options": {
          "textMode": "auto",
          "colorMode": "value",
          "graphMode": "none",
          "justifyMode": "auto",
          "orientation": "auto"
        },
        "targets": [],
        "x-navixy": {
          "sql": {
            "params": {},
            "statement": "SELECT \n    ROUND(SUM(t.track_distance_meters) / 1000.0, 0) AS value\nFROM business_data.tracks t \nWHERE t.track_start_time >= CURRENT_DATE - INTERVAL ''1 month''\n    AND t.track_start_time < CURRENT_DATE;"
          },
          "verify": {
            "max_rows": 1
          },
          "dataset": {
            "shape": "kpi",
            "columns": {
              "value": {
                "type": "number"
              }
            }
          }
        },
        "datasource": null,
        "fieldConfig": {
          "defaults": {
            "unit": "short",
            "color": {
              "mode": "thresholds"
            },
            "thresholds": {
              "mode": "absolute",
              "steps": [
                {
                  "color": "green",
                  "value": null
                }
              ]
            }
          },
          "overrides": []
        }
      },
      {
        "id": 2,
        "type": "barchart",
        "title": "Mileage Distribution By Weeks, km",
        "gridPos": {
          "h": 16,
          "w": 12,
          "x": 12,
          "y": 0
        },
        "options": {
          "valueMode": "color",
          "displayMode": "gradient",
          "orientation": "horizontal",
          "showUnfilled": true
        },
        "targets": [],
        "x-navixy": {
          "sql": {
            "params": {},
            "statement": "WITH time_classified_tracks AS (\n    SELECT \n        t.track_distance_meters,\n        DATE_TRUNC(''week'', t.track_start_time)::DATE AS week_start_date,\n        -- Time classification with standard parameters\n        CASE \n            WHEN EXTRACT(DOW FROM t.track_start_time) IN (0, 6) THEN ''weekend''\n            -- Work hours: 9:00-18:00\n            WHEN EXTRACT(HOUR FROM t.track_start_time) BETWEEN 9 AND 17 THEN ''work_time''\n            -- Non-work time: all other time on weekdays\n            ELSE ''non_work_time''\n        END AS time_category\n    FROM business_data.tracks t \n    WHERE t.track_start_time >= CURRENT_DATE - INTERVAL ''1 month''\n        AND t.track_start_time < CURRENT_DATE\n)\nSELECT \n    week_start_date AS category,\n    ROUND(SUM(track_distance_meters) / 1000.0, 0) AS value,\n    time_category AS series\nFROM time_classified_tracks\nGROUP BY week_start_date, time_category\nORDER BY week_start_date, time_category;"
          },
          "verify": {
            "max_rows": 10
          },
          "dataset": {
            "shape": "category_value",
            "columns": {}
          },
          "visualization": {
            "stacking": "stacked",
            "orientation": "vertical",
            "colorPalette": "modern"
          }
        },
        "datasource": null,
        "fieldConfig": {
          "defaults": {
            "unit": "short",
            "color": {
              "mode": "palette-classic"
            },
            "custom": {
              "hideFrom": {
                "viz": false,
                "legend": false,
                "tooltip": false
              }
            },
            "mappings": [],
            "thresholds": {
              "mode": "absolute",
              "steps": [
                {
                  "color": "green",
                  "value": null
                }
              ]
            }
          },
          "overrides": []
        }
      },
      {
        "id": 6,
        "type": "kpi",
        "title": "Mileage per Vehicle, km",
        "gridPos": {
          "h": 6,
          "w": 6,
          "x": 0,
          "y": 10
        },
        "options": {
          "textMode": "auto"
        },
        "x-navixy": {
          "sql": {
            "params": {},
            "statement": "WITH vehicle_mileage AS (\n    SELECT \n        t.device_id,\n        SUM(t.track_distance_meters) / 1000.0 AS total_km\n    FROM business_data.tracks t \n    WHERE t.track_start_time >= CURRENT_DATE - INTERVAL ''1 month''\n        AND t.track_start_time < CURRENT_DATE\n    GROUP BY t.device_id\n)\nSELECT \n    ROUND(AVG(total_km), 0) AS value\nFROM vehicle_mileage;"
          },
          "verify": {
            "max_rows": 1000
          },
          "dataset": {
            "shape": "kpi",
            "columns": {
              "value": {
                "type": "number"
              }
            }
          }
        }
      },
      {
        "id": 7,
        "type": "piechart",
        "title": "Mileage Distribution",
        "gridPos": {
          "h": 10,
          "w": 12,
          "x": 0,
          "y": 0
        },
        "options": {
          "pieType": "donut"
        },
        "x-navixy": {
          "sql": {
            "params": {},
            "statement": "WITH time_classified_tracks AS (\n    SELECT \n        t.track_distance_meters,\n        -- Time classification with standard parameters\n        CASE \n            WHEN EXTRACT(DOW FROM t.track_start_time) IN (0, 6) THEN ''weekend''\n            -- Work hours: 9:00-18:00\n            WHEN EXTRACT(HOUR FROM t.track_start_time) BETWEEN 9 AND 17 THEN ''work_time''\n            -- Non-work time: all other time on weekdays\n            ELSE ''non_work_time''\n        END AS time_category\n    FROM business_data.tracks t \n    WHERE t.track_start_time >= CURRENT_DATE - INTERVAL ''1 month''\n        AND t.track_start_time < CURRENT_DATE\n)\nSELECT \n    time_category AS category,\n    round(SUM(track_distance_meters) / 1000.0, 0) AS value\nFROM time_classified_tracks\nGROUP BY time_category\nORDER BY time_category;"
          },
          "verify": {
            "max_rows": 1000
          },
          "dataset": {
            "shape": "pie",
            "columns": {}
          }
        }
      }
    ],
    "refresh": "30s",
    "version": 1,
    "editable": true,
    "timezone": "browser",
    "x-navixy": {
      "execution": {
        "dialect": "postgresql",
        "endpoint": "/api/v1/sql/run",
        "max_rows": 1000,
        "read_only": true,
        "timeout_ms": 5000,
        "allowed_schemas": [
          "demo_data"
        ]
      },
      "parameters": {
        "bindings": {
          "to": "${__to}",
          "from": "${__from}",
          "tenant_id": "${var_tenant}"
        }
      },
      "schemaVersion": "1.0.0"
    },
    "templating": {
      "list": [
        {
          "name": "var_tenant",
          "type": "constant",
          "label": "Tenant",
          "query": "demo-tenant-id",
          "current": {
            "text": "Demo Tenant",
            "value": "demo-tenant-id"
          },
          "options": [
            {
              "text": "Demo Tenant",
              "value": "demo-tenant-id",
              "selected": true
            }
          ]
        }
      ],
      "enable": true
    },
    "timepicker": {
      "now": true,
      "enable": true,
      "hidden": false,
      "collapse": false,
      "time_options": [
        "5m",
        "15m",
        "1h",
        "6h",
        "12h",
        "24h"
      ],
      "refresh_intervals": [
        "5s",
        "10s",
        "30s",
        "1m",
        "5m",
        "15m",
        "30m",
        "1h"
      ]
    },
    "annotations": {
      "list": [
        {
          "hide": true,
          "name": "Annotations & Alerts",
          "type": "dashboard",
          "enable": true,
          "target": {
            "tags": [],
            "type": "dashboard",
            "limit": 100,
            "matchAny": false
          },
          "builtIn": 1,
          "iconColor": "rgba(0, 211, 255, 1)",
          "datasource": {
            "uid": "-- Dashboard --",
            "type": "dashboard"
          }
        }
      ]
    },
    "description": "Simple getting started example dashboard",
    "graphTooltip": 1,
    "schemaVersion": 38
  }'::jsonb,
  '00000000-0000-0000-0000-000000000002'::UUID,
  2000,
  '00000000-0000-0000-0000-000000000001'::UUID,
  '00000000-0000-0000-0000-000000000001'::UUID,
  '00000000-0000-0000-0000-000000000001'::UUID
)
ON CONFLICT (id) DO NOTHING;


-- ==========================================
-- Create trigger for new users (AFTER initial data)
-- ==========================================

-- Now create the trigger so it only applies to NEW users, not the initial admin
DROP TRIGGER IF EXISTS trigger_create_default_user_data ON public.users;
CREATE TRIGGER trigger_create_default_user_data
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION on_user_created();

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