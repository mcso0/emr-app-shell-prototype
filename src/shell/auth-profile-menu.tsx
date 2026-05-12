"use client";

import { CdsNavigationChevronDownIcon, CdsNavigationLogOutIcon } from "@/components/cds-icons/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buttonVariants } from "@/components/ui/button";

export type AuthProfileMenuProps = {
  activityLabel: string;
  roleLabel: string;
  userInitial: string;
  userName: string;
  onLogout: () => void | Promise<void>;
};

export function AuthProfileMenu({
  activityLabel,
  roleLabel,
  userInitial,
  userName,
  onLogout,
}: AuthProfileMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${userName} 프로필 메뉴`}
        data-testid="top-menu-mock-user"
        className={buttonVariants({
          variant: "ghost",
          size: "sm",
          roundness: "round",
          className:
            "ml-1 h-8 w-11 gap-0.5 border border-transparent bg-white px-[3px] py-1 text-[var(--clair-color-label-neutral)] shadow-[0_1px_1px_rgba(26,32,44,0.03)] hover:border-[var(--clair-color-line-normal)] hover:bg-[var(--clair-color-background-surface)] aria-expanded:border-[var(--clair-color-line-strong)] aria-expanded:bg-[var(--clair-color-background-surface)] aria-expanded:[&_svg[data-slot=profile-chevron]]:rotate-180",
        })}
      >
        <span className="relative flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--clair-color-atomic-gray-800)] text-[12px] font-bold leading-none text-white">
          {userInitial}
          <span className="absolute -bottom-0.5 -right-0.5 size-[9px] rounded-full border-[1.5px] border-white bg-[var(--clair-color-status-positive-foreground)]" />
        </span>
        <CdsNavigationChevronDownIcon
          data-slot="profile-chevron"
          className="size-2.5 shrink-0 transition-transform duration-[var(--clair-motion-duration-fast)]"
          aria-hidden="true"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="w-52 p-1.5">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2 py-1.5">
            <span className="flex items-center gap-2">
              <span className="relative flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--clair-color-atomic-gray-800)] text-[12px] font-bold leading-none text-white">
                {userInitial}
                <span className="absolute -bottom-0.5 -right-0.5 size-[9px] rounded-full border-[1.5px] border-white bg-[var(--clair-color-status-positive-foreground)]" />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-[13px] font-semibold leading-4 text-[var(--clair-color-label-strong)]">
                  {userName}
                </span>
                <span className="truncate text-[11px] font-normal leading-4 text-[var(--clair-color-label-neutral)]">
                  {roleLabel}
                </span>
              </span>
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <div className="px-2 pb-1 text-[11px] leading-4 text-[var(--clair-color-label-assistive)]">
          {activityLabel}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="h-8 cursor-pointer gap-2" onClick={() => void onLogout()}>
          <CdsNavigationLogOutIcon className="size-4 text-[var(--clair-color-label-alternative)]" aria-hidden="true" />
          로그아웃
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
