import cors from "cors";
import express from "express";
import { randomUUID } from "crypto";
import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { DATA_DIR, FILES, nowEstish, nowIso, readCsv, writeCsv } from "./csvStore";

const PORT = Number(process.env.API_PORT ?? 3001);
const DUMMY_PASSWORD = "password";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ROLES = ["Analyst", "Manager", "Administrator", "Viewer"] as const;
type Role = (typeof ROLES)[number];

function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

/** Viewers never have access to saved views, so they are not a valid assignment target. */
function isAssignableRole(value: string): value is Role {
  return value === "Analyst" || value === "Manager" || value === "Administrator";
}

/**
 * These mirror the permission helpers in src/lib/roles.ts. The server's tsconfig
 * (tsconfig.node.json) does not include src/, and roles.ts pulls in @/types via a
 * path alias that only tsconfig.app.json defines, so the server cannot import it
 * directly. The small role-hierarchy rules are duplicated here instead — keep these
 * in sync with src/lib/roles.ts if the role rules ever change.
 */
function assignableRolesServer(role: Role): Role[] {
  if (role === "Administrator") return ["Analyst", "Manager", "Administrator", "Viewer"];
  if (role === "Manager") return ["Analyst", "Manager", "Viewer"];
  return [];
}

function canAssignViewsServer(role: Role): boolean {
  return role === "Manager" || role === "Administrator";
}

function canAssignRecordsServer(role: Role): boolean {
  return role === "Manager" || role === "Administrator";
}

function canEditRecordsServer(role: Role): boolean {
  return role !== "Viewer";
}

const USER_COLUMNS = [
  "user_id",
  "email",
  "first_name",
  "last_name",
  "abbreviation",
  "role_access",
  "last_login",
  "created_at",
  "profile_image",
];

const RECORD_COLUMNS = [
  "project_number",
  "file_name",
  "line_of_business",
  "state",
  "received_at_est",
  "delivered_at_est",
  "sla_met",
  "is_urgent",
  "qa_delivery_by",
  "comment",
  "status_hours",
  "status_label",
  "internal",
  "dtp_1",
  "new",
  "fuzzy",
  "total",
  "dtp_2",
  "pm",
  "it_eng",
  "qa",
  "record_id",
  "assigned_analyst_id",
  "template_type",
  "language_code",
  "received_at_utc",
  "delivered_at_utc",
  "egnyte_direct_link",
  "egnyte_file_path",
  "egnyte_file_size_kb",
  "created_by",
  "updated_by",
  "created_at",
  "updated_at",
];

const AUDIT_COLUMNS = [
  "id",
  "timestamp",
  "artifact_id",
  "artifact_table",
  "artifact_name",
  "old_field_value",
  "new_field_value",
  "trigger_source",
  "user_id",
  "event_type",
];

const LANGUAGE_COLUMNS = ["code_id", "language", "country"] as const;

const VIEW_COLUMNS = [
  "view_id",
  "name",
  "owner_user_id",
  "object_type",
  "order",
  "fields_json",
  "conditions_json",
  "sorts_json",
  "assigned_user_ids_json",
  "assigned_roles_json",
  "created_by",
  "created_at",
  "updated_by",
  "updated_at",
];

type UserRow = Record<(typeof USER_COLUMNS)[number], string>;
type RecordRow = Record<(typeof RECORD_COLUMNS)[number], string>;
type AuditRow = Record<(typeof AUDIT_COLUMNS)[number], string>;
type ViewRow = Record<(typeof VIEW_COLUMNS)[number], string>;
type LanguageRow = Record<(typeof LANGUAGE_COLUMNS)[number], string>;

function emptyRecord(): RecordRow {
  return Object.fromEntries(RECORD_COLUMNS.map((col) => [col, ""])) as RecordRow;
}

