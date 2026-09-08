import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, FilterX } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { ColumnFilter } from "@/components/records/ColumnFilter";
import { RecordsPagination } from "@/components/records/RecordsPagination";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  isFilterActive,
  matchesColumnFilter,
  type ColumnFilterValue,
  type FilterKind,
} from "@/lib/columnFilters";
import { analystLabel, formatDateTime } from "@/lib/format";
import { clampPage, pageSlice } from "@/lib/pagination";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { cn } from "@/lib/utils";
import type { AuditLogEntry, FileRecord, PageSize, User } from "@/types";

/** Friendly names for the stores the audit log covers. */
const OBJECT_LABELS: Record<string, string> = {
  "sla-file-records": "Record",
  "sla-users": "User",
  connectors: "Connector",
  "language-codes": "Language",
};

type AuditColumnKey = "timestamp" | "object" | "name" | "field" | "change" | "event" | "source" | "user";

interface AuditColumn {
  key: AuditColumnKey;
  alias: string;
  kind: FilterKind;
}

const AUDIT_COLUMNS: AuditColumn[] = [
  { key: "timestamp", alias: "Timestamp", kind: "date" },
  { key: "object", alias: "Object", kind: "choice" },
  { key: "name", alias: "Name", kind: "text" },
  { key: "field", alias: "Field", kind: "choice" },
  { key: "change", alias: "Change", kind: "text" },
  { key: "event", alias: "Event", kind: "choice" },
  { key: "source", alias: "Source", kind: "choice" },
  { key: "user", alias: "User", kind: "choice" },
];

const DEFAULT_COLUMN_WIDTHS: Record<AuditColumnKey, number> = {
  timestamp: 180,
  object: 140,
  name: 280,
  field: 180,
  change: 320,
  event: 130,
  source: 160,
  user: 220,
};

const MIN_COLUMN_WIDTH = 150;
const FALLBACK_COLUMN_WIDTH = 200;

interface AuditRowView {
  id: string;
  values: Record<AuditColumnKey, string>;
}

