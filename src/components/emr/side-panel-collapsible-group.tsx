"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import {
  EmrSidePanelStateIcon,
  type EmrSidePanelStateIconState,
} from "@/components/emr/side-panel-state-icon";
import { getEmrSidePanelStatusIconState } from "@/components/emr/side-panel-status-title";
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
  countVariant?: "badge" | "plain";
  indicatorClassName?: string;
  indicatorColorToken?: string;
  indicatorVisible?: boolean;
  stateIconState?: EmrSidePanelStateIconState | false;
};

export const EMR_SIDE_PANEL_COLLAPSE_EASE = [0.16, 1, 0.3, 1] as const;
export const EMR_SIDE_PANEL_COLLAPSE_EXIT_EASE = [0.32, 0, 0.67, 0] as const;

function getAccessibleLabel(label: ReactNode, accessibleLabel?: string) {
  return accessibleLabel ?? (typeof label === "string" ? label : "목록 그룹");
}

function getCountBadgeTokens(colorToken?: string) {
  if (!colorToken) return undefined;

  if (colorToken.includes("status-warning")) return { background: "--emr-status-warning-bg", foreground: "--emr-status-warning-text" };
  if (colorToken.includes("status-success")) return { background: "--emr-status-success-bg", foreground: "--emr-status-success-text" };
  if (colorToken.includes("status-danger")) return { background: "--emr-status-danger-bg", foreground: "--emr-status-danger-text" };
  if (colorToken.includes("status-neutral")) return { background: "--emr-status-neutral-bg", foreground: "--emr-status-neutral-text" };
  if (colorToken.includes("status-info")) return { background: "--emr-status-info-bg", foreground: "--emr-status-info-text" };
  if (colorToken.includes("orange")) return { background: "--emr-status-warning-bg", foreground: "--emr-status-warning-text" };
  if (colorToken.includes("green")) return { background: "--emr-status-success-bg", foreground: "--emr-status-success-text" };
  if (colorToken.includes("red")) return { background: "--emr-status-danger-bg", foreground: "--emr-status-danger-text" };
  if (colorToken.includes("mint")) return { background: "--emr-status-success-bg", foreground: "--emr-status-success-text" };
  if (colorToken.includes("gray")) return { background: "--emr-status-neutral-bg", foreground: "--emr-status-neutral-text" };
  if (colorToken.includes("blue") || colorToken.includes("sky") || colorToken.includes("primary")) {
    return { background: "--emr-status-info-bg", foreground: "--emr-status-info-text" };
  }

  return { background: "--emr-status-neutral-bg", foreground: "--emr-status-neutral-text" };
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
  countVariant = "plain",
  dataTestId,
  indicatorClassName,
  indicatorColorToken,
  indicatorVisible = true,
  label,
  onToggle,
  stateIconState,
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
  const resolvedStateIconState =
    stateIconState === false
      ? null
      : stateIconState ?? (typeof label === "string" ? getEmrSidePanelStatusIconState({ colorToken: indicatorColorToken, label }) : null);

  return (
    <section className={cn("emr-density-stack-sm flex flex-col", className)} data-testid={dataTestId}>
      <button
        type="button"
        className="flex h-[var(--emr-sidepanel-list-title-height)] w-full items-center gap-[var(--emr-sidepanel-list-title-gap)] rounded-[var(--emr-sidepanel-list-title-radius)] p-[var(--emr-sidepanel-list-title-padding)] text-left outline-none transition-colors hover:bg-[var(--emr-sidepanel-list-title-hover-bg)] focus-visible:ring-3 focus-visible:ring-ring/50"
        aria-expanded={!collapsed}
        aria-label={`${resolvedAccessibleLabel} ${collapsed ? "펼치기" : "접기"}`}
        onClick={onToggle}
      >
        <div className="flex min-w-0 flex-1 items-center gap-[var(--emr-sidepanel-list-title-left-gap)]">
          {indicatorVisible ? (
            <span
              className={cn(
                "h-[18px] w-[3px] shrink-0 rounded-[var(--clair-border-width-atomic-1)] bg-[var(--emr-text-tertiary)]",
                indicatorClassName
              )}
              style={indicatorColorToken ? { backgroundColor: `var(${indicatorColorToken})` } : undefined}
              aria-hidden="true"
            />
          ) : null}
          {resolvedStateIconState ? (
            <EmrSidePanelStateIcon
              state={resolvedStateIconState}
              data-testid={dataTestId ? `${dataTestId}-status-icon` : undefined}
              aria-hidden={true}
            />
          ) : null}
          <span className="emr-text-section flex min-w-0 items-center gap-1.5 font-medium">
            <span className="truncate text-[var(--emr-sidepanel-list-title-text)]">{label}</span>
            {countVariant === "plain" ? (
              <span
                data-testid={dataTestId ? `${dataTestId}-count` : undefined}
                className={cn("shrink-0 text-[var(--emr-sidepanel-list-title-count)]", countBadgeClassName)}
              >
                {count}
              </span>
            ) : null}
          </span>
        </div>
        <span className="flex shrink-0 items-center gap-1.5">
          {countVariant === "badge" ? (
            <span
              data-testid={dataTestId ? `${dataTestId}-count` : undefined}
              className={cn(
                "emr-text-status inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-[var(--clair-radius-atomic-6)] border border-[var(--emr-status-neutral-border)] bg-[var(--emr-status-neutral-bg)] px-1.5 font-semibold text-[var(--emr-status-neutral-text)]",
                countBadgeClassName
              )}
              style={countBadgeStyle}
            >
              {count}
            </span>
          ) : null}
          <motion.span
            className="flex size-[var(--emr-sidepanel-list-title-action-size)] shrink-0 items-center justify-center rounded-[var(--emr-sidepanel-list-title-action-radius)] p-1"
            animate={{ rotate: collapsed ? 180 : 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: EMR_SIDE_PANEL_COLLAPSE_EASE }}
          >
            <ChevronDownIcon className="size-[var(--emr-sidepanel-list-title-action-icon-size)] shrink-0 text-[var(--emr-sidepanel-list-title-action-icon)]" aria-hidden="true" />
          </motion.span>
        </span>
      </button>
      <AnimatePresence initial={false}>
        {collapsed ? null : (
          <motion.div
            className={cn("emr-density-stack-md emr-density-list-compact flex flex-col overflow-hidden -m-1", contentClassName)}
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