/** Looks the actor up in data/sla-users.csv by the x-user-id header. Never trust a client-supplied role. */
function resolveActor(req: express.Request): UserRow | null {
  const id = String(req.header("x-user-id") ?? "").trim();
  if (!id) return null;
  const users = readCsv<UserRow>(FILES.users);
  return users.find((row) => row.user_id === id) ?? null;
}

/**
 * Verifies the actor against sla-users.csv and checks their role against `allowed`.
 * Sends 401 (unknown/missing actor) or 403 (role not permitted) and returns null on
 * failure — callers must return immediately when this returns null.
 */
function requireRole(req: express.Request, res: express.Response, allowed: Role[]): UserRow | null {
  const actor = resolveActor(req);
  if (!actor) {
    res.status(401).json({ error: "Not signed in." });
    return null;
  }
  if (!allowed.includes(actor.role_access as Role)) {
    res.status(403).json({ error: "You do not have permission to perform this action." });
    return null;
  }
  return actor;
}

function appendAudit(entries: Omit<AuditRow, "id" | "timestamp">[]) {
  const rows = readCsv<AuditRow>(FILES.audit);
  const timestamp = nowEstish();
  for (const entry of entries) {
    rows.push({
      id: randomUUID(),
      timestamp,
      ...entry,
    });
  }
  writeCsv(FILES.audit, rows, AUDIT_COLUMNS);
}

function displayValue(value: string | undefined): string {
  return value && value.trim() ? value : "<empty>";
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.post("/api/login", (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");
  if (!email || password !== DUMMY_PASSWORD) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }
  const users = readCsv<UserRow>(FILES.users);
  const user = users.find((row) => row.email.toLowerCase() === email);
  if (!user) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }
  user.last_login = nowIso();
  writeCsv(FILES.users, users, USER_COLUMNS);
  res.json({ user });
});

app.get("/api/users", (_req, res) => {
  res.json({ users: readCsv<UserRow>(FILES.users) });
});

app.post("/api/users", (req, res) => {
  const actor = requireRole(req, res, ["Manager", "Administrator"]);
  if (!actor) return;

  const body = (req.body ?? {}) as Record<string, unknown>;
  const email = String(body.email ?? "").trim().toLowerCase();
  const first_name = String(body.first_name ?? "").trim();
  const last_name = String(body.last_name ?? "").trim();
  const abbreviation = String(body.abbreviation ?? "").trim();
  const role_access = String(body.role_access ?? "").trim();

  if (!email || !EMAIL_RE.test(email)) {
    res.status(400).json({ error: "A valid email address is required." });
    return;
  }
  if (!first_name || !last_name) {
    res.status(400).json({ error: "First and last name are required." });
    return;
  }
  if (abbreviation.length < 2 || abbreviation.length > 4) {
    res.status(400).json({ error: "Abbreviation must be 2-4 characters." });
    return;
  }
  if (!isRole(role_access)) {
    res.status(400).json({ error: "A valid role is required." });
    return;
  }
  if (!assignableRolesServer(actor.role_access as Role).includes(role_access)) {
    res.status(403).json({ error: `You do not have permission to create users with the ${role_access} role.` });
    return;
  }

  const users = readCsv<UserRow>(FILES.users);
  if (users.some((row) => row.email.toLowerCase() === email)) {
    res.status(400).json({ error: "A user with that email already exists." });
    return;
  }

  const nextId = String(Math.max(0, ...users.map((row) => Number(row.user_id) || 0)) + 1);
  const now = nowIso();
  const user: UserRow = {
    user_id: nextId,
    email,
    first_name,
    last_name,
    abbreviation,
    role_access,
    last_login: "",
    created_at: now,
    profile_image: "",
  };
  users.push(user);
  writeCsv(FILES.users, users, USER_COLUMNS);
  appendAudit([
    {
      artifact_id: user.user_id,
      artifact_table: "sla-users",
      artifact_name: "email",
      old_field_value: "<empty>",
      new_field_value: email,
      trigger_source: "User",
      user_id: actor.user_id,
      event_type: "Created",
    },
  ]);
  res.status(201).json({ user });
});

