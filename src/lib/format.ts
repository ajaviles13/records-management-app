import type { User } from "@/types";

export function analystLabel(users: User[], userId: string): string {
  const user = users.find((row) => row.user_id === userId);
  if (!user) return userId || "—";
  return `${user.first_name} ${user.last_name} (${user.abbreviation})`;
}

export function formatDateTime(value: string): string {
  return value?.trim() ? value : "—";
}

export function yesNoLabel(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (normalized === "Y" || normalized === "YES") return "Yes";
  if (normalized === "N" || normalized === "NO") return "No";
  return value || "—";
}
