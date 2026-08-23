import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { ColumnFilterValue, FilterKind } from "@/lib/columnFilters";

const NOT_SET = "__notset__";

interface ColumnFilterProps {
  kind: FilterKind;
  value: ColumnFilterValue;
  onChange: (value: ColumnFilterValue) => void;
  choices?: { value: string; label: string }[];
}

export function ColumnFilter({ kind, value, onChange, choices = [] }: ColumnFilterProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  if (kind === "choice" || kind === "boolean") {
    const options =
      kind === "boolean"
        ? [
            { value: "YES", label: "Yes" },
            { value: "NO", label: "No" },
          ]
        : choices;
    const selected = Array.isArray(value) ? value : value.trim() ? [value] : [];
    const allSelected = selected.length === 0;
    const visibleOptions = options.filter((option) =>
      option.label.toLowerCase().includes(query.trim().toLowerCase()),
    );
    const showSearch = options.length > 8;
    const showNotSet = kind === "choice" && "(not set)".includes(query.trim().toLowerCase());
    const summary = filterSummary(selected, options);

    function toggle(optionValue: string) {
      const next = selected.includes(optionValue)
        ? selected.filter((item) => item !== optionValue)
        : [...selected, optionValue];
      onChange(next);
    }

    return (
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery("");
        }}
      >
        <PopoverTrigger
          className={cn(
            "flex h-7 w-full min-w-0 items-center justify-between gap-1 rounded-sm border border-input bg-background px-1.5 text-left text-xs shadow-none",
            "outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring",
            !allSelected && "font-medium",
          )}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <span className="min-w-0 truncate">{summary}</span>
          <ChevronDown className="size-3 shrink-0 opacity-60" />
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-56 p-1"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {showSearch ? (
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
              className="mb-1 h-7 w-full rounded-sm border border-input bg-background px-1.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring"
            />
          ) : null}
          <div className="max-h-64 overflow-auto">
            <FilterCheck
              checked={allSelected}
              label="(All)"
              onToggle={() => onChange([])}
            />
            {kind === "choice" && showNotSet ? (
              <FilterCheck
                checked={selected.includes(NOT_SET)}
                label="(Not Set)"
                onToggle={() => toggle(NOT_SET)}
              />
            ) : null}
            {visibleOptions.map((option) => (
              <FilterCheck
                key={option.value}
                checked={selected.includes(option.value)}
                label={option.label}
                onToggle={() => toggle(option.value)}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  const textValue = Array.isArray(value) ? "" : value;

  return (
    <input
      value={textValue}
      onChange={(event) => onChange(event.target.value)}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      placeholder="Filter"
      className={cn(
        "h-7 w-full min-w-0 rounded-sm border border-input bg-background px-1.5 text-xs outline-none",
        "placeholder:italic placeholder:text-muted-foreground",
        "focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring",
      )}
    />
  );
}

function filterSummary(selected: string[], options: { value: string; label: string }[]) {
  if (selected.length === 0) return "(All)";
  const labels = selected.map((item) =>
    item === NOT_SET ? "(Not Set)" : (options.find((option) => option.value === item)?.label ?? item),
  );
  if (labels.length === 1) return labels[0];
  const joined = labels.join(", ");
  return joined.length <= 22 ? joined : `${labels.length} selected`;
}

function FilterCheck({
  checked,
  label,
  onToggle,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-1.5 py-1 text-left text-xs hover:bg-accent"
      onClick={onToggle}
    >
      <Checkbox checked={checked} tabIndex={-1} className="pointer-events-none" />
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}
