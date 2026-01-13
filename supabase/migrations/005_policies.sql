-- ============================================
-- Minerva v2 - 005: RLS Policies
-- ============================================
-- Run AFTER 004_functions.sql
-- Performance: uses (SELECT auth.uid()) pattern

-- =============================================
-- ENABLE RLS
-- =============================================
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =============================================
-- ROLES TABLE (read-only for authenticated)
-- =============================================
CREATE POLICY "roles_select" ON public.roles
    FOR SELECT TO authenticated
    USING (true);

-- =============================================
-- PERMISSIONS TABLE (read-only for authenticated)
-- =============================================
CREATE POLICY "permissions_select" ON public.permissions
    FOR SELECT TO authenticated
    USING (true);

-- =============================================
-- ROLE_PERMISSIONS TABLE (read-only for authenticated)
-- =============================================
CREATE POLICY "role_permissions_select" ON public.role_permissions
    FOR SELECT TO authenticated
    USING (true);

-- =============================================
-- PROFILES TABLE
-- =============================================
-- SELECT: own profile OR admin can see all
CREATE POLICY "profiles_select" ON public.profiles
    FOR SELECT USING (
        id = (SELECT auth.uid())
        OR public.is_admin()
    );

-- INSERT: only via trigger (new user signup)
CREATE POLICY "profiles_insert" ON public.profiles
    FOR INSERT WITH CHECK (
        id = (SELECT auth.uid())
    );

-- UPDATE: admin can update any, users cannot self-update role
CREATE POLICY "profiles_update" ON public.profiles
    FOR UPDATE USING (
        public.is_admin()
    );

-- DELETE: only super_admin
CREATE POLICY "profiles_delete" ON public.profiles
    FOR DELETE USING (
        public.is_super_admin()
    );
