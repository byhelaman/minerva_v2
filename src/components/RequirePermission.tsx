import { ReactNode } from "react";
import { useAuth } from "@/components/auth-provider";

interface RequirePermissionProps {
    children: ReactNode;
    /** Permiso específico requerido (ej: "zoom.links") */
    permission?: string;
    /** Nivel mínimo de jerarquía requerido (ej: 80 para admin) */
    level?: number;
    /** Contenido alternativo si no tiene permiso */
    fallback?: ReactNode;
}

/**
 * Componente wrapper que oculta contenido según permisos del usuario.
 * 
 * @example
 * // Ocultar por nivel de rol
 * <RequirePermission level={80}>
 *     <AdminOnlyCard />
 * </RequirePermission>
 * 
 * @example
 * // Ocultar por permiso específico
 * <RequirePermission permission="zoom.links">
 *     <ZoomIntegrationCard />
 * </RequirePermission>
 */
export function RequirePermission({
    children,
    permission,
    level,
    fallback = null,
}: RequirePermissionProps) {
    const { profile, hasPermission } = useAuth();

    // Si se requiere un nivel y el usuario no lo cumple
    if (level !== undefined) {
        const userLevel = profile?.hierarchy_level ?? 0;
        if (userLevel < level) {
            return <>{fallback}</>;
        }
    }

    // Si se requiere un permiso específico y el usuario no lo tiene
    if (permission && !hasPermission(permission)) {
        return <>{fallback}</>;
    }

    return <>{children}</>;
}
