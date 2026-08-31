import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { SlaStackedChart } from "@/components/snapshot/SlaStackedChart";
import { SnapshotDateFilter } from "@/components/snapshot/SnapshotDateFilter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { recordMatchesWindow, resolveDateRange } from "@/lib/dateRange";
import { buildRecordsLink } from "@/lib/recordsNav";
import { canToggleSnapshotScope, seesAllRecords } from "@/lib/roles";
import { deriveStatus } from "@/lib/status";
import { ALL_RECORDS_VIEW_ID } from "@/lib/viewQuery";
import type { DerivedStatus, FileRecord, SnapshotDateRange } from "@/types";

/** Sentinel understood by the Records column filters as "field is empty". */
const NOT_SET = "__notset__";

interface Metric {
  label: string;
  value: number;
  hint: string;
  filters: Record<string, string[]>;
}

export function MySnapshotPage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<FileRecord[]>([]);
  const [range, setRange] = useState<SnapshotDateRange>({ preset: "all", basis: "both", from: "", to: "" });
  const canToggle = canToggleSnapshotScope(user?.role_access ?? "Viewer");
  const [managerTeamWide, setManagerTeamWide] = useLocalStorage(
    user ? `sla.snapshot.teamWide.${user.user_id}` : "sla.snapshot.teamWide",
    true,
  );

  useEffect(() => {
    api
      .records()
      .then((res) => setRecords(res.records))
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load snapshot."));
  }, []);

  const teamWide = canToggle ? managerTeamWide : seesAllRecords(user?.role_access ?? "Viewer");
  const window = useMemo(() => resolveDateRange(range), [range]);

  /** Records this user is allowed to count, before the date range is applied. */
  const mine = useMemo(
    () => (teamWide ? records : records.filter((row) => row.assigned_analyst_id === user?.user_id)),
    [records, teamWide, user?.user_id],
  );

  const scoped = useMemo(
    () => mine.filter((row) => recordMatchesWindow(row, window, range.basis)),
    [mine, window, range.basis],
  );

  const counts = useMemo(
    () =>
      scoped.reduce(
        (acc, row) => {
          acc[deriveStatus(row)] += 1;
          return acc;
        },
        { "In-Review": 0, Completed: 0, "On-Hold": 0 } as Record<DerivedStatus, number>,
      ),
    [scoped],
  );

  const dateWindow = window.from && window.to ? { ...window, basis: range.basis } : null;

  /**
   * Analysts, and Managers in "my documents" mode, only count their own records, so every
   * drill-through has to carry `assigned_analyst_id` or Records (team-wide by default)
   * will inflate the count.
   */
  function linkFor(filters: Record<string, string[]>, override?: { from: string; to: string }) {
    return buildRecordsLink({
      viewId: ALL_RECORDS_VIEW_ID,
      filters: !teamWide && user ? { ...filters, assigned_analyst_id: [user.user_id] } : filters,
      dateWindow: override ? { ...override, basis: range.basis } : dateWindow,
    });
  }

  const metrics: Metric[] = [
    {
      label: "Documents In-Review",
      value: counts["In-Review"],
      hint: "No delivery time and no hold comment",
      filters: { status: ["In-Review"] },
    },
    {
      label: "Documents Completed",
      value: counts.Completed,
      hint: "Delivery time recorded",
      filters: { status: ["Completed"] },
    },
    {
      label: "Documents On-Hold",
      value: counts["On-Hold"],
      hint: "Hold comment present",
      filters: { status: ["On-Hold"] },
    },
  ];

  const unassigned = teamWide ? scoped.filter((row) => !row.assigned_analyst_id).length : 0;

  const subtitle = teamWide
    ? "Team-wide document and SLA outcomes."
    : canToggle
      ? "My document and SLA outcomes."
      : `Documents assigned to ${user?.first_name} ${user?.last_name}.`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-semibold">My Snapshot</h2>
            {canToggle ? (
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={managerTeamWide}
                  onCheckedChange={setManagerTeamWide}
                  aria-label="Show team-wide snapshot"
                />
                <span className="text-muted-foreground">
                  {managerTeamWide ? "Team-wide" : "My documents"}
                </span>
              </label>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <SnapshotDateFilter value={range} onChange={setRange} />
      </div>

      <div className={teamWide ? "grid gap-4 md:grid-cols-2 xl:grid-cols-4" : "grid gap-4 md:grid-cols-3"}>
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <CardHeader>
              <CardDescription>{metric.label}</CardDescription>
              <CardTitle className="text-4xl tabular-nums">
                <Link className="hover:underline" to={linkFor(metric.filters)}>
                  {metric.value}
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{metric.hint}</p>
            </CardContent>
          </Card>
        ))}

        {teamWide ? (
          <Card className={unassigned > 0 ? "border-amber-500/50" : undefined}>
            <CardHeader>
              <CardDescription>Unassigned</CardDescription>
              <CardTitle className="text-4xl tabular-nums">
                <Link className="hover:underline" to={linkFor({ assigned_analyst_id: [NOT_SET] })}>
                  {unassigned}
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-xs text-muted-foreground">No analyst is currently assigned</p>
              {unassigned > 0 ? (
                <Link
                  className="text-xs font-medium text-primary hover:underline"
                  to={linkFor({ assigned_analyst_id: [NOT_SET] })}
                >
                  Assign these records →
                </Link>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
      </div>

      <SlaStackedChart
        records={mine}
        window={window}
        basis={range.basis}
        linkFor={(slaMet, from, to) => linkFor({ sla_met: [slaMet] }, { from, to })}
      />

      <p className="text-sm text-muted-foreground">
        {scoped.length} document{scoped.length === 1 ? "" : "s"} in the selected range.
      </p>
    </div>
  );
}
