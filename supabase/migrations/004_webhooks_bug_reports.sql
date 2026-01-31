-- ============================================
-- Minerva v2 - 004: Webhooks + Bug Reports
-- ============================================
-- Ejecutar después de 003_zoom_integration.sql.

-- =============================================
-- WEBHOOK EVENTS
-- =============================================
CREATE TABLE
IF NOT EXISTS public.webhook_events
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid
(),
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now
(),
    processed_at TIMESTAMPTZ
);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service Role Full Access" ON public.webhook_events
    FOR ALL
    TO service_role
    USING
(true)
    WITH CHECK
(true);

CREATE OR REPLACE FUNCTION public.cleanup_old_webhook_events
(days_to_keep int DEFAULT 30)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path
= ''
AS $$
DECLARE
    deleted_count int;
BEGIN
    WITH deleted AS (
    DELETE FROM public.webhook_events
        WHERE processed = true
        AND created_at < now() - (days_to_keep || ' days')
    ::interval
        RETURNING *
    )
    SELECT count(*)
    INTO deleted_count
    FROM deleted;

    RAISE NOTICE 'Deleted % old webhook events (older than % days)', deleted_count, days_to_keep;

    RETURN deleted_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_old_webhook_events
(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_webhook_events
(int) TO service_role;

-- =============================================
-- BUG REPORTS
-- =============================================
CREATE TABLE
IF NOT EXISTS public.bug_reports
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid
(),
    title TEXT NOT NULL CHECK
(char_length
(title) >= 5 AND char_length
(title) <= 50),
    description TEXT NOT NULL,
    user_id UUID REFERENCES auth.users
(id) ON
DELETE
SET NULL
,
    user_email TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK
(status IN
('open', 'in_progress', 'resolved', 'closed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now
()
);

COMMENT ON TABLE public.bug_reports IS 'Reportes de bugs enviados por usuarios';

ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bug_reports_insert" ON public.bug_reports
    FOR
INSERT TO
anon,
authenticated
WITH CHECK
(true);

-- Consolidar SELECT policies para evitar múltiples permissive policies
CREATE POLICY "bug_reports_select" ON public.bug_reports
    FOR SELECT TO authenticated
    USING (
        user_id = (SELECT auth.uid())
        OR COALESCE(((SELECT auth.jwt()) ->> 'hierarchy_level')::int, 0) >= 80
    );

CREATE POLICY "bug_reports_update_admin" ON public.bug_reports
    FOR UPDATE TO authenticated
    USING (
        COALESCE(((SELECT auth.jwt()) ->> 'hierarchy_level')::int, 0) >= 80
    );

CREATE INDEX
IF NOT EXISTS idx_bug_reports_user_id ON public.bug_reports
(user_id);
CREATE INDEX
IF NOT EXISTS idx_bug_reports_status ON public.bug_reports
(status);
CREATE INDEX
IF NOT EXISTS idx_bug_reports_created_at ON public.bug_reports
(created_at DESC);

-- =============================================
-- ACTIVE MEETINGS
-- =============================================
-- Obtiene los meeting_ids de reuniones que han iniciado pero no han terminado.
-- Un meeting está "activo" si tiene un evento meeting.started más reciente
-- que cualquier evento meeting.ended para ese meeting_id.
CREATE OR REPLACE FUNCTION public.get_active_meetings
()
RETURNS TABLE
(meeting_id TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path
= ''
AS $$
WITH
    meeting_events
    AS
    (
        -- Extraer meeting_id (convertido a texto) de los eventos started y ended
        SELECT
            (payload->'object'
    ->>'id')::TEXT AS meeting_id,
            event_type,
            created_at
        FROM public.webhook_events
        WHERE event_type IN
('meeting.started', 'meeting.ended')
    ),
    latest_events AS
(
        -- Obtener el evento más reciente por meeting_id
        SELECT DISTINCT ON
(meeting_id)
            meeting_id,
            event_type
        FROM meeting_events
        ORDER BY meeting_id, created_at DESC
    )
-- Retornar solo los meetings cuyo último evento fue started
SELECT meeting_id
FROM latest_events
WHERE event_type = 'meeting.started';
$$;

-- Permisos: accesible para usuarios autenticados
REVOKE EXECUTE ON FUNCTION public.get_active_meetings
() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_active_meetings
() TO authenticated;

-- Índice para optimizar queries de webhook_events por tipo de evento
CREATE INDEX
IF NOT EXISTS idx_webhook_events_event_type ON public.webhook_events
(event_type);
CREATE INDEX
IF NOT EXISTS idx_webhook_events_created_at ON public.webhook_events
(created_at DESC);

-- =============================================
-- CRON SETUP (manual)
-- =============================================
-- Habilitar pg_cron en Supabase y programar cleanup_old_webhook_events.
