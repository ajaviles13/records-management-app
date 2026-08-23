import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "@/auth/AuthContext";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { Toaster } from "@/components/ui/sonner";
import { defaultPath } from "@/lib/roles";
import { AccountPage } from "@/pages/Account";
import { AuditLogPage } from "@/pages/AuditLog";
import { DashboardPage } from "@/pages/Dashboard";
import { LoginPage } from "@/pages/Login";
import { MySnapshotPage } from "@/pages/MySnapshot";
import { RecordsPage } from "@/pages/Records";

function HomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={user ? defaultPath(user.role_access) : "/login"} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <Toaster />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/records" element={<RecordsPage />} />
          <Route path="/snapshot" element={<MySnapshotPage />} />
          <Route path="/audit" element={<AuditLogPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/account" element={<AccountPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
