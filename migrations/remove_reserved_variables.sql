-- Migration: Remove is_reserved column from global_variables table
-- This migration removes the special treatment for reserved variables
-- All variables are now treated equally regardless of their label

-- Drop the index on is_reserved (if it exists)
DROP INDEX IF EXISTS idx_global_variables_is_reserved;

-- Drop the is_reserved column (if it exists)
ALTER TABLE public.global_variables DROP COLUMN IF EXISTS is_reserved;

-- Update any existing reserved variables to remove the reserved flag
-- (This is a no-op now, but kept for clarity)
-- All variables can now be edited and deleted normally