app.delete("/api/users/:id", (req, res) => {
  const actor = requireRole(req, res, ["Manager", "Administrator"]);
  if (!actor) return;

  if (actor.user_id === req.params.id) {
    res.status(400).json({ error: "You cannot remove your own account." });
    return;
  }

  const users = readCsv<UserRow>(FILES.users);
  const index = users.findIndex((row) => row.user_id === req.params.id);
  if (index < 0) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  const target = users[index];
  if (!assignableRolesServer(actor.role_access as Role).includes(target.role_access as Role)) {
    res.status(403).json({ error: `You do not have permission to remove users with the ${target.role_access} role.` });
    return;
  }

  users.splice(index, 1);
  writeCsv(FILES.users, users, USER_COLUMNS);
  appendAudit([
    {
      artifact_id: target.user_id,
      artifact_table: "sla-users",
      artifact_name: "email",
      old_field_value: target.email,
      new_field_value: "<empty>",
      trigger_source: "User",
      user_id: actor.user_id,
      event_type: "Deleted",
    },
  ]);
  res.json({ ok: true });
});

app.patch("/api/users/:id", (req, res) => {
  const actor = resolveActor(req);
  if (!actor) {
    res.status(401).json({ error: "Not signed in." });
    return;
  }

  const users = readCsv<UserRow>(FILES.users);
  const user = users.find((row) => row.user_id === req.params.id);
  if (!user) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  // Everyone may edit their own profile, regardless of role. Editing someone else's
  // profile requires the same Manager/Administrator role hierarchy enforced on delete.
  const isSelf = actor.user_id === user.user_id;
  if (!isSelf && !assignableRolesServer(actor.role_access as Role).includes(user.role_access as Role)) {
    res.status(403).json({ error: `You do not have permission to edit users with the ${user.role_access} role.` });
    return;
  }

  const allowed = ["first_name", "last_name", "abbreviation"] as const;
  const audits: Omit<AuditRow, "id" | "timestamp">[] = [];
  for (const key of allowed) {
    if (typeof req.body?.[key] !== "string") continue;
    if (key === "abbreviation" && user.role_access === "Analyst") continue;
    const next = req.body[key];
    const prev = user[key] ?? "";
    if (prev === next) continue;
    user[key] = next;
    audits.push({
      artifact_id: user.user_id,
      artifact_table: "sla-users",
      artifact_name: key,
      old_field_value: displayValue(prev),
      new_field_value: displayValue(next),
      trigger_source: "User",
      user_id: actor.user_id,
      event_type: "Updated",
    });
  }
  writeCsv(FILES.users, users, USER_COLUMNS);
  if (audits.length) appendAudit(audits);
  res.json({ user });
});

app.get("/api/records", (_req, res) => {
  res.json({ records: readCsv<RecordRow>(FILES.records) });
});

app.post("/api/records", (req, res) => {
  const actor = resolveActor(req);
  if (!actor) {
    res.status(401).json({ error: "Not signed in." });
    return;
  }
  if (!canEditRecordsServer(actor.role_access as Role)) {
    res.status(403).json({ error: "Viewers cannot create records." });
    return;
  }
  const records = readCsv<RecordRow>(FILES.records);
  const userId = actor.user_id;
  const now = nowIso();
  const record: RecordRow = {
    ...emptyRecord(),
    ...sanitizeRecord(req.body ?? {}),
    record_id: randomUUID(),
    created_by: userId,
    updated_by: userId,
    created_at: now,
    updated_at: now,
  };
  records.push(record);
  writeCsv(FILES.records, records, RECORD_COLUMNS);
  const displayName = record.file_name || record.project_number || record.record_id;
  appendAudit([
    {
      artifact_id: record.record_id,
      artifact_table: "sla-file-records",
      artifact_name: "file_name",
      old_field_value: "<empty>",
      new_field_value: displayName,
      trigger_source: "User",
      user_id: userId,
      event_type: "Created",
    },
  ]);
  res.status(201).json({ record });
});

