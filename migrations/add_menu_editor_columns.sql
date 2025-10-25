-- Migration: Add columns for enhanced menu editor functionality
-- This migration adds soft delete, versioning, and improved sorting to sections and reports tables

-- Add new columns to sections table
ALTER TABLE public.sections 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- Add new columns to reports table  
ALTER TABLE public.reports 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- Rename sort_index to sort_order for consistency with API spec
ALTER TABLE public.sections RENAME COLUMN sort_index TO sort_order;
ALTER TABLE public.reports RENAME COLUMN sort_index TO sort_order;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_sections_is_deleted_sort_order ON public.sections(is_deleted, sort_order);
CREATE INDEX IF NOT EXISTS idx_reports_is_deleted_parent_section_sort_order ON public.reports(is_deleted, section_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_sections_updated_at ON public.sections(updated_at);
CREATE INDEX IF NOT EXISTS idx_reports_updated_at ON public.reports(updated_at);

-- Update existing records to have proper sort_order values (multiples of 1000)
-- This ensures we have space for inserting items between existing ones
WITH section_updates AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY sort_order) * 1000 as new_sort_order
  FROM public.sections
  WHERE is_deleted = FALSE
)
UPDATE public.sections 
SET sort_order = section_updates.new_sort_order
FROM section_updates
WHERE sections.id = section_updates.id;

-- Update reports sort_order within each section
WITH report_updates AS (
  SELECT 
    r.id,
    ROW_NUMBER() OVER (PARTITION BY r.section_id ORDER BY r.sort_order) * 1000 as new_sort_order
  FROM public.reports r
  WHERE r.is_deleted = FALSE
)
UPDATE public.reports 
SET sort_order = report_updates.new_sort_order
FROM report_updates
WHERE reports.id = report_updates.id;

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
        )
      )
      FROM public.sections
      WHERE (_include_deleted = TRUE OR is_deleted = FALSE)
      ORDER BY sort_order
    ),
    'rootReports', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', id,
          'name', title,
          'sortOrder', sort_order,
          'version', version
        )
      )
      FROM public.reports
      WHERE section_id IS NULL 
        AND (_include_deleted = TRUE OR is_deleted = FALSE)
      ORDER BY sort_order
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
            )
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

-- Add comments for documentation
COMMENT ON COLUMN public.sections.is_deleted IS 'Soft delete flag - when TRUE, section is hidden from normal views';
COMMENT ON COLUMN public.sections.version IS 'Optimistic concurrency control version number';
COMMENT ON COLUMN public.sections.updated_at IS 'Timestamp of last update';
COMMENT ON COLUMN public.sections.updated_by IS 'User who made the last update';

COMMENT ON COLUMN public.reports.is_deleted IS 'Soft delete flag - when TRUE, report is hidden from normal views';
COMMENT ON COLUMN public.reports.version IS 'Optimistic concurrency control version number';

COMMENT ON FUNCTION public.get_next_sort_order IS 'Calculates next sort order for inserting items between existing ones';
COMMENT ON FUNCTION public.renumber_sort_orders IS 'Renumbers all sort orders in a container with 1000-step intervals';
COMMENT ON FUNCTION public.get_menu_tree IS 'Returns complete menu tree structure for API consumption';
