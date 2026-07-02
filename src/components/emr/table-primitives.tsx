"use client";

import * as React from "react";

import {
  ChevronDownIcon,
  ChevronUpIcon,
  FilterIcon,
  MenuIcon,
} from "@/components/icons";
import { TableCell, TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type {
  EmrColumnResize,
  EmrTableCellTextMode,
  EmrTableHeaderInteraction,
} from "@/components/emr/table-density";

type EmrTableHeaderCellProps = Omit<
  React.ComponentProps<typeof TableHead>,
  "children"
> & {
  align?: "left" | "center" | "right";
  children: React.ReactNode;
  filterActive?: boolean;
  interaction?: EmrTableHeaderInteraction;
  isResizing?: boolean;
  menuActive?: boolean;
  onFilter?: () => void;
  onMenu?: () => void;
  onResizeMouseDown?: React.MouseEventHandler<HTMLButtonElement>;
  onResizeTouchStart?: React.TouchEventHandler<HTMLButtonElement>;
  onSort?: () => void;
  resize?: EmrColumnResize;
  resizeLabel?: string;
  sortDirection?: "asc" | "desc";
  sortLabel?: string;
};

type EmrTableCellTextProps = {
  as?: "span" | "div";
  children: React.ReactNode;
  className?: string;
  fullText?: string;
  mode?: EmrTableCellTextMode;
  title?: string;
};

type EmrTableSelectionHeaderCellProps = Omit<
  React.ComponentProps<typeof EmrTableHeaderCell>,
  "children" | "interaction" | "resize"
> & {
  children: React.ReactNode;
};

type EmrTableSelectionCellProps = React.ComponentProps<typeof TableCell>;

function getAriaSort(sortDirection: EmrTableHeaderCellProps["sortDirection"]) {
  if (sortDirection === "asc") return "ascending";
  if (sortDirection === "desc") return "descending";

  return undefined;
}

function getStringLabel(children: React.ReactNode) {
  return typeof children === "string" ? children : "컬럼";
}

function SortIcon({ direction }: { direction?: "asc" | "desc" }) {
  const Icon = direction === "desc" ? ChevronDownIcon : ChevronUpIcon;

  return <Icon aria-hidden="true" className="size-3" />;
}

export function EmrTableHeaderCell({
  align = "left",
  children,
  className,
  filterActive = false,
  interaction = "static",
  isResizing = false,
  menuActive = false,
  onFilter,
  onMenu,
  onResizeMouseDown,
  onResizeTouchStart,
  onSort,
  resize = "none",
  resizeLabel,
  sortDirection,
  sortLabel,
  style,
  ...props
}: EmrTableHeaderCellProps) {
  const label = getStringLabel(children);
  const resizable =
    resize === "data-column" &&
    Boolean(onResizeMouseDown || onResizeTouchStart);
  const sortable = Boolean(onSort);
  const filterable = Boolean(onFilter);
  const menuable = Boolean(onMenu);

  return (
    <TableHead
      aria-sort={getAriaSort(sortDirection)}
      data-emr-column-resize={resize}
      data-emr-header-interaction={interaction}
      className={cn(
        "emr-table-header-cell emr-text-body relative select-none bg-[var(--emr-surface-muted)] font-medium text-muted-foreground",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
      style={style}
      {...props}
    >
      <div
        className={cn(
          "emr-table-cell-content flex min-w-0 items-center gap-1",
          align === "right" && "justify-end",
          align === "center" && "justify-center",
        )}
      >
        <span className="min-w-0 truncate">{children}</span>
        {sortable ? (
          <button
            data-row-interactive="true"
            type="button"
            aria-label={sortLabel ?? `${label} 정렬`}
            title={sortLabel ?? `${label} 정렬`}
            className={cn(
              "inline-flex size-5 shrink-0 items-center justify-center rounded-[var(--emr-radius-control)] text-[var(--emr-text-tertiary)] hover:bg-[var(--emr-state-hover)] focus-visible:ring-3 focus-visible:ring-ring/50",
              sortDirection && "text-[var(--emr-text-secondary)]",
            )}
            onClick={(event) => {
              event.stopPropagation();
              onSort?.();
            }}
          >
            <SortIcon direction={sortDirection} />
          </button>
        ) : null}
        {filterable ? (
          <button
            data-row-interactive="true"
            type="button"
            aria-label={`${label} 필터`}
            aria-pressed={filterActive}
            className={cn(
              "inline-flex size-5 shrink-0 items-center justify-center rounded-[var(--emr-radius-control)] text-muted-foreground hover:bg-[var(--emr-state-hover)] focus-visible:ring-3 focus-visible:ring-ring/50",
              filterActive && "bg-[var(--emr-state-selected)] text-foreground",
            )}
            onClick={(event) => {
              event.stopPropagation();
              onFilter?.();
            }}
          >
            <FilterIcon aria-hidden="true" className="size-3" />
          </button>
        ) : null}
        {menuable ? (
          <button
            data-row-interactive="true"
            type="button"
            aria-label={`${label} 컬럼 메뉴`}
            aria-pressed={menuActive}
            className={cn(
              "inline-flex size-5 shrink-0 items-center justify-center rounded-[var(--emr-radius-control)] text-muted-foreground hover:bg-[var(--emr-state-hover)] focus-visible:ring-3 focus-visible:ring-ring/50",
              menuActive && "bg-[var(--emr-state-selected)] text-foreground",
            )}
            onClick={(event) => {
              event.stopPropagation();
              onMenu?.();
            }}
          >
            <MenuIcon aria-hidden="true" className="size-3" />
          </button>
        ) : null}
      </div>
      {resizable ? (
        <button
          data-row-interactive="true"
          type="button"
          aria-label={resizeLabel ?? `${label} 컬럼 너비 조절`}
          className="absolute right-[-4px] top-2 z-10 h-6 w-2 cursor-col-resize touch-none rounded-sm before:absolute before:left-1 before:top-1 before:h-4 before:w-px before:bg-[var(--emr-line-hairline)] hover:bg-[var(--emr-state-selected)] focus-visible:ring-3 focus-visible:ring-ring/50 data-[resizing=true]:bg-[var(--emr-state-drag)]"
          data-resizing={isResizing ? "true" : undefined}
          onClick={(event) => event.stopPropagation()}
          onMouseDown={onResizeMouseDown}
          onTouchStart={onResizeTouchStart}
        />
      ) : null}
    </TableHead>
  );
}

export function EmrTableSelectionHeaderCell({
  children,
  className,
  ...props
}: EmrTableSelectionHeaderCellProps) {
  return (
    <EmrTableHeaderCell
      {...props}
      className={cn(
        "w-10 [&_.emr-table-cell-content]:justify-center [&_.emr-table-cell-content>*]:shrink-0",
        className,
      )}
      interaction="static"
      resize="none"
    >
      {children}
    </EmrTableHeaderCell>
  );
}

export function EmrTableSelectionCell({
  children,
  className,
  ...props
}: EmrTableSelectionCellProps) {
  return (
    <TableCell className={cn("w-10", className)} {...props}>
      <span className="emr-table-cell-content flex min-w-0 items-center justify-center gap-1 [&>*]:shrink-0">
        {children}
      </span>
    </TableCell>
  );
}

export function EmrTableCellText({
  as = "span",
  children,
  className,
  fullText,
  mode = "one-line",
  title,
}: EmrTableCellTextProps) {
  const Component = as;
  const textTitle =
    title ?? fullText ?? (typeof children === "string" ? children : undefined);

  return (
    <Component
      data-emr-cell-text-mode={mode}
      title={textTitle}
      className={cn(
        "min-w-0 max-w-full",
        mode === "one-line" && "block truncate",
        mode === "two-line-if-long" &&
          "line-clamp-2 whitespace-normal break-words",
        mode === "always-multiline" && "block whitespace-normal break-words",
        mode === "badge-wrap" && "flex flex-wrap gap-1 overflow-hidden",
        mode === "full-on-demand" &&
          "line-clamp-2 whitespace-normal break-words",
        className,
      )}
    >
      {children}
    </Component>
  );
}
