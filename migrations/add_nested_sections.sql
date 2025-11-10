-- Migration: Add nested sections support
-- This migration adds parent-child relationships between sections

-- Add parent_section_id column to sections table
ALTER TABLE public.sections 
ADD COLUMN parent_section_id UUID REFERENCES public.sections(id) ON DELETE CASCADE;

-- Add index for better performance on parent lookups
CREATE INDEX idx_sections_parent_section_id ON public.sections(parent_section_id);

-- Add depth column for easier querying and sorting
ALTER TABLE public.sections 
ADD COLUMN depth INTEGER NOT NULL DEFAULT 0;

-- Add path column for hierarchical path (e.g., "parent/child/grandchild")
ALTER TABLE public.sections 
ADD COLUMN path TEXT NOT NULL DEFAULT '';

-- Update existing sections to have depth 0 and their name as path
UPDATE public.sections 
SET depth = 0, path = name 
WHERE parent_section_id IS NULL;

-- Create function to update section paths recursively
CREATE OR REPLACE FUNCTION update_section_paths()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    section_record RECORD;
    parent_path TEXT;
BEGIN
    -- Update all sections with their correct paths and depths
    FOR section_record IN 
        WITH RECURSIVE section_hierarchy AS (
            -- Base case: root sections (no parent)
            SELECT 
                id, 
                name, 
                parent_section_id, 
                0 as depth,
                name as path
            FROM public.sections 
            WHERE parent_section_id IS NULL
            
            UNION ALL
            
            -- Recursive case: child sections
            SELECT 
                s.id, 
                s.name, 
                s.parent_section_id, 
                sh.depth + 1,
                sh.path || '/' || s.name
            FROM public.sections s
            INNER JOIN section_hierarchy sh ON s.parent_section_id = sh.id
        )
        SELECT * FROM section_hierarchy
    LOOP
        UPDATE public.sections 
        SET depth = section_record.depth, 
            path = section_record.path
        WHERE id = section_record.id;
    END LOOP;
END;
$$;

-- Execute the function to update all paths
SELECT update_section_paths();

-- Create function to get section hierarchy
CREATE OR REPLACE FUNCTION get_section_hierarchy()
RETURNS TABLE (
    id UUID,
    name TEXT,
    parent_section_id UUID,
    depth INTEGER,
    path TEXT,
    sort_index INTEGER,
    created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
AS $$
    WITH RECURSIVE section_tree AS (
        -- Base case: root sections
        SELECT 
            s.id, 
            s.name, 
            s.parent_section_id, 
            s.depth,
            s.path,
            s.sort_index,
            s.created_at
        FROM public.sections s
        WHERE s.parent_section_id IS NULL
        
        UNION ALL
        
        -- Recursive case: child sections
        SELECT 
            s.id, 
            s.name, 
            s.parent_section_id, 
            s.depth,
            s.path,
            s.sort_index,
            s.created_at
        FROM public.sections s
        INNER JOIN section_tree st ON s.parent_section_id = st.id
    )
    SELECT * FROM section_tree
    ORDER BY path, sort_index;
$$;

-- Create function to prevent circular references
CREATE OR REPLACE FUNCTION prevent_circular_section_reference()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    parent_id UUID;
    current_id UUID;
BEGIN
    -- If no parent, allow it
    IF NEW.parent_section_id IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Check if the new parent would create a circular reference
    current_id := NEW.parent_section_id;
    
    WHILE current_id IS NOT NULL LOOP
        -- If we find our own ID in the parent chain, it's circular
        IF current_id = NEW.id THEN
            RAISE EXCEPTION 'Circular reference detected: section cannot be its own parent or ancestor';
        END IF;
        
        -- Get the parent of the current section
        SELECT parent_section_id INTO current_id
        FROM public.sections
        WHERE id = current_id;
    END LOOP;
    
    RETURN NEW;
END;
$$;

-- Create trigger to prevent circular references
CREATE TRIGGER prevent_circular_section_reference_trigger
    BEFORE INSERT OR UPDATE ON public.sections
    FOR EACH ROW
    EXECUTE FUNCTION prevent_circular_section_reference();

-- Create function to automatically update paths when sections are modified
CREATE OR REPLACE FUNCTION update_section_path_on_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Temporarily disable this trigger to prevent infinite recursion
    -- The update_section_paths() function will update all paths at once
    ALTER TABLE public.sections DISABLE TRIGGER update_section_path_trigger;
    
    -- Update the path and depth for the modified section and all its descendants
    PERFORM update_section_paths();
    
    -- Re-enable the trigger
    ALTER TABLE public.sections ENABLE TRIGGER update_section_path_trigger;
    
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger to update paths automatically
CREATE TRIGGER update_section_path_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.sections
    FOR EACH ROW
    EXECUTE FUNCTION update_section_path_on_change();

-- Add comments for documentation
COMMENT ON COLUMN public.sections.parent_section_id IS 'Reference to parent section for nested hierarchy';
COMMENT ON COLUMN public.sections.depth IS 'Depth level in the hierarchy (0 = root)';
COMMENT ON COLUMN public.sections.path IS 'Hierarchical path (e.g., "parent/child/grandchild")';
COMMENT ON FUNCTION get_section_hierarchy() IS 'Returns sections in hierarchical order with proper nesting';
COMMENT ON FUNCTION prevent_circular_section_reference() IS 'Prevents circular references in section hierarchy';
COMMENT ON FUNCTION update_section_paths() IS 'Updates all section paths and depths recursively';
