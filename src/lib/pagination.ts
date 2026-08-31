import type { PageSize } from "@/types";

export const PAGE_SIZES: PageSize[] = [25, 50, 100, 500, 1000];

export function pageCount(total: number, size: PageSize): number {
  return Math.max(1, Math.ceil(total / size));
}

export function clampPage(page: number, total: number, size: PageSize): number {
  return Math.min(Math.max(1, page), pageCount(total, size));
}

export function pageSlice<T>(items: T[], page: number, size: PageSize): T[] {
  const start = (clampPage(page, items.length, size) - 1) * size;
  return items.slice(start, start + size);
}

export function pageRange(total: number, page: number, size: PageSize): { from: number; to: number } {
  if (!total) return { from: 0, to: 0 };
  const current = clampPage(page, total, size);
  return { from: (current - 1) * size + 1, to: Math.min(current * size, total) };
}
