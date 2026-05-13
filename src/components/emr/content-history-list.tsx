"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { KeyboardEvent, ReactNode } from "react";
import { ChevronDownIcon } from "@/components/icons";
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
      <div className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px] font-medium leading-[18px] tracking-[0.019em]">
        <span className="truncate text-[var(--clair-color-label-alternative)]">
          {label}
        </span>
        <span className="shrink-0 text-[var(--emr-text-tertiary)]">
          {count}
        </span>
      </div>
      <motion.span
        className="flex size-4 shrink-0 items-center justify-center text-[var(--clair-color-label-alternative)]"
        animate={{ rotate: collapsed ? 180 : 0 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: CONTENT_HISTORY_GROUP_EASE }}
      >
        <ChevronDownIcon className="size-4 shrink-0" aria-hidden="true" />
      </motion.span>
    </>
  );

  return (
    <section className="flex flex-col gap-1 rounded-[10px]" data-testid={dataTestId}>
      {onToggle ? (
        <button
          type="button"
          className="flex h-8 w-full items-center justify-between gap-3 rounded-md px-1 py-1 text-left outline-none transition-colors hover:bg-[var(--emr-state-hover)] focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-expanded={!collapsed}
          data-testid={toggleTestId}
          onClick={onToggle}
        >
          {titleContent}
        </button>
      ) : (
        <div className="flex h-8 items-center justify-between gap-3 rounded-md px-1 py-1">{titleContent}</div>
      )}
      <div className="h-px w-full shrink-0 bg-[var(--emr-line-subtle)]" />
      <AnimatePresence initial={false}>
        {collapsed ? null : (
          <motion.div
            key="items"
            className="overflow-hidden"
            initial={{ height: 0, opacity: 0, y: -4 }}
            animate={{ height: "auto", opacity: 1, y: 0, transition: contentTransition }}
            exit={{ height: 0, opacity: 0, y: -4, transition: contentExitTransition }}
          >
            {children}
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
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold leading-5 tracking-normal text-[var(--emr-text-secondary)]">
            {title}
          </div>
          {subtitle ? (
            <div className="mt-0.5 min-w-0 truncate text-[13px] font-medium leading-[18px] tracking-normal text-[var(--emr-text-tertiary)]">
              {subtitle}
            </div>
          ) : null}
        </div>
        {badge ? <div className="shrink-0">{badge}</div> : null}
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {meta ? (
        <div className="mt-1 flex min-w-0 items-center gap-2 text-[13px] font-medium leading-[18px] tracking-normal text-[var(--emr-text-tertiary)]">
          {meta}
        </div>
      ) : null}
    </>
  );
  const itemClassName = cn(
    "block w-full border-b border-[var(--emr-line-subtle)] px-1 py-2 text-left outline-none transition-colors hover:bg-[var(--emr-state-hover)] focus-visible:bg-[var(--emr-state-hover)] focus-visible:ring-3 focus-visible:ring-ring/50",
    selected && "bg-transparent",
    className
  );

  if (onSelect) {
    return (
      <div
        role="button"
        tabIndex={0}
        className={itemClassName}
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
    <div className={itemClassName} data-testid={testId}>
      {content}
    </div>
  );
}
