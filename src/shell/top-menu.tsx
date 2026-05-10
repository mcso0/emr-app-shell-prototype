"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  BellIcon,
  CommandIcon,
  HelpIcon,
  SearchIcon,
  SettingsIcon,
  WorkspaceLogoMarkIcon,
} from "@/components/icons";
import { CdsNavigationChevronDownIcon } from "@/components/cds-icons/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useAuthClient } from "@/features/auth/auth-client";

export function TopMenu({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const { hydrated, session, hydrate, signOut } = useAuthClient();
  const roleLabel = hydrated && session ? session.roleLabel : "Guest";
  const roleId = hydrated && session ? session.role : "mock";
  const roleInitial = hydrated && session ? session.roleLabel.slice(0, 1) : "G";
  const topIconButtonClassName =
    "text-[var(--clair-color-label-alternative)] hover:bg-[var(--clair-color-fill-alternative)] hover:text-[var(--clair-color-label-strong)]";

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  async function handleLogout() {
    await signOut();
    router.replace("/login");
  }

  return (
    <header className="relative z-20 flex h-[52px] items-center border-b border-[var(--clair-color-line-subtle)] bg-[#E9ECF2] px-2.5 shadow-[0_1px_0_rgba(26,32,44,0.03)]">
      <Button
        variant="outline"
        size="sm"
        className="h-8 w-[209px] justify-center gap-1 rounded-[var(--clair-radius-md)] border-[var(--clair-color-line-normal)] bg-white px-3 py-1.5 text-[14px] font-medium leading-5 tracking-[0.196px] text-[var(--clair-color-atomic-gray-900)] shadow-none hover:border-[var(--clair-color-line-strong)] hover:bg-[var(--clair-color-background-surface)]"
        aria-label={`${workspaceId} 워크스페이스 선택`}
      >
        <span className="flex size-4 shrink-0 items-center justify-center overflow-hidden rounded-[var(--clair-radius-atomic-6)] bg-[var(--clair-color-primary-normal)] text-white">
          <WorkspaceLogoMarkIcon className="size-4" aria-hidden="true" />
        </span>
        <span className="flex min-w-0 shrink-0 items-center justify-center gap-1 px-0.5">
          <span className="whitespace-nowrap">VIP 동물의료센터</span>
          <span className="whitespace-nowrap">청담점</span>
        </span>
        <CdsNavigationChevronDownIcon className="size-4 shrink-0 text-black" aria-hidden="true" />
      </Button>
      <Separator orientation="vertical" className="mx-2 hidden h-6" />
      <div className="mx-auto flex h-8 w-[560px] items-center rounded-lg border border-[var(--clair-color-line-normal)] bg-[var(--clair-color-background-surface)] px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]">
        <SearchIcon className="size-3.5 text-muted-foreground" />
        <Input
          className="h-8 border-0 bg-transparent px-2 text-sm shadow-none focus-visible:ring-0"
          placeholder="동물명 또는 보호자명으로 검색"
        />
        <CommandIcon className="size-3 text-muted-foreground" />
        <span className="ml-1 text-[11px] text-muted-foreground">K</span>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon-sm" className={topIconButtonClassName} aria-label="알림">
          <BellIcon />
        </Button>
        <Button variant="ghost" size="icon-sm" className={topIconButtonClassName} aria-label="도움말">
          <HelpIcon />
        </Button>
        <Button variant="ghost" size="icon-sm" className={topIconButtonClassName} aria-label="설정">
          <SettingsIcon />
        </Button>
        <div
          className="ml-1 flex h-8 max-w-[180px] items-center gap-2 rounded-[var(--clair-radius-full)] border border-[var(--clair-color-line-normal)] bg-white px-1.5 pr-2.5 shadow-[0_1px_1px_rgba(26,32,44,0.03)]"
          aria-label={`mock auth role ${roleLabel}`}
          data-testid="top-menu-mock-user"
        >
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--clair-color-status-info-background)] text-[11px] font-semibold text-[var(--clair-color-status-info-foreground)]">
            {roleInitial}
          </span>
          <span className="flex min-w-0 flex-col leading-none">
            <span className="truncate text-[11px] font-semibold text-[var(--clair-color-label-strong)]">
              {roleLabel}
            </span>
            <span className="truncate text-[10px] text-[var(--clair-color-label-neutral)]">
              {roleId}
            </span>
          </span>
        </div>
        <Button variant="ghost" size="sm" className="text-[var(--clair-color-label-alternative)] hover:bg-[var(--clair-color-fill-alternative)] hover:text-[var(--clair-color-label-strong)]" onClick={handleLogout}>
          로그아웃
        </Button>
      </div>
    </header>
  );
}
