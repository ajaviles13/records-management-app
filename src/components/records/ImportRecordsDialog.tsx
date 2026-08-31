import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type ImportDirection = "received" | "delivered";

interface ImportRecordsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EGNYTE_PLACEHOLDER = "https://auratrans.egnyte.com/navigate/folder/…";

function looksLikeUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Import Records is the replacement for hand-creating a single row. The user pastes the
 * Egnyte folder they were assigned and says whether those files were received or
 * delivered.
 *
 * TBD: Extract Files will call Egnyte, list the folder, and create `sla-file-records`
 * rows. Until that connector is wired, the button only validates the form and reports
 * that extraction is not implemented.
 */
export function ImportRecordsDialog({ open, onOpenChange }: ImportRecordsDialogProps) {
  const [directLink, setDirectLink] = useState("");
  const [direction, setDirection] = useState<ImportDirection | null>(null);

  useEffect(() => {
    if (open) {
      setDirectLink("");
      setDirection(null);
    }
  }, [open]);

  const link = directLink.trim();
  const canExtract = looksLikeUrl(link) && direction !== null;

  function extract() {
    if (!canExtract) return;
    // TBD: POST the folder URL and received/delivered choice to an Egnyte extract endpoint.
    toast.info("File extraction is not wired up yet. The folder link and received/delivered choice are ready to send.");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-auto max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Records</DialogTitle>
          <DialogDescription>
            Paste the Egnyte folder that holds the files, then say whether they were received or delivered.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 px-6 py-2">
          <div className="space-y-2">
            <Label htmlFor="import-direct-link">
              Direct Link <span className="text-destructive">*</span>
            </Label>
            <Input
              id="import-direct-link"
              type="url"
              value={directLink}
              placeholder={EGNYTE_PLACEHOLDER}
              onChange={(event) => setDirectLink(event.target.value)}
              autoComplete="off"
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">
              Received or Delivered? <span className="text-destructive">*</span>
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <DirectionChoice
                selected={direction === "received"}
                onSelect={() => setDirection("received")}
                label="Received"
                icon={<FolderGlyph direction="in" />}
              />
              <DirectionChoice
                selected={direction === "delivered"}
                onSelect={() => setDirection("delivered")}
                label="Delivered"
                icon={<FolderGlyph direction="out" />}
              />
            </div>
          </fieldset>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={extract} disabled={!canExtract}>
            Extract Files
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DirectionChoiceProps {
  selected: boolean;
  onSelect: () => void;
  label: string;
  icon: ReactNode;
}

function DirectionChoice({ selected, onSelect, label, icon }: DirectionChoiceProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex items-center gap-3 rounded-lg border bg-background px-4 py-5 text-left text-sm font-medium transition-colors hover:bg-accent",
        selected ? "border-primary ring-2 ring-primary/20" : "border-input",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

/** Inbox tray with a red diamond pointing in (received) or out (delivered). */
function FolderGlyph({ direction }: { direction: "in" | "out" }) {
  return (
    <span className="relative flex size-10 shrink-0 items-center justify-center" aria-hidden>
      <svg viewBox="0 0 40 32" className="size-9">
        <path
          d="M4 10h8.2l2.4-3.2H26c1.7 0 3 1.3 3 3v2.2H36c1.1 0 2 .9 2 2V26c0 1.7-1.3 3-3 3H5c-1.7 0-3-1.3-3-3V13c0-1.7 1.3-3 3-3z"
          fill="#3b82f6"
        />
        <path d="M2 16h36v10c0 1.7-1.3 3-3 3H5c-1.7 0-3-1.3-3-3V16z" fill="#2563eb" />
      </svg>
      <span
        className={cn(
          "absolute size-2.5 rotate-45 bg-red-500",
          direction === "in" ? "top-0" : "bottom-0.5",
        )}
      />
    </span>
  );
}
