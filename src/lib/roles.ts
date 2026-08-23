import type { RoleAccess } from "@/types";

export const NAV_ITEMS: { to: string; label: string; roles: RoleAccess[] }[] = [
  { to: "/records", label: "Records", roles: ["Analyst", "Manager", "Administrator"] },
  { to: "/snapshot", label: "My Snapshot", roles: ["Analyst", "Manager", "Administrator"] },
  { to: "/audit", label: "Audit Log", roles: ["Administrator"] },
  { to: "/dashboard", label: "Dashboard", roles: ["Manager", "Administrator", "Viewer"] },
];

export function canAccess(role: RoleAccess, path: string): boolean {
  if (path === "/account") return true;
  const item = NAV_ITEMS.find((nav) => nav.to === path);
  return item ? item.roles.includes(role) : false;
}

export function defaultPath(role: RoleAccess): string {
  return NAV_ITEMS.find((item) => item.roles.includes(role))?.to ?? "/account";
}

export function canEditRecords(role: RoleAccess): boolean {
  return role !== "Viewer";
}

export function userInitials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || "?";
}

export function displayName(first: string, last: string): string {
  return `${first} ${last}`.trim();
}
