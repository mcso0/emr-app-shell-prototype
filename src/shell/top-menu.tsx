"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  BellIcon,
  HelpIcon,
  SettingsIcon,
  WorkspaceLogoMarkIcon,
} from "@/components/icons";
import { CdsNavigationChevronDownIcon } from "@/components/cds-icons/navigation";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuthClient } from "@/features/auth/auth-client";
import { cn } from "@/lib/utils";
import { AuthProfileMenu } from "@/shell/auth-profile-menu";
import { GlobalCommandPalette } from "@/shell/global-command-palette";

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

export function TopMenu({ workspaceId }: { workspaceId: string }) {
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
    <header className="relative z-20 flex h-[52px] items-center bg-[var(--emr-surface-app)] px-2.5">
      <Button
        variant="outline"
        size="sm"
        className="h-8 w-[209px] justify-center gap-1 rounded-[var(--clair-radius-md)] border-border bg-card px-3 py-1.5 text-[14px] font-medium leading-5 tracking-[0.196px] text-foreground shadow-none hover:border-[var(--emr-line-strong)] hover:bg-[var(--emr-state-hover)] max-sm:w-11 max-sm:px-2"
        aria-label={`${workspaceId} 워크스페이스 선택`}
      >
        <span className="flex size-4 shrink-0 items-center justify-center overflow-hidden rounded-[var(--clair-radius-atomic-6)] bg-primary text-primary-foreground">
          <WorkspaceLogoMarkIcon className="size-4" aria-hidden="true" />
        </span>
        <span className="flex min-w-0 shrink-0 items-center justify-center gap-1 px-0.5 max-sm:hidden">
          <span className="whitespace-nowrap">VIP 동물의료센터</span>
          <span className="whitespace-nowrap">청담점</span>
        </span>
        <CdsNavigationChevronDownIcon className="size-4 shrink-0 text-foreground max-sm:hidden" aria-hidden="true" />
      </Button>
      <Separator orientation="vertical" className="mx-2 hidden h-6" />
      <GlobalCommandPalette workspaceId={workspaceId} />
      <div className="flex items-center gap-1">
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
