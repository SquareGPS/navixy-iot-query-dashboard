-- Migration: Remove password authentication requirement
-- This migration makes password_hash nullable to support token-based authentication

-- Make password_hash nullable
ALTER TABLE public.users ALTER COLUMN password_hash DROP NOT NULL;

-- Add comment explaining the change
COMMENT ON COLUMN public.users.password_hash IS 'Password hash for legacy authentication. Nullable to support token-based authentication.';

