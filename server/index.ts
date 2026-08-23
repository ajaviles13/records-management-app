import cors from "cors";
import express from "express";
import { randomUUID } from "crypto";
import { FILES, nowEstish, nowIso, readCsv, writeCsv } from "./csvStore";

const PORT = Number(process.env.API_PORT ?? 3001);
const DUMMY_PASSWORD = "password";

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
  "old_field_value",
  "new_field_value",
  "trigger_source",
  "user_id",
  "event_type",
];

const VIEW_COLUMNS = [
  "view_id",
  "name",
  "owner_user_id",
  "object_type",
  "order",
  "fields_json",
  "conditions_json",
  "sorts_json",
  "created_by",
  "created_at",
  "updated_by",
  "updated_at",
];

type UserRow = Record<(typeof USER_COLUMNS)[number], string>;
type RecordRow = Record<(typeof RECORD_COLUMNS)[number], string>;
type AuditRow = Record<(typeof AUDIT_COLUMNS)[number], string>;
type ViewRow = Record<(typeof VIEW_COLUMNS)[number], string>;

function emptyRecord(): RecordRow {
  return Object.fromEntries(RECORD_COLUMNS.map((col) => [col, ""])) as RecordRow;
}

function actorId(req: express.Request): string {
  return String(req.header("x-user-id") ?? "").trim();
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

app.patch("/api/users/:id", (req, res) => {
  const users = readCsv<UserRow>(FILES.users);
  const user = users.find((row) => row.user_id === req.params.id);
  if (!user) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  const allowed = ["first_name", "last_name", "abbreviation"] as const;
  for (const key of allowed) {
    if (typeof req.body?.[key] !== "string") continue;
    if (key === "abbreviation" && user.role_access === "Analyst") continue;
    user[key] = req.body[key];
  }
  writeCsv(FILES.users, users, USER_COLUMNS);
  res.json({ user });
});

app.get("/api/records", (_req, res) => {
  res.json({ records: readCsv<RecordRow>(FILES.records) });
});

app.post("/api/records", (req, res) => {
  const records = readCsv<RecordRow>(FILES.records);
  const userId = actorId(req);
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
  appendAudit([
    {
      artifact_id: record.record_id,
      old_field_value: "<empty>",
      new_field_value: record.file_name || record.project_number || record.record_id,
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
  const userId = actorId(req);
  const patch = sanitizeRecord(req.body ?? {});
  const audits: Omit<AuditRow, "id" | "timestamp">[] = [];
  for (const [key, next] of Object.entries(patch)) {
    if (!(key in record) || key === "record_id" || typeof next !== "string") continue;
    const prev = record[key] ?? "";
    if (prev === next) continue;
    record[key] = next;
    audits.push({
      artifact_id: record.record_id,
      old_field_value: displayValue(prev),
      new_field_value: displayValue(next),
      trigger_source: "User",
      user_id: userId,
      event_type: `Updated:${key}`,
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
  res.json({ languages: readCsv<Record<string, string>>(FILES.languageCodes) });
});

app.get("/api/views", (req, res) => {
  const userId = actorId(req);
  if (!userId) {
    res.status(401).json({ error: "Not signed in." });
    return;
  }
  const views = readCsv<ViewRow>(FILES.views)
    .filter((row) => row.owner_user_id === userId)
    .map(parseView)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  res.json({ views });
});

app.post("/api/views", (req, res) => {
  const userId = actorId(req);
  if (!userId) {
    res.status(401).json({ error: "Not signed in." });
    return;
  }
  const parsed = sanitizeViewBody(req.body ?? {});
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
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
  const userId = actorId(req);
  if (!userId) {
    res.status(401).json({ error: "Not signed in." });
    return;
  }
  const views = readCsv<ViewRow>(FILES.views);
  const row = views.find((item) => item.view_id === req.params.id);
  if (!row || row.owner_user_id !== userId) {
    res.status(404).json({ error: "View not found." });
    return;
  }
  const parsed = sanitizeViewBody(req.body ?? {}, { partial: true });
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  if (parsed.name) {
    const name = parsed.name;
    const taken = views.some(
      (item) =>
        item.view_id !== row.view_id &&
        item.owner_user_id === userId &&
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
  row.updated_by = userId;
  row.updated_at = nowIso();
  writeCsv(FILES.views, views, VIEW_COLUMNS);
  res.json({ view: parseView(row) });
});

app.delete("/api/views/:id", (req, res) => {
  const userId = actorId(req);
  if (!userId) {
    res.status(401).json({ error: "Not signed in." });
    return;
  }
  const views = readCsv<ViewRow>(FILES.views);
  const index = views.findIndex((item) => item.view_id === req.params.id && item.owner_user_id === userId);
  if (index < 0) {
    res.status(404).json({ error: "View not found." });
    return;
  }
  views.splice(index, 1);
  writeCsv(FILES.views, views, VIEW_COLUMNS);
  res.json({ ok: true });
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
    } {
  const next: {
    name?: string;
    order?: number;
    fields?: string[];
    conditions?: { join: "AND" | "OR"; items: { field: string; operator: string; value: string[] }[] };
    sorts?: { field: string; direction: "asc" | "desc" }[];
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

  if (!options.partial) {
    if (!next.name) return { error: "View name is required." };
    if (!next.fields?.length) return { error: "Select at least one field." };
    if (next.order == null) next.order = 9999;
    if (!next.conditions) next.conditions = { join: "AND", items: [] };
    if (!next.sorts) next.sorts = [];
  } else if (next.fields && next.fields.length === 0) {
    return { error: "Select at least one field." };
  }

  return next;
}

app.listen(PORT, () => {
  console.log(`SLA Tracker mock API listening on http://localhost:${PORT}`);
});
