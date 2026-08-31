import ExcelJS from "exceljs";
import { fieldAlias, filterKindFor, languageLabel } from "@/lib/columnFilters";
import { analystLabel, formatDateTime, yesNoLabel } from "@/lib/format";
import { deriveStatus } from "@/lib/status";
import { recordFieldValue } from "@/lib/viewQuery";
import type { DataDictionaryField, FileRecord, LanguageCode, User } from "@/types";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

interface ExportLookups {
  dictionary: DataDictionaryField[];
  users: User[];
  languages: LanguageCode[];
}

/**
 * Renders a cell the way the Records table shows it, so an export matches what the user
 * was looking at rather than the raw CSV value.
 */
export function exportValue(record: FileRecord, key: string, lookups: ExportLookups): string {
  const { dictionary, users, languages } = lookups;
  if (key === "status") return deriveStatus(record);
  if (key === "assigned_analyst_id") return analystLabel(users, record.assigned_analyst_id);
  if (key === "language_code") return languageLabel(record.language_code, languages);

  const raw = recordFieldValue(record, key);
  const kind = filterKindFor(key, dictionary);
  if (key === "sla_met" || key === "is_urgent" || kind === "boolean") return yesNoLabel(raw);
  if (kind === "date") return formatDateTime(raw);
  return raw;
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function headerRow(fields: string[], dictionary: DataDictionaryField[]): string[] {
  return fields.map((key) => fieldAlias(key, dictionary));
}

export function exportCsv(records: FileRecord[], fields: string[], filename: string, lookups: ExportLookups) {
  const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const rows = [
    headerRow(fields, lookups.dictionary),
    ...records.map((record) => fields.map((key) => exportValue(record, key, lookups))),
  ];
  const csv = rows.map((row) => row.map(escape).join(",")).join("\r\n");
  // The BOM keeps Excel from mangling non-ASCII file names on open.
  download(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }), `${filename}.csv`);
}

export async function exportXlsx(
  records: FileRecord[],
  fields: string[],
  filename: string,
  lookups: ExportLookups,
) {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Records", { views: [{ state: "frozen", ySplit: 1 }] });

  sheet.addRow(headerRow(fields, lookups.dictionary));
  sheet.getRow(1).font = { bold: true };
  for (const record of records) {
    sheet.addRow(fields.map((key) => exportValue(record, key, lookups)));
  }
  fields.forEach((key, index) => {
    const alias = fieldAlias(key, lookups.dictionary);
    sheet.getColumn(index + 1).width = Math.min(50, Math.max(12, alias.length + 2));
  });

  download(new Blob([await book.xlsx.writeBuffer()], { type: XLSX_MIME }), `${filename}.xlsx`);
}
