import type { AuditLogEntry, DataDictionaryField, FieldOption, FileRecord, LanguageCode, SavedView, User } from "@/types";

const SESSION_KEY = "sla.user";

export function getStoredUser(): User | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user: User | null) {
  if (user) sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
  else sessionStorage.removeItem(SESSION_KEY);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const user = getStoredUser();
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  if (user) headers.set("x-user-id", user.user_id);

  const res = await fetch(path, { ...init, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof body.error === "string" ? body.error : "Request failed.");
  }
  return body as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ user: User }>("/api/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  users: () => request<{ users: User[] }>("/api/users"),
  updateUser: (id: string, patch: Partial<Pick<User, "first_name" | "last_name" | "abbreviation">>) =>
    request<{ user: User }>(`/api/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  records: () => request<{ records: FileRecord[] }>("/api/records"),
  createRecord: (record: Partial<FileRecord>) =>
    request<{ record: FileRecord }>("/api/records", {
      method: "POST",
      body: JSON.stringify(record),
    }),
  updateRecord: (id: string, patch: Partial<FileRecord>) =>
    request<{ record: FileRecord }>(`/api/records/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  auditLog: () => request<{ entries: AuditLogEntry[] }>("/api/audit-log"),
  fieldOptions: () => request<{ options: FieldOption[] }>("/api/field-options"),
  dataDictionary: () => request<{ fields: DataDictionaryField[] }>("/api/data-dictionary"),
  languageCodes: () => request<{ languages: LanguageCode[] }>("/api/language-codes"),
  views: () => request<{ views: SavedView[] }>("/api/views"),
  createView: (view: Partial<SavedView>) =>
    request<{ view: SavedView }>("/api/views", {
      method: "POST",
      body: JSON.stringify(view),
    }),
  updateView: (id: string, patch: Partial<SavedView>) =>
    request<{ view: SavedView }>(`/api/views/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  deleteView: (id: string) => request<{ ok: boolean }>(`/api/views/${id}`, { method: "DELETE" }),
};
