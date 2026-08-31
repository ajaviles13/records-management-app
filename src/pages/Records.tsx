import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, FilterX, FolderInput, Pencil, X } from "lucide-react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { ColumnFilter } from "@/components/records/ColumnFilter";
import { RecordModal, emptyRecord } from "@/components/records/RecordModal";
import { ImportRecordsDialog } from "@/components/records/ImportRecordsDialog";
import { RecordsPagination } from "@/components/records/RecordsPagination";
import { ExportDialog } from "@/components/records/ExportDialog";
import { ViewEditor } from "@/components/records/ViewEditor";
import { ViewPicker } from "@/components/records/ViewPicker";
import { StatusBadge } from "@/components/StatusBadge";
import { UrlLink } from "@/components/UrlLink";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import {
  choiceOptionsForField,
  fieldAlias,
  filterKindFor,
  isFilterActive,
  isUrlField,
  languageLabel,
  matchesColumnFilter,
  type ColumnFilterValue,
} from "@/lib/columnFilters";
import { analystLabel, formatDateTime, yesNoLabel } from "@/lib/format";
import { canEditRecords, canExport } from "@/lib/roles";
import { clampPage, pageSlice } from "@/lib/pagination";
import { basisLabel, recordMatchesWindow } from "@/lib/dateRange";
import { parseRecordsLink, type RecordsDateWindow } from "@/lib/recordsNav";
import { exportCsv, exportXlsx } from "@/lib/exportRecords";
import { deriveStatus } from "@/lib/status";
import { cn } from "@/lib/utils";
import {
  ALL_RECORDS_VIEW_ID,
  allRecordsView,
  matchesViewConditions,
  recordFieldValue,
  sanitizeViewFields,
  sortRecords,
} from "@/lib/viewQuery";
import type {
  DataDictionaryField,
  ExportFormat,
  ExportScope,
  FieldOption,
  FileRecord,
  LanguageCode,
  PageSize,
  SavedView,
  User,
  ViewDraft,
} from "@/types";

const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  file_name: 650,
  project_number: 168,
  language_code: 180,
  status: 150,
  sla_met: 150,
  is_urgent: 150,
  assigned_analyst_id: 180,
  received_at_est: 160,
  delivered_at_est: 160,
  template_type: 150,
  state: 150,
  line_of_business: 200,
  egnyte_direct_link: 300,
};

const MIN_COLUMN_WIDTH = 150;
const FALLBACK_COLUMN_WIDTH = 200;

