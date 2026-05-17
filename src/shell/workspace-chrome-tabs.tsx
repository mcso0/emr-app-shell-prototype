"use client";

import { CdsActionsPlusIcon } from "@/components/cds-icons/actions-and-controls";
import { CloseIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type WorkspaceChromeTabItem = {
  id: string;
  title: string;
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

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5" role="tablist" aria-label="열린 업무 탭">
      {tabs.map((tab) => {
        const active = tab.id === activeTabId;

        return (
          <div
            key={tab.id}
            role="presentation"
            className={cn(
              "group/workspace-tab relative flex h-8 max-w-[230px] min-w-0 items-center rounded-[var(--emr-radius-control)] border transition-colors",
              active
                ? "border-[var(--emr-line-default)] bg-card shadow-sm"
                : "border-transparent bg-transparent hover:bg-[var(--emr-state-hover)]",
            )}
          >
            <Button
              type="button"
              role="tab"
              variant="ghost"
              size="default"
              aria-selected={active}
              className={cn(
                "h-8 min-w-0 flex-1 justify-start truncate rounded-[var(--emr-radius-control)] border-transparent bg-transparent py-0 pl-2.5 text-left text-[13px] font-semibold tracking-normal shadow-none hover:bg-transparent",
                hasMultipleTabs ? "pr-8" : "pr-2.5",
                active
                  ? "text-[var(--emr-text-primary)] hover:text-[var(--emr-text-primary)]"
                  : "text-[var(--emr-text-tertiary)] hover:text-[var(--emr-text-secondary)] group-hover/workspace-tab:text-[var(--emr-text-secondary)]",
              )}
              onClick={() => onActivateTab(tab.id)}
            >
              <span className="truncate">{tab.title}</span>
            </Button>
            {hasMultipleTabs ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`${tab.title} 탭 닫기`}
                className="absolute right-1.5 size-5 rounded-full bg-transparent text-[var(--emr-text-tertiary)] hover:bg-transparent hover:text-[var(--emr-text-tertiary)]"
                onClick={() => onCloseTab(tab.id)}
              >
                <CloseIcon className="size-3.5" aria-hidden="true" />
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
        className="shrink-0 rounded-[var(--emr-radius-control)] hover:bg-[var(--emr-state-hover)] hover:text-foreground"
      >
        <CdsActionsPlusIcon className="size-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
