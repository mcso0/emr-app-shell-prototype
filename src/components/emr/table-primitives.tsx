"use client";

import * as React from "react";
import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";

import tableSortArrow from "@/assets/figma/table-sort-arrow.svg";
import { FilterIcon, MenuIcon } from "@/components/icons";
import {
  TableCell,
  TableHead,
  type TableOverscrollAxes,
} from "@/components/ui/table";
import { ScrollBar } from "@/components/ui/scroll-area";
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
  identity?: boolean;
  interaction?: EmrTableHeaderInteraction;
  isResizing?: boolean;
  insetPlainTextLabel?: boolean;
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
  label?: string;
};

type EmrTableCellTextProps = {
  as?: "span" | "div";
  children: React.ReactNode;
  className?: string;
  fullText?: string;
  mode?: EmrTableCellTextMode;
  title?: string;
};

type EmrPinnedTableWorkspaceProps = React.ComponentProps<"div"> & {
  identityTextInset: number | string;
  selectionColumnWidth?: number | string;
};

type EmrPinnedTableViewportProps = React.ComponentProps<"div"> & {
  leftPinnedColumnWidth?: number | string;
  overscrollAxes?: TableOverscrollAxes;
  pinnedColumnWidth?: number | string;
  rightPinnedColumnWidth?: number | string;
};

type EmrTableIdentityCellContentProps = React.ComponentProps<"div"> & {
  leading?: React.ReactNode;
  leadingGap?: number | string;
  leadingWidth?: number | string;
};

type EmrTableSelectionHeaderCellProps = Omit<
  React.ComponentProps<typeof EmrTableHeaderCell>,
  "children" | "interaction" | "resize"
> & {
  children: React.ReactNode;
};

type EmrTableSelectionCellProps = React.ComponentProps<typeof TableCell>;

type EmrTableContextualSelectionCellProps = EmrTableSelectionCellProps & {
  controlVisibility?: "always" | "contextual";
};

type EmrTableFeedbackSurfaceProps = React.ComponentProps<"div">;

function getAriaSort(sortDirection: EmrTableHeaderCellProps["sortDirection"]) {
  if (sortDirection === "asc") return "ascending";
  if (sortDirection === "desc") return "descending";

  return undefined;
}

function getStringLabel(children: React.ReactNode, label?: string) {
  return label ?? (typeof children === "string" ? children : "컬럼");
}

function toCssLength(value: number | string) {
  return typeof value === "number" ? `${value}px` : value;
}

const tableSortArrowSrc =
  typeof tableSortArrow === "string"
    ? tableSortArrow
    : (tableSortArrow.src ?? "");
const tableHeaderLabelLayoutClassName =
  "inline-flex min-h-6 max-w-full min-w-0 items-center justify-center gap-1 px-2.5 py-1 text-left text-[12px] font-medium leading-4 tracking-[0.3px] text-[var(--clair-color-atomic-neutral-500)]";

function SortIcon({ direction }: { direction?: "asc" | "desc" }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt=""
      aria-hidden="true"
      className={cn(
        "h-[7.75px] w-[6.74993px]",
        direction === "asc" && "rotate-180",
      )}
      src={tableSortArrowSrc}
    />
  );
}

export function EmrTableHeaderCell({
  align = "left",
  children,
  className,
  filterActive = false,
  identity = false,
  interaction = "static",
  isResizing = false,
  insetPlainTextLabel = true,
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
  label: labelProp,
  style,
  ...props
}: EmrTableHeaderCellProps) {
  const label = getStringLabel(children, labelProp);
  const displayedChildren =
    labelProp &&
    (typeof children === "string" || React.Children.count(children) === 0)
      ? labelProp
      : children;
  const resizable =
    resize === "data-column" &&
    Boolean(onResizeMouseDown || onResizeTouchStart);
  const sortable = Boolean(onSort);
  const filterable = Boolean(onFilter);
  const menuable = Boolean(onMenu);
  const plainTextLabel =
    typeof displayedChildren === "string" ||
    typeof displayedChildren === "number";

  return (
    <TableHead
      aria-sort={getAriaSort(sortDirection)}
      data-emr-column-resize={resize}
      data-emr-header-interaction={interaction}
      data-emr-table-identity-cell={identity ? "true" : undefined}
      className={cn(
        "emr-table-header-cell relative select-none bg-[var(--emr-table-header-surface,var(--emr-surface-muted))] font-medium text-muted-foreground",
        identity && "!p-0",
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
        data-emr-table-content="true"
      >
        {sortable ? (
          <button
            data-row-interactive="true"
            type="button"
            aria-label={sortLabel ?? `${label} 정렬`}
            title={sortLabel ?? `${label} 정렬`}
            className={cn(
              tableHeaderLabelLayoutClassName,
              "rounded-lg bg-transparent outline-none hover:bg-[var(--emr-state-hover)] focus-visible:ring-3 focus-visible:ring-ring/50",
              identity && "px-0",
              sortDirection && "text-[var(--clair-color-atomic-neutral-700)]",
            )}
            onClick={(event) => {
              event.stopPropagation();
              onSort?.();
            }}
          >
            <span
              className="min-w-0 truncate"
              data-emr-table-identity-text={identity ? "true" : undefined}
            >
              {displayedChildren}
            </span>
            <span className="grid size-3 shrink-0 place-items-center">
              <SortIcon direction={sortDirection} />
            </span>
          </button>
        ) : (
          <span
            className={cn(
              "min-w-0 truncate",
              plainTextLabel &&
                insetPlainTextLabel &&
                !identity &&
                tableHeaderLabelLayoutClassName,
            )}
            data-emr-table-identity-text={identity ? "true" : undefined}
          >
            {displayedChildren}
          </span>
        )}
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
          className="absolute right-[-4px] top-1/2 z-10 h-6 w-2 -translate-y-1/2 cursor-col-resize touch-none rounded-sm before:absolute before:left-1 before:top-1 before:h-4 before:w-px before:bg-[var(--emr-border-default)] hover:bg-[var(--emr-state-selected)] focus-visible:ring-3 focus-visible:ring-ring/50 data-[resizing=true]:bg-[var(--emr-state-drag)]"
          data-resizing={isResizing ? "true" : undefined}
          onClick={(event) => event.stopPropagation()}
          onMouseDown={onResizeMouseDown}
          onTouchStart={onResizeTouchStart}
        />
      ) : null}
    </TableHead>
  );
}

