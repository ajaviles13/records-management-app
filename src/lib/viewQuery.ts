import { fieldAlias, filterKindFor, type FilterKind } from "@/lib/columnFilters";
import { deriveStatus } from "@/lib/status";
import type {
  DataDictionaryField,
  FileRecord,
  SavedView,
  ViewConditionItem,
  ViewConditions,
  ViewOperator,
  ViewSort,
} from "@/types";

export const ALL_RECORDS_VIEW_ID = "__all__";

export const DEFAULT_VIEW_FIELDS = [
  "file_name",
  "project_number",
  "language_code",
  "status",
  "sla_met",
  "is_urgent",
  "assigned_analyst_id",
  "received_at_est",
  "delivered_at_est",
  "template_type",
  "state",
  "line_of_business",
];

const USER_FIELDS = new Set(["assigned_analyst_id"]);

export function emptyConditions(): ViewConditions {
  return { join: "AND", items: [] };
}

export function allRecordsView(): SavedView {
  return {
    view_id: ALL_RECORDS_VIEW_ID,
    name: "All Records",
    owner_user_id: "",
    object_type: "sla-file-records",
    order: 0,
    fields: [...DEFAULT_VIEW_FIELDS],
    conditions: emptyConditions(),
    sorts: [{ field: "received_at_est", direction: "desc" }],
    created_by: "",
    created_at: "",
    updated_by: "",
    updated_at: "",
  };
}

export function viewableFields(dictionary: DataDictionaryField[]): { key: string; alias: string }[] {
  const fromDictionary = dictionary
    .filter((row) => row.related_table_name === "sla-file-records")
    .map((row) => ({
      key: row.related_field_name,
      alias: row.field_name_alias?.trim() || row.related_field_name,
    }));
  const keys = new Set(fromDictionary.map((row) => row.key));
  const fields = keys.has("status")
    ? fromDictionary
    : [{ key: "status", alias: "Status" }, ...fromDictionary];
  return fields.sort((a, b) => a.alias.localeCompare(b.alias, undefined, { sensitivity: "base" }));
}

export function knownFieldKeys(dictionary: DataDictionaryField[]): Set<string> {
  return new Set(viewableFields(dictionary).map((field) => field.key));
}

export function sanitizeViewFields(fields: string[], dictionary: DataDictionaryField[]): { fields: string[]; dropped: string[] } {
  if (!dictionary.length) return { fields, dropped: [] };
  const known = knownFieldKeys(dictionary);
  const seen = new Set<string>();
  const kept: string[] = [];
  const dropped: string[] = [];
  for (const field of fields) {
    if (!known.has(field) || seen.has(field)) {
      if (!known.has(field)) dropped.push(field);
      continue;
    }
    seen.add(field);
    kept.push(field);
  }
  return { fields: kept.length ? kept : [...DEFAULT_VIEW_FIELDS], dropped };
}

export function operatorsForField(fieldName: string, dictionary: DataDictionaryField[]): { value: ViewOperator; label: string }[] {
  const kind = filterKindFor(fieldName, dictionary);
  const setOps = [
    { value: "is_set" as const, label: "is set" },
    { value: "is_not_set" as const, label: "is not set" },
  ];
  if (USER_FIELDS.has(fieldName)) {
    return [
      { value: "any_of", label: "any of these" },
      { value: "none_of", label: "none of these" },
      { value: "is_me", label: "is me" },
      { value: "is_not_me", label: "is not me" },
      ...setOps,
    ];
  }
  if (kind === "choice" || kind === "boolean") {
    return [
      { value: "any_of", label: "any of these" },
      { value: "none_of", label: "none of these" },
      ...setOps,
    ];
  }
  if (kind === "number" || kind === "date") {
    return [
      { value: "eq", label: "=" },
      { value: "gt", label: ">" },
      { value: "lt", label: "<" },
      { value: "gte", label: ">=" },
      { value: "lte", label: "<=" },
      ...setOps,
    ];
  }
  return [
    { value: "is", label: "is" },
    { value: "contains", label: "contains" },
    ...setOps,
  ];
}

export function operatorNeedsValue(operator: ViewOperator): boolean {
  return operator !== "is_set" && operator !== "is_not_set" && operator !== "is_me" && operator !== "is_not_me";
}

export function operatorUsesChoices(operator: ViewOperator): boolean {
  return operator === "any_of" || operator === "none_of";
}

export function recordFieldValue(record: FileRecord, field: string): string {
  if (field === "status") return deriveStatus(record);
  return (record[field as keyof FileRecord] ?? "") as string;
}

