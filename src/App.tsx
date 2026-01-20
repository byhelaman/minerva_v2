import { Routes, Route, Outlet } from "react-router-dom";
import { useEffect } from "react";
import { MainNav } from "@/components/main-nav";
import { UserNav } from "@/components/user-nav";
import { ScheduleDashboard } from "@/features/schedules/components/ScheduleDashboard";
import { SettingsPage } from "@/features/settings/components/SettingsPage";
import { ProfilePage } from "@/features/profile/components/ProfilePage";
import { DocsPage } from "@/features/docs/components/DocsPage";
import { SystemPage } from "@/features/system/components/SystemPage";
import { LoginPage } from "@/features/auth/components/LoginPage";
import { ProtectedRoute, AdminRoute } from "@/components/ProtectedRoute";
import { useSettings } from "@/components/settings-provider";
import { useTheme } from "@/components/theme-provider";

// Sincroniza el tema desde el archivo de configuración al ThemeProvider al cargar la app
function ThemeSyncer() {
  const { settings, isLoading } = useSettings();
  const { setTheme } = useTheme();

  useEffect(() => {
    if (!isLoading && settings.theme) {
      setTheme(settings.theme);
    }
  }, [isLoading, settings.theme, setTheme]);

  return null;
}

function Layout() {
  return (
    <div className="flex flex-col min-h-screen gap-6 p-5">
      <ThemeSyncer />
      <div className="flex pr-3">
        <MainNav />
        <div className="ml-auto flex items-center space-x-4">
          <UserNav />
        </div>
      </div>
      <div className="w-full max-w-[1400px] mx-auto pb-8">
        <Outlet />
      </div>
    </div>
  );
}



import { UpdateDialog } from "@/components/update-dialog";

function App() {
  return (
    <>
      <UpdateDialog />
      <Routes>
        {/* Ruta pública - Login (signup se hace desde el dialog) */}
        <Route path="/login" element={<LoginPage />} />

        {/* Rutas protegidas */}
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<ScheduleDashboard />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/docs" element={<DocsPage />} />
          <Route path="/system" element={
            <AdminRoute>
              <SystemPage />
            </AdminRoute>
          } />
        </Route>
      </Routes>
    </>
  );
}

export default App;

