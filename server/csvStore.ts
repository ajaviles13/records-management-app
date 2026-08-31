import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.resolve(__dirname, "../data");

export const FILES = {
  users: "sla-users.csv",
  records: "sla-file-records.csv",
  audit: "sla-audit-log.csv",
  fieldOptions: "field-option-values.csv",
  dataDictionary: "data-dictionary.csv",
  languageCodes: "language-codes.csv",
  views: "saved-views.csv",
} as const;

export function readCsv<T extends Record<string, string>>(filename: string): T[] {
  const filePath = path.join(DATA_DIR, filename);
  if (!existsSync(filePath)) return [];
  const raw = readFileSync(filePath, "utf8");
  if (!raw.trim()) return [];
  return parse(raw, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    bom: true,
  }) as T[];
}

/**
 * The line ending already used by a file, so rewriting one row does not reflow the whole
 * file. The seeded CSVs are CRLF; without this a single edit produces a diff touching
 * every line.
 */
function existingDelimiter(filePath: string): "\r\n" | "\n" {
  if (!existsSync(filePath)) return "\r\n";
  const raw = readFileSync(filePath, "utf8");
  const firstBreak = raw.indexOf("\n");
  if (firstBreak <= 0) return "\r\n";
  return raw[firstBreak - 1] === "\r" ? "\r\n" : "\n";
}

export function writeCsv<T extends Record<string, string>>(filename: string, rows: T[], columns: string[]): void {
  const filePath = path.join(DATA_DIR, filename);
  const output = stringify(rows, {
    header: true,
    columns,
    record_delimiter: existingDelimiter(filePath),
  });
  writeFileSync(filePath, output, "utf8");
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function nowEstish(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}
