import { useState, useEffect, useRef } from "react";
import { openUrl } from '@tauri-apps/plugin-opener';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Unplug, Link2, FileSpreadsheet, X, FolderOpen, Check, Folder, RefreshCw } from "lucide-react";
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { DialogClose } from "@radix-ui/react-dialog";

interface MicrosoftAccount {
    email: string;
    name: string;
    connected_at: string;
    linked_file_id?: string;
    linked_file_name?: string;
}

interface FileSystemItem {
    id: string;
    name: string;
    type: 'file' | 'folder';
    date: string;
    parentId: string | null;
}

interface MicrosoftIntegrationProps {
    onFileSelect?: (file: { id: string; name: string } | null) => void;
    currentFile?: { id: string; name: string } | null;
}

export function MicrosoftIntegration({ onFileSelect, currentFile }: MicrosoftIntegrationProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [account, setAccount] = useState<MicrosoftAccount | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isDisconnecting, setIsDisconnecting] = useState(false);
    const [selectedFile, setSelectedFile] = useState<{ id: string; name: string } | null>(null);
    const [isFileDialogOpen, setIsFileDialogOpen] = useState(false);

    // Sync external file state if provided
    useEffect(() => {
        if (currentFile !== undefined) {
            setSelectedFile(currentFile);
        }
    }, [currentFile]);

    // ... (rest of state)

    // ... (fetchFiles, effects, auth handlers remain mostly same)

    const handleDisconnect = async () => {
        try {
            setIsDisconnecting(true);
            const { error } = await supabase.functions.invoke('microsoft-auth', {
                body: { action: 'disconnect' },
                method: 'POST'
            });

            if (error) throw error;

            setAccount(null);
            setSelectedFile(null);
            if (onFileSelect) onFileSelect(null);
            setCurrentFolderId(null);
            setBreadcrumbs([{ id: null, name: "Home" }]);
            toast.success("Microsoft disconnected");
        } catch (error) {
            toast.error("Failed to disconnect");
        } finally {
            setIsDisconnecting(false);
        }
    };

    const handleSelectFile = async (file: { id: string; name: string }) => {
        try {
            // Persist to backend
            const { error } = await supabase.functions.invoke('microsoft-auth', {
                body: {
                    action: 'link-file',
                    fileId: file.id,
                    fileName: file.name
                },
                method: 'POST'
            });

            if (error) throw error;

            setSelectedFile(file);
            if (onFileSelect) onFileSelect(file);
            setIsFileDialogOpen(false);
            toast.success(`Linked file: ${file.name}`);
        } catch (error) {
            console.error("Failed to link file", error);
            toast.error("Failed to save file selection");
        }
    };

    // Restoring File Navigation State and Logic
    const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
    const [breadcrumbs, setBreadcrumbs] = useState<{ id: string | null, name: string }[]>([{ id: null, name: "Home" }]);
    const [files, setFiles] = useState<FileSystemItem[]>([]);
    const [isLoadingFiles, setIsLoadingFiles] = useState(false);
    const [fileCache, setFileCache] = useState<Record<string, FileSystemItem[]>>({});
    const currentFolderRef = useRef(currentFolderId);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Keep ref in sync
    useEffect(() => {
        currentFolderRef.current = currentFolderId;
    }, [currentFolderId]);

    // Load files when folder changes
    const fetchFiles = async (forceRefresh = false) => {
        if (!isFileDialogOpen || !account) return;

        const targetFolder = currentFolderId || 'root';

        // Check Cache first
        if (!forceRefresh && fileCache[targetFolder]) {
            setFiles(fileCache[targetFolder]);
            setIsLoadingFiles(false);
            return;
        }
        try {
            setIsLoadingFiles(true);
            const { data, error } = await supabase.functions.invoke('microsoft-graph', {
                body: {
                    action: 'list-children',
                    folderId: currentFolderId
                },
                method: 'POST'
            });

            if (error) throw error;

            // Race Condition Check
            const currentActiveFolder = currentFolderRef.current || 'root';
            if (targetFolder !== currentActiveFolder) {
                console.log("Ignoring stale response for", targetFolder);
                return;
            }

            // Transform Graph API data to our format
            const items: FileSystemItem[] = data.value.map((item: any) => ({
                id: item.id,
                name: item.name,
                type: item.folder ? 'folder' : 'file',
                date: new Date(item.lastModifiedDateTime).toLocaleDateString(),
                parentId: currentFolderId
            }));

            setFiles(items);
            setFileCache(prev => ({ ...prev, [targetFolder]: items }));
        } catch (error) {
            console.error("Failed to load files", error);
            toast.error("Failed to load OneDrive files");
        } finally {
            const currentActiveFolder = currentFolderRef.current || 'root';
            if (targetFolder === currentActiveFolder) {
                setIsLoadingFiles(false);
            }
        }
    };

    useEffect(() => {
        fetchFiles();
    }, [currentFolderId, isFileDialogOpen, account]);

    const handleRefresh = () => {
        fetchFiles(true);
    };

    // Initial Status Check
    useEffect(() => {
        const fetchStatus = async () => {
            try {
                // setIsLoading(true); // Don't block UI entirely
                const { data, error } = await supabase.functions.invoke('microsoft-auth', {
                    body: { action: 'status' },
                    method: 'POST'
                });

                if (!error && data?.connected && data?.account) {
                    setAccount(data.account);
                    // Load linked file if exists
                    if (data.account.file_id && data.account.file_name) {
                        const file = { id: data.account.file_id, name: data.account.file_name };
                        setSelectedFile(file);
                        if (onFileSelect) onFileSelect(file);
                    }
                }
            } catch (error) {
                console.error("Status check failed", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchStatus();
    }, []);

    // Cleanup timer
    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    const handleConnect = async () => {
        try {
            setIsConnecting(true);
            const { data, error } = await supabase.functions.invoke('microsoft-auth', {
                body: { action: 'init' },
                method: 'POST'
            });

            if (error) throw error;
            if (!data?.url) throw new Error("No URL returned");

            // Open Auth URL
            await openUrl(data.url);
            toast.info("Please complete sign in your browser...");

            // Start Polling
            const startTime = Date.now();
            const POLL_INTERVAL = 3000;
            const TIMEOUT = 180000; // 3 min

            if (timerRef.current) clearInterval(timerRef.current);

            timerRef.current = setInterval(async () => {
                if (Date.now() - startTime > TIMEOUT) {
                    handleCancelConnect();
                    toast.error("Connection timed out");
                    return;
                }

                const { data: status } = await supabase.functions.invoke('microsoft-auth', {
                    body: { action: 'status' },
                    method: 'POST'
                });

                if (status?.connected) {
                    if (timerRef.current) clearInterval(timerRef.current);
                    setAccount(status.account);
                    setIsConnecting(false);
                    toast.success("Microsoft connected successfully!");
                }
            }, POLL_INTERVAL);

        } catch (error: any) {
            toast.error(error.message || "Failed to start connection");
            setIsConnecting(false);
        }
    };

    const handleNavigate = (folderId: string | null, folderName: string) => {
        setCurrentFolderId(folderId);
        setBreadcrumbs(prev => [...prev, { id: folderId, name: folderName }]);
    };

    const handleBreadcrumbClick = (index: number) => {
        const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
        setBreadcrumbs(newBreadcrumbs);
        setCurrentFolderId(newBreadcrumbs[newBreadcrumbs.length - 1].id);
    };

    const handleCancelConnect = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        setIsConnecting(false);
        toast.info("Connection cancelled");
    };

    if (isLoading) {
        return (
            <Card className="shadow-none">
                <CardHeader>
                    <CardTitle>Microsoft Integration</CardTitle>
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
                <CardTitle>Microsoft Integration</CardTitle>
                <CardDescription>
                    Connect your Microsoft account and link an Excel file.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex items-center justify-between gap-6 flex-wrap">
                    <div className="space-y-1">
                        {account ? (
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                    <div className="size-2 rounded-full bg-green-500" />
                                    <span className="font-medium text-sm">
                                        Connected
                                    </span>
                                </div>
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
                            {account ? `Linked to ${account.email} ` : "No account linked"}
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        {account && (
                            <Dialog open={isFileDialogOpen} onOpenChange={setIsFileDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="outline" size="sm">
                                        <FolderOpen />
                                        {selectedFile ? "Change File" : "Browse"}
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-[500px]">
                                    <DialogHeader>
                                        <DialogTitle>Select from OneDrive</DialogTitle>
                                        <DialogDescription>
                                            Navigate your folders to find the Excel file.
                                        </DialogDescription>
                                    </DialogHeader>

                                    {/* Breadcrumbs */}
                                    <div className="my-1 px-1 flex items-center justify-between">
                                        <Breadcrumb>
                                            <BreadcrumbList>
                                                {breadcrumbs.map((crumb, index) => {
                                                    const isLast = index === breadcrumbs.length - 1;
                                                    return (
                                                        <span key={crumb.id || 'root'} className="flex items-center gap-1.5">
                                                            <BreadcrumbItem>
                                                                {isLast ? (
                                                                    <BreadcrumbPage>{crumb.name}</BreadcrumbPage>
                                                                ) : (
                                                                    <BreadcrumbLink
                                                                        className="cursor-pointer flex items-center gap-1"
                                                                        onClick={() => handleBreadcrumbClick(index)}
                                                                    >
                                                                        {crumb.name}
                                                                    </BreadcrumbLink>
                                                                )}
                                                            </BreadcrumbItem>
                                                            {!isLast && <BreadcrumbSeparator />}
                                                        </span>
                                                    );
                                                })}
                                            </BreadcrumbList>
                                        </Breadcrumb>
                                        <Button
                                            variant="ghost"
                                            size="icon-sm"
                                            onClick={handleRefresh}
                                            disabled={isLoadingFiles}
                                            title="Refresh folder"
                                        >
                                            <RefreshCw />
                                        </Button>
                                    </div>

                                    <ScrollArea className="h-[300px] border rounded-md">
                                        <div className="p-2 h-full">
                                            {isLoadingFiles ? (
                                                <div className="flex flex-col items-center justify-center h-full min-h-[280px] space-y-2">
                                                    <Loader2 className="h-6 w-6 animate-spin" />
                                                    <p className="text-sm">Loading files...</p>
                                                </div>
                                            ) : files.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center h-full min-h-[280px] text-muted-foreground">
                                                    <FolderOpen className="mb-2 opacity-20" size={24} />
                                                    <p className="text-sm">Empty folder</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-1">
                                                    {files.map((item) => {
                                                        const isFolder = item.type === 'folder';
                                                        const isExcel = item.name.toLowerCase().endsWith('.xlsx');
                                                        const isDisabled = !isFolder && !isExcel;

                                                        return (
                                                            <div
                                                                key={item.id}
                                                                className={cn(
                                                                    "group flex items-center justify-between p-2 rounded-md transition-all",
                                                                    isDisabled ? "opacity-50 cursor-not-allowed" : "hover:bg-accent/50 cursor-pointer"
                                                                )}
                                                                onClick={() => {
                                                                    if (isDisabled) return;
                                                                    isFolder ? handleNavigate(item.id, item.name) : handleSelectFile({ id: item.id, name: item.name });
                                                                }}
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <div className={cn(
                                                                        "transition-colors",
                                                                        isDisabled ? "text-muted-foreground" : "text-muted-foreground group-hover:text-foreground"
                                                                    )}>
                                                                        {isFolder ? <Folder className="h-4 w-4" /> : <FileSpreadsheet className={cn("h-4 w-4", selectedFile?.id === item.id ? "text-primary" : "")} />}
                                                                    </div>
                                                                    <span className={cn(
                                                                        "text-sm leading-none transition-colors",
                                                                        !isDisabled && "group-hover:text-primary",
                                                                        selectedFile?.id === item.id ? "font-medium" : ""
                                                                    )}>
                                                                        {item.name}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-xs text-muted-foreground">
                                                                        {item.date}
                                                                    </span>
                                                                    {selectedFile?.id === item.id && !isDisabled && (
                                                                        <Check className="h-4 w-4 text-primary" />
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </ScrollArea>
                                    <DialogFooter>
                                        <DialogClose asChild>
                                            <Button variant="secondary">Cancel</Button>
                                        </DialogClose>
                                    </DialogFooter>
                                </DialogContent>

                            </Dialog>
                        )}

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
                                            This will disconnect your Microsoft account.
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
                            isConnecting ? (
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="sm" disabled className="gap-2">
                                        <Loader2 className="animate-spin" />
                                        Connecting...
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        onClick={handleCancelConnect}
                                        className="text-muted-foreground hover:text-foreground"
                                        title="Cancel connection"
                                    >
                                        <X />
                                        <span className="sr-only">Cancel</span>
                                    </Button>
                                </div>
                            ) : (
                                <Button variant="outline" size="sm" onClick={handleConnect}>
                                    <Link2 />
                                    Connect Microsoft
                                </Button>
                            )
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
