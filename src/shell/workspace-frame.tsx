"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import type { ModuleDefinition } from "@/types/emr";
import { Button } from "@/components/ui/button";
import { useLayoutStore } from "@/stores/layout-store";
import { cn } from "@/lib/utils";
import { SHELL_LAYOUT } from "@/shell/layout-contract";

type WorkspaceFrameProps = {
  moduleDefinition: ModuleDefinition;
  workspaceId: string;
};

export function WorkspaceFrame({ moduleDefinition, workspaceId }: WorkspaceFrameProps) {
  const {
    activeDrawer,
    contentAsideOpen,
    contentAsideWidth,
    modulePanelOpen,
    moduleSidePanelWidth,
    rightPanelOpen,
    rightPanelWidth,
    setActiveDrawer,
  } = useLayoutStore();
  const SidePanel = moduleDefinition.sidePanel;
  const Header = moduleDefinition.contentHeader;
  const ContentAside = moduleDefinition.contentAside;
  const Content = moduleDefinition.content;
  const RightPanel = moduleDefinition.rightPanel;
  const Drawer = moduleDefinition.drawer;
  const effectiveModuleSidePanelWidth = Math.max(
    moduleSidePanelWidth,
    SHELL_LAYOUT.moduleSidePanel.minWidth
  );
  const effectiveContentAsideWidth = Math.max(
    contentAsideWidth,
    SHELL_LAYOUT.contentAside.minWidth
  );
  const effectiveRightPanelWidth = Math.max(
    rightPanelWidth,
    SHELL_LAYOUT.rightPanel.defaultWidth
  );
  const slotProps = {
    workspaceId,
    moduleId: moduleDefinition.id,
    hasContentAside: Boolean(ContentAside),
    hasRightPanel: Boolean(RightPanel),
  };

  return (
    <main
      className="relative grid min-h-0 overflow-hidden rounded-lg border border-input bg-card transition-[grid-template-columns] duration-200"
      style={{
        gridTemplateColumns: `${
          modulePanelOpen && SidePanel ? `${effectiveModuleSidePanelWidth}px` : "0px"
        } minmax(0, 1fr) ${
          RightPanel && rightPanelOpen ? `${effectiveRightPanelWidth}px` : "0px"
        }`,
      }}
    >
      <aside className="min-h-0 overflow-hidden border-r bg-card">
        <div
          className="flex h-full flex-col"
          style={{
            minWidth: SHELL_LAYOUT.moduleSidePanel.minWidth,
            width: effectiveModuleSidePanelWidth,
          }}
        >
          {SidePanel ? <SidePanel {...slotProps} /> : null}
        </div>
      </aside>

      <section className="relative flex min-h-0 min-w-0 flex-col bg-card">
        {Header ? <Header {...slotProps} /> : null}
        <div
          className="grid min-h-0 flex-1 transition-[grid-template-columns] duration-200"
          style={{
            gridTemplateColumns: `${
              ContentAside && contentAsideOpen ? `${effectiveContentAsideWidth}px` : "0px"
            } minmax(0, 1fr)`,
          }}
        >
          <aside className="min-h-0 overflow-hidden border-r bg-card">
            <div
              className="h-full"
              style={{
                minWidth: SHELL_LAYOUT.contentAside.minWidth,
                width: effectiveContentAsideWidth,
              }}
            >
              {ContentAside ? (
                <ContentAside {...slotProps} />
              ) : null}
            </div>
          </aside>
          <div className="min-h-0 min-w-0 overflow-hidden">
            <Content {...slotProps} />
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
              className="absolute inset-y-0 right-0 border-l bg-card shadow-2xl"
              style={{
                width: SHELL_LAYOUT.drawer.defaultWidth,
                zIndex: SHELL_LAYOUT.drawer.zIndex,
              }}
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
              <Drawer {...slotProps} />
            </motion.aside>
          ) : null}
        </AnimatePresence>
      </section>

      <aside
        className={cn(
          "min-h-0 overflow-hidden border-l bg-card transition-opacity duration-150",
          RightPanel && !rightPanelOpen && "pointer-events-none opacity-0"
        )}
      >
        <div className="flex h-full w-full flex-col" style={{ minWidth: SHELL_LAYOUT.rightPanel.defaultWidth }}>
          {RightPanel ? <RightPanel {...slotProps} /> : null}
        </div>
      </aside>
    </main>
  );
}
