"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { Transition } from "framer-motion";
import { WorkspaceLogoMarkIcon } from "@/components/icons";
import {
  CdsActionsCheckIcon,
  CdsActionsRefreshCwIcon,
} from "@/components/cds-icons/actions-and-controls";
import { CdsNavigationChevronDownIcon } from "@/components/cds-icons/navigation";
import { EmrPopoverShell } from "@/components/emr/popover-shell";
import { Button } from "@/components/ui/button";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getWorkspaceListOptionRoleLabel,
  useSessionWorkspaceIdentity,
  useSessionWorkspaceList,
  type WorkspaceListOption,
} from "@/features/auth/workspace-display";
import { cn } from "@/lib/utils";

type WorkspaceSwitcherProps = {
  collapsed?: boolean;
  className?: string;
  userSessionId: string | null;
  workspaceId: string;
  onSelectWorkspace: (workspace: WorkspaceListOption) => void;
};

const WORKSPACE_LABEL_EASE = [0.16, 0, 0.2, 1] as const;
const WORKSPACE_SEARCH_THRESHOLD = 5;

export function WorkspaceSwitcher({
  collapsed = false,
  className,
  userSessionId,
  workspaceId,
  onSelectWorkspace,
}: WorkspaceSwitcherProps) {
  const { displayName: workspaceDisplayName, logoUrl } =
    useSessionWorkspaceIdentity(workspaceId);
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [isLabelMounted, setIsLabelMounted] = useState(!collapsed);
  const { reload, requestState, workspaces } = useSessionWorkspaceList({
    enabled: open,
    userSessionId,
    workspaceId,
  });
  const showSearch = workspaces.length >= WORKSPACE_SEARCH_THRESHOLD;
  const labelTransition: Transition = reduceMotion
    ? { duration: 0 }
    : {
        duration: 0.14,
        ease: WORKSPACE_LABEL_EASE,
        delay: collapsed ? 0 : 0.04,
      };

  useEffect(() => {
    if (collapsed) return;

    const frame = window.requestAnimationFrame(() => {
      setIsLabelMounted(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [collapsed]);

  function handleSelect(workspace: WorkspaceListOption) {
    setOpen(false);
    if (workspace.id !== workspaceId) {
      onSelectWorkspace(workspace);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="default"
            data-testid="workspace-switcher"
            className={cn(
              "h-8 items-center justify-center gap-[var(--clair-border-width-atomic-4)] rounded-[var(--clair-radius-atomic-8)] border border-[var(--emr-workspace-button-border)] bg-[var(--emr-workspace-button-bg)] px-[6px] py-[var(--clair-radius-atomic-6)] text-[14px] font-medium leading-5 tracking-[0.196px] text-[var(--emr-workspace-button-text)] shadow-[var(--clair-shadow-xs)] transition-[background-color,border-color,width] hover:border-[var(--emr-workspace-button-border)] hover:bg-[var(--emr-workspace-button-hover-bg)] hover:text-[var(--emr-workspace-button-text)] focus-visible:ring-ring/40 active:bg-[var(--emr-workspace-button-bg)] active:shadow-none",
              collapsed
                ? "w-[var(--emr-navrail-width)]"
                : "w-fit max-w-full min-w-48",
              className,
            )}
            aria-label={`${workspaceId} 워크스페이스 선택`}
          />
        }
      >
        <span
          data-slot="workspace-switcher-mark"
          className="flex size-[18px] shrink-0 items-center justify-center overflow-hidden rounded-[var(--clair-radius-atomic-6)] bg-[var(--emr-workspace-button-logo-bg)] text-[var(--emr-workspace-button-logo-fg)]"
          aria-hidden="true"
        >
          <Avatar
            className="size-[18px] after:hidden"
            roundness="roundrect"
            aria-hidden="true"
          >
            {logoUrl ? (
              <AvatarImage
                src={logoUrl}
                alt=""
                data-slot="workspace-switcher-logo-image"
                className="object-contain"
              />
            ) : null}
            <AvatarFallback className="bg-[var(--emr-workspace-button-logo-bg)] text-[var(--emr-workspace-button-logo-fg)]">
              <WorkspaceLogoMarkIcon size={18} className="size-[18px]" />
            </AvatarFallback>
          </Avatar>
        </span>
        {isLabelMounted ? (
          <span
            data-slot="workspace-switcher-label"
            aria-hidden={collapsed}
            className="min-w-0 px-[var(--clair-border-width-atomic-2)] transition-[opacity,transform] duration-150"
          >
            <motion.span
              data-slot="workspace-switcher-label-content"
              initial={{
                filter: "blur(2px)",
                opacity: 0,
                x: -4,
              }}
              animate={{
                filter: collapsed ? "blur(2px)" : "blur(0px)",
                opacity: collapsed ? 0 : 1,
                x: collapsed ? -4 : 0,
              }}
              transition={labelTransition}
              onAnimationComplete={() => {
                if (collapsed) {
                  setIsLabelMounted(false);
                }
              }}
            >
              {workspaceDisplayName}
            </motion.span>
          </span>
        ) : null}
        <CdsNavigationChevronDownIcon
          size={16}
          className={cn(
            "size-4 shrink-0 text-[var(--emr-workspace-button-icon)] transition-transform duration-150",
            open && "rotate-180"
          )}
          aria-hidden="true"
        />
      </PopoverTrigger>

      <EmrPopoverShell
        align="start"
        aria-label="워크스페이스 전환"
        bodyClassName="gap-1 px-2 pb-2"
        bodyScroll
        className="max-w-[calc(100vw-20px)]"
        data-testid="workspace-switcher-popover"
        description="내가 참여 중인 활성 워크스페이스"
        footer={
          <div className="flex w-full items-center justify-between gap-3 text-[11px] leading-4 text-[var(--emr-text-tertiary)]">
            <span>활성 멤버십</span>
            <span>{workspaces.length}개</span>
          </div>
        }
        sideOffset={6}
        title="워크스페이스 전환"
        width="lg"
      >
        {requestState === "loading" ? (
          <WorkspaceListLoading />
        ) : (
          <>
            {requestState === "error" ? (
              <div
                role="status"
                className="mb-1 flex items-center justify-between gap-3 rounded-md bg-[var(--emr-status-warning-bg)] px-2.5 py-2 text-xs text-[var(--emr-text-secondary)]"
              >
                <span>저장된 목록을 표시하고 있어요.</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0 gap-1 px-2 text-xs"
                  onClick={reload}
                >
                  <CdsActionsRefreshCwIcon className="size-3.5" />
                  다시 시도
                </Button>
              </div>
            ) : null}
            <Command className="bg-transparent" loop>
              {showSearch ? (
                <CommandInput
                  aria-label="워크스페이스 검색"
                  className="h-9"
                  placeholder="워크스페이스 검색"
                />
              ) : null}
              <CommandList className="max-h-64">
                <CommandEmpty>일치하는 워크스페이스가 없습니다.</CommandEmpty>
                <CommandGroup heading="워크스페이스">
                  {workspaces.map((workspace) => {
                    const current = workspace.id === workspaceId;
                    const roleLabel = getWorkspaceListOptionRoleLabel(workspace);

                    return (
                      <CommandItem
                        key={workspace.id}
                        value={`${workspace.displayName} ${workspace.id} ${roleLabel}`}
                        aria-current={current ? "true" : undefined}
                        className="min-h-12 cursor-pointer gap-2.5 px-2.5 py-2"
                        data-testid={`workspace-switcher-option-${workspace.id}`}
                        onSelect={() => handleSelect(workspace)}
                      >
                        <span
                          className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[var(--emr-workspace-button-logo-bg)] text-[var(--emr-workspace-button-logo-fg)]"
                          aria-hidden="true"
                        >
                          <WorkspaceLogoMarkIcon size={28} className="size-7" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-[var(--emr-text-primary)]">
                            {workspace.displayName}
                          </span>
                          <span className="block truncate text-[11px] leading-4 text-[var(--emr-text-tertiary)]">
                            {current ? `현재 · ${roleLabel}` : roleLabel}
                          </span>
                        </span>
                        {current ? (
                          <CdsActionsCheckIcon
                            className="size-4 text-[var(--emr-text-link)]"
                            aria-label="현재 워크스페이스"
                          />
                        ) : null}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
            {workspaces.length === 1 ? (
              <p className="px-2 pb-1 text-xs leading-5 text-[var(--emr-text-tertiary)]">
                전환할 수 있는 다른 워크스페이스가 없습니다.
              </p>
            ) : null}
          </>
        )}
      </EmrPopoverShell>
    </Popover>
  );
}

function WorkspaceListLoading() {
  return (
    <div role="status" aria-label="워크스페이스 목록 불러오는 중" className="grid gap-2 p-1">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="flex h-12 items-center gap-2.5 px-1.5">
          <Skeleton className="size-7 shrink-0 rounded-md" />
          <div className="grid flex-1 gap-1.5">
            <Skeleton className="h-3.5 w-3/5" />
            <Skeleton className="h-3 w-2/5" />
          </div>
        </div>
      ))}
      <span className="sr-only">워크스페이스 목록을 불러오고 있습니다.</span>
    </div>
  );
}
