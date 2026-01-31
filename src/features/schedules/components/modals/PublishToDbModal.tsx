import { useState } from "react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useScheduleStore } from "@/features/schedules/stores/useScheduleStore";
import { Loader2 } from "lucide-react";

interface PublishToDbModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function PublishToDbModal({ open, onOpenChange }: PublishToDbModalProps) {
    const { activeDate, baseSchedules, publishDailyChanges, publishToSupabase } = useScheduleStore();
    const [isPublishing, setIsPublishing] = useState(false);
    const [needsOverwrite, setNeedsOverwrite] = useState(false);

    const handlePublish = async () => {
        setIsPublishing(true);
        setNeedsOverwrite(false);
        try {
            // 1. Publish to Excel (Original Flow)
            await publishDailyChanges();

            // 2. Publish to Supabase (New Flow)
            const result = await publishToSupabase(false); // Try without overwrite first

            if (!result.success && result.exists) {
                setNeedsOverwrite(true);
                setIsPublishing(false);
                return; // Stop here, ask for overwrite
            }

            if (result.success) {
                onOpenChange(false);
            }
        } catch (error) {
            console.error("Publish flow failed", error);
        } finally {
            if (!needsOverwrite) setIsPublishing(false);
        }
    };

    const handleOverwrite = async () => {
        setIsPublishing(true);
        try {
            // Force overwrite on Supabase
            await publishToSupabase(true);
            onOpenChange(false);
            setNeedsOverwrite(false);
        } finally {
            setIsPublishing(false);
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={(val) => !isPublishing && onOpenChange(val)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        {needsOverwrite ? "Schedule Already Exists" : "Publish Schedule"}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        {needsOverwrite ? (
                            <span className="text-destructive font-medium">
                                A schedule for {activeDate} has already been published. Do you want to overwrite it?
                                This will update the version available to all users.
                            </span>
                        ) : (
                            <>
                                Are you sure you want to publish the schedule for <strong>{activeDate}</strong>?
                                <br /><br />
                                This will:
                                <ul className="list-disc pl-5 mt-2 space-y-1">
                                    <li>Update the Excel file in OneDrive</li>
                                    <li>Save the schedule to the database</li>
                                    <li>Notify all users of the update</li>
                                </ul>
                                <p className="mt-4 text-xs text-muted-foreground">
                                    Total Records: {baseSchedules.length}
                                </p>
                            </>
                        )}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isPublishing} onClick={() => setNeedsOverwrite(false)}>
                        Cancel
                    </AlertDialogCancel>
                    {needsOverwrite ? (
                        <AlertDialogAction onClick={handleOverwrite} disabled={isPublishing} className="bg-destructive hover:bg-destructive/90">
                            {isPublishing ? <Loader2 className="animate-spin mr-2" /> : null}
                            Overwrite
                        </AlertDialogAction>
                    ) : (
                        <AlertDialogAction onClick={handlePublish} disabled={isPublishing}>
                            {isPublishing ? <Loader2 className="animate-spin mr-2" /> : null}
                            Publish
                        </AlertDialogAction>
                    )}
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