export function AuditLogPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [records, setRecords] = useState<FileRecord[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [sortKey, setSortKey] = useState<AuditColumnKey>("timestamp");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [columnWidths, setColumnWidths] = useLocalStorage("sla.audit.columnWidths", DEFAULT_COLUMN_WIDTHS);
  const [columnFilters, setColumnFilters] = useState<Partial<Record<AuditColumnKey, ColumnFilterValue>>>({});
  const [pageSize, setPageSize] = useLocalStorage<PageSize>(
    user ? `sla.audit.pageSize.${user.user_id}` : "sla.audit.pageSize",
    25,
  );
  const [page, setPage] = useState(1);
  const dragRef = useRef<{ key: AuditColumnKey; startX: number; startWidth: number } | null>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const hScrollRef = useRef<HTMLDivElement>(null);

  const tableWidth = useMemo(
    () =>
      AUDIT_COLUMNS.reduce(
        (sum, column) => sum + (columnWidths[column.key] ?? DEFAULT_COLUMN_WIDTHS[column.key] ?? FALLBACK_COLUMN_WIDTH),
        0,
      ),
    [columnWidths],
  );
  const hasActiveFilters = Object.values(columnFilters).some(isFilterActive);

  useEffect(() => {
    Promise.all([api.auditLog(), api.records(), api.users()])
      .then(([audit, rec, usr]) => {
        setEntries(audit.entries);
        setRecords(rec.records);
        setUsers(usr.users);
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load audit log."));
  }, []);

  useEffect(() => {
    function onMove(event: PointerEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      const next = Math.max(MIN_COLUMN_WIDTH, drag.startWidth + (event.clientX - drag.startX));
      setColumnWidths((current) => ({ ...current, [drag.key]: next }));
    }
    function onUp() {
      if (!dragRef.current) return;
      dragRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [setColumnWidths]);

  const recordMap = useMemo(() => new Map(records.map((row) => [row.record_id, row])), [records]);
  const userMap = useMemo(() => new Map(users.map((row) => [row.user_id, row])), [users]);

  const rows = useMemo<AuditRowView[]>(
    () =>
      entries.map((entry) => ({
        id: entry.id,
        values: {
          timestamp: entry.timestamp,
          object: entry.artifact_table,
          name: subjectOf(entry, recordMap, userMap),
          field: entry.artifact_name,
          change: `${entry.old_field_value} → ${entry.new_field_value}`,
          event: entry.event_type,
          source: entry.trigger_source,
          user: entry.user_id,
        },
      })),
    [entries, recordMap, userMap],
  );

  const choicesFor = useMemo(() => {
    const unique = (key: AuditColumnKey, labelFor?: (value: string) => string) => {
      const seen = new Set<string>();
      const options: { value: string; label: string }[] = [];
      for (const row of rows) {
        const value = row.values[key];
        if (!value || seen.has(value)) continue;
        seen.add(value);
        options.push({ value, label: labelFor ? labelFor(value) : value });
      }
      return options.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
    };
    return {
      object: unique("object", (value) => OBJECT_LABELS[value] ?? value),
      field: unique("field"),
      event: unique("event"),
      source: unique("source"),
      user: unique("user", (value) => analystLabel(users, value)),
    } satisfies Partial<Record<AuditColumnKey, { value: string; label: string }[]>>;
  }, [rows, users]);

  const filtered = useMemo(() => {
    const matched = rows.filter((row) =>
      AUDIT_COLUMNS.every((column) => {
        const filter = columnFilters[column.key];
        if (!isFilterActive(filter)) return true;
        return matchesColumnFilter(row.values[column.key], filter ?? "", column.kind);
      }),
    );
    return [...matched].sort((a, b) => {
      const cmp = a.values[sortKey].localeCompare(b.values[sortKey], undefined, {
        numeric: true,
        sensitivity: "base",
      });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, columnFilters, sortKey, sortDir]);

  const currentPage = clampPage(page, filtered.length, pageSize);
  const pagedRows = useMemo(() => pageSlice(filtered, currentPage, pageSize), [filtered, currentPage, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [columnFilters, pageSize]);

  function widthFor(key: AuditColumnKey) {
    return columnWidths[key] ?? DEFAULT_COLUMN_WIDTHS[key] ?? FALLBACK_COLUMN_WIDTH;
  }

  function toggleSort(key: AuditColumnKey) {
    if (sortKey === key) setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function startResize(key: AuditColumnKey, event: ReactPointerEvent) {
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = {
      key,
      startX: event.clientX,
      startWidth: widthFor(key),
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  function syncHorizontalScroll(source: "table" | "bar") {
    const table = tableScrollRef.current;
    const bar = hScrollRef.current;
    if (!table || !bar) return;
    if (source === "table" && bar.scrollLeft !== table.scrollLeft) bar.scrollLeft = table.scrollLeft;
    if (source === "bar" && table.scrollLeft !== bar.scrollLeft) table.scrollLeft = bar.scrollLeft;
  }

  function cellDisplay(row: AuditRowView, key: AuditColumnKey): string {
    const raw = row.values[key];
    if (key === "timestamp") return formatDateTime(raw);
    if (key === "object") return OBJECT_LABELS[raw] ?? (raw || "—");
    if (key === "user") return analystLabel(users, raw);
    return raw || "—";
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">Audit Log</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            title="Clear filters"
            disabled={!hasActiveFilters}
            onClick={() => setColumnFilters({})}
          >
            <FilterX className="size-4" />
          </Button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-card">
        <div
          ref={tableScrollRef}
          className="records-table-scroll min-h-0 flex-1 overflow-auto"
          onScroll={() => syncHorizontalScroll("table")}
        >
          <Table
            className="w-max table-fixed border-separate border-spacing-0"
            containerClassName="overflow-visible w-max min-h-full"
            style={{ width: tableWidth }}
          >
            <colgroup>
              {AUDIT_COLUMNS.map((column) => (
                <col key={column.key} style={{ width: widthFor(column.key) }} />
              ))}
            </colgroup>
            <TableHeader className="bg-muted">
              <TableRow className="hover:bg-transparent">
                {AUDIT_COLUMNS.map((column, index) => (
                  <TableHead
                    key={column.key}
                    className={cn(
                      "relative h-auto sticky top-0 z-30 whitespace-normal bg-muted px-2 py-1.5 align-top",
                      index < AUDIT_COLUMNS.length - 1 && "border-r border-border",
                    )}
                    style={{ width: widthFor(column.key), minWidth: widthFor(column.key), maxWidth: widthFor(column.key) }}
                  >
                    <div className="mb-1 flex items-center gap-1 pr-2">
                      <span className="min-w-0 flex-1 cursor-text select-text text-left text-xs font-semibold leading-4">
                        {column.alias}
                      </span>
                      <button
                        type="button"
                        className="shrink-0 rounded-sm p-0.5 text-muted-foreground select-none hover:bg-accent hover:text-foreground"
                        title={`Sort by ${column.alias}`}
                        onClick={() => toggleSort(column.key)}
                      >
                        {sortKey === column.key ? (
                          sortDir === "asc" ? (
                            <ArrowUp className="size-3" />
                          ) : (
                            <ArrowDown className="size-3" />
                          )
                        ) : (
                          <ArrowUpDown className="size-3 opacity-40" />
                        )}
                      </button>
                    </div>
                    <div className="pr-2 select-none">
                      <ColumnFilter
                        kind={column.kind}
                        value={columnFilters[column.key] ?? (column.kind === "choice" || column.kind === "boolean" ? [] : "")}
                        onChange={(next) => setColumnFilters((current) => ({ ...current, [column.key]: next }))}
                        choices={choicesFor[column.key as keyof typeof choicesFor] ?? []}
                      />
                    </div>
                    {index < AUDIT_COLUMNS.length - 1 ? (
                      <span
                        role="separator"
                        aria-orientation="vertical"
                        aria-label={`Resize ${column.alias} column`}
                        className="absolute inset-y-0 right-0 z-20 flex w-3 cursor-col-resize items-center justify-center text-muted-foreground/50 select-none hover:text-primary"
                        onPointerDown={(event) => startResize(column.key, event)}
                        onClick={(event) => event.stopPropagation()}
                        onDoubleClick={(event) => {
                          event.stopPropagation();
                          setColumnWidths((current) => ({
                            ...current,
                            [column.key]: DEFAULT_COLUMN_WIDTHS[column.key],
                          }));
                        }}
                      >
                        |
                      </span>
                    ) : null}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={AUDIT_COLUMNS.length} className="h-24 text-center text-muted-foreground">
                    No audit events match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                pagedRows.map((row, rowIndex) => (
                  <TableRow key={row.id} className={cn(rowIndex % 2 === 1 && "bg-muted/30")}>
                    {AUDIT_COLUMNS.map((column, index) => {
                      const value = cellDisplay(row, column.key);
                      return (
                        <TableCell
                          key={column.key}
                          className={cn(
                            "overflow-hidden text-sm text-ellipsis",
                            index < AUDIT_COLUMNS.length - 1 && "border-r border-border",
                          )}
                          style={{ width: widthFor(column.key), maxWidth: widthFor(column.key) }}
                          title={value}
                        >
                          {column.key === "field" ? <span className="font-mono text-xs">{value}</span> : value}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <div
          ref={hScrollRef}
          className="records-h-scroll shrink-0 border-t"
          onScroll={() => syncHorizontalScroll("bar")}
          aria-label="Scroll audit log columns"
        >
          <div style={{ width: tableWidth, height: 1 }} />
        </div>
      </div>
      <RecordsPagination
        total={filtered.length}
        page={currentPage}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        itemLabel="events"
      />
    </div>
  );
}

/**
 * The human-readable subject of an entry. `artifact_id` alone is meaningless now that
 * the log covers users and connectors as well as records, so it is resolved against
 * whichever store `artifact_table` names.
 */
function subjectOf(
  entry: AuditLogEntry,
  recordMap: Map<string, FileRecord>,
  userMap: Map<string, User>,
): string {
  if (entry.artifact_table === "sla-users") {
    const subject = userMap.get(entry.artifact_id);
    return subject ? `${subject.first_name} ${subject.last_name}`.trim() || subject.email : entry.artifact_id;
  }
  if (entry.artifact_table === "connectors") return entry.artifact_id;
  const record = recordMap.get(entry.artifact_id);
  return record?.file_name || record?.project_number || entry.artifact_id;
}
