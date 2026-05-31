"use client";

import { WorkspaceLogoMarkIcon } from "@/components/icons";
import { CdsNavigationChevronDownIcon } from "@/components/cds-icons/navigation";
import { Button } from "@/components/ui/button";
import { useSessionWorkspaceDisplayName } from "@/features/auth/workspace-display";
import { cn } from "@/lib/utils";

type WorkspaceSwitcherProps = {
  collapsed?: boolean;
  className?: string;
  workspaceId: string;
};

export function WorkspaceSwitcher({ collapsed = false, className, workspaceId }: WorkspaceSwitcherProps) {
  const workspaceDisplayName = useSessionWorkspaceDisplayName(workspaceId);

  return (
    <Button
      type="button"
      variant="ghost"
      size="default"
      data-testid="workspace-switcher"
      className={cn(
        "h-8 items-center justify-center gap-[var(--clair-border-width-atomic-4)] rounded-[var(--clair-radius-atomic-8)] border border-[var(--emr-workspace-button-border)] bg-[var(--emr-workspace-button-bg)] px-[var(--clair-spacing-8)] py-[var(--clair-radius-atomic-6)] text-[14px] font-medium leading-5 tracking-[0.196px] text-[var(--emr-workspace-button-text)] shadow-[var(--clair-shadow-xs)] transition-[background-color,border-color,width] hover:border-[var(--emr-workspace-button-border)] hover:bg-[var(--emr-workspace-button-hover-bg)] hover:text-[var(--emr-workspace-button-text)] focus-visible:ring-ring/40 active:bg-[var(--emr-workspace-button-bg)] active:shadow-none",
        collapsed
          ? "w-14"
          : "w-fit max-w-full min-w-48",
        className,
      )}
      aria-label={`${workspaceId} 워크스페이스 선택`}
    >
      <span
        data-slot="workspace-switcher-mark"
        className="flex size-[18px] shrink-0 items-center justify-center overflow-hidden rounded-[var(--clair-radius-atomic-6)] bg-[var(--emr-workspace-button-logo-bg)] text-[var(--emr-workspace-button-logo-fg)]"
        aria-hidden="true"
      >
        <WorkspaceLogoMarkIcon size={18} className="size-[18px]" />
      </span>
      <span
        data-slot="workspace-switcher-label"
        className={cn(
          "min-w-0 px-[var(--clair-border-width-atomic-2)] transition-[opacity,transform] duration-150",
          collapsed ? "hidden" : "opacity-100"
        )}
      >
        {workspaceDisplayName}
      </span>
      <CdsNavigationChevronDownIcon
        size={16}
        className={cn(
          "size-4 shrink-0 text-[var(--emr-workspace-button-icon)] transition-opacity duration-150"
        )}
        aria-hidden="true"
      />
    </Button>
  );
}
