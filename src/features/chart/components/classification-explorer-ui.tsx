"use client";

import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type KeyboardEventHandler,
  type ReactNode,
  type Ref,
} from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { UniqueIdentifier } from "@dnd-kit/core";
import { IconReorderAlt } from "obra-icons-react";
import {
  CdsActionsCheckIcon,
  CdsActionsSearchIcon,
  CdsActionsTrashIcon,
  CdsActionsXIcon,
} from "@/components/cds-icons/actions-and-controls";
import { CdsAlertsLoaderIcon } from "@/components/cds-icons/alerts-and-status";
import { EmrEmptyState } from "@/components/emr/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import styles from "./classification-explorer-ui.module.css";

export type ClassificationExplorerStatus =
  "ready" | "loading" | "error" | "permission";

export function ClassificationExplorerColumn({
  children,
  className,
  header,
  label,
  scroll = true,
  status = "ready",
  statusMessage,
  tone = "default",
}: {
  children: ReactNode;
  className?: string;
  header: ReactNode;
  label: string;
  scroll?: boolean;
  status?: ClassificationExplorerStatus;
  statusMessage?: string;
  tone?: "default" | "muted";
}) {
  return (
    <section
      aria-label={label}
      className={cn(
        styles.column,
        tone === "muted" && styles.mutedColumn,
        className,
      )}
      data-slot="classification-explorer-column"
    >
      {header}
      {status === "ready" ? (
        scroll ? (
          <ScrollArea
            className={styles.columnScroll}
            data-slot="classification-explorer-scroll"
          >
            {children}
          </ScrollArea>
        ) : (
          children
        )
      ) : (
        <ClassificationExplorerColumnStatus
          label={label}
          message={statusMessage}
          status={status}
        />
      )}
    </section>
  );
}

export function ClassificationExplorerHeading({
  action,
  count,
  countLoading = false,
  countSuffix = "",
  label,
}: {
  action?: ReactNode;
  count?: number;
  countLoading?: boolean;
  countSuffix?: string;
  label: string;
}) {
  return (
    <div
      className={styles.sectionHeader}
      data-slot="classification-explorer-heading"
    >
      <span className={styles.sectionTitle}>
        <strong>{label}</strong>
        {countLoading ? (
          <span
            aria-hidden="true"
            className={styles.countSkeleton}
            data-testid="classification-explorer-count-skeleton"
          />
        ) : typeof count === "number" ? (
          <Badge variant="secondary" className={styles.countBadge}>
            {count}
            {countSuffix}
          </Badge>
        ) : null}
      </span>
      {action}
    </div>
  );
}

