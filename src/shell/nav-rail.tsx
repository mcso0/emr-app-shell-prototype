"use client";

import Link from "next/link";
import { PanelOpenIcon } from "@/components/icons";
import { modules } from "@/modules/registry";
import { useLayoutStore } from "@/stores/layout-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type NavRailProps = {
  activeModuleId: string;
  workspaceId: string;
};

export function NavRail({ activeModuleId, workspaceId }: NavRailProps) {
  const { modulePanelOpen, setModulePanelOpen } = useLayoutStore();

  return (
    <nav className="flex min-h-0 flex-col items-center rounded-lg bg-sidebar py-2 text-sidebar-foreground">
      {!modulePanelOpen ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="mb-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                onClick={() => setModulePanelOpen(true)}
                aria-label="사이드 패널 펼치기"
              >
                <PanelOpenIcon />
              </Button>
            }
          />
          <TooltipContent side="right">사이드 패널 펼치기</TooltipContent>
        </Tooltip>
      ) : (
        <div className="mb-2 size-7" />
      )}
      <div className="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto">
        {modules.map((module) => {
          const Icon = module.icon;
          const active = module.id === activeModuleId;
          return (
            <Tooltip key={module.id}>
              <TooltipTrigger
                render={
                  <Link
                    href={`/w/${workspaceId}/${module.id}`}
                    className={cn(
                      "flex size-11 items-center justify-center rounded-md text-[var(--clair-color-atomic-gray-400)] transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      active && "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                    )}
                    aria-label={module.label}
                  >
                    <Icon className="size-4" />
                  </Link>
                }
              />
              <TooltipContent side="right">{module.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </nav>
  );
}
