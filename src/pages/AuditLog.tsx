import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "@/api/client";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { analystLabel, formatDateTime } from "@/lib/format";
import type { AuditLogEntry, FileRecord, User } from "@/types";

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((entry) => {
      const record = recordMap.get(entry.artifact_id);
      const haystack = [
        entry.timestamp,
        entry.event_type,
        entry.trigger_source,
        entry.old_field_value,
        entry.new_field_value,
        entry.artifact_id,
        record?.file_name,
        record?.project_number,
        analystLabel(users, entry.user_id),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [entries, query, recordMap, users]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div>
        <h2 className="text-2xl font-semibold">Audit Log</h2>
        <p className="text-sm text-muted-foreground">Changes written to sla-file-records, captured in sla-audit-log.csv.</p>
      </div>
      <Input className="max-w-md" placeholder="Search events, files, users…" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>File</TableHead>
              <TableHead>Change</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>User</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No audit events found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((entry) => {
                const record = recordMap.get(entry.artifact_id);
                return (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap">{formatDateTime(entry.timestamp)}</TableCell>
                    <TableCell className="max-w-72 truncate" title={record?.file_name || entry.artifact_id}>
                      {record?.file_name || entry.artifact_id}
                    </TableCell>
                    <TableCell className="max-w-80 truncate">
                      {entry.old_field_value} → {entry.new_field_value}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{entry.event_type}</TableCell>
                    <TableCell>{entry.trigger_source}</TableCell>
                    <TableCell>{analystLabel(users, entry.user_id)}</TableCell>
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