app.patch("/api/records/:id", (req, res) => {
  const records = readCsv<RecordRow>(FILES.records);
  const record = records.find((row) => row.record_id === req.params.id);
  if (!record) {
    res.status(404).json({ error: "Record not found." });
    return;
  }
  const actor = resolveActor(req);
  if (!actor) {
    res.status(401).json({ error: "Not signed in." });
    return;
  }
  if (!canEditRecordsServer(actor.role_access as Role)) {
    res.status(403).json({ error: "Viewers cannot edit records." });
    return;
  }
  const patch = sanitizeRecord(req.body ?? {});
  const nextAssignee = patch.assigned_analyst_id;
  if (
    typeof nextAssignee === "string" &&
    nextAssignee !== (record.assigned_analyst_id ?? "") &&
    !canAssignRecordsServer(actor.role_access as Role)
  ) {
    res.status(403).json({ error: "Only Managers and Administrators can reassign a record." });
    return;
  }
  const userId = actor.user_id;
  const audits: Omit<AuditRow, "id" | "timestamp">[] = [];
  for (const [key, next] of Object.entries(patch)) {
    if (!(key in record) || key === "record_id" || typeof next !== "string") continue;
    const prev = record[key] ?? "";
    if (prev === next) continue;
    record[key] = next;
    audits.push({
      artifact_id: record.record_id,
      artifact_table: "sla-file-records",
      artifact_name: key,
      old_field_value: displayValue(prev),
      new_field_value: displayValue(next),
      trigger_source: "User",
      user_id: userId,
      event_type: "Updated",
    });
  }
  record.updated_by = userId;
  record.updated_at = nowIso();
  writeCsv(FILES.records, records, RECORD_COLUMNS);
  if (audits.length) appendAudit(audits);
  res.json({ record });
});

app.get("/api/audit-log", (_req, res) => {
  const entries = readCsv<AuditRow>(FILES.audit);
  entries.sort((a, b) => (a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0));
  res.json({ entries });
});

app.get("/api/field-options", (_req, res) => {
  res.json({ options: readCsv<Record<string, string>>(FILES.fieldOptions) });
});

app.get("/api/data-dictionary", (_req, res) => {
  res.json({ fields: readCsv<Record<string, string>>(FILES.dataDictionary) });
});

app.get("/api/language-codes", (_req, res) => {
  res.json({ languages: readCsv<LanguageRow>(FILES.languageCodes) });
});

app.post("/api/language-codes", (req, res) => {
  const actor = requireRole(req, res, ["Manager", "Administrator"]);
  if (!actor) return;

  const code_id = String(req.body?.code_id ?? "").trim().toUpperCase();
  const language = String(req.body?.language ?? "").trim();
  const country = String(req.body?.country ?? "").trim();
  if (!code_id || !/^[A-Z0-9]{1,12}$/.test(code_id)) {
    res.status(400).json({ error: "Language code must be 1–12 letters or numbers with no spaces." });
    return;
  }
  if (!language) {
    res.status(400).json({ error: "Language name is required." });
    return;
  }

  const languages = readCsv<LanguageRow>(FILES.languageCodes);
  if (languages.some((row) => row.code_id.trim().toUpperCase() === code_id)) {
    res.status(400).json({ error: `A language with code ${code_id} already exists.` });
    return;
  }

  const row: LanguageRow = { code_id, language, country };
  languages.push(row);
  writeCsv(FILES.languageCodes, languages, [...LANGUAGE_COLUMNS]);
  appendAudit([
    {
      artifact_id: code_id,
      artifact_table: "language-codes",
      artifact_name: "code_id",
      old_field_value: "<empty>",
      new_field_value: `${code_id} (${language})`,
      trigger_source: "User",
      user_id: actor.user_id,
      event_type: "Created",
    },
  ]);
  res.status(201).json({ language: row });
});

