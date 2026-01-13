import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/components/auth-provider";
import { ReactNode } from "react";

interface ProtectedRouteProps {
    children: ReactNode;
    requiredPermission?: string;
    requiredLevel?: number;
}

/**
 * Protege rutas que requieren autenticación.
 * Opcionalmente verifica permisos específicos o niveles de rol.
 */
export function ProtectedRoute({
    children,
    requiredPermission,
    requiredLevel
}: ProtectedRouteProps) {
    const { user, profile, isLoading, hasPermission } = useAuth();
    const location = useLocation();

    // Aún cargando estado de autenticación
    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    // No autenticado
    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Verificar permiso si es requerido
    if (requiredPermission && !hasPermission(requiredPermission)) {
        return <Navigate to="/" replace />;
    }

    // Verificar nivel de rol si es requerido
    if (requiredLevel && (profile?.hierarchy_level ?? 0) < requiredLevel) {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
}

/**
 * Componente que requiere acceso admin (nivel >= 80)
 */
export function AdminRoute({ children }: { children: ReactNode }) {
    return (
        <ProtectedRoute requiredLevel={80}>
            {children}
        </ProtectedRoute>
    );
}

/**
 * Componente que requiere acceso super_admin (nivel >= 100)
 */
export function SuperAdminRoute({ children }: { children: ReactNode }) {
    return (
        <ProtectedRoute requiredLevel={100}>
            {children}
        </ProtectedRoute>
    );
}
