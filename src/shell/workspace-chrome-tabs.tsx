"use client";

import { useState, type FocusEvent, type MouseEvent } from "react";
import { CdsActionsPlusIcon } from "@/components/cds-icons/actions-and-controls";
import { CircleCloseFillIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { GnbIcon } from "@/shell/module-nav-icons";

export type WorkspaceChromeTabItem = {
  icon?: GnbIcon;
  iconClassName?: string;
  id: string;
  title: string;
  tooltipDescription?: string;
  tooltipTitle?: string;
};

type WorkspaceChromeTabsProps = {
  activeTabId: string | null;
  tabs: WorkspaceChromeTabItem[];
  onActivateTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onNewTab: () => void;
};

export function WorkspaceChromeTabs({
  activeTabId,
  tabs,
  onActivateTab,
  onCloseTab,
  onNewTab,
}: WorkspaceChromeTabsProps) {
  const hasMultipleTabs = tabs.length > 1;
  const [hoveredTabId, setHoveredTabId] = useState<string | null>(null);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5" role="tablist" aria-label="열린 업무 탭">
      {tabs.map((tab) => {
        const active = tab.id === activeTabId;
        const TabIcon = tab.icon;
        const showCloseButton = hasMultipleTabs && hoveredTabId === tab.id;

        function handleCloseTab(event: MouseEvent<HTMLButtonElement>) {
          event.stopPropagation();
          onCloseTab(tab.id);
        }

        function handleBlur(event: FocusEvent<HTMLDivElement>) {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setHoveredTabId(null);
          }
        }

        return (
          <div
            key={tab.id}
            role="presentation"
            onBlur={handleBlur}
            onFocus={() => setHoveredTabId(tab.id)}
            onMouseEnter={() => setHoveredTabId(tab.id)}
            onMouseLeave={() => setHoveredTabId(null)}
            className={cn(
              "group/workspace-tab relative flex h-8 max-w-[230px] min-w-0 items-center rounded-[var(--emr-radius-control)] border transition-colors",
              active
                ? "border-[var(--emr-line-default)] bg-card shadow-xs"
                : "border-[var(--emr-line-subtle)] bg-transparent shadow-none hover:border-[var(--emr-line-default)] hover:bg-[var(--emr-state-hover)]",
            )}
          >
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    role="tab"
                    variant="ghost"
                    size="default"
                    aria-selected={active}
                    className={cn(
                      "h-8 min-w-0 flex-1 justify-start gap-0 truncate rounded-[var(--emr-radius-control)] border-transparent bg-transparent py-0 pl-2 text-left text-[13px] font-semibold tracking-normal shadow-none hover:bg-transparent",
                      "pr-2.5",
                      active
                        ? "text-[var(--emr-text-primary)] hover:text-[var(--emr-text-primary)]"
                        : "text-[var(--emr-text-tertiary)] hover:text-[var(--emr-text-secondary)] group-hover/workspace-tab:text-[var(--emr-text-secondary)]",
                    )}
                    onClick={() => onActivateTab(tab.id)}
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      {TabIcon ? (
                        <span
                          className={cn(
                            "flex size-4 shrink-0 items-center justify-center",
                            showCloseButton && "opacity-0",
                          )}
                          aria-hidden="true"
                        >
                          <TabIcon
                            className={cn(
                              "origin-center scale-[0.65] text-current",
                              active ? "opacity-65" : "opacity-80",
                              tab.iconClassName
                            )}
                          />
                        </span>
                      ) : null}
                      <span className="truncate">{tab.title}</span>
                    </span>
                  </Button>
                }
              />
              <TooltipContent
                side="bottom"
                align="start"
                sideOffset={8}
                className="max-w-[260px] flex-col items-start gap-0.5 px-2.5 py-2 text-left"
              >
                <span className="max-w-full truncate text-[12px] font-semibold">
                  {tab.tooltipTitle ?? tab.title}
                </span>
                {tab.tooltipDescription ? (
                  <span className="max-w-full truncate text-[11px] opacity-80">
                    {tab.tooltipDescription}
                  </span>
                ) : null}
              </TooltipContent>
            </Tooltip>
            {hasMultipleTabs ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`${tab.title} 탭 닫기`}
                className={cn(
                  "absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 rounded-full bg-transparent text-[var(--emr-text-placeholder)] transition-none hover:bg-transparent hover:text-[var(--emr-text-tertiary)]",
                  showCloseButton ? "opacity-100" : "opacity-0",
                )}
                onClick={handleCloseTab}
              >
                <CircleCloseFillIcon className="size-3.5" aria-hidden="true" />
              </Button>
            ) : null}
          </div>
        );
      })}
      <Button
        variant="ghost"
        size="icon"
        aria-label="새 업무 탭"
        onClick={onNewTab}
        className="shrink-0 rounded-[var(--emr-radius-control)] border-transparent bg-transparent text-muted-foreground shadow-none hover:bg-[var(--emr-state-hover)] hover:text-foreground"
      >
        <CdsActionsPlusIcon className="size-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
