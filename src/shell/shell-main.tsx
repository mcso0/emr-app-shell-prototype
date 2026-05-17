"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { Transition } from "framer-motion";
import type { CSSProperties } from "react";
import type { ModuleDefinition } from "@/types/emr";
import { cn } from "@/lib/utils";
import { useLayoutStore } from "@/stores/layout-store";
import { NavRail } from "@/shell/nav-rail";
import { SHELL_LAYOUT } from "@/shell/layout-contract";
import { WorkspaceFrame } from "@/shell/workspace-frame";
import { WorkspaceSwitcher } from "@/shell/workspace-switcher";

type ShellMainProps = {
  moduleDefinition: ModuleDefinition;
  navigationSearch: string;
  workspaceId: string;
  onNavigateModule: (href: string, moduleId: string) => void;
};

const PANEL_ENTER_EASE = [0.16, 0, 0.08, 1] as const;
const PANEL_EXIT_EASE = [0.32, 0, 1, 1] as const;

export function ShellMain({
  moduleDefinition,
  navigationSearch,
  workspaceId,
  onNavigateModule,
}: ShellMainProps) {
  const reduceMotion = useReducedMotion();
  const modulePanelOpen = useLayoutStore((state) => state.modulePanelOpen);
  const SidePanel = moduleDefinition.sidePanel;
  const shouldShowModuleSidePanel = Boolean(modulePanelOpen && SidePanel);
  const navigationColumnWidth = shouldShowModuleSidePanel
    ? SHELL_LAYOUT.navigationColumn.openWidth
    : SHELL_LAYOUT.navigationColumn.collapsedWidth;
  const modulePanelTransition: Transition = reduceMotion
    ? { duration: 0 }
    : {
        duration: modulePanelOpen ? 0.16 : 0.12,
        ease: modulePanelOpen ? PANEL_ENTER_EASE : PANEL_EXIT_EASE,
      };
  const slotProps = {
    workspaceId,
    moduleId: moduleDefinition.id,
    moduleLabel: moduleDefinition.label,
    hasContentAside: Boolean(moduleDefinition.contentAside),
    hasRightPanel: Boolean(moduleDefinition.rightPanel),
  };

  return (
    <div
      className="grid min-h-0 grid-cols-[minmax(0,1fr)] transition-[grid-template-columns] md:grid-cols-[var(--clair-shell-main-columns)]"
      style={{
        "--clair-shell-main-columns": `${navigationColumnWidth}px minmax(0, 1fr)`,
        gap: SHELL_LAYOUT.shell.gap,
        height: `calc(100vh - ${SHELL_LAYOUT.shell.tabsBarHeight}px)`,
        padding: SHELL_LAYOUT.shell.bodyPadding,
        transitionDuration: reduceMotion ? "0ms" : "160ms",
        transitionTimingFunction: "var(--clair-motion-easing-panel-enter)",
      } as CSSProperties}
    >
      <section
        data-testid="shell-navigation-column"
        className="flex min-h-0 min-w-0 flex-col transition-[width] max-md:hidden"
        style={{ gap: SHELL_LAYOUT.shell.gap, width: navigationColumnWidth }}
      >
        <WorkspaceSwitcher collapsed={!shouldShowModuleSidePanel} workspaceId={workspaceId} />

        <div
          data-testid="module-panel-area"
          className="grid min-h-0 flex-1 transition-[grid-template-columns]"
          style={{
            gap: SHELL_LAYOUT.shell.gap,
            gridTemplateColumns: shouldShowModuleSidePanel
              ? `${SHELL_LAYOUT.navRailWidth}px minmax(0, ${SHELL_LAYOUT.moduleSidePanel.defaultWidth}px)`
              : `${SHELL_LAYOUT.navRailWidth}px 0px`,
            transitionDuration: reduceMotion ? "0ms" : "160ms",
            transitionTimingFunction: "var(--clair-motion-easing-panel-enter)",
          } as CSSProperties}
        >
          <NavRail
            activeModuleId={moduleDefinition.id}
            navigationSearch={navigationSearch}
            workspaceId={workspaceId}
            onNavigateModule={onNavigateModule}
          />

          <aside
            className={cn(
              "min-h-0 min-w-0 overflow-hidden rounded-lg border border-[var(--emr-line-default)] bg-[var(--emr-surface-panel)]",
              !shouldShowModuleSidePanel && "pointer-events-none border-transparent opacity-0"
            )}
          >
            <div
              className="relative flex h-full flex-col"
              style={{
                minWidth: SHELL_LAYOUT.moduleSidePanel.minWidth,
                width: SHELL_LAYOUT.moduleSidePanel.defaultWidth,
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
        </div>
      </section>

      <section data-testid="shell-workspace-area" className="min-h-0 min-w-0">
        <div data-testid="workspace-frame" className="h-full min-h-0 min-w-0 [&>main]:h-full">
          <WorkspaceFrame moduleDefinition={moduleDefinition} workspaceId={workspaceId} />
        </div>
      </section>
    </div>
  );
}
