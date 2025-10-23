-- Drop existing problematic policies
DROP POLICY IF EXISTS "Admins and editors can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins and editors can manage sections" ON public.sections;
DROP POLICY IF EXISTS "Admins and editors can manage reports" ON public.reports;
DROP POLICY IF EXISTS "Admins and editors can manage tiles" ON public.report_tiles;
DROP POLICY IF EXISTS "Admins and editors can manage report tables" ON public.report_tables;
DROP POLICY IF EXISTS "Admins and editors can manage columns" ON public.report_table_columns;
DROP POLICY IF EXISTS "Admins can manage settings" ON public.app_settings;

-- Create security definer function to check roles WITHOUT recursion
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create security definer function to check if user is admin or editor
CREATE OR REPLACE FUNCTION public.is_admin_or_editor(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'editor')
  )
$$;

-- Recreate policies using the security definer functions
CREATE POLICY "Admins and editors can manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.is_admin_or_editor(auth.uid()));

CREATE POLICY "Admins and editors can manage sections"
  ON public.sections FOR ALL
  TO authenticated
  USING (public.is_admin_or_editor(auth.uid()));

CREATE POLICY "Admins and editors can manage reports"
  ON public.reports FOR ALL
  TO authenticated
  USING (public.is_admin_or_editor(auth.uid()));

CREATE POLICY "Admins and editors can manage tiles"
  ON public.report_tiles FOR ALL
  TO authenticated
  USING (public.is_admin_or_editor(auth.uid()));

CREATE POLICY "Admins and editors can manage report tables"
  ON public.report_tables FOR ALL
  TO authenticated
  USING (public.is_admin_or_editor(auth.uid()));

CREATE POLICY "Admins and editors can manage columns"
  ON public.report_table_columns FOR ALL
  TO authenticated
  USING (public.is_admin_or_editor(auth.uid()));

CREATE POLICY "Admins can manage settings"
  ON public.app_settings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));