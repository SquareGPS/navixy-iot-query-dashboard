-- Fix user_roles authorization exposure
-- Drop the overly permissive policy that allows anyone to view roles
DROP POLICY IF EXISTS "Users can view all roles" ON public.user_roles;

-- Create a new policy that only allows authenticated users to view roles
CREATE POLICY "Authenticated users can view roles" 
ON public.user_roles 
FOR SELECT 
TO authenticated
USING (true);

-- Note: This restricts viewing to authenticated users only
-- If you want users to only see their own role, use:
-- USING (auth.uid() = user_id)
