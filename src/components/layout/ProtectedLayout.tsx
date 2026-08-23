import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { canAccess, defaultPath } from "@/lib/roles";

export function ProtectedLayout() {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!canAccess(user.role_access, location.pathname)) {
    return <Navigate to={defaultPath(user.role_access)} replace />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
