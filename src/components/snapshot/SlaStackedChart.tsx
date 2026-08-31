import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  bucketEnd,
  bucketLabel,
  bucketStart,
  bucketStarts,
  chartDay,
  granularityFor,
  windowForRecords,
  type DateWindow,
} from "@/lib/dateRange";
import type { FileRecord, SnapshotDateBasis } from "@/types";

const GRANULARITY_NOUN = { day: "day", week: "week", month: "month" } as const;

const CHART_CONFIG = {
  met: { label: "SLA met", color: "var(--chart-2)" },
  missed: { label: "SLA missed", color: "var(--destructive)" },
} satisfies ChartConfig;

const SLA_VALUE = { met: "Y", missed: "N" } as const;

interface Bucket {
  key: string;
  label: string;
  from: string;
  to: string;
  met: number;
  missed: number;
}

interface SlaStackedChartProps {
  records: FileRecord[];
  window: DateWindow;
  basis: SnapshotDateBasis;
  /** Builds a Records deep link for one stack segment. */
  linkFor: (slaMet: "Y" | "N", from: string, to: string) => string;
}

export function SlaStackedChart({ records, window, basis, linkFor }: SlaStackedChartProps) {
  const navigate = useNavigate();
  const { buckets, granularity, pending } = useMemo(() => {
    const bounded = windowForRecords(records, window, basis);
    const grain = granularityFor(bounded);
    const index = new Map<string, Bucket>();
    for (const start of bucketStarts(bounded, grain)) {
      index.set(start, {
        key: start,
        label: bucketLabel(start, grain),
        from: start,
        to: bucketEnd(start, grain),
        met: 0,
        missed: 0,
      });
    }

    let unset = 0;
    for (const record of records) {
      const day = chartDay(record, bounded, basis);
      if (!day) continue;
      const bucket = index.get(bucketStart(day, grain));
      if (!bucket) continue;
      const outcome = record.sla_met.trim().toUpperCase();
      if (outcome === "Y" || outcome === "YES") bucket.met += 1;
      else if (outcome === "N" || outcome === "NO") bucket.missed += 1;
      else unset += 1;
    }

    return { buckets: [...index.values()], granularity: grain, pending: unset };
  }, [records, window, basis]);

  const totals = useMemo(
    () =>
      buckets.reduce(
        (acc, bucket) => ({ met: acc.met + bucket.met, missed: acc.missed + bucket.missed }),
        { met: 0, missed: 0 },
      ),
    [buckets],
  );

  // Recharts stacks in declaration order, so the larger series is declared first to
  // keep it on the bottom of every bar.
  const series: ("met" | "missed")[] = totals.met >= totals.missed ? ["met", "missed"] : ["missed", "met"];
  const hasData = totals.met + totals.missed > 0;

  /**
   * Recharts hands the clicked bar's datum back either directly or nested under
   * `payload`, depending on the shape it renders, so both are checked.
   */
  function drill(key: "met" | "missed", entry: unknown) {
    const datum = entry && typeof entry === "object" ? (entry as { payload?: Partial<Bucket> } & Partial<Bucket>) : null;
    const bucket = datum?.payload ?? datum;
    if (!bucket?.from || !bucket.to) return;
    if (!bucket[key]) return;
    navigate(linkFor(SLA_VALUE[key], bucket.from, bucket.to));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>SLA outcomes over time</CardTitle>
        <CardDescription>
          Grouped by {GRANULARITY_NOUN[granularity]}. Click any segment to open those records.
          {pending > 0 ? ` ${pending} record${pending === 1 ? "" : "s"} have no SLA outcome yet and are not charted.` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <>
            <ChartContainer config={CHART_CONFIG} className="h-72 w-full">
              <BarChart data={buckets} barCategoryGap="18%">
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" interval="preserveStartEnd" tickMargin={8} />
                <YAxis allowDecimals={false} width={40} />
                <ChartTooltip
                  content={<ChartTooltipContent labelFormatter={(_, payload) => payload?.[0]?.payload?.label ?? ""} />}
                />
                <ChartLegend content={<ChartLegendContent />} />
                {series.map((key) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    stackId="sla"
                    fill={`var(--color-${key})`}
                    style={{ cursor: "pointer" }}
                    radius={key === series[1] ? [4, 4, 0, 0] : undefined}
                    onClick={(entry: unknown) => drill(key, entry)}
                  />
                ))}
              </BarChart>
            </ChartContainer>

            {/* Keyboard and screen-reader accessible equivalent, and the hyperlinked counts
                the spec asks for, since recharts tooltips cannot hold focusable links. */}
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                View the {GRANULARITY_NOUN[granularity]}-by-{GRANULARITY_NOUN[granularity]} counts as links
              </summary>
              <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                {buckets
                  .filter((bucket) => bucket.met + bucket.missed > 0)
                  .map((bucket) => (
                    <li key={bucket.key} className="flex items-center gap-2">
                      <span className="min-w-24 text-muted-foreground">{bucket.label}</span>
                      <Link className="tabular-nums hover:underline" to={linkFor("Y", bucket.from, bucket.to)}>
                        {bucket.met} met
                      </Link>
                      <span className="text-muted-foreground">·</span>
                      <Link className="tabular-nums hover:underline" to={linkFor("N", bucket.from, bucket.to)}>
                        {bucket.missed} missed
                      </Link>
                    </li>
                  ))}
              </ul>
            </details>
          </>
        ) : (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No records with a recorded SLA outcome fall in the selected range.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
