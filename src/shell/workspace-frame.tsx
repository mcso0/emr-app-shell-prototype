"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { CSSProperties } from "react";
import { CloseIcon } from "@/components/icons";
import {
  GuardianProfileDrawer,
  PatientProfileDrawer,
} from "@/features/reception/profile-drawer";
import { ReceptionDrawer } from "@/features/reception/module";
import type {
  ModuleDefinition,
  WorkspaceSlotAvailabilityProviderProps,
} from "@/types/emr";
import { Button } from "@/components/ui/button";
import { useLayoutStore } from "@/stores/layout-store";
import { cn } from "@/lib/utils";
import { SHELL_LAYOUT } from "@/shell/layout-contract";

type WorkspaceFrameProps = {
  moduleDefinition: ModuleDefinition;
  onNavigateWorkspaceSurface?: (href: string, moduleId: string) => void;
  workspaceId: string;
};

function DefaultSlotAvailabilityProvider({
  children,
}: WorkspaceSlotAvailabilityProviderProps) {
  return children({});
}

export function WorkspaceFrame({
  moduleDefinition,
  onNavigateWorkspaceSurface,
  workspaceId,
}: WorkspaceFrameProps) {
  const prefersReducedMotion = useReducedMotion();
  const {
    activeDrawer,
    contentAsideOpen,
    contentAsideWidth,
    rightPanelOpen,
    rightPanelWidth,
    setActiveDrawer,
  } = useLayoutStore();
  const Header = moduleDefinition.contentHeader;
  const ContentAside = moduleDefinition.contentAside;
  const Content = moduleDefinition.content;
  const RightPanel = moduleDefinition.rightPanel;
  const ModuleDrawer = moduleDefinition.drawer;
  const SlotAvailabilityProvider =
    moduleDefinition.slotAvailabilityProvider ?? DefaultSlotAvailabilityProvider;
  const routeReceptionDrawerToRightPanel =
    moduleDefinition.id === "reception" && Boolean(RightPanel);
  const instantRightPanel = moduleDefinition.id === "reception";
  const isPatientDrawer = activeDrawer?.type === "patient" || activeDrawer?.type === "reception-patient";
  const isGuardianDrawer = activeDrawer?.type === "guardian" || activeDrawer?.type === "reception-guardian";
  const isReceptionDrawer =
    activeDrawer?.type === "reception-appointment" ||
    activeDrawer?.type === "reception-appointment-check-in-form" ||
    activeDrawer?.type === "reception-encounter" ||
    activeDrawer?.type === "reception-form" ||
    activeDrawer?.type === "reception-reservation-form";
  const CommonProfileDrawer = isPatientDrawer
    ? PatientProfileDrawer
    : isGuardianDrawer
      ? GuardianProfileDrawer
      : undefined;
  const EffectiveModuleDrawer =
    isReceptionDrawer && !routeReceptionDrawerToRightPanel
      ? ReceptionDrawer
      : ModuleDrawer;
  const shouldRenderWorkspaceDrawer =
    Boolean(activeDrawer && (CommonProfileDrawer || EffectiveModuleDrawer)) &&
    !(routeReceptionDrawerToRightPanel && isReceptionDrawer);
  const drawerTitle =
    isPatientDrawer
        ? "환자 정보"
        : isGuardianDrawer
          ? "보호자 정보"
          : activeDrawer?.type === "inpatient-admission"
            ? "입원 상세"
            : activeDrawer?.type === "reception-appointment"
              ? "예약 상세"
              : activeDrawer?.type === "reception-appointment-check-in-form"
                ? "접수 생성"
              : activeDrawer?.type === "reception-encounter"
                ? "접수 상세"
              : activeDrawer?.type === "reception-form"
                ? "접수 생성"
              : activeDrawer?.type === "reception-reservation-form"
                ? "예약 생성"
                : "상세 정보";
  const drawerSubtitle =
    activeDrawer?.subtitle ??
    (activeDrawer?.type === "reception-encounter" ||
    activeDrawer?.type === "reception-form"
      ? undefined
      : activeDrawer?.id);
  const drawerWidth =
    CommonProfileDrawer
      ? 380
      : activeDrawer?.type === "hospital-order"
      ? SHELL_LAYOUT.drawer.largeWidth
      : SHELL_LAYOUT.drawer.defaultWidth;
  const shouldShowShellDrawerHeader =
    activeDrawer?.type !== "hospital-order" && !CommonProfileDrawer;
  const drawerMotionKey = activeDrawer
    ? `${activeDrawer.type}-${activeDrawer.id}`
    : undefined;
  const effectiveContentAsideWidth = Math.max(
    contentAsideWidth,
    SHELL_LAYOUT.contentAside.minWidth
  );
  const resolvedRightPanelWidth =
    activeDrawer?.rightPanelPresentation?.width ??
    moduleDefinition.rightPanelWidth ??
    rightPanelWidth;
  const effectiveRightPanelWidth = Math.max(
    resolvedRightPanelWidth,
    SHELL_LAYOUT.rightPanel.defaultWidth
  );
  const baseSlotProps = {
    workspaceId,
    moduleId: moduleDefinition.id,
    moduleLabel: moduleDefinition.label,
    onNavigateWorkspaceSurface,
  };

  return (
    <SlotAvailabilityProvider {...baseSlotProps}>
      {(availability) => {
        const hasContentAside =
          Boolean(ContentAside) && (availability.hasContentAside ?? true);
        const hasRightPanel =
          Boolean(RightPanel) && (availability.hasRightPanel ?? true);
        const contentAsideVisible = hasContentAside && contentAsideOpen;
        const rightPanelVisible = hasRightPanel && rightPanelOpen;
        const rightPanelGap = rightPanelVisible
          ? (activeDrawer?.rightPanelPresentation?.gap ??
            (moduleDefinition.rightPanelGap ? SHELL_LAYOUT.shell.gap : 0))
          : 0;
        const rightPanelDetached = rightPanelGap > 0;
        const rightPanelMobileFullWidth = Boolean(
          activeDrawer?.rightPanelPresentation?.mobileFullWidth,
        );
        const slotProps = {
          ...baseSlotProps,
          hasContentAside,
          hasRightPanel,
        };

        return (
          <main
            className={cn(
              "emr-workspace-frame-responsive relative grid min-h-0 gap-x-[var(--clair-workspace-right-panel-gap)] [grid-template-columns:var(--clair-workspace-frame-columns)] max-md:[grid-template-columns:minmax(0,1fr)]",
              !instantRightPanel && "transition-[grid-template-columns]",
              rightPanelDetached
                ? "overflow-visible bg-transparent"
                : "overflow-hidden rounded-[var(--emr-radius-panel)] border border-[var(--emr-border-strong)] bg-[var(--emr-surface-workspace)] shadow-xs"
            )}
            data-content-aside-open={contentAsideVisible ? "true" : "false"}
            data-right-panel-mobile-full={rightPanelMobileFullWidth ? "true" : "false"}
            data-right-panel-open={rightPanelVisible ? "true" : "false"}
            style={{
              "--clair-workspace-frame-columns": `minmax(0, 1fr) ${
                rightPanelVisible ? `${effectiveRightPanelWidth}px` : "0px"
              }`,
              "--clair-workspace-right-panel-gap": `${rightPanelGap}px`,
            } as CSSProperties}
          >
            <section
              data-testid="workspace-main-content"
              className={cn(
                "relative flex min-h-0 min-w-0 flex-col bg-[var(--emr-surface-workspace)]",
                rightPanelDetached &&
                  "overflow-hidden rounded-[var(--emr-radius-panel)] border border-[var(--emr-border-strong)] shadow-xs"
              )}
            >
              {Header ? <Header {...slotProps} /> : null}
              <div
                className="grid min-h-0 flex-1 transition-[grid-template-columns] duration-200 [grid-template-columns:var(--clair-workspace-content-columns)] max-md:[grid-template-columns:minmax(0,1fr)]"
                style={{
                  "--clair-workspace-content-columns": `${
                    contentAsideVisible
                      ? `${effectiveContentAsideWidth}px`
                      : "0px"
                  } minmax(0, 1fr)`,
                } as CSSProperties}
              >
                <aside
                  className={cn(
                    "min-h-0 min-w-0 overflow-hidden bg-[var(--emr-surface-content-panel)] max-md:hidden",
                    contentAsideVisible && "border-r border-[var(--emr-content-aside-border)]"
                  )}
                >
                  <div
                    className="h-full"
                    style={{
                      minWidth: contentAsideVisible
                        ? SHELL_LAYOUT.contentAside.minWidth
                        : 0,
                      width: contentAsideVisible ? effectiveContentAsideWidth : 0,
                    }}
                  >
                    {ContentAside && contentAsideVisible ? (
                      <ContentAside {...slotProps} />
                    ) : null}
                  </div>
                </aside>
                <div className="min-h-0 min-w-0 overflow-hidden">
                  <Content {...slotProps} />
                </div>
              </div>

            </section>

            <aside
              data-testid="workspace-right-panel"
              className={cn(
                "emr-workspace-rightpanel-responsive min-h-0 min-w-0 overflow-hidden bg-[var(--emr-surface-rightpanel)] max-md:hidden",
                rightPanelMobileFullWidth &&
                  "max-[1100px]:fixed max-[1100px]:inset-0 max-[1100px]:z-50 max-[1100px]:block max-[1100px]:rounded-none max-[1100px]:border-0",
                !instantRightPanel && "transition-opacity duration-150",
                rightPanelVisible &&
                  (rightPanelDetached
                    ? "rounded-[var(--emr-radius-panel)] border border-[var(--emr-border-strong)] shadow-xs"
                    : "border-l border-[var(--emr-border-strong)]"),
                !rightPanelVisible && "pointer-events-none opacity-0"
              )}
            >
              <div
                className="flex h-full w-full flex-col"
                style={{ minWidth: rightPanelVisible ? effectiveRightPanelWidth : 0 }}
              >
                {RightPanel && rightPanelVisible ? <RightPanel {...slotProps} /> : null}
              </div>
            </aside>

            <AnimatePresence>
              {shouldRenderWorkspaceDrawer ? (
                <motion.aside
                  key={drawerMotionKey}
                  initial={{ x: 480, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 480, opacity: 0 }}
                  transition={{
                    duration: CommonProfileDrawer && prefersReducedMotion ? 0 : 0.18,
                    ease: "easeOut",
                  }}
                  className={cn(
                    "absolute bottom-0 right-0 top-0",
                    CommonProfileDrawer
                      ? "bg-transparent"
                      : "border-l border-[var(--emr-border-strong)] bg-[var(--emr-surface-rightpanel)] shadow-2xl",
                  )}
                  data-testid="workspace-drawer"
                  style={{
                    gridColumn: "1 / -1",
                    gridRow: "1 / -1",
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
                  ) : EffectiveModuleDrawer ? (
                    <EffectiveModuleDrawer {...slotProps} />
                  ) : null}
                </motion.aside>
              ) : null}
            </AnimatePresence>
          </main>
        );
      }}
    </SlotAvailabilityProvider>
  );
}
