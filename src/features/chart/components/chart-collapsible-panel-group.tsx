"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";

import {
  CdsNavigationChevronLeftIcon,
  CdsNavigationChevronRightIcon,
} from "@/components/cds-icons/navigation";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type ChartCollapsiblePanelId = "soap" | "assessment" | "history";

type ChartCollapsiblePanelGroupProps = {
  children: ReactNode;
  className?: string;
  collapsedPanels: ReadonlySet<ChartCollapsiblePanelId>;
};

type ChartCollapsiblePanelProps = {
  children: ReactNode;
  collapsed?: boolean;
  contentId: string;
  label: string;
  onCollapsedChange?: (collapsed: boolean) => void;
  panelId: ChartCollapsiblePanelId;
};

export type ChartPanelCollapseButtonProps = {
  collapsed?: boolean;
  contentId: string;
  label: string;
  onCollapse: () => void;
  panelId: ChartCollapsiblePanelId | "order";
};

const COLLAPSED_TRACK_PX = 46;
const EXPANDED_TRACK_WEIGHT: Record<ChartCollapsiblePanelId, number> = {
  soap: 566.5,
  assessment: 566.5,
  history: 375,
};

export function ChartCollapsiblePanelGroup({
  children,
  className,
  collapsedPanels,
}: ChartCollapsiblePanelGroupProps) {
  const childArray = Children.toArray(children);
  const getGridTemplateColumns = (minimumWidth: number | null) =>
    childArray
      .map((child) => {
        if (!isValidElement<ChartCollapsiblePanelProps>(child)) {
          return minimumWidth === null
            ? "minmax(0, 1fr)"
            : `minmax(${minimumWidth}px, 1fr)`;
        }

        return collapsedPanels.has(child.props.panelId)
          ? `${COLLAPSED_TRACK_PX}px`
          : `minmax(${minimumWidth ?? 0}px, ${EXPANDED_TRACK_WEIGHT[child.props.panelId]}fr)`;
      })
      .join(" ");
  const gridTemplateColumns = getGridTemplateColumns(null);
  const narrowGridTemplateColumns = getGridTemplateColumns(360);

  return (
    <div
      data-testid="chart-soap-diagnosis-grid"
      data-collapsed-count={collapsedPanels.size}
      className={cn(
        "grid min-h-0 min-w-0 items-stretch gap-2 overflow-x-auto overflow-y-hidden bg-[#fcfcfc] [grid-template-columns:var(--chart-panel-columns)] transition-[grid-template-columns] duration-[var(--clair-motion-duration-normal)] ease-[var(--clair-motion-easing-standard)] motion-reduce:transition-none max-[1180px]:[grid-template-columns:var(--chart-panel-columns-narrow)] [&>*]:min-w-0",
        className,
      )}
      style={
        {
          "--chart-panel-columns": gridTemplateColumns,
          "--chart-panel-columns-narrow": narrowGridTemplateColumns,
        } as CSSProperties
      }
    >
      {childArray.map((child) => {
        if (!isValidElement<ChartCollapsiblePanelProps>(child)) return child;

        return cloneElement(child as ReactElement<ChartCollapsiblePanelProps>, {
          collapsed: collapsedPanels.has(child.props.panelId),
        });
      })}
    </div>
  );
}

export function ChartCollapsiblePanel({
  children,
  collapsed = false,
  contentId,
  label,
  onCollapsedChange,
  panelId,
}: ChartCollapsiblePanelProps) {
  return (
    <div
      className="group/chart-collapsible-panel relative h-full min-h-0 min-w-0"
      data-collapsed={collapsed ? "true" : "false"}
      data-panel-id={panelId}
    >
      <div
        id={contentId}
        aria-hidden={collapsed || undefined}
        inert={collapsed ? true : undefined}
        className={cn(
          "h-full min-h-0 min-w-0 transition-opacity duration-[var(--clair-motion-duration-normal)] ease-[var(--clair-motion-easing-standard)] motion-reduce:transition-none",
          collapsed
            ? "pointer-events-none invisible opacity-0"
            : "visible opacity-100",
        )}
      >
        {children}
      </div>
      <button
        type="button"
        data-chart-panel-expand={panelId}
        aria-controls={contentId}
        aria-expanded={false}
        aria-label={`${label} 패널 펼치기`}
        className={cn(
          "absolute inset-x-0 top-0 flex h-fit min-h-0 w-[46px] flex-col items-center overflow-hidden rounded-lg border border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] py-2 text-sm font-semibold leading-5 text-foreground shadow-xs outline-none transition-[background-color,box-shadow,opacity] duration-[var(--clair-motion-duration-fast)] ease-[var(--clair-motion-easing-standard)] focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
          collapsed
            ? "pointer-events-auto visible opacity-100"
            : "pointer-events-none invisible opacity-0",
        )}
        onClick={() => onCollapsedChange?.(false)}
      >
        <span
          className="[writing-mode:vertical-rl] [text-orientation:mixed]"
          style={{ writingMode: "vertical-rl" }}
        >
          {label}
        </span>
        <span className="mt-4 flex size-7 items-center justify-center rounded-lg [&_svg]:size-3.5">
          <CdsNavigationChevronRightIcon aria-hidden="true" />
        </span>
      </button>
    </div>
  );
}

export function ChartPanelCollapseButton({
  collapsed = false,
  contentId,
  label,
  onCollapse,
  panelId,
}: ChartPanelCollapseButtonProps) {
  const actionLabel = `${label} 패널 ${collapsed ? "펼치기" : "접기"}`;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-controls={contentId}
            aria-expanded={!collapsed}
            aria-label={actionLabel}
            data-chart-panel-collapse={collapsed ? undefined : panelId}
            data-chart-panel-expand={collapsed ? panelId : undefined}
            className="pointer-events-none size-7 rounded-lg text-[var(--emr-text-secondary)] opacity-0 transition-opacity duration-[var(--clair-motion-duration-fast)] ease-[var(--clair-motion-easing-standard)] group-hover/chart-collapsible-panel:pointer-events-auto group-hover/chart-collapsible-panel:opacity-100 group-focus-within/chart-collapsible-panel:pointer-events-auto group-focus-within/chart-collapsible-panel:opacity-100 motion-reduce:transition-none [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100 [@media(pointer:coarse)]:pointer-events-auto [@media(pointer:coarse)]:opacity-100 [&[aria-expanded=true]:not(:hover)]:!bg-transparent [&[aria-expanded=true]:not(:hover)]:!text-[var(--emr-text-secondary)] [&_svg]:size-3.5"
            onClick={onCollapse}
          />
        }
      >
        <CdsNavigationChevronLeftIcon aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent side="bottom">{actionLabel}</TooltipContent>
    </Tooltip>
  );
}
