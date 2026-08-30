"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  BellIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  HelpIcon,
} from "@/components/icons";
import { EmrMotionIcon } from "@/components/emr/motion-icon";
import { Button } from "@/components/ui/button";
import { useAuthClient } from "@/features/auth/auth-client";
import { useCurrentPersonalProfile } from "@/features/auth/use-current-personal-profile";
import { cn } from "@/lib/utils";
import {
  getMockEncounterBundle,
  getMockPatientBundle,
  mockImagingStudies,
  mockInvoices,
  mockLabResults,
} from "@/mocks/emr-domain";
import { AuthProfileMenu } from "@/shell/auth-profile-menu";
import { workspaceTabIconById } from "@/shell/module-nav-icons";
import { WorkspaceChromeTabs } from "@/shell/workspace-chrome-tabs";
import { useLayoutStore } from "@/stores/layout-store";
import type { WorkspaceTab } from "@/stores/workspace-tabs-store";
import refreshMotionIcon from "../../icons/motionIcon/iconly-icon-export-1782380161.json";

type WorkspaceTabsBarProps = {
  activeTabId: string | null;
  canGoBack: boolean;
  canGoForward: boolean;
  isRefreshing?: boolean;
  notificationBadgeCount: number;
  notificationDrawerOpen: boolean;
  refreshLabel?: string;
  tabs: WorkspaceTab[];
  onActivateTab: (tabId: string) => void;
  onBack: () => void;
  onCloseTab: (tabId: string) => void;
  onForward: () => void;
  onNewTab: () => void;
  onOpenNotifications: () => void;
  onRefresh?: () => void;
};

function getDisplayTitle(tab: WorkspaceTab) {
  if (tab.moduleId === "dispensing") return "조제/처치";
  return tab.title;
}

const moduleActivityLabels: Record<string, string> = {
  billing: "수납",
  customer: "고객관리",
  dispensing: "조제",
  home: "원내 현황",
  imaging: "영상",
  inpatient: "입원",
  lab: "검사",
  orders: "병원관리",
  reception: "접수/예약",
  treatment: "진료/차트",
};

type WorkspaceTabPreview = {
  description: string;
  title: string;
};

function getModuleActivityLabel(pathname: string) {
  const moduleId = pathname.split("/")[3];
  return (moduleId && moduleActivityLabels[moduleId]) || "워크스페이스";
}

function getTabRouteSearchParam(tab: WorkspaceTab, key: string) {
  const route = tab.history[tab.historyIndex] ?? tab.history.at(-1) ?? "";
  const search = route.split("?")[1] ?? "";

  return new URLSearchParams(search).get(key) ?? undefined;
}

function getTabEncounterId(tab: WorkspaceTab) {
  if (tab.encounterId) return tab.encounterId;

  if (tab.moduleId === "billing") {
    const invoiceId = getTabRouteSearchParam(tab, "invoiceId");
    return mockInvoices.find((item) => item.id === invoiceId)?.encounterId;
  }

  if (tab.moduleId === "reception") {
    return getTabRouteSearchParam(tab, "encounterId");
  }

  if (tab.moduleId === "imaging") {
    const imagingStudyId = getTabRouteSearchParam(tab, "imagingStudyId");
    return mockImagingStudies.find((item) => item.id === imagingStudyId)?.encounterId;
  }

  if (tab.moduleId === "lab") {
    const labResultId = getTabRouteSearchParam(tab, "labResultId");
    return mockLabResults.find((item) => item.id === labResultId)?.encounterId;
  }

  return undefined;
}

function getTabPatientId(tab: WorkspaceTab) {
  if (tab.patientId) return tab.patientId;
  if (tab.surfaceType === "patient") return tab.surfaceId;

  if (tab.moduleId === "billing") {
    const invoiceId = getTabRouteSearchParam(tab, "invoiceId");
    const encounterId = mockInvoices.find((item) => item.id === invoiceId)?.encounterId;
    return encounterId ? getMockEncounterBundle(encounterId)?.patient.id : undefined;
  }

  if (tab.moduleId === "reception") {
    return getTabRouteSearchParam(tab, "patientId");
  }

  if (tab.moduleId === "imaging") {
    const imagingStudyId = getTabRouteSearchParam(tab, "imagingStudyId");
    return mockImagingStudies.find((item) => item.id === imagingStudyId)?.patientId;
  }

  if (tab.moduleId === "lab") {
    const labResultId = getTabRouteSearchParam(tab, "labResultId");
    return mockLabResults.find((item) => item.id === labResultId)?.patientId;
  }

  return undefined;
}