app.get("/api/views", (req, res) => {
  const actor = resolveActor(req);
  if (!actor) {
    res.status(401).json({ error: "Not signed in." });
    return;
  }
  if (actor.role_access === "Viewer") {
    res.json({ views: [] });
    return;
  }
  const role = actor.role_access as Role;
  const userId = actor.user_id;
  const seen = new Map<string, ReturnType<typeof parseView>>();
  for (const row of readCsv<ViewRow>(FILES.views)) {
    const view = parseView(row);
    const inherited =
      view.owner_user_id === userId || view.assigned_user_ids.includes(userId) || view.assigned_roles.includes(role);
    if (inherited) seen.set(view.view_id, view);
  }
  const views = [...seen.values()].sort(
    (a, b) => a.order - b.order || a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
  res.json({ views });
});

/**
 * Only Managers and Administrators may share a view (non-empty assigned_user_ids or
 * assigned_roles). Every assigned user id must be a real, non-Viewer user.
 */
function checkAssignmentPermission(
  actor: UserRow,
  assignedUserIds: string[] | undefined,
  assignedRoles: Role[] | undefined,
): { status: number; error: string } | null {
  const wantsAssignment = (assignedUserIds && assignedUserIds.length > 0) || (assignedRoles && assignedRoles.length > 0);
  if (!wantsAssignment) return null;
  if (!canAssignViewsServer(actor.role_access as Role)) {
    return { status: 403, error: "Only Managers and Administrators can share a view." };
  }
  if (assignedUserIds && assignedUserIds.length) {
    const users = readCsv<UserRow>(FILES.users);
    const invalid = assignedUserIds.some((id) => {
      const target = users.find((row) => row.user_id === id);
      return !target || target.role_access === "Viewer";
    });
    if (invalid) {
      return { status: 400, error: "One or more selected users are invalid or are Viewers." };
    }
  }
  return null;
}

app.post("/api/views", (req, res) => {
  const actor = resolveActor(req);
  if (!actor) {
    res.status(401).json({ error: "Not signed in." });
    return;
  }
  const parsed = sanitizeViewBody(req.body ?? {});
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const assignmentError = checkAssignmentPermission(actor, parsed.assigned_user_ids, parsed.assigned_roles);
  if (assignmentError) {
    res.status(assignmentError.status).json({ error: assignmentError.error });
    return;
  }
  const userId = actor.user_id;
  const name = parsed.name ?? "";
  const fields = parsed.fields ?? [];
  const order = parsed.order ?? 9999;
  const conditions = parsed.conditions ?? { join: "AND", items: [] };
  const sorts = parsed.sorts ?? [];
  const views = readCsv<ViewRow>(FILES.views);
  if (views.some((row) => row.owner_user_id === userId && row.name.trim().toLowerCase() === name.toLowerCase())) {
    res.status(400).json({ error: "You already have a view with that name." });
    return;
  }
  const now = nowIso();
  const row: ViewRow = {
    view_id: randomUUID(),
    name,
    owner_user_id: userId,
    object_type: "sla-file-records",
    order: String(order),
    fields_json: JSON.stringify(fields),
    conditions_json: JSON.stringify(conditions),
    sorts_json: JSON.stringify(sorts),
    assigned_user_ids_json: JSON.stringify(parsed.assigned_user_ids ?? []),
    assigned_roles_json: JSON.stringify(parsed.assigned_roles ?? []),
    created_by: userId,
    created_at: now,
    updated_by: userId,
    updated_at: now,
  };
  views.push(row);
  writeCsv(FILES.views, views, VIEW_COLUMNS);
  res.status(201).json({ view: parseView(row) });
});

app.patch("/api/views/:id", (req, res) => {
  const actor = resolveActor(req);
  if (!actor) {
    res.status(401).json({ error: "Not signed in." });
    return;
  }
  const views = readCsv<ViewRow>(FILES.views);
  const row = views.find((item) => item.view_id === req.params.id);
  if (!row || row.owner_user_id !== actor.user_id) {
    res.status(404).json({ error: "View not found." });
    return;
  }
  const parsed = sanitizeViewBody(req.body ?? {}, { partial: true });
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const assignmentError = checkAssignmentPermission(actor, parsed.assigned_user_ids, parsed.assigned_roles);
  if (assignmentError) {
    res.status(assignmentError.status).json({ error: assignmentError.error });
    return;
  }
  if (parsed.name) {
    const name = parsed.name;
    const taken = views.some(
      (item) =>
        item.view_id !== row.view_id &&
        item.owner_user_id === actor.user_id &&
        item.name.trim().toLowerCase() === name.toLowerCase(),
    );
    if (taken) {
      res.status(400).json({ error: "You already have a view with that name." });
      return;
    }
    row.name = name;
  }
  if (parsed.order != null) row.order = String(parsed.order);
  if (parsed.fields) row.fields_json = JSON.stringify(parsed.fields);
  if (parsed.conditions) row.conditions_json = JSON.stringify(parsed.conditions);
  if (parsed.sorts) row.sorts_json = JSON.stringify(parsed.sorts);
  if (parsed.assigned_user_ids) row.assigned_user_ids_json = JSON.stringify(parsed.assigned_user_ids);
  if (parsed.assigned_roles) row.assigned_roles_json = JSON.stringify(parsed.assigned_roles);
  row.updated_by = actor.user_id;
  row.updated_at = nowIso();
  writeCsv(FILES.views, views, VIEW_COLUMNS);
  res.json({ view: parseView(row) });
});

app.delete("/api/views/:id", (req, res) => {
  const actor = resolveActor(req);
  if (!actor) {
    res.status(401).json({ error: "Not signed in." });
    return;
  }
  const views = readCsv<ViewRow>(FILES.views);
  const index = views.findIndex((item) => item.view_id === req.params.id && item.owner_user_id === actor.user_id);
  if (index < 0) {
    res.status(404).json({ error: "View not found." });
    return;
  }
  views.splice(index, 1);
  writeCsv(FILES.views, views, VIEW_COLUMNS);
  res.json({ ok: true });
});

/**
 * ---------------------------------------------------------------------------
 * Egnyte File Share connector (local-first placeholder)
 * ---------------------------------------------------------------------------
 * EGNYTE_CLIENT_ID / EGNYTE_CLIENT_SECRET are stored in the repo-root .env for now,
 * purely so the Configure > Connectors UI has something real to read and write while
 * the app is local-first. Nothing else in this codebase consumes these values yet.
 *
 * Production migration path: these credentials move to AWS Systems Manager Parameter
 * Store (as SecureString parameters), read directly by backend Lambdas at invocation
 * time. Once that lands, this Express layer — and the browser — should never see the
 * secret value again; GET should keep returning only `has_client_secret`.
 * ---------------------------------------------------------------------------
 */
const ENV_PATH = path.join(path.dirname(DATA_DIR), ".env");

function readEnvFile(): string {
  return existsSync(ENV_PATH) ? readFileSync(ENV_PATH, "utf8") : "";
}

function parseEnvFile(raw: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    map.set(key, value);
  }
  return map;
}

