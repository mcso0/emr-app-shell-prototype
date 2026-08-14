"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { Transition } from "framer-motion";
import { WorkspaceLogoMarkIcon } from "@/components/icons";
import { CdsNavigationChevronDownIcon } from "@/components/cds-icons/navigation";
import { Button } from "@/components/ui/button";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { useSessionWorkspaceIdentity } from "@/features/auth/workspace-display";
import { cn } from "@/lib/utils";

type WorkspaceSwitcherProps = {
  collapsed?: boolean;
  className?: string;
  workspaceId: string;
};

const WORKSPACE_LABEL_EASE = [0.16, 0, 0.2, 1] as const;

export function WorkspaceSwitcher({ collapsed = false, className, workspaceId }: WorkspaceSwitcherProps) {
  const { displayName: workspaceDisplayName, logoUrl } =
    useSessionWorkspaceIdentity(workspaceId);
  const reduceMotion = useReducedMotion();
  const [isLabelMounted, setIsLabelMounted] = useState(!collapsed);
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

  return (
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
          "size-4 shrink-0 text-[var(--emr-workspace-button-icon)] transition-opacity duration-150"
        )}
        aria-hidden="true"
      />
    </Button>
  );
}