export function matchesViewConditions(record: FileRecord, conditions: ViewConditions, userId: string, dictionary: DataDictionaryField[]): boolean {
  if (!conditions.items.length) return true;
  const results = conditions.items.map((item) => matchesCondition(record, item, userId, dictionary));
  return conditions.join === "OR" ? results.some(Boolean) : results.every(Boolean);
}

function matchesCondition(
  record: FileRecord,
  item: ViewConditionItem,
  userId: string,
  dictionary: DataDictionaryField[],
): boolean {
  const raw = recordFieldValue(record, item.field).trim();
  const kind = filterKindFor(item.field, dictionary);
  const values = item.value ?? [];

  switch (item.operator) {
    case "is_set":
      return raw !== "";
    case "is_not_set":
      return raw === "";
    case "is_me":
      return raw === userId;
    case "is_not_me":
      return raw !== userId;
    case "any_of":
      return values.some((value) => valuesEqual(raw, value, kind));
    case "none_of":
      return !values.some((value) => valuesEqual(raw, value, kind));
    case "is":
      return raw.toLowerCase() === (values[0] ?? "").trim().toLowerCase();
    case "contains":
      return raw.toLowerCase().includes((values[0] ?? "").trim().toLowerCase());
    case "eq":
      return compareTyped(raw, values[0] ?? "", "eq", kind);
    case "gt":
      return compareTyped(raw, values[0] ?? "", "gt", kind);
    case "lt":
      return compareTyped(raw, values[0] ?? "", "lt", kind);
    case "gte":
      return compareTyped(raw, values[0] ?? "", "gte", kind);
    case "lte":
      return compareTyped(raw, values[0] ?? "", "lte", kind);
    default:
      return true;
  }
}

function valuesEqual(raw: string, expected: string, kind: FilterKind): boolean {
  if (kind === "boolean") {
    const value = raw.toUpperCase();
    const target = expected.toUpperCase();
    if (target === "YES" || target === "Y" || target === "TRUE") {
      return value === "YES" || value === "Y" || value === "TRUE";
    }
    if (target === "NO" || target === "N" || target === "FALSE") {
      return value === "NO" || value === "N" || value === "FALSE";
    }
  }
  return raw === expected;
}

function compareTyped(left: string, right: string, op: "eq" | "gt" | "lt" | "gte" | "lte", kind: FilterKind): boolean {
  if (!right) return true;
  if (kind === "number") {
    const a = Number(left);
    const b = Number(right);
    if (Number.isNaN(a) || Number.isNaN(b)) return false;
    if (op === "eq") return a === b;
    if (op === "gt") return a > b;
    if (op === "lt") return a < b;
    if (op === "gte") return a >= b;
    return a <= b;
  }
  const a = Date.parse(left);
  const b = Date.parse(right);
  if (!Number.isNaN(a) && !Number.isNaN(b)) {
    if (op === "eq") return a === b;
    if (op === "gt") return a > b;
    if (op === "lt") return a < b;
    if (op === "gte") return a >= b;
    return a <= b;
  }
  const cmp = left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
  if (op === "eq") return cmp === 0;
  if (op === "gt") return cmp > 0;
  if (op === "lt") return cmp < 0;
  if (op === "gte") return cmp >= 0;
  return cmp <= 0;
}

export function sortRecords(records: FileRecord[], sorts: ViewSort[]): FileRecord[] {
  if (!sorts.length) return records;
  return [...records].sort((a, b) => {
    for (const sort of sorts) {
      const av = recordFieldValue(a, sort.field);
      const bv = recordFieldValue(b, sort.field);
      const cmp = av.localeCompare(bv, undefined, { numeric: true, sensitivity: "base" });
      if (cmp !== 0) return sort.direction === "asc" ? cmp : -cmp;
    }
    return 0;
  });
}

export function conditionPreview(conditions: ViewConditions, dictionary: DataDictionaryField[]): string {
  if (!conditions.items.length) return "No conditions — all records";
  return conditions.items
    .map((item) => {
      const alias = fieldAlias(item.field, dictionary);
      const operator = operatorsForField(item.field, dictionary).find((row) => row.value === item.operator)?.label ?? item.operator;
      if (!operatorNeedsValue(item.operator)) return `(${alias} ${operator})`;
      const value = item.value.length ? item.value.join(", ") : "…";
      return `(${alias} ${operator} ${value})`;
    })
    .join(` ${conditions.join} `);
}