/**
 * Upserts keys into the repo-root .env, preserving every other line — comments, blank
 * lines, and unrelated keys — exactly as written. Existing keys are updated in place;
 * new keys are appended at the end.
 */
function upsertEnvFile(updates: Record<string, string>) {
  const raw = readEnvFile();
  const lines = raw.length ? raw.split(/\r?\n/) : [];
  const remaining = new Map(Object.entries(updates));
  const nextLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return line;
    const eq = trimmed.indexOf("=");
    if (eq < 0) return line;
    const key = trimmed.slice(0, eq).trim();
    if (!remaining.has(key)) return line;
    const value = remaining.get(key) ?? "";
    remaining.delete(key);
    return `${key}=${value}`;
  });
  for (const [key, value] of remaining) {
    nextLines.push(`${key}=${value}`);
  }
  while (nextLines.length && nextLines[nextLines.length - 1] === "") nextLines.pop();
  writeFileSync(ENV_PATH, `${nextLines.join("\n")}\n`, "utf8");
}

interface EgnyteConnectorStatus {
  connector_id: "egnyte";
  has_client_id: boolean;
  has_client_secret: boolean;
  client_id: string;
  updated_at: string;
}

function egnyteStatus(): EgnyteConnectorStatus {
  const env = parseEnvFile(readEnvFile());
  const clientId = env.get("EGNYTE_CLIENT_ID") ?? "";
  const clientSecret = env.get("EGNYTE_CLIENT_SECRET") ?? "";
  return {
    connector_id: "egnyte",
    has_client_id: clientId.trim().length > 0,
    has_client_secret: clientSecret.trim().length > 0,
    client_id: clientId,
    updated_at: env.get("EGNYTE_UPDATED_AT") ?? "",
  };
}