export function ClassificationExplorerSearchHeader({
  buttonRef,
  count,
  countLoading = false,
  countSuffix = "",
  disabled,
  inputProps,
  inputRef,
  label,
  placeholder,
  query,
  searchOpen,
  searching = false,
  onCloseSearch,
  onKeyDown,
  onOpenSearch,
  onQueryChange,
  openSearchAriaLabel,
}: {
  buttonRef?: Ref<HTMLButtonElement>;
  count?: number;
  countLoading?: boolean;
  countSuffix?: string;
  disabled: boolean;
  inputProps?: Pick<
    InputHTMLAttributes<HTMLInputElement>,
    "aria-activedescendant" | "aria-controls" | "aria-expanded" | "role"
  >;
  inputRef?: Ref<HTMLInputElement>;
  label: string;
  placeholder: string;
  query: string;
  searchOpen: boolean;
  searching?: boolean;
  onCloseSearch: () => void;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
  onOpenSearch: () => void;
  onQueryChange: (value: string) => void;
  openSearchAriaLabel?: string;
}) {
  if (searchOpen) {
    return (
      <div
        className={cn(styles.sectionHeader, styles.searchHeader)}
        data-slot="classification-explorer-search-header"
      >
        <label className={styles.searchField}>
          <span className="sr-only">{label} 검색</span>
          <CdsActionsSearchIcon aria-hidden="true" />
          <Input
            {...inputProps}
            autoFocus
            ref={inputRef}
            type="search"
            aria-label={`${label} 검색`}
            value={query}
            placeholder={placeholder}
            disabled={disabled}
            onKeyDown={(event) => {
              if (event.key === "Escape" && !onKeyDown) {
                event.preventDefault();
                if (query) onQueryChange("");
                else onCloseSearch();
                return;
              }
              onKeyDown?.(event);
            }}
            onValueChange={onQueryChange}
          />
        </label>
        {searching ? (
          <span className={styles.searchingStatus} role="status">
            검색 중
          </span>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`${label} 검색 닫기`}
          onClick={onCloseSearch}
        >
          <CdsActionsXIcon aria-hidden="true" />
        </Button>
      </div>
    );
  }

  return (
    <ClassificationExplorerHeading
      count={count}
      countLoading={countLoading}
      countSuffix={countSuffix}
      label={label}
      action={
        <Button
          ref={buttonRef}
          type="button"
          variant="ghost"
          size="icon-sm"
          className={styles.headerSearchButton}
          aria-label={openSearchAriaLabel ?? `${label} 검색`}
          aria-expanded="false"
          disabled={disabled}
          onClick={onOpenSearch}
        >
          <CdsActionsSearchIcon aria-hidden="true" />
        </Button>
      }
    />
  );
}

type ClassificationExplorerOptionProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> & {
  count?: number;
  countLoading?: boolean;
  description?: ReactNode;
  label: ReactNode;
  selected: boolean;
  selectedIndicator?: boolean;
  trailing?: ReactNode;
  variant?: "facet" | "result";
};

export const ClassificationExplorerOption = forwardRef<
  HTMLButtonElement,
  ClassificationExplorerOptionProps
>(function ClassificationExplorerOption(
  {
    className,
    count,
    countLoading = false,
    description,
    label,
    selected,
    selectedIndicator = false,
    trailing,
    variant = "facet",
    ...props
  },
  ref,
) {
  const detailed = Boolean(description);
  const hasTrailingSlot =
    countLoading ||
    typeof count === "number" ||
    Boolean(trailing) ||
    selectedIndicator;
  return (
    <button
      {...props}
      ref={ref}
      type="button"
      role="option"
      aria-selected={selected}
      className={cn(
        styles.option,
        detailed && styles.detailedOption,
        className,
      )}
      data-list-variant={variant}
      data-slot="classification-explorer-option"
    >
      <span className={styles.optionCopy}>
        <span>{label}</span>
        {description ? <small>{description}</small> : null}
      </span>
      {hasTrailingSlot ? (
        <span className={styles.optionTrailingSlot}>
          {countLoading ? (
            <span
              aria-hidden="true"
              className={styles.optionCountSkeleton}
              data-slot="classification-explorer-option-count"
              data-testid="classification-explorer-option-count-skeleton"
            />
          ) : typeof count === "number" ? (
            <span
              className={styles.optionCount}
              data-slot="classification-explorer-option-count"
            >
              {count}
            </span>
          ) : null}
          {trailing ? (
            <span className={styles.optionTrailing}>{trailing}</span>
          ) : null}
          {selectedIndicator ? (
            <i
              className={styles.optionIndicator}
              data-slot="classification-explorer-option-indicator"
            >
              <CdsActionsCheckIcon aria-hidden="true" />
            </i>
          ) : null}
        </span>
      ) : null}
    </button>
  );
});

export function ClassificationExplorerList({
  ariaLabel,
  children,
  selected = false,
}: {
  ariaLabel: string;
  children: ReactNode;
  selected?: boolean;
}) {
  return (
    <div
      aria-label={ariaLabel}
      className={selected ? styles.selectedList : styles.list}
      data-slot={
        selected
          ? "classification-explorer-selected-list"
          : "classification-explorer-list"
      }
      role={selected ? "list" : "listbox"}
    >
      {children}
    </div>
  );
}

export function ClassificationExplorerReviewHeading({
  count,
  disabled = false,
  label = "선택 항목",
  onClear,
}: {
  count: number;
  disabled?: boolean;
  label?: string;
  onClear: () => void;
}) {
  return (
    <ClassificationExplorerHeading
      label={label}
      count={count}
      action={
        <Button
          type="button"
          variant="outline"
          size="xs"
          className={styles.clearButton}
          disabled={disabled || !count}
          onClick={onClear}
        >
          <CdsActionsTrashIcon aria-hidden="true" data-icon="inline-start" />
          전체 삭제
        </Button>
      }
    />
  );
}

export function ClassificationExplorerSortableRow({
  disabled = false,
  id,
  label,
  onMove,
  onRemove,
  removeAriaLabel,
  trailing,
}: {
  disabled?: boolean;
  id: UniqueIdentifier;
  label: string;
  onMove?: (direction: -1 | 1) => void;
  onRemove: () => void;
  removeAriaLabel?: string;
  trailing?: ReactNode;
}) {
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ disabled, id });
  const sortableKeyDown = listeners?.onKeyDown;

  return (
    <div
      ref={setNodeRef}
      className={cn(styles.selectedRow, isDragging && styles.dragging)}
      data-has-trailing={Boolean(trailing)}
      data-list-variant="review"
      data-slot="classification-explorer-sortable-row"
      role="listitem"
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <Button
        {...attributes}
        {...listeners}
        ref={setActivatorNodeRef}
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={disabled}
        aria-label={`${label} 순서 변경`}
        className={styles.dragHandle}
        onKeyDown={(event) => {
          if (onMove && event.altKey && event.key === "ArrowUp") {
            event.preventDefault();
            onMove(-1);
            return;
          }
          if (onMove && event.altKey && event.key === "ArrowDown") {
            event.preventDefault();
            onMove(1);
            return;
          }
          sortableKeyDown?.(event);
        }}
      >
        <IconReorderAlt aria-hidden="true" />
      </Button>
      <strong className={styles.selectedName} title={label}>
        {label}
      </strong>
      {trailing ? (
        <span className={styles.selectedTrailing}>{trailing}</span>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        disabled={disabled}
        aria-label={removeAriaLabel ?? `${label} 삭제`}
        className={styles.deleteButton}
        onClick={onRemove}
      >
        <CdsActionsXIcon aria-hidden="true" />
      </Button>
    </div>
  );
}

export function ClassificationExplorerLoadingState({
  label,
  message,
}: {
  label: string;
  message?: string;
}) {
  return (
    <div
      className={styles.loadingState}
      data-slot="classification-explorer-loading-state"
      role="status"
      aria-live="polite"
    >
      <span
        aria-hidden="true"
        className={styles.loadingIconSurface}
        data-slot="classification-explorer-loading-icon"
      >
        <CdsAlertsLoaderIcon className={styles.spinner} />
      </span>
      <strong>{message ?? `${label}을 불러오는 중입니다`}</strong>
    </div>
  );
}

function ClassificationExplorerColumnStatus({
  label,
  message,
  status,
}: {
  label: string;
  message?: string;
  status: Exclude<ClassificationExplorerStatus, "ready">;
}) {
  if (status === "loading") {
    return <ClassificationExplorerLoadingState label={label} />;
  }

  return (
    <EmrEmptyState
      kind={status === "permission" ? "no-permission" : "read-error"}
      surface="content"
      priority="local-recovery"
      title={
        status === "permission"
          ? `${label}을 볼 권한이 없습니다`
          : `${label}을 불러오지 못했습니다`
      }
      description={
        message ??
        (status === "permission"
          ? "차트 조회 권한을 확인해 주세요."
          : "잠시 후 다시 시도해 주세요.")
      }
      className={styles.emptyState}
    />
  );
}
