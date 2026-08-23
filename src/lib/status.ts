import type { DerivedStatus, FileRecord } from "@/types";

export function deriveStatus(record: Pick<FileRecord, "comment" | "delivered_at_est">): DerivedStatus {
  if (record.comment.trim()) return "On-Hold";
  if (record.delivered_at_est.trim()) return "Completed";
  return "In-Review";
}

export function statusBadgeClass(status: DerivedStatus): string {
  switch (status) {
    case "In-Review":
      return "bg-amber-100 text-amber-900 border-amber-200";
    case "Completed":
      return "bg-teal-100 text-teal-900 border-teal-200";
    case "On-Hold":
      return "bg-slate-200 text-slate-800 border-slate-300";
  }
}