app.get("/api/connectors/egnyte", (req, res) => {
  if (!requireRole(req, res, ["Administrator"])) return;
  res.json({ connector: egnyteStatus() });
});

app.put("/api/connectors/egnyte", (req, res) => {
  const actor = requireRole(req, res, ["Administrator"]);
  if (!actor) return;

  const clientId = String(req.body?.client_id ?? "").trim();
  const clientSecret = String(req.body?.client_secret ?? "").trim();
  const before = egnyteStatus();

  const updates: Record<string, string> = { EGNYTE_CLIENT_ID: clientId, EGNYTE_UPDATED_AT: nowIso() };
  // A blank secret leaves the previously stored secret untouched.
  if (clientSecret) updates.EGNYTE_CLIENT_SECRET = clientSecret;
  upsertEnvFile(updates);

  const audits: Omit<AuditRow, "id" | "timestamp">[] = [];
  if (before.client_id !== clientId) {
    audits.push({
      artifact_id: "egnyte",
      artifact_table: "connectors",
      artifact_name: "EGNYTE_CLIENT_ID",
      old_field_value: displayValue(before.client_id),
      new_field_value: displayValue(clientId),
      trigger_source: "User",
      user_id: actor.user_id,
      event_type: "Updated",
    });
  }
  if (clientSecret) {
    audits.push({
      artifact_id: "egnyte",
      artifact_table: "connectors",
      artifact_name: "EGNYTE_CLIENT_SECRET",
      old_field_value: "<redacted>",
      new_field_value: "<redacted>",
      trigger_source: "User",
      user_id: actor.user_id,
      event_type: "Updated",
    });
  }
  if (audits.length) appendAudit(audits);

  res.json({ connector: egnyteStatus() });
});

function sanitizeRecord(body: Record<string, unknown>): Partial<RecordRow> {
  const next: Partial<RecordRow> = {};
  for (const col of RECORD_COLUMNS) {
    if (col === "record_id" || col === "created_by" || col === "created_at") continue;
    if (typeof body[col] === "string") {
      next[col] = body[col];
    }
  }
  return next;
}

function parseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function parseStringArray(raw: string | undefined): string[] {
  const parsed = parseJson<unknown>(raw ?? "[]", []);
  if (!Array.isArray(parsed)) return [];
  return parsed.map((item) => String(item).trim()).filter(Boolean);
}

function normalizeConditionItems(items: unknown): { field: string; operator: string; value: string[] }[] {
  if (!Array.isArray(items)) return [];
  const next: { field: string; operator: string; value: string[] }[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const field = String(row.field ?? "").trim();
    if (!field) continue;
    next.push({
      field,
      operator: String(row.operator ?? "is"),
      value: Array.isArray(row.value) ? row.value.map((value) => String(value)) : [],
    });
  }
  return next;
}

