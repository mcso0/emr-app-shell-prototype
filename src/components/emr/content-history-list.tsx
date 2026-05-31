"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { KeyboardEvent, ReactNode } from "react";
import { CalendarIcon, ChevronDownIcon, ClockIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

type EmrContentHistoryGroupProps = {
  children: ReactNode;
  count: ReactNode;
  label: ReactNode;
  collapsed?: boolean;
  dataTestId?: string;
  onToggle?: () => void;
  toggleTestId?: string;
};

type EmrContentHistoryItemProps = {
  title: ReactNode;
  action?: ReactNode;
  badge?: ReactNode;
  className?: string;
  meta?: ReactNode;
  onSelect?: () => void;
  selected?: boolean;
  subtitle?: ReactNode;
  testId?: string;
};

const CONTENT_HISTORY_GROUP_EASE = [0.16, 1, 0.3, 1] as const;
const CONTENT_HISTORY_GROUP_EXIT_EASE = [0.32, 0, 0.67, 0] as const;

export function EmrContentHistoryGroup({
  children,
  collapsed = false,
  count,
  dataTestId,
  label,
  onToggle,
  toggleTestId,
}: EmrContentHistoryGroupProps) {
  const reduceMotion = useReducedMotion();
  const contentTransition = reduceMotion
    ? { duration: 0 }
    : {
        height: { duration: 0.24, ease: CONTENT_HISTORY_GROUP_EASE },
        opacity: { duration: 0.14, ease: "easeOut" },
        y: { duration: 0.2, ease: CONTENT_HISTORY_GROUP_EASE },
      };
  const contentExitTransition = reduceMotion
    ? { duration: 0 }
    : {
        height: { duration: 0.18, ease: CONTENT_HISTORY_GROUP_EXIT_EASE },
        opacity: { duration: 0.12, ease: "easeIn" },
        y: { duration: 0.16, ease: CONTENT_HISTORY_GROUP_EXIT_EASE },
      };

  const titleContent = (
    <>
      <div className="emr-text-body flex min-w-0 flex-1 items-center gap-[var(--emr-content-history-group-title-left-gap)] font-medium">
        <CalendarIcon
          className="size-[var(--emr-content-history-group-action-icon-size)] shrink-0 text-[var(--emr-content-history-group-title-icon)]"
          aria-hidden="true"
        />
        <span className="truncate text-[var(--emr-content-history-group-title-text)]">
          {label}
        </span>
        <span className="shrink-0 text-[var(--emr-content-history-group-title-count)]">
          {count}
        </span>
      </div>
      <motion.span
        className="flex size-[var(--emr-content-history-group-action-size)] shrink-0 items-center justify-center text-[var(--emr-content-history-group-title-icon)]"
        animate={{ rotate: collapsed ? 180 : 0 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: CONTENT_HISTORY_GROUP_EASE }}
      >
        <ChevronDownIcon
          className="size-[var(--emr-content-history-group-action-icon-size)] shrink-0"
          aria-hidden="true"
        />
      </motion.span>
    </>
  );

  return (
    <section className="flex flex-col gap-[var(--emr-content-history-list-gap)]" data-testid={dataTestId}>
      {onToggle ? (
        <button
          type="button"
          className="flex h-[var(--emr-content-history-group-title-height)] w-full items-center justify-between gap-[var(--emr-content-history-group-title-gap)] rounded-[var(--emr-content-history-group-title-radius)] p-[var(--emr-content-history-group-title-padding)] text-left outline-none transition-colors hover:bg-[var(--emr-content-history-group-title-hover-bg)] focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-expanded={!collapsed}
          data-slot="content-history-group-title"
          data-testid={toggleTestId}
          onClick={onToggle}
        >
          {titleContent}
        </button>
      ) : (
        <div
          className="flex h-[var(--emr-content-history-group-title-height)] items-center justify-between gap-[var(--emr-content-history-group-title-gap)] rounded-[var(--emr-content-history-group-title-radius)] p-[var(--emr-content-history-group-title-padding)]"
          data-slot="content-history-group-title"
        >
          {titleContent}
        </div>
      )}
      <AnimatePresence initial={false}>
        {collapsed ? null : (
          <motion.div
            key="items"
            className="overflow-hidden"
            initial={{ height: 0, opacity: 0, y: -4 }}
            animate={{ height: "auto", opacity: 1, y: 0, transition: contentTransition }}
            exit={{ height: 0, opacity: 0, y: -4, transition: contentExitTransition }}
          >
            <div className="flex min-w-0">
              <div
                className="flex shrink-0 self-stretch pl-[var(--emr-content-history-timeline-gutter)] pr-[var(--emr-content-history-timeline-padding-right)]"
                aria-hidden="true"
              >
                <div className="w-px bg-[var(--emr-content-history-timeline-line)]" />
              </div>
              <div
                className="flex min-w-0 flex-1 flex-col gap-[var(--emr-content-history-list-gap)]"
                data-slot="content-history-group-list"
              >
                {children}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export function EmrContentHistoryItem({
  action,
  badge,
  className,
  meta,
  onSelect,
  selected = false,
  subtitle,
  testId,
  title,
}: EmrContentHistoryItemProps) {
  const content = (
    <>
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-[var(--emr-content-history-card-gap)]">
          {subtitle ? (
            <div className="emr-text-metadata flex min-w-0 items-center gap-1 font-medium text-[var(--emr-content-history-card-meta)]">
              <ClockIcon className="size-3 shrink-0" aria-hidden="true" />
              <span className="min-w-0 truncate">{subtitle}</span>
            </div>
          ) : null}
          <div className="emr-text-body truncate font-semibold text-[var(--emr-content-history-card-title)]">
            {title}
          </div>
        </div>
        {badge ? <div className="shrink-0">{badge}</div> : null}
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {meta ? (
        <div className="emr-text-metadata flex min-w-0 flex-wrap items-center gap-[var(--emr-content-history-card-gap)] font-medium text-[var(--emr-content-history-card-meta)] [&>span]:inline-flex [&>span]:h-6 [&>span]:min-w-0 [&>span]:items-center [&>span]:rounded-[var(--clair-radius-atomic-6)] [&>span]:border [&>span]:border-[var(--emr-content-history-card-chip-border)] [&>span]:bg-[var(--emr-content-history-card-chip-bg)] [&>span]:px-[var(--clair-spacing-6)] [&>span]:py-[var(--clair-spacing-2)] [&>span]:text-[var(--emr-content-history-card-chip-text)]">
          {meta}
        </div>
      ) : null}
    </>
  );
  const itemClassName = cn(
    "block w-full rounded-[var(--emr-content-history-card-radius)] p-[var(--emr-content-history-card-padding)] text-left outline-none transition-colors hover:bg-[var(--emr-content-history-card-hover-bg)] focus-visible:bg-[var(--emr-content-history-card-hover-bg)] focus-visible:ring-3 focus-visible:ring-ring/50",
    selected && "bg-[var(--emr-content-history-card-selected-bg)]",
    className
  );

  if (onSelect) {
    return (
      <div
        role="button"
        tabIndex={0}
        className={itemClassName}
        data-slot="content-history-item"
        data-selected={selected ? "true" : undefined}
        data-testid={testId}
        aria-pressed={selected}
        onClick={onSelect}
        onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
          if (event.target !== event.currentTarget) {
            return;
          }

          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect();
          }
        }}
      >
        {content}
      </div>
    );
  }

  return (
    <div className={itemClassName} data-slot="content-history-item" data-testid={testId}>
      {content}
    </div>
  );
}
