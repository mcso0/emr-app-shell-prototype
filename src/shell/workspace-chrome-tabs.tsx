"use client";

import { type MouseEvent } from "react";
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

const WORKSPACE_TAB_WIDTH_CLASS_NAME =
  "min-w-[var(--emr-topbar-tab-min-width)] max-w-[var(--emr-topbar-tab-max-width)]";
const workspaceTabButtonClassName =
  "h-[var(--emr-topbar-control-size)] min-w-0 flex-1 justify-start gap-0 truncate rounded-[var(--emr-topbar-tab-radius)] border-transparent bg-transparent py-[var(--emr-topbar-tab-padding-y)] pl-[var(--emr-topbar-tab-padding-x)] pr-[var(--emr-topbar-tab-padding-right)] text-left [font-size:var(--emr-type-size-body)] font-medium ![letter-spacing:var(--emr-type-tracking-section)] [line-height:var(--emr-type-leading-body)] shadow-none hover:bg-transparent";
const workspaceTabCloseClassName =
  "mr-[var(--emr-topbar-tab-padding-x)] flex size-[var(--emr-topbar-tab-close-size)] shrink-0 items-center justify-center rounded-full bg-transparent p-0 text-[var(--emr-topbar-tab-close)] opacity-0 transition-opacity duration-[var(--emr-topbar-motion-duration)] pointer-events-none hover:bg-transparent hover:text-[var(--emr-topbar-tab-active-close)] group-hover/workspace-tab:pointer-events-auto group-hover/workspace-tab:opacity-100 group-focus-within/workspace-tab:pointer-events-auto group-focus-within/workspace-tab:opacity-100 motion-reduce:transition-none";
const workspaceTabIconFrameClassName =
  "flex size-[var(--clair-spacing-16)] shrink-0 items-center justify-center text-[var(--emr-topbar-tab-icon)]";
const workspaceTabTooltipClassName =
  "max-w-[260px] flex-col items-start gap-0.5 px-2.5 py-2 text-left";

export function WorkspaceChromeTabs({
  activeTabId,
  tabs,
  onActivateTab,
  onCloseTab,
  onNewTab,
}: WorkspaceChromeTabsProps) {
  const hasMultipleTabs = tabs.length > 1;

  return (
    <div
      className="hidden min-w-0 flex-1 items-center gap-[var(--emr-topbar-tab-gap)] sm:flex"
      role="tablist"
      aria-label="열린 업무 탭"
    >
      {tabs.map((tab) => {
        const active = tab.id === activeTabId;
        const TabIcon = tab.icon;

        function handleCloseTab(event: MouseEvent<HTMLButtonElement>) {
          event.stopPropagation();
          onCloseTab(tab.id);
        }

        return (
          <div
            key={tab.id}
            role="presentation"
            className={cn(
              "group/workspace-tab relative flex h-[var(--emr-topbar-control-size)] min-w-0 items-center gap-[var(--emr-topbar-tab-inner-gap)] rounded-[var(--emr-topbar-tab-radius)] border transition-colors",
              WORKSPACE_TAB_WIDTH_CLASS_NAME,
              active
                ? "border-[var(--emr-topbar-tab-active-border)] bg-[var(--emr-topbar-tab-active-bg)] shadow-[var(--emr-topbar-tab-active-shadow)]"
                : "border-transparent bg-[var(--emr-topbar-tab-bg)] hover:border-transparent hover:bg-[var(--emr-topbar-tab-hover-bg)]",
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
                      workspaceTabButtonClassName,
                      hasMultipleTabs && "pr-0",
                      active
                        ? "text-[var(--emr-topbar-tab-active-text)] hover:text-[var(--emr-topbar-tab-active-text)]"
                        : "text-[var(--emr-topbar-tab-text)] hover:text-[var(--emr-topbar-tab-active-text)] group-hover/workspace-tab:text-[var(--emr-topbar-tab-active-text)]",
                    )}
                    onClick={() => onActivateTab(tab.id)}
                  >
                    <span className="flex min-w-0 items-center gap-[var(--emr-topbar-tab-inner-gap)]">
                      {TabIcon ? (
                        <span
                          className={cn(
                            workspaceTabIconFrameClassName,
                            active && "text-[var(--emr-topbar-tab-active-icon)]",
                          )}
                          aria-hidden="true"
                        >
                          <TabIcon
                            className={cn(
                              "origin-center scale-[var(--emr-topbar-tab-icon-scale)] text-current",
                              tab.iconClassName
                            )}
                          />
                        </span>
                      ) : null}
                      <span className="truncate px-[var(--emr-topbar-tab-label-padding-x)]">{tab.title}</span>
                    </span>
                  </Button>
                }
              />
              <TooltipContent
                side="bottom"
                align="start"
                sideOffset={8}
                className={workspaceTabTooltipClassName}
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
                  workspaceTabCloseClassName,
                  active && "text-[var(--emr-topbar-tab-active-close)]",
                )}
                onClick={handleCloseTab}
              >
                <CircleCloseFillIcon className="size-[var(--emr-topbar-tab-close-size)]" aria-hidden="true" />
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
        className="size-[var(--emr-topbar-control-size)] shrink-0 rounded-[var(--emr-topbar-control-radius)] border-transparent bg-transparent text-[var(--emr-topbar-icon)] shadow-none hover:bg-[var(--emr-topbar-tab-hover-bg)] hover:text-[var(--emr-topbar-icon-strong)]"
      >
        <CdsActionsPlusIcon className="size-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