export function EmrPinnedTableWorkspace({
  children,
  identityTextInset,
  selectionColumnWidth = 0,
  style,
  ...props
}: EmrPinnedTableWorkspaceProps) {
  return (
    <div
      data-emr-pinned-table-workspace="true"
      style={
        {
          ...style,
          "--emr-table-identity-text-inset": toCssLength(identityTextInset),
          "--emr-table-selection-column-width":
            toCssLength(selectionColumnWidth),
        } as React.CSSProperties
      }
      {...props}
    >
      {children}
    </div>
  );
}

export function EmrPinnedTableViewport({
  children,
  className,
  leftPinnedColumnWidth,
  overscrollAxes = "horizontal",
  pinnedColumnWidth = 0,
  rightPinnedColumnWidth = 0,
  style,
  ...props
}: EmrPinnedTableViewportProps) {
  const leftWidth = leftPinnedColumnWidth ?? pinnedColumnWidth;

  return (
    <ScrollAreaPrimitive.Root
      data-emr-pinned-table-viewport="true"
      className={cn(
        "relative isolate min-h-0 min-w-0 overflow-hidden",
        className,
      )}
      style={
        {
          ...style,
          "--emr-table-left-pinned-column-width": toCssLength(leftWidth),
          "--emr-table-pinned-column-width": toCssLength(leftWidth),
          "--emr-table-right-pinned-column-width": toCssLength(
            rightPinnedColumnWidth,
          ),
        } as React.CSSProperties
      }
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        data-emr-pinned-table-scroll-owner="true"
        data-slot="scroll-area-viewport"
        className={cn(
          "size-full rounded-[inherit] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1",
          (overscrollAxes === "horizontal" || overscrollAxes === "both") &&
            "overscroll-x-none",
          (overscrollAxes === "vertical" || overscrollAxes === "both") &&
            "overscroll-y-none",
        )}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar
        data-emr-pinned-table-scrollbar="horizontal"
        orientation="horizontal"
        className="z-20"
        style={{
          insetInlineStart: "var(--emr-table-left-pinned-column-width)",
          insetInlineEnd: "var(--emr-table-right-pinned-column-width)",
        }}
      />
      <ScrollBar
        data-emr-pinned-table-scrollbar="vertical"
        orientation="vertical"
        className="z-20"
      />
      <ScrollAreaPrimitive.Corner />
      {leftWidth ? (
        <>
          <div
            aria-hidden="true"
            data-emr-pinned-side="left"
            data-emr-pinned-table-dimmer="true"
          />
          <div
            aria-hidden="true"
            data-emr-pinned-side="left"
            data-emr-pinned-table-divider="true"
          />
        </>
      ) : null}
      {rightPinnedColumnWidth ? (
        <>
          <div
            aria-hidden="true"
            data-emr-pinned-side="right"
            data-emr-pinned-table-dimmer="true"
          />
          <div
            aria-hidden="true"
            data-emr-pinned-side="right"
            data-emr-pinned-table-divider="true"
          />
        </>
      ) : null}
    </ScrollAreaPrimitive.Root>
  );
}

export function EmrTableIdentityCellContent({
  children,
  className,
  leading,
  leadingGap = 0,
  leadingWidth = 0,
  style,
  ...props
}: EmrTableIdentityCellContentProps) {
  return (
    <div
      data-emr-table-identity-content="true"
      className={cn("relative flex min-w-0 items-center", className)}
      style={
        {
          ...style,
          "--emr-table-identity-leading-gap": toCssLength(leadingGap),
          "--emr-table-identity-leading-width": toCssLength(leadingWidth),
        } as React.CSSProperties
      }
      {...props}
    >
      {leading ? (
        <span
          aria-hidden="true"
          className="absolute inline-flex shrink-0 items-center justify-center"
          data-emr-table-identity-leading="true"
        >
          {leading}
        </span>
      ) : null}
      <span
        className="flex min-w-0 flex-1 items-center"
        data-emr-table-identity-text="true"
      >
        {children}
      </span>
    </div>
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
        "w-10 min-w-10 max-w-10 [&_.emr-table-cell-content]:justify-center [&_.emr-table-cell-content>*]:shrink-0",
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
  controlVisibility = "always",
  ...props
}: EmrTableContextualSelectionCellProps) {
  return (
    <TableCell
      className={cn("w-10 min-w-10 max-w-10", className)}
      data-emr-table-selection-visibility={controlVisibility}
      {...props}
    >
      <span className="emr-table-cell-content flex min-w-0 items-center justify-center gap-1 [&>*]:shrink-0">
        {children}
      </span>
    </TableCell>
  );
}

export function EmrTableFeedbackSurface({
  children,
  className,
  ...props
}: EmrTableFeedbackSurfaceProps) {
  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-1 items-center justify-center bg-[var(--emr-surface-panel)] px-4 py-6",
        className,
      )}
      data-emr-table-feedback-surface="true"
      {...props}
    >
      {children}
    </div>
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
