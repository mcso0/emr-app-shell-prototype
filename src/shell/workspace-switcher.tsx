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
        "h-8 items-center rounded-[var(--emr-radius-control)] border-0 bg-transparent p-0 text-[var(--emr-text-secondary)] tracking-normal shadow-none transition-[background-color,width] hover:bg-[var(--emr-state-hover)] hover:text-[var(--emr-text-primary)] focus-visible:ring-ring/40",
        collapsed
          ? "w-12 justify-start"
          : "w-fit max-w-full min-w-0 justify-start pr-2 text-[13px] font-semibold",
        className,
      )}
      aria-label={`${workspaceId} 워크스페이스 선택`}
    >
      <span
        data-slot="workspace-switcher-mark-slot"
        className="flex h-8 w-12 shrink-0 items-center justify-center"
        aria-hidden="true"
      >
        <span
          data-slot="workspace-switcher-mark"
          className="flex size-6 items-center justify-center overflow-hidden rounded-[7px] bg-[var(--brand)] text-[var(--brand-foreground)]"
        >
          <WorkspaceLogoMarkIcon className="size-6" />
        </span>
      </span>
      <span
        data-slot="workspace-switcher-label"
        className={cn(
          "min-w-0 truncate transition-[opacity,transform] duration-150",
          collapsed ? "pointer-events-none opacity-0" : "opacity-100"
        )}
      >
        {workspaceDisplayName}
      </span>
      <CdsNavigationChevronDownIcon
        className={cn(
          "ml-1.5 size-4 shrink-0 text-[var(--emr-text-tertiary)] transition-opacity duration-150",
          collapsed && "opacity-0"
        )}
        aria-hidden="true"
      />
    </Button>
  );
}
