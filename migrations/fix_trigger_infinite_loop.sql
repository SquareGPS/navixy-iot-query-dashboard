-- Fix infinite recursion in update_section_path_on_change trigger
-- This migration fixes the trigger that causes infinite loops when updating sections

-- Drop and recreate the trigger function with recursion prevention
DROP TRIGGER IF EXISTS update_section_path_trigger ON public.sections;

CREATE OR REPLACE FUNCTION update_section_path_on_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Check if we're already updating paths to prevent infinite recursion
    IF current_setting('updating_section_paths', true) = 'true' THEN
        RETURN COALESCE(NEW, OLD);
    END IF;
    
    -- Set flag to prevent recursion
    PERFORM set_config('updating_section_paths', 'true', true);
    
    -- Update the path and depth for the modified section and all its descendants
    PERFORM update_section_paths();
    
    -- Clear the flag
    PERFORM set_config('updating_section_paths', 'false', true);
    
    RETURN COALESCE(NEW, OLD);
EXCEPTION
    WHEN OTHERS THEN
        -- Clear the flag on error
        PERFORM set_config('updating_section_paths', 'false', true);
        RAISE;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER update_section_path_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.sections
    FOR EACH ROW
    EXECUTE FUNCTION update_section_path_on_change();

