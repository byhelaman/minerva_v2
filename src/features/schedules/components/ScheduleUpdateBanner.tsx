import { useEffect } from "react";
import { useScheduleStore, PublishedSchedule } from "@/features/schedules/stores/useScheduleStore";
import { Button } from "@/components/ui/button";
import { CloudDownload, X, Calendar } from "lucide-react";
import { supabase } from "@/lib/supabase";

export function ScheduleUpdateBanner() {
    const { latestPublished, checkForUpdates, downloadPublished, dismissUpdate } = useScheduleStore();

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

    if (!latestPublished) return null;

    return (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-in slide-in-from-bottom-4 fade-in duration-300">
            <div className="bg-card border rounded-lg shadow-lg p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 text-primary">
                        <Calendar className="h-4 w-4" />
                        <span className="font-medium">New Schedule Available</span>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => dismissUpdate(latestPublished.id)}
                        className="shrink-0 -mr-2 -mt-1"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                <p className="text-sm text-muted-foreground">
                    Schedule for <strong>{latestPublished.schedule_date}</strong> has been published.
                    Do you want to download it?
                </p>

                <div className="flex gap-2">
                    <Button
                        size="sm"
                        onClick={() => downloadPublished(latestPublished as PublishedSchedule)}
                    >
                        <CloudDownload />
                        Download
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => dismissUpdate(latestPublished.id)}
                    >
                        Dismiss
                    </Button>
                </div>
            </div>
        </div>
    );
}
