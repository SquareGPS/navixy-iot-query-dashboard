-- Fix get_menu_tree function to return empty arrays/objects instead of NULL
-- when there are no sections or reports

CREATE OR REPLACE FUNCTION public.get_menu_tree(_include_deleted BOOLEAN DEFAULT FALSE)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'sections', COALESCE((
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
    ), '[]'::jsonb),
    'rootReports', COALESCE((
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
    ), '[]'::jsonb),
    'sectionReports', COALESCE((
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
    ), '{}'::jsonb)
  ) INTO result;
  
  RETURN result;
END;
$$;

