import type { FileRecord, SnapshotDateBasis, SnapshotDateRange } from "@/types";

/** An inclusive, date-only window. Empty strings mean unbounded. */
export interface DateWindow {
  from: string;
  to: string;
}

export type Granularity = "day" | "week" | "month";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Record timestamps arrive as `YYYY-MM-DD H:MM:SS` with single-digit hours in the
 * seeded data, so the hour group is deliberately lenient.
 */
export function parseRecordDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2}):(\d{2}))?/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour ?? 0),
    Number(minute ?? 0),
    Number(second ?? 0),
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

/** The date-only portion of a record timestamp, or "" when unparseable. */
export function recordDay(value: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
  return match ? match[1] : "";
}

export function toIsoDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function fromIsoDay(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

/** Monday-based start of week, matching the "This Week" preset. */
function startOfWeek(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

export function resolveDateRange(range: SnapshotDateRange, now = new Date()): DateWindow {
  if (range.preset === "all") return { from: "", to: "" };
  if (range.preset === "custom") return { from: range.from, to: range.to };

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (range.preset) {
    case "today":
      return { from: toIsoDay(today), to: toIsoDay(today) };
    case "week": {
      const start = startOfWeek(today);
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
      return { from: toIsoDay(start), to: toIsoDay(end) };
    }
    case "month": {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { from: toIsoDay(start), to: toIsoDay(end) };
    }
    case "year": {
      const start = new Date(today.getFullYear(), 0, 1);
      const end = new Date(today.getFullYear(), 11, 31);
      return { from: toIsoDay(start), to: toIsoDay(end) };
    }
    default:
      return { from: "", to: "" };
  }
}

/**
 * The record dates a basis considers. "both" means either timestamp qualifying is
 * enough, which is why this returns a list rather than a single value.
 */
export function basisDays(record: FileRecord, basis: SnapshotDateBasis): string[] {
  const received = recordDay(record.received_at_est);
  const delivered = recordDay(record.delivered_at_est);
  if (basis === "received") return received ? [received] : [];
  if (basis === "delivered") return delivered ? [delivered] : [];
  return [received, delivered].filter(Boolean);
}

/**
 * Date-only comparison, so a record delivered at 17:15 on the end date is included.
 * Lexicographic comparison is safe because both sides are `YYYY-MM-DD`.
 */
export function dayInWindow(day: string, window: DateWindow): boolean {
  if (!day) return false;
  if (window.from && day < window.from) return false;
  if (window.to && day > window.to) return false;
  return true;
}

export function recordMatchesWindow(record: FileRecord, window: DateWindow, basis: SnapshotDateBasis): boolean {
  if (!window.from && !window.to) return true;
  return basisDays(record, basis).some((day) => dayInWindow(day, window));
}

export function recordMatchesRange(record: FileRecord, range: SnapshotDateRange): boolean {
  return recordMatchesWindow(record, resolveDateRange(range), range.basis);
}

/**
 * The single day a record is charted under. With "both" selected a record can match on
 * either timestamp, so the earliest matching day wins to keep each record in exactly one
 * bucket.
 */
export function chartDay(record: FileRecord, window: DateWindow, basis: SnapshotDateBasis): string {
  const candidates = basisDays(record, basis).filter((day) => dayInWindow(day, window));
  if (!candidates.length) return "";
  return candidates.reduce((earliest, day) => (day < earliest ? day : earliest));
}

/** Widens an unbounded window to the span actually present in the data. */
export function windowForRecords(records: FileRecord[], window: DateWindow, basis: SnapshotDateBasis): DateWindow {
  if (window.from && window.to) return window;
  let min = "";
  let max = "";
  for (const record of records) {
    for (const day of basisDays(record, basis)) {
      if (!min || day < min) min = day;
      if (!max || day > max) max = day;
    }
  }
  return { from: window.from || min, to: window.to || max };
}

export function granularityFor(window: DateWindow): Granularity {
  if (!window.from || !window.to) return "month";
  const spanDays = (fromIsoDay(window.to).getTime() - fromIsoDay(window.from).getTime()) / DAY_MS + 1;
  if (spanDays <= 31) return "day";
  if (spanDays <= 182) return "week";
  return "month";
}

/** The inclusive start of the bucket a given day falls into. */
export function bucketStart(day: string, granularity: Granularity): string {
  const date = fromIsoDay(day);
  if (granularity === "day") return day;
  if (granularity === "week") return toIsoDay(startOfWeek(date));
  return toIsoDay(new Date(date.getFullYear(), date.getMonth(), 1));
}

/** The inclusive end of a bucket, used to build drill-through date windows. */
export function bucketEnd(start: string, granularity: Granularity): string {
  const date = fromIsoDay(start);
  if (granularity === "day") return start;
  if (granularity === "week") {
    return toIsoDay(new Date(date.getFullYear(), date.getMonth(), date.getDate() + 6));
  }
  return toIsoDay(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

export function bucketLabel(start: string, granularity: Granularity): string {
  const date = fromIsoDay(start);
  if (granularity === "month") {
    return date.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
  }
  const label = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return granularity === "week" ? `Wk ${label}` : label;
}

/** Every bucket start between the window bounds, in chronological order. */
export function bucketStarts(window: DateWindow, granularity: Granularity): string[] {
  if (!window.from || !window.to || window.from > window.to) return [];
  const starts: string[] = [];
  let cursor = fromIsoDay(bucketStart(window.from, granularity));
  const last = fromIsoDay(bucketStart(window.to, granularity));
  while (cursor <= last && starts.length < 400) {
    starts.push(toIsoDay(cursor));
    if (granularity === "day") cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
    else if (granularity === "week") cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 7);
    else cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return starts;
}

/** Turns a pair of Received/Delivered toggles into a basis, never allowing neither. */
export function basisFromToggles(received: boolean, delivered: boolean): SnapshotDateBasis {
  if (received && delivered) return "both";
  return delivered ? "delivered" : "received";
}

export function basisLabel(basis: SnapshotDateBasis): string {
  if (basis === "received") return "Received";
  if (basis === "delivered") return "Delivered";
  return "Received or Delivered";
}
