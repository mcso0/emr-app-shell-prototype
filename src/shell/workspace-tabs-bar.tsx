"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  BellIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  HelpIcon,
  SettingsIcon,
  WorkspaceLogoMarkIcon,
} from "@/components/icons";
import { CdsActionsPlusIcon } from "@/components/cds-icons/actions-and-controls";
import { CdsNavigationChevronDownIcon } from "@/components/cds-icons/navigation";
import { Button } from "@/components/ui/button";
import { useAuthClient } from "@/features/auth/auth-client";
import { cn } from "@/lib/utils";
import { AuthProfileMenu } from "@/shell/auth-profile-menu";
import { GlobalCommandPalette } from "@/shell/global-command-palette";
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

const mockShellUserProfiles: Record<string, { initial: string; name: string }> = {
  billing_admin: { initial: "HR", name: "정하린" },
  front_desk: { initial: "YN", name: "최유나" },
  hospital_admin: { initial: "MJ", name: "송민재" },
  nurse: { initial: "HY", name: "송하윤" },
  vet: { initial: "SJ", name: "이수지" },
};

const moduleActivityLabels: Record<string, string> = {
  billing: "수납",
  customer: "고객관리",
  dispensing: "조제",
  home: "홈",
  imaging: "영상",
  inpatient: "입원",
  lab: "검사",
  orders: "병원관리",
  reception: "접수/예약",
  treatment: "진료/차트",
};

function getModuleActivityLabel(pathname: string) {
  const moduleId = pathname.split("/")[3];
  return (moduleId && moduleActivityLabels[moduleId]) || "워크스페이스";
}

function getActiveMinutes(issuedAt?: string, now = Date.now()) {
  if (!issuedAt) return 0;

  const issuedTime = new Date(issuedAt).getTime();
  if (!Number.isFinite(issuedTime)) return 0;

  return Math.max(0, Math.floor((now - issuedTime) / 60000));
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
  const router = useRouter();
  const pathname = usePathname();
  const [now, setNow] = useState(() => Date.now());
  const { hydrated, session, hydrate, signOut } = useAuthClient();
  const hasMultipleTabs = tabs.length > 1;
  const roleLabel = hydrated && session ? session.roleLabel : "Guest";
  const userProfile =
    hydrated && session
      ? (mockShellUserProfiles[session.role] ?? {
          initial: session.roleLabel.slice(0, 2).toUpperCase(),
          name: session.roleLabel,
        })
      : { initial: "G", name: "Guest" };
  const activityModuleLabel = getModuleActivityLabel(pathname);
  const activeMinutes = getActiveMinutes(hydrated && session ? session.issuedAt : undefined, now);
  const activityLabel =
    hydrated && session
      ? `활동중 · ${activityModuleLabel} ${activeMinutes}분째`
      : "활동 대기";
  const topIconButtonClassName =
    "text-muted-foreground hover:bg-[var(--emr-state-hover)] hover:text-foreground";

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 60000);

    return () => window.clearInterval(interval);
  }, []);

  async function handleLogout() {
    await signOut();
    router.replace("/login");
  }

  return (
    <header
      data-testid="workspace-tabs-bar"
      className="relative z-20 flex h-[58px] items-center gap-2.5 bg-[var(--emr-surface-app)] px-2.5"
    >
      <button
        type="button"
        className="flex h-10 min-w-[240px] items-center justify-center gap-2 rounded-[var(--emr-radius-panel)] bg-[var(--emr-surface-panel)] px-3 text-[15px] font-semibold text-[var(--emr-text-primary)] shadow-[var(--emr-shadow-control)] outline-none transition-colors hover:bg-card focus-visible:ring-3 focus-visible:ring-ring/40"
        aria-label={`${workspaceId} 워크스페이스 선택`}
      >
        <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-primary text-primary-foreground">
          <WorkspaceLogoMarkIcon className="size-7" aria-hidden="true" />
        </span>
        <span className="truncate">VIP 동물의료센터 청담점</span>
        <CdsNavigationChevronDownIcon className="size-4 shrink-0 text-foreground" aria-hidden="true" />
      </button>

      <GlobalCommandPalette workspaceId={workspaceId} />

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
              role="presentation"
              className={cn(
                "relative flex h-10 max-w-[230px] min-w-0 items-center",
                active
                  ? "text-[var(--emr-text-primary)]"
                  : "text-[var(--emr-text-secondary)]",
              )}
            >
              <button
                type="button"
                role="tab"
                aria-selected={active}
                className={cn(
                  "flex h-10 min-w-0 flex-1 items-center truncate rounded-[var(--emr-radius-panel)] border py-0 pl-3 text-left text-[14px] font-semibold outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                  hasMultipleTabs ? "pr-9" : "pr-3",
                  active
                    ? "border-[var(--emr-line-container)] bg-card shadow-[var(--emr-shadow-control)]"
                    : "border-transparent bg-[var(--emr-surface-muted)] hover:bg-card",
                )}
                onClick={() => onActivateTab(tab.id)}
              >
                <span className="truncate">{displayTitle}</span>
              </button>
              {hasMultipleTabs ? (
                <button
                  type="button"
                  aria-label={`${displayTitle} 탭 닫기`}
                  className="absolute right-2 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground outline-none transition-colors hover:bg-[var(--emr-state-hover)] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
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

      <div className="flex shrink-0 items-center gap-1">
        <Button variant="ghost" size="icon" className={topIconButtonClassName} aria-label="알림">
          <BellIcon />
        </Button>
        <Button variant="ghost" size="icon" className={cn(topIconButtonClassName, "max-sm:hidden")} aria-label="도움말">
          <HelpIcon />
        </Button>
        <Button variant="ghost" size="icon" className={cn(topIconButtonClassName, "max-sm:hidden")} aria-label="설정">
          <SettingsIcon />
        </Button>
        <AuthProfileMenu
          activityLabel={activityLabel}
          roleLabel={roleLabel}
          userInitial={userProfile.initial}
          userName={userProfile.name}
          onLogout={handleLogout}
        />
      </div>
    </header>
  );
}
