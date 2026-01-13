-- ============================================
-- Minerva v2 - 001: Roles and Permissions
-- ============================================
-- Run this FIRST in Supabase SQL Editor

-- Roles table with hierarchy
CREATE TABLE public.roles (
    name TEXT PRIMARY KEY,
    description TEXT,
    hierarchy_level INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Permissions table
CREATE TABLE public.permissions (
    name TEXT PRIMARY KEY,
    description TEXT,
    min_role_level INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Role to permission mapping (for reference/admin UI)
CREATE TABLE public.role_permissions (
    role TEXT REFERENCES public.roles(name) ON DELETE CASCADE,
    permission TEXT REFERENCES public.permissions(name) ON DELETE CASCADE,
    PRIMARY KEY (role, permission)
);

-- =============================================
-- SEED DATA
-- =============================================

-- Roles (hierarchy: higher = more permissions)
INSERT INTO public.roles (name, description, hierarchy_level) VALUES
    ('super_admin', 'Full system control, Zoom integration', 100),
    ('admin', 'Manage users and system settings', 80),
    ('operator', 'Work with schedules and Zoom data', 50),
    ('viewer', 'Read-only access to own schedules', 10);

-- Permissions
INSERT INTO public.permissions (name, description, min_role_level) VALUES
    -- Schedules
    ('schedules.read', 'View own schedules', 10),
    ('schedules.write', 'Upload and edit schedules', 50),
    -- Zoom
    ('zoom.search', 'Search Zoom users', 50),
    ('zoom.links', 'Create and manage Zoom links', 50),
    -- Users
    ('users.read', 'View user list', 80),
    ('users.write', 'Manage user roles', 80),
    -- Settings
    ('settings.read', 'View system settings', 80),
    ('settings.write', 'Modify system settings and Zoom integration', 100);

-- Role-Permission mappings (explicit for admin UI)
INSERT INTO public.role_permissions (role, permission) VALUES
    -- viewer
    ('viewer', 'schedules.read'),
    -- operator (includes viewer permissions)
    ('operator', 'schedules.read'),
    ('operator', 'schedules.write'),
    ('operator', 'zoom.search'),
    ('operator', 'zoom.links'),
    -- admin (includes operator permissions)
    ('admin', 'schedules.read'),
    ('admin', 'schedules.write'),
    ('admin', 'zoom.search'),
    ('admin', 'zoom.links'),
    ('admin', 'users.read'),
    ('admin', 'users.write'),
    ('admin', 'settings.read'),
    -- super_admin (all permissions)
    ('super_admin', 'schedules.read'),
    ('super_admin', 'schedules.write'),
    ('super_admin', 'zoom.search'),
    ('super_admin', 'zoom.links'),
    ('super_admin', 'users.read'),
    ('super_admin', 'users.write'),
    ('super_admin', 'settings.read'),
    ('super_admin', 'settings.write');
