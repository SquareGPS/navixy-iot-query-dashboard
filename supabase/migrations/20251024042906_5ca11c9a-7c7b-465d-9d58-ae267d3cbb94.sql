-- Drop the overly permissive policy that allows all users to view settings
DROP POLICY IF EXISTS "Users can view settings" ON public.app_settings;

-- Create a new policy that restricts SELECT to admins only
CREATE POLICY "Only admins can view settings" 
ON public.app_settings 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::text));

-- Note: The "Admins can manage settings" policy for INSERT/UPDATE/DELETE already exists
-- and uses has_role(auth.uid(), 'admin'), so that remains unchanged