-- ==========================================
-- Phase 1: Foundation - JSON Schema for Reports
-- ==========================================

-- Add report_schema column to reports table
ALTER TABLE public.reports 
ADD COLUMN report_schema JSONB;

-- Create a function to validate report schema structure
CREATE OR REPLACE FUNCTION public.validate_report_schema(schema JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- Basic validation: must have required top-level fields
  IF schema IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check required fields exist
  IF NOT (
    schema ? 'title' AND
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

-- Migrate existing reports to new JSON schema format
DO $$
DECLARE
  report_record RECORD;
  tiles_json JSONB;
  table_json JSONB;
  rows_array JSONB := '[]'::JSONB;
  tile_record RECORD;
  table_record RECORD;
  columns_json JSONB;
  col_record RECORD;
BEGIN
  -- Loop through all existing reports
  FOR report_record IN SELECT * FROM public.reports ORDER BY sort_index LOOP
    rows_array := '[]'::JSONB;
    
    -- Convert tiles to JSON format
    FOR tile_record IN 
      SELECT * FROM public.report_tiles 
      WHERE report_id = report_record.id 
      ORDER BY position 
    LOOP
      -- Build tiles row (group tiles, max 3 per row)
      -- For simplicity, putting each tile in its own row for now
      tiles_json := jsonb_build_object(
        'type', 'tiles',
        'title', tile_record.title,
        'visuals', jsonb_build_array(
          jsonb_build_object(
            'kind', 'tile',
            'label', tile_record.title,
            'query', jsonb_build_object(
              'sql', tile_record.sql
            ),
            'options', jsonb_build_object(
              'precision', COALESCE(tile_record.decimals, 0),
              'format', COALESCE(tile_record.format, 'number')
            )
          )
        )
      );
      rows_array := rows_array || tiles_json;
    END LOOP;
    
    -- Convert tables to JSON format
    FOR table_record IN 
      SELECT * FROM public.report_tables 
      WHERE report_id = report_record.id 
    LOOP
      columns_json := '[]'::JSONB;
      
      -- Get columns for this table
      FOR col_record IN 
        SELECT * FROM public.report_table_columns 
        WHERE report_table_id = table_record.id 
        ORDER BY col_order 
      LOOP
        columns_json := columns_json || jsonb_build_object(
          'field', col_record.column_key,
          'label', COALESCE(col_record.label, col_record.column_key),
          'format', COALESCE(col_record.format, 'text'),
          'width', col_record.width,
          'sortable', true,
          'truncate', true
        );
      END LOOP;
      
      table_json := jsonb_build_object(
        'type', 'table',
        'visuals', jsonb_build_array(
          jsonb_build_object(
            'kind', 'table',
            'label', 'Data Table',
            'query', jsonb_build_object(
              'sql', table_record.sql
            ),
            'options', jsonb_build_object(
              'paginate', true,
              'page_size', COALESCE(table_record.default_page_size, 25),
              'columns', columns_json
            )
          )
        )
      );
      rows_array := rows_array || table_json;
    END LOOP;
    
    -- Build complete report schema
    UPDATE public.reports
    SET report_schema = jsonb_build_object(
      'title', report_record.title,
      'subtitle', report_record.description,
      'meta', jsonb_build_object(
        'schema_version', '1.0.0',
        'report_id', report_record.id::text,
        'slug', report_record.slug,
        'last_updated', COALESCE(report_record.updated_at, report_record.created_at, NOW())::text,
        'updated_by', jsonb_build_object(
          'id', COALESCE(report_record.updated_by::text, report_record.created_by::text, 'system'),
          'name', 'System Migration'
        )
      ),
      'rows', rows_array
    )
    WHERE id = report_record.id;
  END LOOP;
END $$;

-- Make report_schema required (all reports should now have it)
ALTER TABLE public.reports 
ALTER COLUMN report_schema SET NOT NULL;

-- Add constraint to validate schema
ALTER TABLE public.reports
ADD CONSTRAINT reports_valid_schema_check 
CHECK (validate_report_schema(report_schema));

-- Drop old tables (no longer needed)
DROP TABLE IF EXISTS public.report_table_columns CASCADE;
DROP TABLE IF EXISTS public.report_tables CASCADE;
DROP TABLE IF EXISTS public.report_tiles CASCADE;

-- Update reports table - remove columns that are now in JSON
ALTER TABLE public.reports 
DROP COLUMN IF EXISTS description,
DROP COLUMN IF EXISTS settings;

-- Add index on report_schema for faster queries
CREATE INDEX idx_reports_schema_meta ON public.reports USING gin ((report_schema->'meta'));
CREATE INDEX idx_reports_schema_slug ON public.reports ((report_schema->'meta'->>'slug'));

-- Create helper function to extract report data
CREATE OR REPLACE FUNCTION public.get_report_queries(report_uuid UUID)
RETURNS TABLE(
  query_type TEXT,
  visual_label TEXT,
  sql_query TEXT,
  row_index INTEGER
)
LANGUAGE plpgsql
STABLE
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

-- Add comment explaining the schema
COMMENT ON COLUMN public.reports.report_schema IS 'JSON schema following the Navixy Report Page format. Contains complete report definition including tiles, tables, and annotations with their queries and display options.';

COMMENT ON FUNCTION public.validate_report_schema IS 'Validates that a report schema JSON contains all required fields and follows the expected structure.';

COMMENT ON FUNCTION public.get_report_queries IS 'Helper function to extract all SQL queries from a report schema for validation or analysis.';