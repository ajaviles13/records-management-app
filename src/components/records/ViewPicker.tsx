import { Check, ChevronDown, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { canEditView } from "@/lib/roles";
import { ALL_RECORDS_VIEW_ID } from "@/lib/viewQuery";
import { cn } from "@/lib/utils";
import type { SavedView, User } from "@/types";

interface ViewPickerProps {
  views: SavedView[];
  activeViewId: string;
  /** The signed-in user, whose ownership of each view decides whether the pencil shows. */
  currentUser: User | null;
  onSelect: (viewId: string) => void;
  onNew: () => void;
  onEdit: (viewId: string) => void;
}

export function ViewPicker({ views, activeViewId, currentUser, onSelect, onNew, onEdit }: ViewPickerProps) {
  const active = views.find((view) => view.view_id === activeViewId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-72 min-w-72 justify-between">
          <span className="truncate">{active?.name ?? "All Records"}</span>
          <ChevronDown className="size-4 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        {views.map((view) => {
          const isSaved = view.view_id !== ALL_RECORDS_VIEW_ID;
          const editable = isSaved && currentUser ? canEditView(currentUser, view) : false;
          return (
            <DropdownMenuItem key={view.view_id} onClick={() => onSelect(view.view_id)} className="gap-1.5">
              {editable ? (
                <span
                  role="button"
                  tabIndex={0}
                  title={`Edit ${view.name}`}
                  className="flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-background hover:text-foreground"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onEdit(view.view_id);
                  }}
                >
                  <Pencil className="size-3.5" />
                </span>
              ) : (
                <span className="size-6 shrink-0" />
              )}
              <Check className={cn("size-4", view.view_id === activeViewId ? "opacity-100" : "opacity-0")} />
              <span className="truncate">{view.name}</span>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onNew}>
          <Plus className="size-4" />
          New View
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
