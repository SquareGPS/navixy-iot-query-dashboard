-- Fix function search path warnings for security
-- These functions need search_path set to prevent security issues

-- Fix validate_report_schema function
CREATE OR REPLACE FUNCTION public.validate_report_schema(schema jsonb)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $function$
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
$function$;

-- Fix get_report_queries function
CREATE OR REPLACE FUNCTION public.get_report_queries(report_uuid uuid)
RETURNS TABLE(query_type text, visual_label text, sql_query text, row_index integer)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $function$
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
$function$;
