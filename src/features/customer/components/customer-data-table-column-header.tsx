"use client";

import tableSortArrow from "@/assets/figma/table-sort-arrow.svg";
import { cn } from "@/lib/utils";

const tableSortArrowSrc =
  typeof tableSortArrow === "string"
    ? tableSortArrow
    : tableSortArrow.src ?? "";

type CustomerDataTableColumnHeaderProps = {
  ariaLabel: string;
  canSort: boolean;
  identity?: boolean;
  label: string;
  onToggleSort?: () => void;
  sortDirection?: false | "asc" | "desc";
};

export function CustomerDataTableColumnHeader({
  ariaLabel,
  canSort,
  identity = false,
  label,
  onToggleSort,
  sortDirection = false,
}: CustomerDataTableColumnHeaderProps) {
  return (
    <button
      type="button"
      aria-disabled={!canSort}
      aria-label={ariaLabel}
      disabled={!canSort}
      className={cn(
        "inline-flex min-h-6 max-w-full items-center justify-center gap-1 rounded-lg bg-transparent px-2.5 py-1 text-[12px] font-medium leading-4 tracking-[0.3px] text-[var(--clair-color-atomic-neutral-500)] outline-none hover:bg-[var(--clair-color-atomic-black-alpha-4)] focus-visible:ring-3 focus-visible:ring-[var(--clair-color-atomic-neutral-300)] disabled:cursor-default disabled:opacity-100",
        identity && "px-0",
        sortDirection && "text-[var(--clair-color-atomic-neutral-700)]",
      )}
      onClick={canSort ? onToggleSort : undefined}
    >
      <span
        className="min-w-0 truncate"
        data-customer-column-header-label="true"
      >
        {label}
      </span>
      <span className="grid size-3 shrink-0 place-items-center" aria-hidden="true">
        {/* Exact exported Figma vector; a raw img preserves its subpixel geometry. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt=""
          className={cn(
            "h-[7.75px] w-[6.74993px]",
            sortDirection === "asc" && "rotate-180",
          )}
          src={tableSortArrowSrc}
        />
      </span>
    </button>
  );
}
