"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { Transition } from "framer-motion";
import type { CSSProperties } from "react";
import { CloseIcon } from "@/components/icons";
import {
  GuardianProfileDrawer,
  PatientProfileDrawer,
} from "@/features/reception/profile-drawer";
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
    rightPanelOpen,
    rightPanelWidth,
    setActiveDrawer,
  } = useLayoutStore();
  const SidePanel = moduleDefinition.sidePanel;
  const Header = moduleDefinition.contentHeader;
  const ContentAside = moduleDefinition.contentAside;
  const Content = moduleDefinition.content;
  const RightPanel = moduleDefinition.rightPanel;
  const ModuleDrawer = moduleDefinition.drawer;
  const isPatientDrawer = activeDrawer?.type === "patient" || activeDrawer?.type === "reception-patient";
  const isGuardianDrawer = activeDrawer?.type === "guardian" || activeDrawer?.type === "reception-guardian";
  const CommonProfileDrawer = isPatientDrawer
    ? PatientProfileDrawer
    : isGuardianDrawer
      ? GuardianProfileDrawer
      : undefined;
  const drawerTitle =
    isPatientDrawer
        ? "환자 정보"
        : isGuardianDrawer
          ? "보호자 정보"
          : activeDrawer?.type === "inpatient-admission"
            ? "입원 상세"
            : activeDrawer?.type === "reception-appointment"
              ? "예약 상세"
              : activeDrawer?.type === "reception-encounter"
                ? "접수 정보"
                : "상세 정보";
  const drawerSubtitle =
    activeDrawer?.subtitle ??
    (activeDrawer?.type === "reception-encounter" ? undefined : activeDrawer?.id);
  const drawerWidth =
    activeDrawer?.type === "hospital-order" || CommonProfileDrawer
      ? SHELL_LAYOUT.drawer.largeWidth
      : SHELL_LAYOUT.drawer.defaultWidth;
  const shouldShowShellDrawerHeader = activeDrawer?.type !== "hospital-order";
  const shouldShowModuleSidePanel = Boolean(modulePanelOpen && SidePanel);
  const effectiveModuleSidePanelWidth = SHELL_LAYOUT.moduleSidePanel.defaultWidth;
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
      className="relative grid min-h-0 overflow-hidden rounded-lg border border-[var(--emr-line-default)] bg-card transition-[grid-template-columns] [grid-template-columns:var(--clair-workspace-frame-columns)] max-md:[grid-template-columns:minmax(0,1fr)]"
      style={{
        "--clair-workspace-frame-columns": `${
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
      } as CSSProperties}
    >
      <aside
        className={cn(
          "min-h-0 min-w-0 overflow-hidden bg-[var(--emr-surface-panel)] max-md:hidden",
          shouldShowModuleSidePanel && "border-r border-[var(--emr-line-default)]"
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
          className="grid min-h-0 flex-1 transition-[grid-template-columns] duration-200 [grid-template-columns:var(--clair-workspace-content-columns)] max-md:[grid-template-columns:minmax(0,1fr)]"
          style={{
            "--clair-workspace-content-columns": `${
              ContentAside && contentAsideOpen ? `${effectiveContentAsideWidth}px` : "0px"
            } minmax(0, 1fr)`,
          } as CSSProperties}
        >
          <aside
            className={cn(
              "min-h-0 min-w-0 overflow-hidden bg-card max-md:hidden",
              ContentAside && contentAsideOpen && "border-r border-[var(--emr-line-default)]"
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
          {activeDrawer && (CommonProfileDrawer || ModuleDrawer) ? (
            <motion.aside
              key={`${activeDrawer.type}-${activeDrawer.id}`}
              initial={{ x: 480, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 480, opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="absolute bottom-0 right-0 top-0 border-l border-[var(--emr-line-default)] bg-card shadow-2xl"
              style={{
                width: `min(100%, ${drawerWidth}px)`,
                zIndex: SHELL_LAYOUT.drawer.zIndex,
              }}
            >
              {shouldShowShellDrawerHeader ? (
                <div className="flex h-12 items-center justify-between border-b px-4">
                  <div>
                    <div className="flex min-w-0 items-baseline gap-2">
                      <span className="text-sm font-semibold">{drawerTitle}</span>
                      {drawerSubtitle ? (
                        <span className="truncate text-[11px] text-muted-foreground">
                          {drawerSubtitle}
                        </span>
                      ) : null}
                    </div>
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
              ) : null}
              {CommonProfileDrawer && activeDrawer ? (
                isPatientDrawer ? (
                  <PatientProfileDrawer patientId={activeDrawer.id} />
                ) : (
                  <GuardianProfileDrawer guardianId={activeDrawer.id} />
                )
              ) : ModuleDrawer ? (
                <ModuleDrawer {...slotProps} />
              ) : null}
            </motion.aside>
          ) : null}
        </AnimatePresence>
      </section>

      <aside
        className={cn(
          "min-h-0 min-w-0 overflow-hidden bg-card transition-opacity duration-150 max-md:hidden",
          RightPanel && rightPanelOpen && "border-l border-[var(--emr-line-default)]",
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
