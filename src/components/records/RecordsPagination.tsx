import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PAGE_SIZES, pageCount, pageRange } from "@/lib/pagination";
import type { PageSize } from "@/types";

interface RecordsPaginationProps {
  total: number;
  page: number;
  pageSize: PageSize;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSize) => void;
  /** Noun used in “Display N …” and “Showing X–Y of Z …”. Defaults to records. */
  itemLabel?: string;
}

export function RecordsPagination({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  itemLabel = "records",
}: RecordsPaginationProps) {
  const pages = pageCount(total, pageSize);
  const range = pageRange(total, page, pageSize);
  const nounCap = itemLabel.charAt(0).toUpperCase() + itemLabel.slice(1);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t px-3 py-2 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Display</span>
        <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value) as PageSize)}>
          <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size === 1000 ? `1,000 ${nounCap}` : `${size} ${itemLabel}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-muted-foreground">per page</span>
      </div>
      <span className="tabular-nums text-muted-foreground">
        Showing {range.from}–{range.to} of {total} {itemLabel}
      </span>
      <div className="flex items-center gap-1">
        <Button size="icon-sm" variant="outline" aria-label="First page" disabled={page <= 1} onClick={() => onPageChange(1)}><ChevronFirst /></Button>
        <Button size="icon-sm" variant="outline" aria-label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)}><ChevronLeft /></Button>
        <span className="min-w-20 text-center tabular-nums">Page {page} of {pages}</span>
        <Button size="icon-sm" variant="outline" aria-label="Next page" disabled={page >= pages} onClick={() => onPageChange(page + 1)}><ChevronRight /></Button>
        <Button size="icon-sm" variant="outline" aria-label="Last page" disabled={page >= pages} onClick={() => onPageChange(pages)}><ChevronLast /></Button>
      </div>
    </div>
  );
}
