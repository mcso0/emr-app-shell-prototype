"use client";

import { UserIcon } from "@/components/icons";
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
import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { formatCompactAvatarInitials } from "@/features/auth/personal-profile-session";

export type AuthProfileMenuProps = {
  activityLabel: string;
  avatarUrl?: string;
  roleLabel: string;
  userInitial: string;
  userName: string;
  onLogout: () => void | Promise<void>;
  profileHref: string;
};

export function AuthProfileMenu({
  activityLabel,
  avatarUrl,
  roleLabel,
  userInitial,
  userName,
  onLogout,
  profileHref,
}: AuthProfileMenuProps) {
  const compactInitials = formatCompactAvatarInitials(userInitial);

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
            "!h-[var(--emr-topbar-control-size)] !w-[var(--emr-topbar-profile-width)] !gap-[var(--emr-topbar-tab-inner-gap)] !border !border-[var(--emr-topbar-profile-border)] !bg-[var(--emr-topbar-profile-bg)] !p-[var(--clair-spacing-4)] !text-[var(--emr-topbar-icon)] !shadow-[var(--clair-shadow-xs)] hover:!border-[var(--emr-topbar-profile-border)] hover:!bg-[var(--emr-topbar-tab-hover-bg)] aria-expanded:!border-[var(--emr-topbar-profile-border)] aria-expanded:!bg-[var(--emr-topbar-tab-hover-bg)] aria-expanded:[&_svg[data-slot=profile-chevron]]:rotate-180",
        })}
      >
        <Avatar
          size="sm"
          className="size-[var(--clair-spacing-24)] bg-[var(--emr-topbar-profile-avatar-bg)] after:border-[var(--emr-topbar-profile-avatar-border)]"
        >
          {avatarUrl ? (
            <AvatarImage
              data-testid="top-menu-profile-avatar-image"
              src={avatarUrl}
              alt=""
            />
          ) : null}
          <AvatarFallback
            data-testid="top-menu-profile-avatar-fallback"
            className="bg-[var(--emr-topbar-profile-avatar-bg)] text-[var(--emr-type-size-micro)] font-medium leading-[var(--emr-type-leading-micro)] tracking-[var(--emr-type-tracking-micro)] ![color:var(--emr-topbar-profile-avatar-text)]"
          >
            {compactInitials}
          </AvatarFallback>
          <AvatarBadge className="!size-[var(--clair-spacing-6)] !bg-[var(--emr-status-success-text)] !ring-1 !ring-[var(--emr-topbar-profile-bg)]" />
        </Avatar>
        <CdsNavigationChevronDownIcon
          data-slot="profile-chevron"
          className="size-[var(--clair-spacing-12)] shrink-0 transition-transform duration-[var(--clair-motion-duration-fast)]"
          aria-hidden="true"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="w-52 p-1.5">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2 py-1.5">
            <span className="flex items-center gap-2">
              <Avatar className="size-7 bg-primary after:border-transparent">
                {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
                <AvatarFallback className="bg-primary text-[12px] font-bold leading-none text-primary-foreground">
                  {compactInitials}
                </AvatarFallback>
                <AvatarBadge className="!size-[9px] !bg-[var(--emr-status-success-text)] !ring-[1.5px] !ring-card" />
              </Avatar>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-[13px] font-semibold leading-4 text-foreground">
                  {userName}
                </span>
                <span className="truncate text-[11px] font-normal leading-4 text-muted-foreground">
                  {roleLabel}
                </span>
              </span>
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <div className="px-2 pb-1 text-[11px] leading-4 text-[var(--emr-text-tertiary)]">
          {activityLabel}
        </div>
        <DropdownMenuSeparator />
        <a
          role="menuitem"
          href={profileHref}
          className="relative flex h-8 cursor-pointer select-none items-center gap-2 rounded-md px-1.5 py-1 text-sm outline-hidden hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
        >
          <UserIcon className="size-4 text-muted-foreground" aria-hidden="true" />
          개인 설정
        </a>
        <DropdownMenuItem className="h-8 cursor-pointer gap-2" onClick={() => void onLogout()}>
          <CdsNavigationLogOutIcon className="size-4 text-muted-foreground" aria-hidden="true" />
          로그아웃
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
