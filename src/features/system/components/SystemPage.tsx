import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ManageUsersModal } from "./ManageUsersModal";
import { ManageRolesModal } from "./ManageRolesModal";

export function SystemPage() {
    const [isManageUsersOpen, setIsManageUsersOpen] = useState(false);
    const [isManageRolesOpen, setIsManageRolesOpen] = useState(false);
    return (
        <div className="space-y-6">
            <div className="flex flex-col py-8 my-4 gap-1">
                <h1 className="text-xl font-bold tracking-tight">System Administration</h1>
                <p className="text-muted-foreground">Manage users, roles, and system configuration.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Left Column */}
                <div className="space-y-6">
                    {/* User Management */}
                    <Card className="shadow-none">
                        <CardHeader>
                            <CardTitle>User Management</CardTitle>
                            <CardDescription>
                                View and manage user accounts and their roles.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <p className="font-medium text-sm">Total Users</p>
                                    <p className="text-2xl font-semibold">--</p>
                                </div>
                                <Button variant="outline" size="sm" onClick={() => setIsManageUsersOpen(true)}>
                                    Manage Users
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Role & Permissions */}
                    <Card className="shadow-none">
                        <CardHeader>
                            <CardTitle>Roles & Permissions</CardTitle>
                            <CardDescription>
                                Configure role hierarchies and permission assignments.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <p className="font-medium text-sm">Role Management</p>
                                    <p className="text-xs text-muted-foreground">
                                        View and configure roles and their permissions.
                                    </p>
                                </div>
                                <Button variant="outline" size="sm" onClick={() => setIsManageRolesOpen(true)}>
                                    Manage Roles
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                    {/* Database Status */}
                    <Card className="shadow-none">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                Database Status
                            </CardTitle>
                            <CardDescription>
                                Supabase connection and database health.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-2">
                                <div className="size-2 rounded-full bg-green-500" />
                                <span className="text-sm font-medium">Connected</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-muted-foreground">Provider</span>
                                    <p className="font-medium">Supabase</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Region</span>
                                    <p className="font-medium">--</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* System Activity */}
                    <Card className="shadow-none">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                Recent Activity
                            </CardTitle>
                            <CardDescription>
                                System events and audit log.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="text-sm text-muted-foreground text-center py-8">
                                Activity log coming soon...
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Manage Users Modal */}
            <ManageUsersModal
                open={isManageUsersOpen}
                onOpenChange={setIsManageUsersOpen}
            />

            {/* Manage Roles Modal */}
            <ManageRolesModal
                open={isManageRolesOpen}
                onOpenChange={setIsManageRolesOpen}
            />
        </div>
    );
}
