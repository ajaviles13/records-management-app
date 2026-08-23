import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { NAV_ITEMS } from "@/lib/roles";
import { cn } from "@/lib/utils";

export function ConfigureLayout() {
  const { user } = useAuth();
  if (!user) return null;

  const tabs =
    NAV_ITEMS.find((item) => item.to === "/configure")?.children?.filter((child) =>
      child.roles.includes(user.role_access),
    ) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Configure</h2>
        <p className="text-sm text-muted-foreground">Manage who has access to the platform and how it connects to external systems.</p>
      </div>
      <div className="flex gap-1 border-b">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              cn(
                "-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
                isActive ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>
      <Outlet />
    </div>
  );
}
