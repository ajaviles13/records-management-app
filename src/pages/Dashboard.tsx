import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, Pie, PieChart, XAxis, YAxis, Cell } from "recharts";
import { api } from "@/api/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { deriveStatus } from "@/lib/status";
import type { FileRecord } from "@/types";

const STATUS_COLORS = {
  "In-Review": "var(--chart-3)",
  Completed: "var(--chart-2)",
  "On-Hold": "var(--chart-5)",
};

export function DashboardPage() {
  const [records, setRecords] = useState<FileRecord[]>([]);

  useEffect(() => {
    api
      .records()
      .then((res) => setRecords(res.records))
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load dashboard."));
  }, []);

  const statusData = useMemo(() => {
    const counts = { "In-Review": 0, Completed: 0, "On-Hold": 0 };
    for (const row of records) counts[deriveStatus(row)] += 1;
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [records]);

  const slaData = useMemo(() => {
    let met = 0;
    let missed = 0;
    let unset = 0;
    for (const row of records) {
      const value = row.sla_met.trim().toUpperCase();
      if (value === "Y" || value === "YES") met += 1;
      else if (value === "N" || value === "NO") missed += 1;
      else unset += 1;
    }
    return [
      { name: "Met", value: met },
      { name: "Missed", value: missed },
      { name: "Unset", value: unset },
    ];
  }, [records]);

  const languageData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of records) {
      const key = row.language_code || "Unknown";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()].map(([name, value]) => ({ name, value }));
  }, [records]);

  const urgentData = useMemo(() => {
    let urgent = 0;
    let standard = 0;
    for (const row of records) {
      if (row.is_urgent.trim().toUpperCase() === "YES") urgent += 1;
      else standard += 1;
    }
    return [
      { name: "Urgent", value: urgent },
      { name: "Standard", value: standard },
    ];
  }, [records]);

  const statusConfig = {
    value: { label: "Documents" },
    "In-Review": { label: "In-Review", color: STATUS_COLORS["In-Review"] },
    Completed: { label: "Completed", color: STATUS_COLORS.Completed },
    "On-Hold": { label: "On-Hold", color: STATUS_COLORS["On-Hold"] },
  } satisfies ChartConfig;

  const slaConfig = {
    value: { label: "Documents" },
    Met: { label: "Met", color: "var(--chart-2)" },
    Missed: { label: "Missed", color: "var(--chart-5)" },
    Unset: { label: "Unset", color: "var(--chart-4)" },
  } satisfies ChartConfig;

  const languageConfig = {
    value: { label: "Documents", color: "var(--chart-1)" },
  } satisfies ChartConfig;

  const urgentConfig = {
    value: { label: "Documents" },
    Urgent: { label: "Urgent", color: "var(--chart-5)" },
    Standard: { label: "Standard", color: "var(--chart-1)" },
  } satisfies ChartConfig;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Dashboard</h2>
        <p className="text-sm text-muted-foreground">Organization-wide view of translation file volume and SLA outcomes.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Status breakdown" description="Derived from delivery time and hold comments">
          <ChartContainer config={statusConfig} className="h-64 w-full">
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                {statusData.map((entry) => (
                  <Cell key={entry.name} fill={STATUS_COLORS[entry.name as keyof typeof STATUS_COLORS]} />
                ))}
              </Pie>
              <ChartTooltip content={<ChartTooltipContent />} />
            </PieChart>
          </ChartContainer>
        </ChartCard>
        <ChartCard title="SLA met vs missed" description="From the sla_met field">
          <ChartContainer config={slaConfig} className="h-64 w-full">
            <BarChart data={slaData}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="value" radius={4}>
                {slaData.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={entry.name === "Met" ? "var(--chart-2)" : entry.name === "Missed" ? "var(--chart-5)" : "var(--chart-4)"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </ChartCard>
        <ChartCard title="Volume by language" description="Count of records per language code">
          <ChartContainer config={languageConfig} className="h-64 w-full">
            <BarChart data={languageData}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="value" fill="var(--chart-1)" radius={4} />
            </BarChart>
          </ChartContainer>
        </ChartCard>
        <ChartCard title="Urgent vs standard" description="Priority mix across all records">
          <ChartContainer config={urgentConfig} className="h-64 w-full">
            <BarChart data={urgentData}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="value" radius={4}>
                {urgentData.map((entry) => (
                  <Cell key={entry.name} fill={entry.name === "Urgent" ? "var(--chart-5)" : "var(--chart-1)"} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