function parseView(row: ViewRow) {
  const fields = parseJson<string[]>(row.fields_json, []).filter((item) => typeof item === "string" && item.trim());
  const conditions = parseJson<{ join?: string; items?: unknown[] }>(row.conditions_json, { join: "AND", items: [] });
  const sorts = parseJson<{ field?: string; direction?: string }[]>(row.sorts_json, []);
  return {
    assigned_user_ids: parseStringArray(row.assigned_user_ids_json),
    assigned_roles: parseStringArray(row.assigned_roles_json).filter(isAssignableRole),
    view_id: row.view_id,
    name: row.name,
    owner_user_id: row.owner_user_id,
    object_type: row.object_type || "sla-file-records",
    order: Number(row.order) || 0,
    fields,
    conditions: {
      join: conditions.join === "OR" ? "OR" : "AND",
      items: normalizeConditionItems(conditions.items),
    },
    sorts: sorts
      .filter((item) => item && typeof item.field === "string" && item.field.trim())
      .map((item) => ({
        field: String(item.field),
        direction: item.direction === "asc" ? "asc" : "desc",
      })),
    created_by: row.created_by,
    created_at: row.created_at,
    updated_by: row.updated_by,
    updated_at: row.updated_at,
  };
}

function sanitizeViewBody(
  body: Record<string, unknown>,
  options: { partial?: boolean } = {},
):
  | { error: string }
  | {
      name?: string;
      order?: number;
      fields?: string[];
      conditions?: { join: "AND" | "OR"; items: { field: string; operator: string; value: string[] }[] };
      sorts?: { field: string; direction: "asc" | "desc" }[];
      assigned_user_ids?: string[];
      assigned_roles?: Role[];
    } {
  const next: {
    name?: string;
    order?: number;
    fields?: string[];
    conditions?: { join: "AND" | "OR"; items: { field: string; operator: string; value: string[] }[] };
    sorts?: { field: string; direction: "asc" | "desc" }[];
    assigned_user_ids?: string[];
    assigned_roles?: Role[];
  } = {};

  if (typeof body.name === "string") next.name = body.name.trim();
  if (body.order != null) {
    const order = Number(body.order);
    if (!Number.isInteger(order)) return { error: "Order must be an integer." };
    next.order = order;
  }
  if (Array.isArray(body.fields)) {
    next.fields = body.fields.filter((item): item is string => typeof item === "string" && item.trim() !== "");
  }
  if (body.conditions && typeof body.conditions === "object") {
    const conditions = body.conditions as { join?: unknown; items?: unknown };
    next.conditions = {
      join: conditions.join === "OR" ? "OR" : "AND",
      items: normalizeConditionItems(conditions.items),
    };
  }
  if (Array.isArray(body.sorts)) {
    next.sorts = body.sorts
      .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
      .map((item) => {
        const direction: "asc" | "desc" = item.direction === "asc" ? "asc" : "desc";
        return { field: String(item.field ?? "").trim(), direction };
      })
      .filter((item) => item.field);
  }
  if (Array.isArray(body.assigned_user_ids)) {
    next.assigned_user_ids = [...new Set(body.assigned_user_ids.map((item) => String(item).trim()).filter(Boolean))];
  }
  if (Array.isArray(body.assigned_roles)) {
    const roles = body.assigned_roles.map((item) => String(item).trim());
    const invalid = roles.find((role) => !isAssignableRole(role));
    if (invalid) return { error: `"${invalid}" cannot be assigned a saved view.` };
    next.assigned_roles = [...new Set(roles)] as Role[];
  }

  if (!options.partial) {
    if (!next.name) return { error: "View name is required." };
    if (!next.fields?.length) return { error: "Select at least one field." };
    if (next.order == null) next.order = 9999;
    if (!next.conditions) next.conditions = { join: "AND", items: [] };
    if (!next.sorts) next.sorts = [];
    if (!next.assigned_user_ids) next.assigned_user_ids = [];
    if (!next.assigned_roles) next.assigned_roles = [];
  } else if (next.fields && next.fields.length === 0) {
    return { error: "Select at least one field." };
  }

  return next;
}

app.listen(PORT, () => {
  console.log(`SLA Tracker mock API listening on http://localhost:${PORT}`);
});
