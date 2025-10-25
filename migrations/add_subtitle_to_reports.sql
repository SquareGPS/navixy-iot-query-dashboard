-- Migration: Add subtitle column to reports table
-- This migration adds a subtitle column to the existing reports table

-- Add subtitle column to reports table
ALTER TABLE public.reports 
ADD COLUMN IF NOT EXISTS subtitle TEXT;

-- Update any existing reports to have null subtitle (optional field)
-- No data migration needed as subtitle is optional