export function RecordsPage() {
  const { user } = useAuth();
  const location = useLocation();
  const [records, setRecords] = useState<FileRecord[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [options, setOptions] = useState<FieldOption[]>([]);
  const [dictionary, setDictionary] = useState<DataDictionaryField[]>([]);
  const [languageCodes, setLanguageCodes] = useState<LanguageCode[]>([]);
  const [views, setViews] = useState<SavedView[]>([]);
  const [activeViewId, setActiveViewId] = useLocalStorage(
    user ? `sla.records.activeViewId.${user.user_id}` : "sla.records.activeViewId",
    ALL_RECORDS_VIEW_ID,
  );
  const [sortKey, setSortKey] = useState("received_at_est");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [sortOverride, setSortOverride] = useState(false);
  const [columnWidths, setColumnWidths] = useLocalStorage("sla.records.columnWidths", DEFAULT_COLUMN_WIDTHS);
  const [columnFilters, setColumnFilters] = useState<Partial<Record<string, ColumnFilterValue>>>({});
  const [dateWindow, setDateWindow] = useState<RecordsDateWindow | null>(null);
  const [pageSize, setPageSize] = useLocalStorage<PageSize>(
    user ? `sla.records.pageSize.${user.user_id}` : "sla.records.pageSize",
    25,
  );
  const [page, setPage] = useState(1);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState<FileRecord>(emptyRecord());
  const [pending, setPending] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [editingViewId, setEditingViewId] = useState<string>(ALL_RECORDS_VIEW_ID);
  const [viewPending, setViewPending] = useState(false);
  const dragRef = useRef<{ key: string; startX: number; startWidth: number } | null>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const hScrollRef = useRef<HTMLDivElement>(null);
  const droppedToastRef = useRef<string>("");
  const appliedSearchRef = useRef<string | null>(null);

  const readOnly = !user || !canEditRecords(user.role_access);
  const lookups = useMemo(() => ({ options, users, languageCodes }), [options, users, languageCodes]);
  const builtinView = useMemo(() => allRecordsView(), []);
  const pickerViews = useMemo(() => [builtinView, ...views], [builtinView, views]);
  const activeView = useMemo(
    () => pickerViews.find((view) => view.view_id === activeViewId) ?? builtinView,
    [pickerViews, activeViewId, builtinView],
  );
  const visibleColumns = useMemo(() => sanitizeViewFields(activeView.fields, dictionary), [activeView.fields, dictionary]);
  const editColumnWidth = readOnly ? 0 : 52;
  const tableWidth = useMemo(
    () =>
      visibleColumns.fields.reduce(
        (sum, key) => sum + (columnWidths[key] ?? DEFAULT_COLUMN_WIDTHS[key] ?? FALLBACK_COLUMN_WIDTH),
        editColumnWidth,
      ),
    [visibleColumns.fields, columnWidths, editColumnWidth],
  );
  const hasActiveFilters = Object.values(columnFilters).some(isFilterActive);
  const editingView = pickerViews.find((view) => view.view_id === editingViewId) ?? activeView;
  const editorInitial = useMemo(() => {
    if (editorMode === "edit") return editingView;
    return {
      ...activeView,
      view_id: "",
      name: "",
      order: 9999,
    };
  }, [activeView, editingView, editorMode]);

  async function load() {
    const [recordRes, userRes, optionRes, dictionaryRes, languageRes, viewRes] = await Promise.allSettled([
      api.records(),
      api.users(),
      api.fieldOptions(),
      api.dataDictionary(),
      api.languageCodes(),
      api.views(),
    ]);
    if (recordRes.status === "fulfilled") setRecords(recordRes.value.records);
    else toast.error(recordRes.reason instanceof Error ? recordRes.reason.message : "Failed to load records.");
    if (userRes.status === "fulfilled") setUsers(userRes.value.users);
    if (optionRes.status === "fulfilled") setOptions(optionRes.value.options);
    if (dictionaryRes.status === "fulfilled") setDictionary(dictionaryRes.value.fields);
    if (languageRes.status === "fulfilled") setLanguageCodes(languageRes.value.languages);
    else toast.error("Failed to load language codes.");
    if (viewRes.status === "fulfilled") setViews(viewRes.value.views);
    else toast.error("Failed to load views.");
  }

  useEffect(() => {
    load().catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load records."));
  }, []);

  useEffect(() => {
    if (!views.length) return;
    if (activeViewId !== ALL_RECORDS_VIEW_ID && !views.some((view) => view.view_id === activeViewId)) {
      setActiveViewId(ALL_RECORDS_VIEW_ID);
    }
  }, [views, activeViewId, setActiveViewId]);

  useEffect(() => {
    const key = `${activeView.view_id}:${visibleColumns.dropped.join(",")}`;
    if (!visibleColumns.dropped.length || droppedToastRef.current === key) return;
    droppedToastRef.current = key;
    toast.warning(`Ignored unknown fields on this view: ${visibleColumns.dropped.join(", ")}`);
  }, [activeView.view_id, visibleColumns.dropped]);

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

  const filtered = useMemo(() => {
    const userId = user?.user_id ?? "";
    const byView = records.filter((row) => matchesViewConditions(row, activeView.conditions, userId, dictionary));
    const byHeader = byView.filter((row) =>
      visibleColumns.fields.every((key) => {
        const filter = columnFilters[key];
        if (!isFilterActive(filter)) return true;
        return matchesColumnFilter(filterValue(row, key), filter ?? "", filterKindFor(key, dictionary));
      }),
    );
    const dated = dateWindow
      ? byHeader.filter((row) => recordMatchesWindow(row, dateWindow, dateWindow.basis))
      : byHeader;
    if (!sortOverride) return sortRecords(dated, activeView.sorts);
    return [...dated].sort((a, b) => {
      const cmp = recordFieldValue(a, sortKey).localeCompare(recordFieldValue(b, sortKey), undefined, {
        numeric: true,
        sensitivity: "base",
      });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [
    records,
    columnFilters,
    sortKey,
    sortDir,
    dictionary,
    activeView,
    visibleColumns.fields,
    sortOverride,
    user?.user_id,
    dateWindow,
  ]);
  const currentPage = clampPage(page, filtered.length, pageSize);
  const pagedRecords = useMemo(() => pageSlice(filtered, currentPage, pageSize), [filtered, currentPage, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [activeViewId, columnFilters, pageSize]);
  useEffect(() => {
    if (appliedSearchRef.current === location.search) return;
    appliedSearchRef.current = location.search;
    const link = parseRecordsLink(location.search);
    if (!location.search) {
      setDateWindow(null);
      return;
    }
    setActiveViewId(link.viewId ?? ALL_RECORDS_VIEW_ID);
    setDateWindow(link.dateWindow ?? null);
    const next: Partial<Record<string, ColumnFilterValue>> = {};
    for (const [key, values] of Object.entries(link.filters ?? {})) {
      const kind = filterKindFor(key, dictionary);
      next[key] = kind === "choice" || kind === "boolean" ? values : (values[0] ?? "");
    }
    setColumnFilters(next);
    setPage(1);
  }, [location.search, dictionary, setActiveViewId]);

  function widthFor(key: string) {
    return columnWidths[key] ?? DEFAULT_COLUMN_WIDTHS[key] ?? FALLBACK_COLUMN_WIDTH;
  }

  function selectView(viewId: string) {
    setActiveViewId(viewId);
    setColumnFilters({});
    setSortOverride(false);
    const next = pickerViews.find((view) => view.view_id === viewId) ?? allRecordsView();
    const firstSort = next.sorts[0];
    setSortKey(firstSort?.field ?? "received_at_est");
    setSortDir(firstSort?.direction ?? "desc");
    setDateWindow(null);
  }

  function toggleSort(key: string) {
    setSortOverride(true);
    if (sortKey === key) setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function startResize(key: string, event: ReactPointerEvent) {
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

  function openEdit(record: FileRecord) {
    setDraft({ ...record });
    setSheetOpen(true);
  }

  async function save() {
    setPending(true);
    try {
      await api.updateRecord(draft.record_id, draft);
      toast.success("Record updated.");
      setSheetOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setPending(false);
    }
  }

  function exportRecords(scope: ExportScope, format: ExportFormat) {
    const rows = scope === "page" ? pagedRecords : filtered;
    const slug =
      activeView.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "all-records";
    const fileName = `${slug}-${new Date().toISOString().slice(0, 10)}`;
    const lookups = { dictionary, users, languages: languageCodes };

    if (format === "csv") exportCsv(rows, visibleColumns.fields, fileName, lookups);
    else {
      void exportXlsx(rows, visibleColumns.fields, fileName, lookups).catch((err) =>
        toast.error(err instanceof Error ? err.message : "Excel export failed."),
      );
    }
  }

  async function saveView(draftView: ViewDraft) {
    setViewPending(true);
    try {
      if (editorMode === "create") {
        const created = await api.createView(draftView);
        toast.success("View saved.");
        setEditorOpen(false);
        await load();
        selectView(created.view.view_id);
      } else {
        await api.updateView(editingView.view_id, draftView);
        toast.success("View updated.");
        setEditorOpen(false);
        await load();
        selectView(editingView.view_id);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save view.");
    } finally {
      setViewPending(false);
    }
  }

  async function deleteView() {
    if (editingView.view_id === ALL_RECORDS_VIEW_ID) return;
    if (!window.confirm(`Delete view “${editingView.name}”?`)) return;
    setViewPending(true);
    try {
      const deletedId = editingView.view_id;
      await api.deleteView(deletedId);
      toast.success("View deleted.");
      setEditorOpen(false);
      if (activeView.view_id === deletedId) selectView(ALL_RECORDS_VIEW_ID);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete view.");
    } finally {
      setViewPending(false);
    }
  }

  function cellValue(record: FileRecord, key: string) {
    if (key === "status") return <StatusBadge record={record} />;
    if (key === "assigned_analyst_id") return analystLabel(users, record.assigned_analyst_id);
    if (key === "language_code") return languageLabel(record.language_code, languageCodes);
    if (key === "sla_met" || key === "is_urgent") return yesNoLabel(record[key as keyof FileRecord] as string);
    if (key === "template_type") {
      const kind = record.template_type === "PDF" ? "pdf" : record.template_type === "Word" ? "word" : "";
      return (
        <span className={kind ? `template-type-icon template-type-icon-${kind}` : undefined}>
          {record.template_type || "—"}
        </span>
      );
    }
    const kind = filterKindFor(key, dictionary);
    const raw = recordFieldValue(record, key);
    if (isUrlField(key, dictionary)) return <UrlLink value={raw} />;
    if (kind === "boolean") return yesNoLabel(raw);
    if (kind === "date") return formatDateTime(raw);
    return raw || "—";
  }

  function choicesFor(key: string) {
    return choiceOptionsForField(key, dictionary, lookups);
  }

  const currentSortField = sortOverride ? sortKey : (activeView.sorts[0]?.field ?? sortKey);
  const currentSortDir = sortOverride ? sortDir : (activeView.sorts[0]?.direction ?? sortDir);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">Records</h2>
          <ViewPicker
            views={pickerViews}
            activeViewId={activeView.view_id}
            currentUser={user}
            onSelect={selectView}
            onNew={() => {
              setEditorMode("create");
              setEditorOpen(true);
            }}
            onEdit={(viewId) => {
              setEditingViewId(viewId);
              setEditorMode("edit");
              setEditorOpen(true);
            }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dateWindow ? (
            <span className="flex items-center gap-1.5 rounded-full border bg-muted px-3 py-1 text-xs">
              {basisLabel(dateWindow.basis)} between {dateWindow.from} and {dateWindow.to}
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setDateWindow(null)}
                aria-label="Clear date range filter"
              >
                <X className="size-3" />
              </button>
            </span>
          ) : null}
          <Button
            variant="outline"
            size="icon-sm"
            title="Clear filters"
            disabled={!hasActiveFilters}
            onClick={() => setColumnFilters({})}
          >
            <FilterX className="size-4" />
          </Button>
          {canExport(user?.role_access ?? "Viewer") ? (
            <Button variant="outline" onClick={() => setExportOpen(true)}>
              Export Data
            </Button>
          ) : null}
          {readOnly ? null : (
            <Button onClick={() => setImportOpen(true)}>
              <FolderInput className="size-4" />
              Import Records
            </Button>
          )}
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-card">
        <div
          ref={tableScrollRef}
          className="records-table-scroll min-h-0 flex-1 overflow-auto"
          onScroll={() => syncHorizontalScroll("table")}
        >
        <Table
          className="w-max table-fixed"
          containerClassName="overflow-visible w-max min-h-full"
          style={{ width: tableWidth }}
        >
          <colgroup>
            {!readOnly && <col style={{ width: editColumnWidth }} />}
            {visibleColumns.fields.map((key) => (
              <col key={key} style={{ width: widthFor(key) }} />
            ))}
          </colgroup>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {!readOnly && (
                <TableHead
                  className="sticky top-0 left-0 z-40 bg-muted/70 px-2"
                  style={{ width: editColumnWidth }}
                >
                  <span className="sr-only">Edit</span>
                </TableHead>
              )}
              {visibleColumns.fields.map((key, index) => {
                const kind = filterKindFor(key, dictionary);
                const alias = fieldAlias(key, dictionary);
                return (
                  <TableHead
                    key={key}
                    className={cn(
                          "relative h-auto sticky top-0 z-30 whitespace-normal bg-muted/70 px-2 py-1.5 align-top",
                      index < visibleColumns.fields.length - 1 && "border-r border-border",
                    )}
                    style={{ width: widthFor(key), minWidth: widthFor(key), maxWidth: widthFor(key) }}
                  >
                    <div className="mb-1 flex items-center gap-1 pr-2">
                      <span className="min-w-0 flex-1 cursor-text select-text text-left text-xs font-semibold leading-4">
                        {alias}
                      </span>
                      <button
                        type="button"
                        className="shrink-0 rounded-sm p-0.5 text-muted-foreground select-none hover:bg-accent hover:text-foreground"
                        title={`Sort by ${alias}`}
                        onClick={() => toggleSort(key)}
                      >
                        {currentSortField === key ? (
                          currentSortDir === "asc" ? (
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
                        kind={kind}
                        value={columnFilters[key] ?? (kind === "choice" || kind === "boolean" ? [] : "")}
                        onChange={(next) => setColumnFilters((current) => ({ ...current, [key]: next }))}
                        choices={choicesFor(key)}
                      />
                    </div>
                    {index < visibleColumns.fields.length - 1 ? (
                      <span
                        role="separator"
                        aria-orientation="vertical"
                        aria-label={`Resize ${alias} column`}
                        className="absolute inset-y-0 right-0 z-20 flex w-3 cursor-col-resize items-center justify-center text-muted-foreground/50 select-none hover:text-primary"
                        onPointerDown={(event) => startResize(key, event)}
                        onClick={(event) => event.stopPropagation()}
                        onDoubleClick={(event) => {
                          event.stopPropagation();
                          setColumnWidths((current) => ({ ...current, [key]: DEFAULT_COLUMN_WIDTHS[key] ?? FALLBACK_COLUMN_WIDTH }));
                        }}
                      >
                        |
                      </span>
                    ) : null}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={Math.max(visibleColumns.fields.length + (readOnly ? 0 : 1), 1)} className="h-24 text-center text-muted-foreground">
                  No records match the current view and filters.
                </TableCell>
              </TableRow>
            ) : (
              pagedRecords.map((record, rowIndex) => (
                <TableRow
                  key={record.record_id}
                  className={cn(rowIndex % 2 === 1 && "bg-muted/30")}
                >
                  {!readOnly && (
                    <TableCell
                      className={cn("sticky left-0 z-20 px-2",  "bg-card")}
                    >
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                        aria-label={`Edit ${record.file_name}`}
                        onClick={() => openEdit(record)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                    </TableCell>
                  )}
                  {visibleColumns.fields.map((key, index) => {
                    const value = cellValue(record, key);
                    const raw = recordFieldValue(record, key);
                    return (
                      <TableCell
                        key={key}
                        className={cn(
                          "overflow-hidden text-sm text-ellipsis",
                          index < visibleColumns.fields.length - 1 && "border-r border-border",
                        )}
                        style={{ width: widthFor(key), maxWidth: widthFor(key) }}
                        title={typeof value === "string" ? value : raw || undefined}
                      >
                        {value}
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
          aria-label="Scroll records columns"
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
      />
      <RecordModal
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        mode="edit"
        draft={draft}
        onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
        onSave={save}
        pending={pending}
        readOnly={readOnly}
        users={users}
        options={options}
        dictionary={dictionary}
        languageCodes={languageCodes}
        role={user?.role_access}
      />
      <ImportRecordsDialog open={importOpen} onOpenChange={setImportOpen} />
      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        pageCount={pagedRecords.length}
        viewCount={filtered.length}
        onExport={exportRecords}
      />
      <ViewEditor
        open={editorOpen}
        mode={editorMode}
        initial={editorInitial}
        dictionary={dictionary}
        lookups={lookups}
        pending={viewPending}
        users={users}
        currentUser={user}
        onOpenChange={setEditorOpen}
        onSave={saveView}
        onDelete={editorMode === "edit" ? () => void deleteView() : undefined}
      />
    </div>
  );
}

function filterValue(record: FileRecord, key: string): string {
  if (key === "status") return deriveStatus(record);
  return recordFieldValue(record, key);
}
