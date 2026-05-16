"use client";

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  SearchIcon,
  WorkspaceLogoMarkIcon,
} from "@/components/icons";
import { CdsActionsPlusIcon } from "@/components/cds-icons/actions-and-controls";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { WorkspaceTab } from "@/stores/workspace-tabs-store";

type WorkspaceTabsBarProps = {
  activeTabId: string | null;
  canGoBack: boolean;
  canGoForward: boolean;
  tabs: WorkspaceTab[];
  workspaceId: string;
  onActivateTab: (tabId: string) => void;
  onBack: () => void;
  onCloseTab: (tabId: string) => void;
  onForward: () => void;
  onNewTab: () => void;
};

function getDisplayTitle(tab: WorkspaceTab) {
  if (tab.moduleId === "dispensing") return "조제/처치";
  return tab.title;
}

export function WorkspaceTabsBar({
  activeTabId,
  canGoBack,
  canGoForward,
  tabs,
  workspaceId,
  onActivateTab,
  onBack,
  onCloseTab,
  onForward,
  onNewTab,
}: WorkspaceTabsBarProps) {
  const hasMultipleTabs = tabs.length > 1;

  return (
    <header
      data-testid="workspace-tabs-bar"
      className="relative z-20 flex h-[58px] items-center gap-2.5 bg-[var(--emr-surface-app)] px-2.5"
    >
      <button
        type="button"
        className="flex h-10 min-w-[240px] items-center gap-2 rounded-[var(--emr-radius-panel)] bg-[var(--emr-surface-panel)] px-3 text-[15px] font-semibold text-[var(--emr-text-primary)] shadow-[var(--emr-shadow-control)]"
        aria-label={`${workspaceId} 워크스페이스 선택`}
      >
        <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-primary text-primary-foreground">
          <WorkspaceLogoMarkIcon className="size-7" aria-hidden="true" />
        </span>
        <span className="truncate">VIP 동물의료센터 청담점</span>
      </button>

      <Button
        variant="outline"
        size="icon"
        aria-label="전역 통합 검색 열기"
        className="size-10 rounded-[var(--emr-radius-panel)]"
      >
        <SearchIcon className="size-5" aria-hidden="true" />
      </Button>

      <Button
        variant="outline"
        size="icon"
        aria-label="탭 뒤로가기"
        disabled={!canGoBack}
        onClick={onBack}
        className="size-10 rounded-[var(--emr-radius-panel)]"
      >
        <ChevronLeftIcon className="size-5" aria-hidden="true" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        aria-label="탭 앞으로가기"
        disabled={!canGoForward}
        onClick={onForward}
        className="size-10 rounded-[var(--emr-radius-panel)]"
      >
        <ChevronRightIcon className="size-5" aria-hidden="true" />
      </Button>

      <div className="h-7 w-px shrink-0 bg-[var(--emr-line-container)]" />

      <div
        className="flex min-w-0 flex-1 items-center gap-2.5"
        role="tablist"
        aria-label="열린 업무 탭"
      >
        {tabs.map((tab) => {
          const active = tab.id === activeTabId;
          const displayTitle = getDisplayTitle(tab);

          return (
            <div
              key={tab.id}
              className={cn(
                "flex h-10 max-w-[230px] items-center gap-2 rounded-[var(--emr-radius-panel)] border px-3 text-[14px] font-semibold outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                active
                  ? "border-[var(--emr-line-container)] bg-card text-[var(--emr-text-primary)] shadow-[var(--emr-shadow-control)]"
                  : "border-transparent bg-[var(--emr-surface-muted)] text-[var(--emr-text-secondary)] hover:bg-card",
              )}
            >
              <button
                type="button"
                role="tab"
                aria-selected={active}
                className="min-w-0 flex-1 truncate text-left outline-none"
                onClick={() => onActivateTab(tab.id)}
              >
                {displayTitle}
              </button>
              {hasMultipleTabs ? (
                <button
                  type="button"
                  aria-label={`${displayTitle} 탭 닫기`}
                  className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
                  onClick={() => onCloseTab(tab.id)}
                >
                  <CloseIcon className="size-3.5" aria-hidden="true" />
                </button>
              ) : null}
            </div>
          );
        })}

        <Button
          variant="ghost"
          size="icon"
          aria-label="새 업무 탭"
          onClick={onNewTab}
          className="size-10 shrink-0 rounded-[var(--emr-radius-panel)]"
        >
          <CdsActionsPlusIcon className="size-5" aria-hidden="true" />
        </Button>
      </div>
    </header>
  );
}
