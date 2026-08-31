import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "@/api/client";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { analystLabel, formatDateTime } from "@/lib/format";
import type { AuditLogEntry, FileRecord, User } from "@/types";

/** Friendly names for the stores the audit log covers. */
const OBJECT_LABELS: Record<string, string> = {
  "sla-file-records": "Record",
  "sla-users": "User",
  connectors: "Connector",
  "language-codes": "Language",
};

export function AuditLogPage() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [records, setRecords] = useState<FileRecord[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    Promise.all([api.auditLog(), api.records(), api.users()])
      .then(([audit, rec, usr]) => {
        setEntries(audit.entries);
        setRecords(rec.records);
        setUsers(usr.users);
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load audit log."));
  }, []);

  const recordMap = useMemo(() => new Map(records.map((row) => [row.record_id, row])), [records]);
  const userMap = useMemo(() => new Map(users.map((row) => [row.user_id, row])), [users]);

  /**
   * The human-readable subject of an entry. `artifact_id` alone is meaningless now that
   * the log covers users and connectors as well as records, so it is resolved against
   * whichever store `artifact_table` names.
   */
  function subjectOf(entry: AuditLogEntry): string {
    if (entry.artifact_table === "sla-users") {
      const user = userMap.get(entry.artifact_id);
      return user ? `${user.first_name} ${user.last_name}`.trim() || user.email : entry.artifact_id;
    }
    if (entry.artifact_table === "connectors") return entry.artifact_id;
    const record = recordMap.get(entry.artifact_id);
    return record?.file_name || record?.project_number || entry.artifact_id;
  }

  function objectLabelOf(entry: AuditLogEntry): string {
    return OBJECT_LABELS[entry.artifact_table] ?? entry.artifact_table ?? "Record";
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((entry) => {
      const haystack = [
        entry.timestamp,
        entry.event_type,
        entry.trigger_source,
        entry.artifact_name,
        entry.old_field_value,
        entry.new_field_value,
        entry.artifact_id,
        objectLabelOf(entry),
        subjectOf(entry),
        analystLabel(users, entry.user_id),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
    // `subjectOf` and `objectLabelOf` close over the lookup maps, so those are the real deps.
  }, [entries, query, recordMap, userMap, users]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div>
        <h2 className="text-2xl font-semibold">Audit Log</h2>
        <p className="text-sm text-muted-foreground">
          Every change to records, users, and connectors, captured in sla-audit-log.csv.
        </p>
      </div>
      <Input
        className="max-w-md"
        placeholder="Search events, objects, fields, users…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Object</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Field</TableHead>
              <TableHead>Change</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>User</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  No audit events found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((entry) => {
                const subject = subjectOf(entry);
                return (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap">{formatDateTime(entry.timestamp)}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{objectLabelOf(entry)}</TableCell>
                    <TableCell className="max-w-64 truncate" title={subject}>
                      {subject}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs">{entry.artifact_name}</TableCell>
                    <TableCell className="max-w-80 truncate" title={`${entry.old_field_value} → ${entry.new_field_value}`}>
                      {entry.old_field_value} → {entry.new_field_value}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{entry.event_type}</TableCell>
                    <TableCell>{entry.trigger_source}</TableCell>
                    <TableCell className="whitespace-nowrap">{analystLabel(users, entry.user_id)}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
