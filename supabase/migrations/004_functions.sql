-- ============================================
-- Minerva v2 - 004: Functions
-- ============================================
-- Run AFTER 003_schedules.sql
-- All SECURITY DEFINER functions use SET search_path = ''

-- =============================================
-- HELPER: Get current user's role hierarchy level
-- =============================================
CREATE OR REPLACE FUNCTION public.user_role_level()
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT COALESCE(
        (SELECT r.hierarchy_level 
         FROM public.profiles p 
         JOIN public.roles r ON p.role = r.name 
         WHERE p.id = auth.uid()),
        0
    );
$$;

-- =============================================
-- HELPER: Check if user has a specific permission
-- =============================================
CREATE OR REPLACE FUNCTION public.has_permission(p_permission TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT public.user_role_level() >= COALESCE(
        (SELECT min_role_level FROM public.permissions WHERE name = p_permission),
        999  -- If permission doesn't exist, deny
    );
$$;

-- =============================================
-- HELPER: Check if user is admin or higher
-- =============================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT public.user_role_level() >= 80;
$$;

-- =============================================
-- HELPER: Check if user is super_admin
-- =============================================
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT public.user_role_level() >= 100;
$$;

-- =============================================
-- API: Get current user's profile with permissions
-- =============================================
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT json_build_object(
        'id', p.id,
        'email', p.email,
        'display_name', p.display_name,
        'role', p.role,
        'hierarchy_level', r.hierarchy_level,
        'permissions', (
            SELECT json_agg(perm.name)
            FROM public.permissions perm
            WHERE perm.min_role_level <= r.hierarchy_level
        )
    )
    FROM public.profiles p
    JOIN public.roles r ON p.role = r.name
    WHERE p.id = auth.uid();
$$;

-- =============================================
-- API: Check email exists (for signup validation)
-- =============================================
CREATE OR REPLACE FUNCTION public.check_email_exists(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (SELECT 1 FROM public.profiles WHERE email = p_email);
$$;

-- =============================================
-- API: Update current user's display name
-- =============================================
CREATE OR REPLACE FUNCTION public.update_my_display_name(new_display_name TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    UPDATE public.profiles
    SET display_name = new_display_name,
        updated_at = NOW()
    WHERE id = auth.uid();
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.update_my_display_name(TEXT) TO authenticated;
