import type { SnapshotDateBasis } from "@/types";

export const RECORDS_PATH = "/records";

/** Query key for the saved view to activate. */
const VIEW_KEY = "view";
/** Prefix for column filter values, e.g. `f.status=In-Review`. Repeat the key for multi-value. */
const FILTER_PREFIX = "f.";
const BASIS_KEY = "basis";
const FROM_KEY = "from";
const TO_KEY = "to";

/**
 * A date window carried into Records alongside the column filters. Records applies this
 * as a separate predicate layer because a single column filter input cannot express a
 * two-sided range.
 */
export interface RecordsDateWindow {
  basis: SnapshotDateBasis;
  /** Inclusive start, `YYYY-MM-DD`. */
  from: string;
  /** Inclusive end, `YYYY-MM-DD`. */
  to: string;
}

/**
 * The contract for deep-linking into the Records tab from elsewhere in the app,
 * primarily the clickable metrics and chart segments on My Snapshot.
 */
export interface RecordsDeepLink {
  /** View to activate on arrival. Defaults to All Records when omitted. */
  viewId?: string;
  /** Column filters keyed by record field. Values are raw, unencoded field values. */
  filters?: Record<string, string[]>;
  /** Optional date window applied on top of the column filters. */
  dateWindow?: RecordsDateWindow | null;
}

function isBasis(value: string): value is SnapshotDateBasis {
  return value === "received" || value === "delivered" || value === "both";
}

export function buildRecordsLink({ viewId, filters, dateWindow }: RecordsDeepLink): string {
  const params = new URLSearchParams();
  if (viewId) params.set(VIEW_KEY, viewId);
  for (const [field, values] of Object.entries(filters ?? {})) {
    for (const value of values) {
      if (value !== "") params.append(`${FILTER_PREFIX}${field}`, value);
    }
  }
  if (dateWindow && dateWindow.from && dateWindow.to) {
    params.set(BASIS_KEY, dateWindow.basis);
    params.set(FROM_KEY, dateWindow.from);
    params.set(TO_KEY, dateWindow.to);
  }
  const query = params.toString();
  return query ? `${RECORDS_PATH}?${query}` : RECORDS_PATH;
}

export function parseRecordsLink(search: string): RecordsDeepLink {
  const params = new URLSearchParams(search);
  const filters: Record<string, string[]> = {};
  for (const [key, value] of params.entries()) {
    if (!key.startsWith(FILTER_PREFIX)) continue;
    const field = key.slice(FILTER_PREFIX.length);
    if (!field) continue;
    (filters[field] ??= []).push(value);
  }

  const basis = params.get(BASIS_KEY) ?? "";
  const from = params.get(FROM_KEY) ?? "";
  const to = params.get(TO_KEY) ?? "";
  const dateWindow = isBasis(basis) && from && to ? { basis, from, to } : null;

  return {
    viewId: params.get(VIEW_KEY) ?? undefined,
    filters,
    dateWindow,
  };
}

export function hasDeepLink(link: RecordsDeepLink): boolean {
  return Boolean(link.viewId || link.dateWindow || Object.keys(link.filters ?? {}).length);
}
