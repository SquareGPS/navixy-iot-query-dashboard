-- Add external_db_url column to app_settings
ALTER TABLE public.app_settings 
ADD COLUMN IF NOT EXISTS external_db_url text;