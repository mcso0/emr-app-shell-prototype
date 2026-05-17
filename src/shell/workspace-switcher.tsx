"use client";

import { WorkspaceLogoMarkIcon } from "@/components/icons";
import { CdsNavigationChevronDownIcon } from "@/components/cds-icons/navigation";
import { cn } from "@/lib/utils";

type WorkspaceSwitcherProps = {
  collapsed?: boolean;
  className?: string;
  workspaceId: string;
};

export function WorkspaceSwitcher({ collapsed = false, className, workspaceId }: WorkspaceSwitcherProps) {
  return (
    <button
      type="button"
      data-testid="workspace-switcher"
      className={cn(
        "flex h-10 items-center rounded-[var(--emr-radius-panel)] bg-[var(--emr-surface-panel)] text-[var(--emr-text-primary)] shadow-[var(--emr-shadow-control)] outline-none transition-[background-color,width] hover:bg-card focus-visible:ring-3 focus-visible:ring-ring/40",
        collapsed
          ? "w-12 justify-center px-0"
          : "w-full min-w-0 justify-start gap-2 px-3 text-[15px] font-semibold",
        className,
      )}
      aria-label={`${workspaceId} 워크스페이스 선택`}
    >
      <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-primary text-primary-foreground">
        <WorkspaceLogoMarkIcon className="size-7" aria-hidden="true" />
      </span>
      <span className={cn("truncate", collapsed && "sr-only")}>VIP 동물의료센터 청담점</span>
      <CdsNavigationChevronDownIcon
        className={cn("size-4 shrink-0 text-foreground", collapsed && "hidden")}
        aria-hidden="true"
      />
    </button>
  );
}
