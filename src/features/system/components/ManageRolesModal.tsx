import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ManageRolesModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

// Mock roles data
const mockRoles = [
    {
        name: "super_admin",
        level: 100,
        description: "Full system control",
        permissions: ["schedules.read", "schedules.write", "zoom.search", "zoom.links", "users.read", "users.write", "settings.read", "settings.write"]
    },
    {
        name: "admin",
        level: 80,
        description: "User management",
        permissions: ["schedules.read", "schedules.write", "zoom.search", "zoom.links", "users.read", "users.write", "settings.read"]
    },
    {
        name: "operator",
        level: 50,
        description: "Schedule management",
        permissions: ["schedules.read", "schedules.write", "zoom.search", "zoom.links"]
    },
    {
        name: "viewer",
        level: 10,
        description: "Read only access",
        permissions: ["schedules.read"]
    },
];

export function ManageRolesModal({ open, onOpenChange }: ManageRolesModalProps) {
    const [selectedRole, setSelectedRole] = useState<string | null>(null);

    const currentRole = mockRoles.find(r => r.name === selectedRole);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[650px] gap-6">
                <DialogHeader>
                    <DialogTitle>Roles & Permissions</DialogTitle>
                    <DialogDescription>
                        Configure role hierarchies and permission assignments.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex gap-2">
                    {/* Roles List */}
                    <Card className="shadow-none w-[200px] shrink-0 p-0 overflow-hidden border-0 rounded-none">
                        <ScrollArea className="max-h-[350px]">
                            <div className="divide-y pr-4">
                                {mockRoles.map((role) => (
                                    <button
                                        key={role.name}
                                        onClick={() => setSelectedRole(role.name)}
                                        className={`w-full flex items-center justify-between p-3 hover:bg-muted/50 text-left transition-colors ${selectedRole === role.name ? "bg-muted" : ""
                                            }`}
                                    >
                                        <div className="space-y-0.5">
                                            <p className="font-medium text-sm truncate max-w-[120px]">{role.name}</p>
                                            <p className="text-xs text-muted-foreground">Level {role.level}</p>
                                        </div>
                                        <ChevronRight className="size-4 text-muted-foreground" />
                                    </button>
                                ))}
                            </div>
                        </ScrollArea>
                    </Card>

                    {/* Role Details */}
                    <Card className="shadow-none flex-1">
                        {currentRole ? (
                            <>
                                <CardHeader className="flex items-start justify-between gap-4">
                                    <div className="space-y-1.5">
                                        <CardTitle>{currentRole.name}</CardTitle>
                                        <CardDescription>{currentRole.description}</CardDescription>
                                    </div>
                                    <Badge variant="secondary">Level {currentRole.level}</Badge>
                                </CardHeader>
                                <CardContent className="h-full">
                                    <p className="text-xs font-medium text-muted-foreground mb-2">
                                        PERMISSIONS ({currentRole.permissions.length})
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {currentRole.permissions.map((perm) => (
                                            <Badge key={perm} variant="outline" className="text-xs">
                                                {perm}
                                            </Badge>
                                        ))}
                                    </div>
                                </CardContent>
                                <CardFooter className="gap-2">
                                    <Button variant="outline" size="sm" disabled>
                                        Edit Role
                                    </Button>
                                    <Button variant="ghost" size="sm" disabled className="text-destructive hover:text-destructive">
                                        Delete
                                    </Button>
                                </CardFooter>
                            </>
                        ) : (
                            <CardContent className="flex items-center justify-center min-h-[200px]">
                                <p className="text-sm text-muted-foreground">
                                    Select a role to view details
                                </p>
                            </CardContent>
                        )}
                    </Card>
                </div>

                <DialogFooter>
                    <Button variant="outline" size="sm" disabled>
                        + Create Role
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
