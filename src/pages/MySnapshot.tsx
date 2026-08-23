import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { deriveStatus } from "@/lib/status";
import type { FileRecord } from "@/types";

export function MySnapshotPage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<FileRecord[]>([]);

  useEffect(() => {
    api
      .records()
      .then((res) => setRecords(res.records))
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load snapshot."));
  }, []);

  const mine = useMemo(
    () => records.filter((row) => row.assigned_analyst_id === user?.user_id),
    [records, user],
  );

  const counts = useMemo(() => {
    return mine.reduce(
      (acc, row) => {
        acc[deriveStatus(row)] += 1;
        return acc;
      },
      { "In-Review": 0, Completed: 0, "On-Hold": 0 },
    );
  }, [mine]);

  const cards = [
    { label: "Documents In-Review", value: counts["In-Review"], hint: "No delivery time, no hold comment" },
    { label: "Documents Completed", value: counts.Completed, hint: "Delivery time recorded" },
    { label: "Documents On-Hold", value: counts["On-Hold"], hint: "Hold comment present" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">My Snapshot</h2>
        <p className="text-sm text-muted-foreground">
          High-level counts for documents assigned to {user?.first_name} {user?.last_name}.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardHeader>
              <CardDescription>{card.label}</CardDescription>
              <CardTitle className="text-4xl tabular-nums">{card.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{card.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">{mine.length} assigned document{mine.length === 1 ? "" : "s"} in total.</p>
    </div>
  );
}
