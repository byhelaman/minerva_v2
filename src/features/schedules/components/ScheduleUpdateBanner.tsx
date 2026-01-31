import { useEffect, useRef } from "react";
import { useScheduleStore, PublishedSchedule } from "@/features/schedules/stores/useScheduleStore";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export function ScheduleUpdateBanner() {
    const { latestPublished, checkForUpdates, downloadPublished, dismissUpdate } = useScheduleStore();
    const toastIdRef = useRef<string | number | null>(null);
    const lastSeenIdRef = useRef<string | null>(null);

    // Verificar actualizaciones al montar
    useEffect(() => {
        checkForUpdates();

        // Suscripción Realtime
        const channel = supabase
            .channel('published_schedules_changes')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'published_schedules' },
                () => {
                    checkForUpdates();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [checkForUpdates]);

    // Handle Toast
    useEffect(() => {
        if (latestPublished) {
            // If already showing this exact schedule, don't re-toast
            if (lastSeenIdRef.current === latestPublished.id) {
                return;
            }

            // Dismiss previous if exists
            if (toastIdRef.current) {
                toast.dismiss(toastIdRef.current);
            }

            lastSeenIdRef.current = latestPublished.id;

            toastIdRef.current = toast("New Schedule Available", {
                description: `Schedule for ${latestPublished.schedule_date} has been published.`,
                duration: Infinity, // No auto-dismiss
                action: {
                    label: "Download",
                    onClick: () => downloadPublished(latestPublished as PublishedSchedule),
                },
                cancel: {
                    label: "Dismiss",
                    onClick: () => dismissUpdate(latestPublished.id),
                },
            });
        } else {
            // If latestPublished is gone, remove toast
            if (toastIdRef.current) {
                toast.dismiss(toastIdRef.current);
                toastIdRef.current = null;
            }
            lastSeenIdRef.current = null;
        }
    }, [latestPublished, downloadPublished, dismissUpdate]);

    return null;
}
