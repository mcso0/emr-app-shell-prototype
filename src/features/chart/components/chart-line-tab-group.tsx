import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function ChartLineTabGroup<TValue extends string>({
  "aria-label": ariaLabel,
  items,
  onValueChange,
  value,
}: {
  items: Array<{ value: TValue; label: ReactNode; count?: number }>;
  "aria-label": string;
  onValueChange: (value: TValue) => void;
  value: TValue;
}) {
  return (
    <div className="flex min-w-0 items-stretch gap-2.5" role="tablist" aria-label={ariaLabel}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={value === item.value}
          className={cn(
            "group relative inline-flex items-center whitespace-nowrap px-1 py-1 text-[length:var(--clair-typography-body-2-normal-font-size)] font-semibold leading-[var(--clair-typography-body-2-normal-line-height)] tracking-normal text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            value === item.value && "text-foreground"
          )}
          onClick={() => onValueChange(item.value)}
        >
          <span>{item.label}</span>
          {typeof item.count === "number" ? <span className="ml-1 font-semibold tabular-nums">{item.count}</span> : null}
          <span
            aria-hidden="true"
            className={cn(
              "absolute inset-x-0 bottom-[-1px] h-0.5 bg-foreground opacity-0 transition-opacity",
              value === item.value && "opacity-100"
            )}
          />
        </button>
      ))}
    </div>
  );
}
