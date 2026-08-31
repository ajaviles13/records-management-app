import { CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { basisFromToggles, basisLabel, resolveDateRange, toIsoDay } from "@/lib/dateRange";
import type { SnapshotDateRange, SnapshotRangePreset } from "@/types";

const PRESET_LABELS: Record<SnapshotRangePreset, string> = {
  all: "All time",
  today: "Today",
  week: "This Week",
  month: "This Month",
  year: "This Year",
  custom: "Custom range",
};

const PRESET_ORDER: SnapshotRangePreset[] = ["all", "today", "week", "month", "year", "custom"];

interface SnapshotDateFilterProps {
  value: SnapshotDateRange;
  onChange: (next: SnapshotDateRange) => void;
}

export function SnapshotDateFilter({ value, onChange }: SnapshotDateFilterProps) {
  const window = resolveDateRange(value);
  const receivedOn = value.basis === "received" || value.basis === "both";
  const deliveredOn = value.basis === "delivered" || value.basis === "both";
  const summary =
    value.preset === "all"
      ? "All time"
      : window.from && window.to
        ? `${window.from} → ${window.to}`
        : "Pick a range";

  function setPreset(preset: SnapshotRangePreset) {
    if (preset !== "custom") {
      onChange({ ...value, preset, from: "", to: "" });
      return;
    }
    // Seed the custom range from the current month so the inputs are never blank.
    const today = toIsoDay(new Date());
    onChange({ ...value, preset, from: value.from || today, to: value.to || today });
  }

  function toggleBasis(next: { received?: boolean; delivered?: boolean }) {
    const received = next.received ?? receivedOn;
    const delivered = next.delivered ?? deliveredOn;
    // Neither selected would filter everything out, so ignore the last uncheck.
    if (!received && !delivered) return;
    onChange({ ...value, basis: basisFromToggles(received, delivered) });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="gap-2 font-normal">
            <CalendarRange className="size-4 opacity-70" />
            <span>{basisLabel(value.basis)}</span>
            <span className="text-muted-foreground">·</span>
            <span>{summary}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 space-y-4">
          <div className="space-y-2">
            <Label>Apply the range to</Label>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="flex items-center gap-2 rounded-sm px-1 py-1 text-left text-sm hover:bg-accent"
                onClick={() => toggleBasis({ received: !receivedOn })}
              >
                <Checkbox checked={receivedOn} className="pointer-events-none" tabIndex={-1} />
                Received
              </button>
              <button
                type="button"
                className="flex items-center gap-2 rounded-sm px-1 py-1 text-left text-sm hover:bg-accent"
                onClick={() => toggleBasis({ delivered: !deliveredOn })}
              >
                <Checkbox checked={deliveredOn} className="pointer-events-none" tabIndex={-1} />
                Delivered
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              With both selected, a record counts when either date falls in the range.
            </p>
          </div>

          <div className="space-y-2 border-t pt-3">
            <Label htmlFor="snapshot-preset">Date range</Label>
            <Select value={value.preset} onValueChange={(next) => setPreset(next as SnapshotRangePreset)}>
              <SelectTrigger id="snapshot-preset" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRESET_ORDER.map((preset) => (
                  <SelectItem key={preset} value={preset}>
                    {PRESET_LABELS[preset]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {value.preset === "custom" ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="snapshot-from">Start</Label>
                <Input
                  id="snapshot-from"
                  type="date"
                  value={value.from}
                  max={value.to || undefined}
                  onChange={(event) => onChange({ ...value, from: event.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="snapshot-to">End</Label>
                <Input
                  id="snapshot-to"
                  type="date"
                  value={value.to}
                  min={value.from || undefined}
                  onChange={(event) => onChange({ ...value, to: event.target.value })}
                />
              </div>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  );
}
