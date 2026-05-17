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
        "h-8 items-center rounded-[var(--emr-radius-control)] bg-transparent text-[var(--emr-text-secondary)] tracking-normal shadow-none transition-[background-color,width] hover:bg-[var(--emr-state-hover)] hover:text-[var(--emr-text-primary)] focus-visible:ring-ring/40",
        collapsed
          ? "w-8 justify-center px-0"
          : "w-fit max-w-full min-w-0 justify-start gap-1.5 px-2 text-[13px] font-semibold",
        className,
      )}
      aria-label={`${workspaceId} 워크스페이스 선택`}
    >
      <span className="flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-[6px] bg-[var(--brand)] text-[var(--brand-foreground)]">
        <WorkspaceLogoMarkIcon className="size-5" aria-hidden="true" />
      </span>
      <span className={cn("truncate", collapsed && "hidden")}>{workspaceDisplayName}</span>
      <CdsNavigationChevronDownIcon
        className={cn("size-4 shrink-0 text-[var(--emr-text-tertiary)]", collapsed && "hidden")}
        aria-hidden="true"
      />
    </Button>
  );
}
