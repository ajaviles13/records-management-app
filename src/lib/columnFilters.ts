import { analystLabel } from "@/lib/format";
import type { DataDictionaryField, FieldOption, LanguageCode, User } from "@/types";

export type FilterKind = "text" | "choice" | "boolean" | "date" | "number";

export interface ChoiceOption {
  value: string;
  label: string;
}

export interface ChoiceLookups {
  options: FieldOption[];
  users: User[];
  languageCodes: LanguageCode[];
}

export function dictionaryField(
  fieldName: string,
  dictionary: DataDictionaryField[],
  table = "sla-file-records",
): DataDictionaryField | undefined {
  return dictionary.find((row) => row.related_table_name === table && row.related_field_name === fieldName);
}

export function isLinkedToList(field?: DataDictionaryField): boolean {
  return (field?.is_linked_to_list ?? "").trim().toUpperCase() === "TRUE";
}

export function languageLabel(codeId: string, languages: LanguageCode[]): string {
  const row = languages.find((language) => language.code_id === codeId);
  if (!row) return codeId || "—";
  return `${row.language} (${row.code_id})`;
}

export function optionsForField(
  fieldName: string,
  dictionary: DataDictionaryField[],
  options: FieldOption[],
  table = "sla-file-records",
): FieldOption[] {
  const field = dictionaryField(fieldName, dictionary, table);
  if (!field) return [];
  return options
    .filter((option) => option.field_id === field.field_id)
    .sort((a, b) => Number(a.order) - Number(b.order));
}

export function choiceOptionsForField(
  fieldName: string,
  dictionary: DataDictionaryField[],
  lookups: ChoiceLookups,
  table = "sla-file-records",
): ChoiceOption[] {
  if (fieldName === "status") {
    return [
      { value: "In-Review", label: "In-Review" },
      { value: "Completed", label: "Completed" },
      { value: "On-Hold", label: "On-Hold" },
    ];
  }
  if (fieldName === "sla_met") {
    return [
      { value: "Y", label: "Yes" },
      { value: "N", label: "No" },
    ];
  }
  if (fieldName === "assigned_analyst_id") {
    return lookups.users.map((row) => ({
      value: row.user_id,
      label: analystLabel(lookups.users, row.user_id),
    }));
  }

  const field = dictionaryField(fieldName, dictionary, table);
  if (!field) return [];
  if (isLinkedToList(field)) return linkedListChoices(field, lookups);

  return optionsForField(fieldName, dictionary, lookups.options, table).map((option) => ({
    value: option.label,
    label: option.label,
  }));
}

function linkedListChoices(field: DataDictionaryField, lookups: ChoiceLookups): ChoiceOption[] {
  const table = field.linked_table_name.trim();
  const column = field.linked_field_name.trim();

  if (table === "language-codes" && column === "code_id") {
    return [...lookups.languageCodes]
      .sort((a, b) => a.language.localeCompare(b.language, undefined, { sensitivity: "base" }))
      .map((row) => ({
        value: row.code_id,
        label: `${row.language} (${row.code_id})`,
      }));
  }

  if (table === "sla-users" && column === "abbreviation") {
    return lookups.users
      .filter((user) => user.role_access === "Analyst" || user.role_access === "Manager")
      .sort((a, b) => a.abbreviation.localeCompare(b.abbreviation, undefined, { sensitivity: "base" }))
      .map((user) => ({
        value: user.abbreviation,
        label: user.abbreviation,
      }));
  }

  return [];
}

export function fieldAlias(fieldName: string, dictionary: DataDictionaryField[]): string {
  if (fieldName === "status") return "Status";
  return dictionaryField(fieldName, dictionary)?.field_name_alias?.trim() || fieldName;
}

export function filterKindFor(fieldName: string, dictionary: DataDictionaryField[]): FilterKind {
  if (fieldName === "status") return "choice";
  if (fieldName === "assigned_analyst_id") return "choice";
  const type = (dictionaryField(fieldName, dictionary)?.type ?? "").trim().toLowerCase();
  if (type === "boolean") return "boolean";
  if (type === "single choice") return "choice";
  if (type === "timestamp" || type === "timestampz") return "date";
  if (type === "decimal" || type === "whole number") return "number";
  return "text";
}

export function isUrlField(fieldName: string, dictionary: DataDictionaryField[]): boolean {
  return (dictionaryField(fieldName, dictionary)?.type ?? "").trim().toLowerCase() === "url";
}

export type ColumnFilterValue = string | string[];

export function isFilterActive(filter: ColumnFilterValue | undefined): boolean {
  if (filter == null) return false;
  if (Array.isArray(filter)) return filter.length > 0;
  return Boolean(filter.trim());
}

export function matchesColumnFilter(rawValue: string, filter: ColumnFilterValue, kind: FilterKind): boolean {
  if (Array.isArray(filter)) {
    if (filter.length === 0) return true;
    return filter.some((item) => matchesColumnFilter(rawValue, item, kind));
  }

  const value = rawValue.trim();
  const query = filter.trim();
  if (!query || query === "__all__") return true;
  if (query === "__notset__") return value === "";

  if (kind === "boolean") {
    const normalized = value.toUpperCase();
    if (query === "YES") return normalized === "YES" || normalized === "Y" || normalized === "TRUE";
    if (query === "NO") return normalized === "NO" || normalized === "N" || normalized === "FALSE";
    return normalized === query;
  }

  if (kind === "choice") {
    return value === query;
  }

  const upper = query.toUpperCase();
  if (upper === "IS SET") return value !== "";
  if (upper === "IS NOT SET") return value === "";

  if (query.startsWith(">=")) return compareValues(value, query.slice(2).trim(), "gte", kind);
  if (query.startsWith("<=")) return compareValues(value, query.slice(2).trim(), "lte", kind);
  if (query.startsWith("=")) return compareValues(value, query.slice(1).trim(), "eq", kind);

  if (kind === "number") {
    const left = Number(value);
    const right = Number(query);
    if (!Number.isNaN(left) && !Number.isNaN(right)) return left === right;
  }

  return value.toLowerCase().includes(query.toLowerCase());
}

function compareValues(left: string, right: string, op: "gte" | "lte" | "eq", kind: FilterKind): boolean {
  if (!right) return true;
  if (kind === "number") {
    const a = Number(left);
    const b = Number(right);
    if (Number.isNaN(a) || Number.isNaN(b)) return false;
    if (op === "gte") return a >= b;
    if (op === "lte") return a <= b;
    return a === b;
  }
  const a = Date.parse(left);
  const b = Date.parse(right);
  if (!Number.isNaN(a) && !Number.isNaN(b)) {
    if (op === "gte") return a >= b;
    if (op === "lte") return a <= b;
    return a === b;
  }
  const cmp = left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
  if (op === "gte") return cmp >= 0;
  if (op === "lte") return cmp <= 0;
  return cmp === 0;
}
