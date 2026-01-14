import { useState, useEffect } from "react";
import { openUrl } from '@tauri-apps/plugin-opener';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Unplug, Link2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ZoomAccount {
    email: string;
    name: string;
    connected_at: string;
}

export function ZoomIntegration() {
    const [isLoading, setIsLoading] = useState(true);
    const [account, setAccount] = useState<ZoomAccount | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isDisconnecting, setIsDisconnecting] = useState(false);

    const fetchStatus = async () => {
        try {
            setIsLoading(true);
            const { data, error } = await supabase.functions.invoke('zoom-auth', {
                body: { action: 'status' },
                method: 'POST'
            });

            if (error) throw error;

            if (data?.connected && data?.account) {
                setAccount(data.account);
            } else {
                setAccount(null);
            }
        } catch (error) {
            console.error("Zoom status error:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
    }, []);

    const handleConnect = async () => {
        try {
            setIsConnecting(true);

            // 1. Get Auth URL from Edge Function
            const { data, error } = await supabase.functions.invoke('zoom-auth', {
                body: { action: 'init' },
                method: 'POST'
            });

            if (error) throw error;
            if (!data?.url) throw new Error("No URL returned");

            // 2. Open Browser (Tauri - System Default)
            // @ts-ignore
            await openUrl(data.url);

            toast.info("Please complete authentication in your browser...");

            // 3. Start Polling for success
            const startTime = Date.now();
            const POLL_INTERVAL = 2000; // 2s
            const TIMEOUT = 180000; // 3 min

            const timer = setInterval(async () => {
                if (Date.now() - startTime > TIMEOUT) {
                    clearInterval(timer);
                    setIsConnecting(false);
                    toast.error("Connection timed out. Please try again.");
                    return;
                }

                try {
                    const { data: statusData, error: statusError } = await supabase.functions.invoke('zoom-auth', {
                        body: { action: 'status' },
                        method: 'POST'
                    });

                    if (statusError) {
                        // Critical error check if needed
                    }

                    if (statusData?.connected) {
                        clearInterval(timer);
                        setAccount(statusData.account);
                        setIsConnecting(false);
                        toast.success("Zoom connected successfully!");
                    }
                } catch (e) {
                    // Ignore
                }
            }, POLL_INTERVAL);

        } catch (error: any) {
            toast.error(error.message || "Failed to start connection");
            setIsConnecting(false);
        }
    };

    const handleDisconnect = async (e: React.MouseEvent) => {
        // Prevent AlertDialog from closing immediately if we want to show loading state inside?
        // Actually for simplicity, we let it close but disabling the trigger button avoids double clicks?
        // But the trigger is only disabled IF the dialog is closed.
        // Let's just track state.
        e.preventDefault(); // Prevent default close logic to handle async? 
        // No, standard AlertDialogAction closes immediately. Preventing default keeps it open.

        try {
            setIsDisconnecting(true);
            const { error } = await supabase.functions.invoke('zoom-auth', {
                body: { action: 'disconnect' },
                method: 'POST'
            });

            if (error) throw error;

            setAccount(null);
            toast.success("Zoom disconnected");
            // If we prevented default, we'd need to manually close the dialog here via controlled state.
            // But since 'setAccount(null)' removes the dialog entirely from DOM (rendering 'Connect' button instead), 
            // it doesn't matter if we prevented default or not regarding closing.
            // The important part is disabling the button while request is in flight.
        } catch (error: any) {
            toast.error("Failed to disconnect");
        } finally {
            setIsDisconnecting(false);
        }
    };

    if (isLoading) {
        return (
            <Card className="shadow-none">
                <CardHeader>
                    <CardTitle>Zoom Integration</CardTitle>
                    <CardDescription>Loading status...</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex justify-center p-4">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="shadow-none">
            <CardHeader>
                <CardTitle>Zoom Integration</CardTitle>
                <CardDescription>
                    Connect your Zoom account to automate meeting creation.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex items-center justify-between gap-6 flex-wrap">
                    <div className="space-y-1">
                        {account ? (
                            <div className="flex items-center gap-2">
                                <div className="size-2 rounded-full bg-green-500" />
                                <span className="font-medium text-sm">
                                    Connected
                                </span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <div className="size-2 rounded-full bg-gray-300" />
                                <span className="font-medium text-sm">
                                    Not Connected
                                </span>
                            </div>
                        )}

                        <p className="text-sm text-muted-foreground">
                            {account ? `Linked to ${account.email}` : "No account linked"}
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        {account ? (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={isDisconnecting}
                                        className="border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive hover:border-destructive/50 focus-visible:ring-destructive/20 focus-visible:border-destructive dark:border-destructive/50 dark:bg-destructive/10 dark:text-destructive dark:hover:bg-destructive/20 dark:hover:text-destructive dark:hover:border-destructive/50 dark:focus-visible:ring-destructive/20 dark:focus-visible:border-destructive"
                                    >
                                        {isDisconnecting ? <Loader2 className="animate-spin" /> : <Unplug />}
                                        {isDisconnecting ? "Waiting..." : "Disconnect"}
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will disconnect your Zoom account. You won't be able to schedule meetings automatically properly until you reconnect.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel disabled={isDisconnecting}>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleDisconnect} disabled={isDisconnecting}>
                                            {isDisconnecting ? (
                                                <>
                                                    <Loader2 className="animate-spin" />
                                                    Disconnecting...
                                                </>
                                            ) : (
                                                "Disconnect"
                                            )}
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        ) : (
                            <Button variant="outline" size="sm" onClick={handleConnect} disabled={isConnecting}>
                                {isConnecting ? (
                                    <Loader2 className="animate-spin" />
                                ) : (
                                    <Link2 />
                                )}
                                {isConnecting ? "Connecting..." : "Connect Zoom"}
                            </Button>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
