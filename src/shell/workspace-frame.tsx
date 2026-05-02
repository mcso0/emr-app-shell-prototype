"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { Transition } from "framer-motion";
import { CloseIcon } from "@/components/icons";
import type { ModuleDefinition } from "@/types/emr";
import { Button } from "@/components/ui/button";
import { useLayoutStore } from "@/stores/layout-store";
import { cn } from "@/lib/utils";
import { SHELL_LAYOUT } from "@/shell/layout-contract";

type WorkspaceFrameProps = {
  moduleDefinition: ModuleDefinition;
  workspaceId: string;
};

const PANEL_ENTER_EASE = [0.16, 0, 0.08, 1] as const;
const PANEL_EXIT_EASE = [0.32, 0, 1, 1] as const;

export function WorkspaceFrame({ moduleDefinition, workspaceId }: WorkspaceFrameProps) {
  const reduceMotion = useReducedMotion();
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
  const drawerTitle =
    activeDrawer?.type === "reception-form"
      ? "접수"
      : activeDrawer?.type === "reception-patient"
        ? "환자 정보"
        : activeDrawer?.type === "reception-guardian"
          ? "보호자 정보"
          : activeDrawer?.type === "reception-appointment"
            ? "예약 상세"
            : "상세 정보";
  const drawerWidth =
    activeDrawer?.type === "reception-form"
      ? SHELL_LAYOUT.drawer.largeWidth
      : SHELL_LAYOUT.drawer.defaultWidth;
  const shouldShowModuleSidePanel = Boolean(modulePanelOpen && SidePanel);
  const effectiveModuleSidePanelWidth = Math.max(
    moduleSidePanelWidth,
    SHELL_LAYOUT.moduleSidePanel.minWidth
  );
  const modulePanelTransition: Transition = reduceMotion
    ? { duration: 0 }
    : {
        duration: modulePanelOpen ? 0.16 : 0.12,
        ease: modulePanelOpen ? PANEL_ENTER_EASE : PANEL_EXIT_EASE,
      };
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
    moduleLabel: moduleDefinition.label,
    hasContentAside: Boolean(ContentAside),
    hasRightPanel: Boolean(RightPanel),
  };

  return (
    <main
      className="relative grid min-h-0 overflow-hidden rounded-lg border border-input bg-card transition-[grid-template-columns]"
      style={{
        gridTemplateColumns: `${
          modulePanelOpen && SidePanel ? `${effectiveModuleSidePanelWidth}px` : "0px"
        } minmax(0, 1fr) ${
          RightPanel && rightPanelOpen ? `${effectiveRightPanelWidth}px` : "0px"
        }`,
        transitionDuration: reduceMotion
          ? "0ms"
          : modulePanelOpen
            ? "var(--clair-motion-duration-panel-enter)"
            : "var(--clair-motion-duration-panel-exit)",
        transitionTimingFunction: modulePanelOpen
          ? "var(--clair-motion-easing-panel-enter)"
          : "var(--clair-motion-easing-panel-exit)",
      }}
    >
      <aside
        className={cn(
          "min-h-0 min-w-0 overflow-hidden bg-white",
          shouldShowModuleSidePanel && "border-r border-input"
        )}
      >
        <div
          className="relative flex h-full flex-col"
          style={{
            minWidth: SHELL_LAYOUT.moduleSidePanel.minWidth,
            width: effectiveModuleSidePanelWidth,
          }}
        >
          <AnimatePresence initial={false}>
            {shouldShowModuleSidePanel && SidePanel ? (
              <motion.div
                key={`${moduleDefinition.id}-module-side-panel`}
                initial={reduceMotion ? false : { opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduceMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: -12 }}
                transition={modulePanelTransition}
                className="h-full min-h-0"
              >
                <SidePanel {...slotProps} />
              </motion.div>
            ) : null}
          </AnimatePresence>
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
          <aside
            className={cn(
              "min-h-0 min-w-0 overflow-hidden bg-card",
              ContentAside && contentAsideOpen && "border-r"
            )}
          >
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
                width: drawerWidth,
                zIndex: SHELL_LAYOUT.drawer.zIndex,
              }}
            >
              <div className="flex h-12 items-center justify-between border-b px-4">
                <div>
                  <div className="text-sm font-semibold">{drawerTitle}</div>
                  <div className="text-[11px] text-muted-foreground">{activeDrawer.id}</div>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="상세 닫기"
                  onClick={() => setActiveDrawer(null)}
                >
                  <CloseIcon />
                </Button>
              </div>
              <Drawer {...slotProps} />
            </motion.aside>
          ) : null}
        </AnimatePresence>
      </section>

      <aside
        className={cn(
          "min-h-0 min-w-0 overflow-hidden bg-card transition-opacity duration-150",
          RightPanel && rightPanelOpen && "border-l",
          RightPanel && !rightPanelOpen && "pointer-events-none opacity-0"
        )}
      >
        <div
          className="flex h-full w-full flex-col"
          style={{ minWidth: rightPanelOpen ? SHELL_LAYOUT.rightPanel.defaultWidth : 0 }}
        >
          {RightPanel && rightPanelOpen ? <RightPanel {...slotProps} /> : null}
        </div>
      </aside>
    </main>
  );
}
