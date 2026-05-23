"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { CdsNavigationArrowDownIcon } from "@/components/cds-icons/navigation";
import { EmrIconButton } from "@/components/emr/icon-button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type EmrOrderGroupSectionProps = {
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  collapsed?: boolean;
  count?: ReactNode;
  label?: ReactNode;
  meta?: ReactNode;
  onToggle?: () => void;
  titleClassName?: string;
};

const ORDER_GROUP_EASE = [0.16, 1, 0.3, 1] as const;
const ORDER_GROUP_EXIT_EASE = [0.32, 0, 0.67, 0] as const;

function getAccessibleTitle(title: ReactNode) {
  return typeof title === "string" ? title : "오더 그룹";
}

export function EmrOrderGroupSection({
  title,
  actions,
  children,
  className,
  collapsed = false,
  count,
  label,
  meta,
  onToggle,
  titleClassName,
}: EmrOrderGroupSectionProps) {
  const accessibleTitle = getAccessibleTitle(title);
  const reduceMotion = useReducedMotion();
  const contentTransition = reduceMotion
    ? { duration: 0 }
    : {
        height: { duration: 0.24, ease: ORDER_GROUP_EASE },
        opacity: { duration: 0.14, ease: "easeOut" },
        y: { duration: 0.2, ease: ORDER_GROUP_EASE },
      };
  const contentExitTransition = reduceMotion
    ? { duration: 0 }
    : {
        height: { duration: 0.18, ease: ORDER_GROUP_EXIT_EASE },
        opacity: { duration: 0.12, ease: "easeIn" },
        y: { duration: 0.16, ease: ORDER_GROUP_EXIT_EASE },
      };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label ? (
        <div className="emr-text-status flex h-6 items-center font-medium text-[var(--emr-text-tertiary)]">
          {label}
        </div>
      ) : null}
      <motion.section
        className="overflow-hidden rounded-xl border border-[var(--emr-line-hairline)] bg-card px-4"
        animate={{ paddingBottom: collapsed ? 0 : 16 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: ORDER_GROUP_EASE }}
      >
        <div className="flex h-14 items-center justify-between px-1 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <EmrIconButton
              type="button"
              aria-expanded={!collapsed}
              aria-label={collapsed ? `${accessibleTitle} 펼치기` : `${accessibleTitle} 접기`}
              onClick={onToggle}
            >
              <motion.span
                className="flex shrink-0 items-center justify-center"
                animate={{ rotate: collapsed ? -90 : 0 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: ORDER_GROUP_EASE }}
              >
                <CdsNavigationArrowDownIcon />
              </motion.span>
            </EmrIconButton>
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className={cn(
                  "emr-text-body truncate font-semibold text-[var(--emr-text-secondary)]",
                  titleClassName
                )}
              >
                {title}
              </span>
              {count !== undefined ? (
                <Badge
                  variant="secondary"
                  className="emr-text-status h-5 min-w-5 rounded-md px-1 font-medium text-[var(--emr-text-tertiary)]"
                >
                  {count}
                </Badge>
              ) : null}
              {meta}
            </div>
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-3">{actions}</div> : null}
        </div>
        <AnimatePresence initial={false}>
          {collapsed ? null : (
            <motion.div
              className="overflow-hidden"
              initial={{ height: 0, opacity: 0, y: -4 }}
              animate={{ height: "auto", opacity: 1, y: 0, transition: contentTransition }}
              exit={{ height: 0, opacity: 0, y: -4, transition: contentExitTransition }}
            >
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>
    </div>
  );
}
