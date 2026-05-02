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
import { useMockAuthStore } from "@/features/auth/session-store";

export function TopMenu({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const hydrated = useMockAuthStore((state) => state.hydrated);
  const session = useMockAuthStore((state) => state.session);
  const hydrate = useMockAuthStore((state) => state.hydrate);
  const logout = useMockAuthStore((state) => state.logout);
  const roleLabel = hydrated && session ? session.roleLabel : "Guest";
  const roleId = hydrated && session ? session.role : "mock";
  const roleInitial = hydrated && session ? session.roleLabel.slice(0, 1) : "G";

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <header className="flex h-[52px] items-center px-2.5">
      <Button
        variant="outline"
        size="sm"
        className="h-8 w-[209px] justify-center gap-1 rounded-[var(--clair-radius-md)] border-[var(--clair-color-atomic-gray-200)] bg-white px-3 py-1.5 text-[14px] font-medium leading-5 tracking-[0.196px] text-[var(--clair-color-atomic-gray-900)] hover:bg-white"
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
      <div className="mx-auto flex h-8 w-[560px] items-center rounded-lg border border-input bg-card px-3">
        <SearchIcon className="size-3.5 text-muted-foreground" />
        <Input
          className="h-8 border-0 bg-transparent px-2 text-sm shadow-none focus-visible:ring-0"
          placeholder="동물명 또는 보호자명으로 검색"
        />
        <CommandIcon className="size-3 text-muted-foreground" />
        <span className="ml-1 text-[11px] text-muted-foreground">K</span>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon-sm" aria-label="알림">
          <BellIcon />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="도움말">
          <HelpIcon />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="설정">
          <SettingsIcon />
        </Button>
        <div
          className="ml-1 flex h-8 max-w-[180px] items-center gap-2 rounded-[var(--clair-radius-full)] border border-[var(--clair-color-line-normal)] bg-white px-1.5 pr-2.5"
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
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          로그아웃
        </Button>
      </div>
    </header>
  );
}
