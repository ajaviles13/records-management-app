import { SquareArrowOutUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function hrefForUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  try {
    const parsed = new URL(/^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.href;
  } catch {
    return null;
  }
}

export function UrlLink({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const href = hrefForUrl(value);
  if (!href) return <span className={className}>{value.trim() || "—"}</span>;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={value}
      className={cn(
        "inline-flex min-w-0 max-w-full items-center gap-1.5 text-primary hover:underline",
        className,
      )}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <SquareArrowOutUpRight className="size-3.5 shrink-0" />
      <span className="truncate">{value.trim()}</span>
    </a>
  );
}
