import { NavLink, useNavigate } from "react-router-dom";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  ScrollText,
  Settings,
} from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { displayName, navItemsFor, userInitials } from "@/lib/roles";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const ICONS = {
  "/records": ClipboardList,
  "/snapshot": BarChart3,
  "/audit": ScrollText,
  "/dashboard": LayoutDashboard,
  "/configure": Settings,
} as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useLocalStorage("sla.sidebarCollapsed", false);

  if (!user) return null;

  const items = navItemsFor(user.role_access);
  const name = displayName(user.first_name, user.last_name);
  const initials = userInitials(user.first_name, user.last_name);

  return (
    <div className="flex h-full min-h-0">
      <aside
        className={cn(
          "flex shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200",
          collapsed ? "w-16" : "w-60",
        )}
      >
        <div className={cn("flex items-start gap-1", collapsed ? "justify-center px-2 pt-4 pb-2" : "px-4 pt-4 pb-3")}>
          {collapsed ? null : (
            <div className="min-w-0 flex-1 px-1 pt-1">
              <p className="text-xs font-semibold tracking-[0.18em] text-teal-200/80 uppercase">AuraCom</p>
              <h1 className="mt-1 text-lg leading-tight font-semibold">SLA Tracker</h1>
            </div>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setCollapsed(!collapsed)}
            className="mt-0.5 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          </Button>
        </div>

        <nav className={cn("flex flex-1 flex-col gap-1", collapsed ? "px-2" : "px-3")}>
          {items.map((item) => {
            const Icon = ICONS[item.to as keyof typeof ICONS];
            return (
              <div key={item.to}>
                <NavLink
                  to={item.to}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center rounded-md text-sm font-medium transition-colors",
                      collapsed ? "justify-center px-0 py-2.5" : "gap-2 px-3 py-2",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
                    )
                  }
                >
                  {Icon ? <Icon className="size-4 shrink-0" /> : null}
                  {collapsed ? <span className="sr-only">{item.label}</span> : item.label}
                </NavLink>
                {item.children?.length && !collapsed ? (
                  <div className="mt-1 flex flex-col gap-1 border-l border-sidebar-border pl-3">
                    {item.children.map((child) => (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        className={({ isActive }) =>
                          cn(
                            "rounded-md px-3 py-1.5 text-sm transition-colors",
                            isActive
                              ? "bg-sidebar-accent text-sidebar-accent-foreground"
                              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
                          )
                        }
                      >
                        {child.label}
                      </NavLink>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>

        <div className={cn("mt-auto", collapsed ? "px-2 pb-3" : "px-3 pb-3")}>
          <Separator className="mb-3 bg-sidebar-border" />
          {collapsed ? (
            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                title={name}
                onClick={() => navigate("/account")}
                className="rounded-full hover:opacity-90"
              >
                <Avatar className="size-8">
                  <AvatarImage src={user.profile_image || undefined} alt={name} />
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
              </button>
              <Button
                variant="ghost"
                size="icon-sm"
                title="Sign out"
                aria-label="Sign out"
                onClick={() => {
                  logout();
                  navigate("/login");
                }}
                className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                <LogOut className="size-4" />
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => navigate("/account")}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-sidebar-accent"
              >
                <Avatar className="size-8 shrink-0">
                  <AvatarImage src={user.profile_image || undefined} alt={name} />
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 leading-tight">
                  <p className="truncate text-sm font-medium">{name}</p>
                  <p className="truncate text-xs text-sidebar-foreground/70">{user.role_access}</p>
                </div>
              </button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  logout();
                  navigate("/login");
                }}
                className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                <LogOut className="size-4" />
                Sign out
              </Button>
            </div>
          )}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">

        <main className="min-h-0 flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
