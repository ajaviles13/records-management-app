import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { ExportFormat, ExportScope } from "@/types";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Rows on the page the user is currently looking at. */
  pageCount: number;
  /** Rows across the whole filtered view. */
  viewCount: number;
  onExport: (scope: ExportScope, format: ExportFormat) => void;
}

interface RadioRowProps {
  name: string;
  id: string;
  checked: boolean;
  onSelect: () => void;
  children: ReactNode;
}

function RadioRow({ name, id, checked, onSelect, children }: RadioRowProps) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="radio"
        id={id}
        name={name}
        checked={checked}
        onChange={onSelect}
        className="size-4 accent-primary"
      />
      <Label htmlFor={id} className="font-normal">
        {children}
      </Label>
    </div>
  );
}

export function ExportDialog({ open, onOpenChange, pageCount, viewCount, onExport }: ExportDialogProps) {
  const [scope, setScope] = useState<ExportScope>("page");
  const [format, setFormat] = useState<ExportFormat>("csv");

  function submit() {
    onExport(scope, format);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-auto max-w-md">
        <DialogHeader>
          <DialogTitle>Export Data</DialogTitle>
          <DialogDescription>Exports the visible columns in their current order.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-6">
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Export Scope</legend>
            <div className="space-y-2">
              <RadioRow name="export-scope" id="scope-page" checked={scope === "page"} onSelect={() => setScope("page")}>
                {pageCount} records in current view
              </RadioRow>
              <RadioRow name="export-scope" id="scope-view" checked={scope === "view"} onSelect={() => setScope("view")}>
                All records in current view ({viewCount})
              </RadioRow>
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">Export Format</legend>
            <div className="space-y-2 mb-5">
              <RadioRow name="export-format" id="format-csv" checked={format === "csv"} onSelect={() => setFormat("csv")}>
                CSV (Comma Separated Values)
              </RadioRow>
              <RadioRow
                name="export-format"
                id="format-xlsx"
                checked={format === "xlsx"}
                onSelect={() => setFormat("xlsx")}
              >
                Excel File
              </RadioRow>
            </div>
          </fieldset>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit}>Export</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