function getTabPreview(tab: WorkspaceTab): WorkspaceTabPreview {
  const displayTitle = getDisplayTitle(tab);

  if (tab.moduleId === "home") {
    return {
      title: "업무 요약",
      description: "오늘의 다음 행동과 운영 병목을 한눈에 확인",
    };
  }

  const encounterId = getTabEncounterId(tab);
  const patientId = getTabPatientId(tab);
  const encounterBundle = encounterId ? getMockEncounterBundle(encounterId) : null;
  const patientBundle =
    encounterBundle ?? (patientId ? getMockPatientBundle(patientId) : null);
  const patient = patientBundle?.patient;
  const guardian =
    patientBundle && "primaryGuardian" in patientBundle
      ? patientBundle.primaryGuardian
      : undefined;
  const encounter =
    encounterBundle?.encounter ??
    (encounterId && patientBundle && "encounters" in patientBundle
      ? patientBundle.encounters.find((item) => item.id === encounterId)
      : undefined);
  const workDetail = encounter?.chiefComplaint ?? encounter?.visitPurpose;

  if (!patient) {
    return {
      title: displayTitle,
      description: "환자 맥락 없는 업무 탭",
    };
  }

  return {
    title: guardian?.name ? `${patient.name} · ${guardian.name}` : patient.name,
    description: [displayTitle, workDetail].filter(Boolean).join(" · "),
  };
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
  isRefreshing,
  notificationBadgeCount,
  notificationDrawerOpen,
  refreshLabel,
  tabs,
  onActivateTab,
  onBack,
  onCloseTab,
  onForward,
  onNewTab,
  onOpenNotifications,
  onRefresh,
}: WorkspaceTabsBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [now, setNow] = useState(() => Date.now());
  const [refreshMotionSignal, setRefreshMotionSignal] = useState(0);
  const modulePanelOpen = useLayoutStore((state) => state.modulePanelOpen);
  const { hydrated, session, hydrate, signOut } = useAuthClient();
  const personalProfile = useCurrentPersonalProfile({ hydrated, session });
  const roleLabel = hydrated && session ? session.roleLabel : "Guest";
  const userProfile =
    hydrated && session && personalProfile
      ? {
          avatarUrl: personalProfile.avatarUrl,
          initial: personalProfile.initials,
          name: personalProfile.displayName,
        }
      : { avatarUrl: undefined, initial: "G", name: "Guest" };
  const activityModuleLabel = getModuleActivityLabel(pathname);
  const activeMinutes = getActiveMinutes(hydrated && session ? session.issuedAt : undefined, now);
  const activityLabel =
    hydrated && session
      ? `활동중 · ${activityModuleLabel} ${activeMinutes}분째`
      : "활동 대기";
  const topIconButtonClassName =
    "size-[var(--emr-topbar-control-size)] rounded-[var(--emr-topbar-control-radius)] border-transparent bg-transparent text-[var(--emr-topbar-icon)] shadow-none hover:bg-[var(--emr-topbar-tab-hover-bg)] hover:text-[var(--emr-topbar-icon-strong)] hover:shadow-none [&_svg]:size-4";
  const historyButtonClassName =
    "size-[var(--emr-topbar-control-size)] rounded-[var(--emr-topbar-control-radius)] border-transparent bg-transparent text-[var(--emr-topbar-icon-strong)] shadow-none hover:bg-[var(--emr-topbar-tab-hover-bg)] hover:text-[var(--emr-topbar-icon-strong)] hover:shadow-none active:bg-[var(--emr-topbar-tab-hover-bg)] disabled:border-transparent disabled:bg-transparent disabled:text-[var(--emr-topbar-icon-strong)] disabled:opacity-[var(--emr-topbar-disabled-opacity)] disabled:shadow-none disabled:hover:bg-transparent disabled:hover:text-[var(--emr-topbar-icon-strong)]";
  const chromeTabs = tabs.map((tab) => {
    const preview = getTabPreview(tab);

    return {
      icon: workspaceTabIconById[tab.moduleId]?.icon,
      iconClassName: cn(
        workspaceTabIconById[tab.moduleId]?.iconClassName,
        tab.moduleId === "lab" && "translate-y-px",
      ),
      id: tab.id,
      title: getDisplayTitle(tab),
      tooltipDescription: preview.description,
      tooltipTitle: preview.title,
    };
  });

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
    router.replace("/login?reason=signed_out");
  }

  function handleRefreshClick() {
    setRefreshMotionSignal((value) => value + 1);
    onRefresh?.();
  }

  const profileHref = `/profile?${new URLSearchParams({ returnTo: pathname }).toString()}`;

  return (
    <header
      data-testid="workspace-tabs-bar"
      data-module-panel={modulePanelOpen ? "open" : "closed"}
      className="relative z-20 flex h-[var(--emr-topbar-control-size)] items-center gap-[var(--emr-topbar-section-gap)] bg-[var(--emr-surface-app)]"
    >
      <div
        data-testid="workspace-topbar-leading-slot"
        className={cn(
          "relative flex min-w-0 flex-1 items-center gap-[var(--emr-topbar-item-gap)]",
        )}
      >
        <div
          data-testid="workspace-history-controls"
          className={cn(
            "flex shrink-0 items-center gap-[var(--emr-topbar-history-gap)]",
            modulePanelOpen &&
              "md:absolute md:left-[calc(-1*var(--emr-topbar-open-history-shift))] md:top-0"
          )}
        >
          <Button
            variant="ghost"
            size="icon"
            aria-label={refreshLabel ?? `${activityModuleLabel} 새로고침`}
            disabled={!onRefresh || isRefreshing}
            onClick={handleRefreshClick}
            className={historyButtonClassName}
          >
            <EmrMotionIcon
              animationData={refreshMotionIcon}
              autoplay={false}
              className="size-4"
              loop={false}
              playSignal={refreshMotionSignal}
            />
          </Button>
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
        </div>

        <WorkspaceChromeTabs
          activeTabId={activeTabId}
          tabs={chromeTabs}
          onActivateTab={onActivateTab}
          onCloseTab={onCloseTab}
          onNewTab={onNewTab}
        />
      </div>

      <div className="flex shrink-0 items-center gap-[var(--emr-topbar-action-gap)]">
        <Button
          variant="ghost"
          size="icon"
          className={cn(topIconButtonClassName, "relative")}
          aria-label={
            notificationBadgeCount > 0
              ? `알림 센터 열기, 중요 알림 ${notificationBadgeCount}개`
              : "알림 센터 열기"
          }
          aria-controls="global-notification-drawer"
          aria-expanded={notificationDrawerOpen}
          onClick={onOpenNotifications}
        >
          <BellIcon className="size-4" aria-hidden="true" />
          {notificationBadgeCount > 0 ? (
            <span
              data-testid="global-notification-badge"
              className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--emr-status-danger-text)] px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-[var(--emr-surface-app)]"
            >
              {notificationBadgeCount > 99 ? "99+" : notificationBadgeCount}
            </span>
          ) : null}
        </Button>
        <Button variant="ghost" size="icon" className={cn(topIconButtonClassName, "max-sm:hidden")} aria-label="도움말">
          <HelpIcon className="size-4" />
        </Button>
        <AuthProfileMenu
          activityLabel={activityLabel}
          avatarUrl={userProfile.avatarUrl}
          roleLabel={roleLabel}
          userInitial={userProfile.initial}
          userName={userProfile.name}
          onLogout={handleLogout}
          profileHref={profileHref}
        />
      </div>
    </header>
  );
}
