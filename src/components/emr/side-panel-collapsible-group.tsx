"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { ChevronDownIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

type EmrSidePanelCollapsibleGroupProps = {
  children: ReactNode;
  collapsed: boolean;
  count: ReactNode;
  label: ReactNode;
  onToggle: () => void;
  accessibleLabel?: string;
  className?: string;
  contentClassName?: string;
  dataTestId?: string;
  countBadgeColorToken?: string;
  countBadgeClassName?: string;
  indicatorClassName?: string;
  indicatorColorToken?: string;
  indicatorVisible?: boolean;
};

export const EMR_SIDE_PANEL_COLLAPSE_EASE = [0.16, 1, 0.3, 1] as const;
export const EMR_SIDE_PANEL_COLLAPSE_EXIT_EASE = [0.32, 0, 0.67, 0] as const;

function getAccessibleLabel(label: ReactNode, accessibleLabel?: string) {
  return accessibleLabel ?? (typeof label === "string" ? label : "목록 그룹");
}

function getCountBadgeTokens(colorToken?: string) {
  if (!colorToken) return undefined;

  if (colorToken.includes("orange")) return { background: "--clair-color-atomic-orange-50", foreground: "--clair-color-atomic-orange-500" };
  if (colorToken.includes("green")) return { background: "--clair-color-atomic-green-50", foreground: "--clair-color-atomic-green-500" };
  if (colorToken.includes("red")) return { background: "--clair-color-atomic-red-50", foreground: "--clair-color-atomic-red-500" };
  if (colorToken.includes("mint")) return { background: "--clair-color-atomic-mint-50", foreground: "--clair-color-atomic-mint-500" };
  if (colorToken.includes("gray")) return { background: "--clair-color-atomic-gray-50", foreground: "--clair-color-atomic-gray-500" };
  if (colorToken.includes("blue") || colorToken.includes("sky") || colorToken.includes("primary")) {
    return { background: "--clair-color-atomic-blue-50", foreground: "--clair-color-atomic-blue-500" };
  }

  return { background: "--clair-color-atomic-gray-50", foreground: "--clair-color-atomic-gray-500" };
}

export function EmrSidePanelCollapsibleGroup({
  accessibleLabel,
  children,
  className,
  collapsed,
  contentClassName,
  count,
  countBadgeClassName,
  countBadgeColorToken,
  dataTestId,
  indicatorClassName,
  indicatorColorToken,
  indicatorVisible = true,
  label,
  onToggle,
}: EmrSidePanelCollapsibleGroupProps) {
  const reduceMotion = useReducedMotion();
  const resolvedAccessibleLabel = getAccessibleLabel(label, accessibleLabel);
  const contentTransition = reduceMotion
    ? { duration: 0 }
    : {
        height: { duration: 0.24, ease: EMR_SIDE_PANEL_COLLAPSE_EASE },
        opacity: { duration: 0.14, ease: "easeOut" },
        y: { duration: 0.2, ease: EMR_SIDE_PANEL_COLLAPSE_EASE },
      };
  const contentExitTransition = reduceMotion
    ? { duration: 0 }
    : {
        height: { duration: 0.18, ease: EMR_SIDE_PANEL_COLLAPSE_EXIT_EASE },
        opacity: { duration: 0.12, ease: "easeIn" },
        y: { duration: 0.16, ease: EMR_SIDE_PANEL_COLLAPSE_EXIT_EASE },
      };
  const countBadgeTokens = getCountBadgeTokens(countBadgeColorToken);
  const countBadgeStyle = countBadgeTokens
    ? {
        backgroundColor: `var(${countBadgeTokens.background})`,
        borderColor: `var(${countBadgeTokens.background})`,
        color: `var(${countBadgeTokens.foreground})`,
      }
    : undefined;

  return (
    <section className={cn("flex flex-col gap-1", className)} data-testid={dataTestId}>
      <button
        type="button"
        className="flex h-8 w-full items-center gap-3 rounded-[var(--clair-radius-atomic-6)] p-1 text-left outline-none transition-colors hover:bg-[var(--clair-color-atomic-black-alpha-8)] focus-visible:ring-3 focus-visible:ring-ring/50"
        aria-expanded={!collapsed}
        aria-label={`${resolvedAccessibleLabel} ${collapsed ? "펼치기" : "접기"}`}
        onClick={onToggle}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          {indicatorVisible ? (
            <span
              className={cn(
                "h-[18px] w-[3px] shrink-0 rounded-[var(--clair-border-width-atomic-1)] bg-[var(--clair-color-atomic-gray-400)]",
                indicatorClassName
              )}
              style={indicatorColorToken ? { backgroundColor: `var(${indicatorColorToken})` } : undefined}
              aria-hidden="true"
            />
          ) : null}
          <span className="flex min-w-0 items-center text-[14px] font-medium leading-5 tracking-[0.196px]">
            <span className="truncate text-[var(--clair-color-atomic-gray-600)]">{label}</span>
          </span>
        </div>
        <span className="flex shrink-0 items-center gap-1.5">
          <span
            data-testid={dataTestId ? `${dataTestId}-count` : undefined}
            className={cn(
              "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-[var(--clair-radius-atomic-6)] border border-[var(--clair-color-atomic-gray-200)] bg-[var(--clair-color-atomic-gray-50)] px-1.5 text-[12px] font-semibold leading-4 tracking-normal text-[var(--clair-color-atomic-gray-600)]",
              countBadgeClassName
            )}
            style={countBadgeStyle}
          >
            {count}
          </span>
          <motion.span
            className="flex min-h-6 min-w-6 shrink-0 items-center justify-center rounded-sm p-1"
            animate={{ rotate: collapsed ? 180 : 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: EMR_SIDE_PANEL_COLLAPSE_EASE }}
          >
            <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </motion.span>
        </span>
      </button>
      <AnimatePresence initial={false}>
        {collapsed ? null : (
          <motion.div
            className={cn("flex flex-col gap-1 overflow-hidden", contentClassName)}
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
