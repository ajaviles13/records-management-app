import type { RoleAccess, SavedView, User } from "@/types";

export interface NavItem {
  to: string;
  label: string;
  roles: RoleAccess[];
  children?: NavItem[];
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/records", label: "Records", roles: ["Analyst", "Manager", "Administrator"] },
  { to: "/snapshot", label: "My Snapshot", roles: ["Analyst", "Manager", "Administrator"] },
  { to: "/audit", label: "Audit Log", roles: ["Administrator"] },
  { to: "/dashboard", label: "Dashboard", roles: ["Manager", "Administrator", "Viewer"] },
  {
    to: "/configure",
    label: "Configure",
    roles: ["Manager", "Administrator"],
    children: [
      { to: "/configure/users", label: "Users", roles: ["Manager", "Administrator"] },
      { to: "/configure/connectors", label: "Connectors", roles: ["Administrator"] },
    ],
  },
];

function flattenNav(items: NavItem[]): NavItem[] {
  return items.flatMap((item) => (item.children ? [item, ...flattenNav(item.children)] : [item]));
}

/** Nav entries a role may see, with unavailable children pruned. */
export function navItemsFor(role: RoleAccess): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role)).map((item) =>
    item.children ? { ...item, children: item.children.filter((child) => child.roles.includes(role)) } : item,
  );
}

export function canAccess(role: RoleAccess, path: string): boolean {
  if (path === "/account") return true;
  const item = flattenNav(NAV_ITEMS).find((nav) => nav.to === path);
  return item ? item.roles.includes(role) : false;
}

export function defaultPath(role: RoleAccess): string {
  const landable = flattenNav(NAV_ITEMS).filter((item) => !item.children);
  return landable.find((item) => item.roles.includes(role))?.to ?? "/account";
}

/** The first Configure child tab this role can open, used for the `/configure` redirect. */
export function defaultConfigurePath(role: RoleAccess): string {
  const configure = NAV_ITEMS.find((item) => item.to === "/configure");
  return configure?.children?.find((child) => child.roles.includes(role))?.to ?? defaultPath(role);
}

export function canEditRecords(role: RoleAccess): boolean {
  return role !== "Viewer";
}

/** Managers and Administrators may add and remove users on Configure > Users. */
export function canManageUsers(role: RoleAccess): boolean {
  return role === "Manager" || role === "Administrator";
}

/**
 * Roles a given role may grant when creating or removing a user. A Manager cannot
 * create or remove an Administrator.
 */
export function assignableRoles(role: RoleAccess): RoleAccess[] {
  if (role === "Administrator") return ["Analyst", "Manager", "Administrator", "Viewer"];
  if (role === "Manager") return ["Analyst", "Manager", "Viewer"];
  return [];
}

export function canAssignRole(actor: RoleAccess, target: RoleAccess): boolean {
  return assignableRoles(actor).includes(target);
}

/** Only Administrators can configure external connectors. */
export function canSeeConnectors(role: RoleAccess): boolean {
  return role === "Administrator";
}

/** Saved views are unavailable to Viewers. */
export function canUseSavedViews(role: RoleAccess): boolean {
  return role !== "Viewer";
}

/** Managers and Administrators can share a view with other users or whole roles. */
export function canAssignViews(role: RoleAccess): boolean {
  return role === "Manager" || role === "Administrator";
}

/** Managers and Administrators can reassign a record to a different analyst or manager. */
export function canAssignRecords(role: RoleAccess): boolean {
  return role === "Manager" || role === "Administrator";
}

/**
 * A view is editable only by the user who owns it. Recipients of an inherited view see
 * no pencil icon, whether they inherited it individually or through their role.
 */
export function canEditView(user: Pick<User, "user_id" | "role_access">, view: Pick<SavedView, "owner_user_id">): boolean {
  if (!canUseSavedViews(user.role_access)) return false;
  return view.owner_user_id === user.user_id;
}

/** Analysts, Managers, and Administrators can export the view they are looking at. */
export function canExport(role: RoleAccess): boolean {
  return role !== "Viewer";
}

/** Managers and Administrators see team-wide numbers in My Snapshot rather than only their own. */
export function seesAllRecords(role: RoleAccess): boolean {
  return role === "Manager" || role === "Administrator";
}

export function userInitials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || "?";
}

export function displayName(first: string, last: string): string {
  return `${first} ${last}`.trim();
}
