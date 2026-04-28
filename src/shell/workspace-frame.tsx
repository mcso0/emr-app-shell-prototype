"use client";

import { AnimatePresence, motion } from "framer-motion";
import { PanelLeftClose, PanelRightClose, PanelRightOpen, X } from "lucide-react";
import type { ModuleDefinition } from "@/types/emr";
import { Button } from "@/components/ui/button";
import { useLayoutStore } from "@/stores/layout-store";
import { cn } from "@/lib/utils";

type WorkspaceFrameProps = {
  moduleDefinition: ModuleDefinition;
  workspaceId: string;
};

export function WorkspaceFrame({ moduleDefinition, workspaceId }: WorkspaceFrameProps) {
  const {
    activeDrawer,
    contextPanelOpen,
    modulePanelOpen,
    rightPanelOpen,
    rightPanelWidth,
    setActiveDrawer,
    setModulePanelOpen,
    setRightPanelOpen,
  } = useLayoutStore();
  const SidePanel = moduleDefinition.sidePanel;
  const Header = moduleDefinition.contentHeader;
  const ContextPanel = moduleDefinition.contextPanel;
  const Content = moduleDefinition.content;
  const RightPanel = moduleDefinition.rightPanel;
  const Drawer = moduleDefinition.drawer;

  return (
    <main
      className="relative grid min-h-0 transition-[grid-template-columns] duration-200"
      style={{
        gridTemplateColumns: `${modulePanelOpen && SidePanel ? "280px" : "0px"} minmax(0, 1fr) ${
          RightPanel && rightPanelOpen ? `${rightPanelWidth}px` : "0px"
        }`,
      }}
    >
      <aside className="min-h-0 overflow-hidden border-r bg-white">
        <div className="flex h-full w-[280px] flex-col">
          <div className="flex h-12 items-center justify-between border-b px-3">
            <div className="min-w-0">
              <div className="truncate text-[15px] font-semibold">{moduleDefinition.label}</div>
              <div className="text-[11px] text-muted-foreground">Navigation Subpanel</div>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="사이드 패널 접기"
              onClick={() => setModulePanelOpen(false)}
            >
              <PanelLeftClose />
            </Button>
          </div>
          {SidePanel ? <SidePanel workspaceId={workspaceId} moduleId={moduleDefinition.id} /> : null}
        </div>
      </aside>

      <section className="relative flex min-h-0 min-w-0 flex-col bg-[#f8fafc]">
        {Header ? <Header workspaceId={workspaceId} moduleId={moduleDefinition.id} /> : null}
        <div
          className="grid min-h-0 flex-1 transition-[grid-template-columns] duration-200"
          style={{
            gridTemplateColumns: `${ContextPanel && contextPanelOpen ? "380px" : "0px"} minmax(0, 1fr)`,
          }}
        >
          <aside className="min-h-0 overflow-hidden border-r bg-white">
            <div className="h-full w-[380px]">
              {ContextPanel ? (
                <ContextPanel workspaceId={workspaceId} moduleId={moduleDefinition.id} />
              ) : null}
            </div>
          </aside>
          <div className="min-h-0 min-w-0 overflow-hidden">
            <Content workspaceId={workspaceId} moduleId={moduleDefinition.id} />
          </div>
        </div>

        <AnimatePresence>
          {activeDrawer && Drawer ? (
            <motion.aside
              key={`${activeDrawer.type}-${activeDrawer.id}`}
              initial={{ x: 480, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 480, opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="absolute inset-y-0 right-0 z-30 w-[460px] border-l bg-white shadow-2xl"
            >
              <div className="flex h-12 items-center justify-between border-b px-4">
                <div>
                  <div className="text-sm font-semibold">상세 정보</div>
                  <div className="text-[11px] text-muted-foreground">{activeDrawer.id}</div>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="상세 닫기"
                  onClick={() => setActiveDrawer(null)}
                >
                  <X />
                </Button>
              </div>
              <Drawer workspaceId={workspaceId} moduleId={moduleDefinition.id} />
            </motion.aside>
          ) : null}
        </AnimatePresence>
      </section>

      <aside
        className={cn(
          "min-h-0 overflow-hidden border-l bg-white transition-opacity duration-150",
          RightPanel && !rightPanelOpen && "pointer-events-none opacity-0"
        )}
      >
        <div className="flex h-full w-full min-w-[280px] flex-col">
          {RightPanel ? (
            <>
              <div className="flex h-12 items-center justify-between border-b px-3">
                <div>
                  <div className="text-sm font-semibold">Right Subpanel</div>
                  <div className="text-[11px] text-muted-foreground">정보 / 상세 / 액션</div>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="우측 패널 접기"
                  onClick={() => setRightPanelOpen(false)}
                >
                  <PanelRightClose />
                </Button>
              </div>
              <RightPanel workspaceId={workspaceId} moduleId={moduleDefinition.id} />
            </>
          ) : null}
        </div>
      </aside>

      {RightPanel && !rightPanelOpen ? (
        <Button
          variant="outline"
          size="icon-sm"
          className="absolute right-3 top-14 z-20 bg-white"
          aria-label="우측 패널 펼치기"
          onClick={() => setRightPanelOpen(true)}
        >
          <PanelRightOpen />
        </Button>
      ) : null}
    </main>
  );
}
