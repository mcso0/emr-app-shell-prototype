"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  BellIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  HelpIcon,
  SettingsIcon,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useAuthClient } from "@/features/auth/auth-client";
import { cn } from "@/lib/utils";
import { AuthProfileMenu } from "@/shell/auth-profile-menu";
import { GlobalCommandPalette } from "@/shell/global-command-palette";
import { WorkspaceChromeTabs } from "@/shell/workspace-chrome-tabs";
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
    "rounded-[var(--emr-radius-control)] text-[var(--emr-text-tertiary)] hover:bg-[var(--emr-state-hover)] hover:text-[var(--emr-text-primary)] [&_svg]:size-4";
  const historyButtonClassName =
    "rounded-[var(--emr-radius-control)] text-muted-foreground hover:bg-[var(--emr-state-hover)] hover:text-foreground disabled:opacity-100 disabled:text-[var(--emr-text-disabled)] disabled:hover:bg-transparent disabled:hover:text-[var(--emr-text-disabled)]";
  const chromeTabs = tabs.map((tab) => ({
    id: tab.id,
    title: getDisplayTitle(tab),
  }));

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
      className="relative z-20 flex h-8 items-center gap-1.5 bg-[var(--emr-surface-app)]"
    >
      <GlobalCommandPalette triggerVariant="icon" workspaceId={workspaceId} />

      <Button
        variant="ghost"
        size="icon"
        aria-label="탭 뒤로가기"
        disabled={!canGoBack}
        onClick={onBack}
        className={historyButtonClassName}
      >
        <ChevronLeftIcon className="size-4" aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="탭 앞으로가기"
        disabled={!canGoForward}
        onClick={onForward}
        className={historyButtonClassName}
      >
        <ChevronRightIcon className="size-4" aria-hidden="true" />
      </Button>

      <div className="h-5 w-px shrink-0 bg-[var(--emr-line-default)]" />

      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <WorkspaceChromeTabs
          activeTabId={activeTabId}
          tabs={chromeTabs}
          onActivateTab={onActivateTab}
          onCloseTab={onCloseTab}
          onNewTab={onNewTab}
        />
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button variant="ghost" size="icon" className={topIconButtonClassName} aria-label="알림">
          <BellIcon className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" className={cn(topIconButtonClassName, "max-sm:hidden")} aria-label="도움말">
          <HelpIcon className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" className={cn(topIconButtonClassName, "max-sm:hidden")} aria-label="설정">
          <SettingsIcon className="size-4" />
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
