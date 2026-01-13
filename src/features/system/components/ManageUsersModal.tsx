import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";

interface ManageUsersModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

// Placeholder users data
const mockUsers = [
    { id: "1", email: "admin@example.com", display_name: "Admin User", role: "super_admin", level: 100 },
    { id: "2", email: "manager@example.com", display_name: "Manager", role: "admin", level: 80 },
    { id: "3", email: "operator@example.com", display_name: "Operator", role: "operator", level: 50 },
    { id: "4", email: "viewer@example.com", display_name: "Viewer", role: "viewer", level: 10 },
];

export function ManageUsersModal({ open, onOpenChange }: ManageUsersModalProps) {
    const [searchQuery, setSearchQuery] = useState("");

    const filteredUsers = mockUsers.filter(user =>
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.display_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getRoleBadgeVariant = (role: string) => {
        switch (role) {
            case "super_admin": return "default";
            case "admin": return "secondary";
            case "operator": return "outline";
            default: return "outline";
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Manage Users</DialogTitle>
                    <DialogDescription>
                        View and manage user accounts and their role assignments.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Search */}
                    <InputGroup>
                        <InputGroupAddon>
                            <Search className="size-4 text-muted-foreground" />
                        </InputGroupAddon>
                        <InputGroupInput
                            placeholder="Search users..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </InputGroup>

                    {/* Users List */}
                    <div className="border rounded-lg divide-y max-h-[400px] overflow-y-auto">
                        {filteredUsers.map((user) => (
                            <div key={user.id} className="flex items-center justify-between p-3 hover:bg-muted/50">
                                <div className="space-y-0.5">
                                    <p className="font-medium text-sm">{user.display_name}</p>
                                    <p className="text-xs text-muted-foreground">{user.email}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge variant={getRoleBadgeVariant(user.role)}>
                                        {user.role}
                                    </Badge>
                                    <Button variant="ghost" size="sm" disabled>
                                        Edit
                                    </Button>
                                </div>
                            </div>
                        ))}
                        {filteredUsers.length === 0 && (
                            <div className="p-8 text-center text-muted-foreground text-sm">
                                No users found
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex justify-between items-center pt-2">
                        <p className="text-sm text-muted-foreground">
                            {filteredUsers.length} user(s)
                        </p>
                        <Button variant="outline" size="sm" disabled>
                            + Invite User
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
