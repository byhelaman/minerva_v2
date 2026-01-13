import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

// Tipos
export interface Profile {
    id: string;
    email: string;
    display_name: string | null;
    role: string;
    hierarchy_level: number;
    permissions: string[];
}

interface AuthContextType {
    session: Session | null;
    user: User | null;
    profile: Profile | null;
    isLoading: boolean;
    signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
    signUp: (email: string, password: string, displayName?: string) => Promise<{ error: Error | null }>;
    signOut: () => Promise<void>;
    hasPermission: (permission: string) => boolean;
    isAdmin: () => boolean;
    isSuperAdmin: () => boolean;
    sendResetPasswordEmail: (email: string) => Promise<{ error: Error | null }>;
    verifyOtp: (email: string, token: string, type: "email" | "signup" | "recovery") => Promise<{ data: any; error: Error | null }>;
    updatePassword: (password: string) => Promise<{ error: Error | null }>;
    updateDisplayName: (displayName: string) => Promise<{ error: Error | null }>;
    refreshProfile: () => Promise<void>;
    verifyCurrentPassword: (password: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Obtener perfil del usuario desde Supabase con timeout
    const fetchProfile = async (): Promise<Profile | null> => {
        try {
            // Timeout de 3 segundos para el RPC
            const rpcPromise = supabase.rpc("get_my_profile");
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("RPC timeout - function may not exist")), 3000)
            );

            const { data, error } = await Promise.race([rpcPromise, timeoutPromise]) as { data: Profile | null; error: Error | null };

            if (error) {
                return null;
            }
            return data as Profile;
        } catch {
            // Devolver perfil vacío para que la app funcione
            return null;
        }
    };

    // Inicializar estado de autenticación
    useEffect(() => {
        let mounted = true;
        let initialSessionLoaded = false;

        // Obtener sesión inicial - usando el patrón recomendado por Supabase
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            if (!mounted) return;
            initialSessionLoaded = true;

            setSession(session);
            setUser(session?.user ?? null);

            if (session?.user) {
                const profileData = await fetchProfile();
                if (mounted) {
                    setProfile(profileData);
                    setIsLoading(false);
                }
            } else {
                setIsLoading(false);
            }
        });

        // Escuchar cambios de autenticación
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                // Ignorar eventos antes de que la sesión inicial se haya cargado
                if (!initialSessionLoaded && event === "SIGNED_IN") {
                    return;
                }

                // Manejar sesión expirada o cerrada
                if (event === "SIGNED_OUT" || event === "TOKEN_REFRESHED" && !session) {
                    setSession(null);
                    setUser(null);
                    setProfile(null);
                    if (mounted) {
                        setIsLoading(false);
                    }
                    return;
                }

                setSession(session);
                setUser(session?.user ?? null);

                if (session?.user) {
                    const profileData = await fetchProfile();
                    if (mounted) {
                        setProfile(profileData);
                    }
                } else {
                    setProfile(null);
                }

                if (mounted) {
                    setIsLoading(false);
                }
            }
        );

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    // Iniciar sesión con email/contraseña
    const signIn = async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        return { error: error as Error | null };
    };

    // Registrar usuario con email/contraseña
    const signUp = async (email: string, password: string, displayName?: string) => {
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    display_name: displayName || null,
                },
            },
        });
        return { error: error as Error | null };
    };

    // Cerrar sesión
    const signOut = async () => {
        await supabase.auth.signOut();
        setProfile(null);
    };

    // Enviar OTP para reset de contraseña
    const sendResetPasswordEmail = async (email: string) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        return { error: error as Error | null };
    };

    // Verificar OTP
    const verifyOtp = async (email: string, token: string, type: "email" | "signup" | "recovery") => {
        const { data, error } = await supabase.auth.verifyOtp({
            email,
            token,
            type,
        });
        return { data, error: error as Error | null };
    };

    // Actualizar contraseña
    const updatePassword = async (password: string) => {
        const { error } = await supabase.auth.updateUser({
            password,
        });
        return { error: error as Error | null };
    };

    // Verificar si el usuario tiene un permiso específico
    const hasPermission = (permission: string): boolean => {
        if (!profile) return false;
        return profile.permissions?.includes(permission) ?? false;
    };

    // Verificar si el usuario es admin o superior
    const isAdmin = (): boolean => {
        return (profile?.hierarchy_level ?? 0) >= 80;
    };

    // Verificar si el usuario es super_admin
    const isSuperAdmin = (): boolean => {
        return (profile?.hierarchy_level ?? 0) >= 100;
    };

    // Actualizar display name del usuario
    const updateDisplayName = async (displayName: string) => {
        // Actualizar user_metadata en auth.users
        const { error: authError } = await supabase.auth.updateUser({
            data: { display_name: displayName },
        });

        if (authError) {
            return { error: authError as Error };
        }

        // Actualizar la tabla profiles usando RPC (bypasses RLS)
        const { error: profileError } = await supabase.rpc("update_my_display_name", {
            new_display_name: displayName,
        });

        if (profileError) {
            return { error: profileError as Error };
        }

        // Refrescar el perfil para obtener los datos actualizados
        const profileData = await fetchProfile();
        setProfile(profileData);

        return { error: null };
    };

    // Refrescar perfil manualmente
    const refreshProfile = async () => {
        const profileData = await fetchProfile();
        setProfile(profileData);
    };

    // Verificar contraseña actual (re-autenticación)
    const verifyCurrentPassword = async (password: string) => {
        if (!profile?.email) {
            return { error: new Error("No email found") };
        }

        const { error } = await supabase.auth.signInWithPassword({
            email: profile.email,
            password,
        });

        return { error: error as Error | null };
    };

    return (
        <AuthContext.Provider
            value={{
                session,
                user,
                profile,
                isLoading,
                signIn,
                signUp,
                signOut,
                hasPermission,
                isAdmin,
                isSuperAdmin,
                sendResetPasswordEmail,
                verifyOtp,
                updatePassword,
                updateDisplayName,
                refreshProfile,
                verifyCurrentPassword,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
