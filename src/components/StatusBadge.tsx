import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { deriveStatus, statusBadgeClass } from "@/lib/status";
import type { FileRecord } from "@/types";

export function StatusBadge({ record }: { record: Pick<FileRecord, "comment" | "delivered_at_est"> }) {
  const status = deriveStatus(record);
  return (
    <Badge variant="outline" className={cn("font-medium", statusBadgeClass(status))}>
      {status}
    </Badge>
  );
}
