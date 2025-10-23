-- Fix function search path
DROP FUNCTION IF EXISTS public.execute_sql(text);

CREATE OR REPLACE FUNCTION public.execute_sql(query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  EXECUTE format('SELECT jsonb_agg(row_to_json(t.*)) FROM (%s) t', query) INTO result;
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;