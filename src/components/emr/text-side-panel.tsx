"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CdsNavigationChevronDownIcon } from "@/components/cds-icons/navigation";
import { cn } from "@/lib/utils";

export function EmrTextSideNavButton({
  active,
  children,
  className,
  count,
  disabled = false,
  icon,
  onClick,
  testId,
}: {
  active?: boolean;
  children: ReactNode;
  className?: string;
  count?: ReactNode;
  disabled?: boolean;
  icon?: ReactNode;
  onClick?: () => void;
  testId?: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        "emr-text-body group flex h-9 w-full items-center gap-2 rounded-md px-2 text-left font-medium text-[var(--emr-text-secondary)] transition-colors hover:bg-[var(--emr-state-hover)]",
        active && "bg-[var(--emr-state-selected)] text-[var(--emr-text-primary)]",
        disabled && "cursor-not-allowed text-muted-foreground hover:bg-transparent",
        className
      )}
      aria-pressed={active}
      data-selected={active ? "true" : undefined}
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {count ? <span className="shrink-0">{count}</span> : null}
    </button>
  );
}

export function EmrTextSideNavSection({
  children,
  icon,
  open,
  testId,
  title,
  onToggle,
}: {
  children: ReactNode;
  icon: ReactNode;
  open: boolean;
  testId?: string;
  title: string;
  onToggle: () => void;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="rounded-md">
      <button
        type="button"
        className="emr-text-compact-title flex h-10 w-full items-center gap-2 rounded-md px-2 text-left font-semibold text-[var(--emr-text-secondary)] transition-colors hover:bg-[var(--emr-state-hover)]"
        aria-expanded={open}
        data-testid={testId}
        onClick={onToggle}
      >
        {icon}
        <span className="min-w-0 flex-1 truncate">{title}</span>
        <CdsNavigationChevronDownIcon
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-150",
            !open && "-rotate-90"
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key={`${title}-content`}
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduceMotion ? { height: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
