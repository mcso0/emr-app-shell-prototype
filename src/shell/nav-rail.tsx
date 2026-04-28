"use client";

import Link from "next/link";
import { PanelLeftOpen } from "lucide-react";
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
    <nav className="flex min-h-0 flex-col items-center border-r border-[#253149] bg-[#111827] py-2 text-white">
      {!modulePanelOpen ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="mb-2 text-white hover:bg-white/10 hover:text-white"
                onClick={() => setModulePanelOpen(true)}
                aria-label="사이드 패널 펼치기"
              >
                <PanelLeftOpen />
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
                      "flex size-10 items-center justify-center rounded-md text-[#aab7cc] transition-colors hover:bg-white/10 hover:text-white",
                      active && "bg-[#2563eb] text-white shadow-sm"
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
