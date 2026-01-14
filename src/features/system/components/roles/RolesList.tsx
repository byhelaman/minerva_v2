/**
 * Componente del panel izquierdo que muestra la lista de roles disponibles.
 * Resalta los roles del sistema con un ícono de escudo.
 */
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield } from "lucide-react";
import { Role, isSystemRole } from "./types";
import { cn } from "@/lib/utils";

interface RolesListProps {
    roles: Role[];
    selectedRole: string | null;
    onSelectRole: (roleName: string) => void;
}

export function RolesList({ roles, selectedRole, onSelectRole }: RolesListProps) {
    return (
        <div className="w-[200px] shrink-0">
            <ScrollArea className="h-[380px] pr-3">
                <div className="space-y-1 p-1">
                    {roles.map((role) => (
                        <button
                            key={role.name}
                            onClick={() => onSelectRole(role.name)}
                            className={cn(
                                "w-full text-left px-3 py-2 rounded-md transition-colors flex items-center justify-between gap-2",
                                selectedRole === role.name
                                    ? "bg-accent text-accent-foreground"
                                    : "hover:bg-muted"
                            )}
                        >
                            <div className="flex items-center gap-2 min-w-0">
                                {isSystemRole(role.name) ? (
                                    <Shield className="size-4 text-muted-foreground shrink-0" />
                                ) : (
                                    <div className="size-4" />
                                )}
                                <div className="min-w-0">
                                    <p className="font-medium text-sm truncate">{role.name}</p>
                                    <p className="text-xs text-muted-foreground">Level {role.hierarchy_level}</p>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}
