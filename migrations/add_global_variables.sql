-- Create global_variables table
CREATE TABLE IF NOT EXISTS public.global_variables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label TEXT NOT NULL UNIQUE,
    description TEXT,
    value TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index on label for faster lookups
CREATE INDEX IF NOT EXISTS idx_global_variables_label ON public.global_variables(label);

-- Insert example variable __client_id (optional - can be removed if not needed)
INSERT INTO public.global_variables (label, description)
VALUES ('__client_id', 'Client identifier for multi-tenant scenarios')
ON CONFLICT (label) DO NOTHING;

-- Enable RLS
ALTER TABLE public.global_variables ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- All authenticated users can view global variables
CREATE POLICY "Users can view global variables" ON public.global_variables
  FOR SELECT USING (true);

-- Only admins can manage global variables
CREATE POLICY "Admins can manage global variables" ON public.global_variables
  FOR ALL USING (has_role(auth_uid(), 'admin'));

