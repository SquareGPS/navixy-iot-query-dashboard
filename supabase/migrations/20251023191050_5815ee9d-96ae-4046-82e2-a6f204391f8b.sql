-- Add external database configuration to app_settings
ALTER TABLE public.app_settings
ADD COLUMN external_db_host text,
ADD COLUMN external_db_port integer DEFAULT 5432,
ADD COLUMN external_db_name text,
ADD COLUMN external_db_user text,
ADD COLUMN external_db_password text;