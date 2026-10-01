"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { useReducedMotion } from "framer-motion";
import { CdsNavigationMaximize2Icon, CdsNavigationMinimize2Icon } from "@/components/cds-icons/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLayoutStore } from "@/stores/layout-store";
import type { ModuleDefinition, ShellComponentProps } from "@/types/emr";
import { SHELL_LAYOUT } from "./layout-contract";

type DocumentLayoutContext = {
  toolbarHost: HTMLDivElement | null;
  canToggle: boolean;
  narrow: boolean;
  toggleWidth: () => void;
  historyControlsId: string;
  rightControlsId: string;
};
const DocumentLayout = createContext<DocumentLayoutContext | null>(null);
export const useWorkspaceDocumentLayout = () => useContext(DocumentLayout);

export function WorkspaceDocumentToolbar({ children }: { children: ReactNode }) {
  const layout = useWorkspaceDocumentLayout();
  if (!layout) return children;
  return layout.toolbarHost ? createPortal(children, layout.toolbarHost) : null;
}

export function WorkspaceDocumentWidthToggle() {
  const layout = useWorkspaceDocumentLayout();
  if (!layout) return null;
  const Icon = layout.narrow ? CdsNavigationMaximize2Icon : CdsNavigationMinimize2Icon;
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="bg-card"
      hidden={!layout.canToggle}
      data-workspace-width-toggle="true"
      aria-pressed={layout.narrow}
      onClick={layout.toggleWidth}
    >
      <Icon data-icon="inline-start" />
      {layout.narrow ? "넓게 보기" : "좁게 보기"}
    </Button>
  );
}

type PanelPosition = { left: number; top: number; right: number; height: number };
function WorkspacePanel({
  children, open, modal, side, controlsId, label, width, position, onClose,
}: {
  children: ReactNode;
  open: boolean;
  modal: boolean;
  side: "left" | "right";
  controlsId: string;
  label: string;
  width: number;
  position: PanelPosition;
  onClose: () => void;
}) {
  const popupRef = useRef<HTMLDivElement>(null);
  const wasModal = useRef(false);
  useEffect(() => {
    if (open && modal && !wasModal.current) {
      popupRef.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    }
    if (!open && wasModal.current) {
      document.querySelector<HTMLButtonElement>(`button[aria-controls="${controlsId}"]`)?.focus({ preventScroll: true });
    }
    wasModal.current = open && modal;
  }, [controlsId, modal, open]);

  return (
    <DialogPrimitive.Root
      open={open}
      modal={modal}
      disablePointerDismissal={!modal}
      onOpenChange={(nextOpen) => { if (!nextOpen && modal) onClose(); }}
    >
      {/* A stable portal preserves panel state and nested dialogs across presentation changes. */}
      <DialogPrimitive.Portal>
      {open && modal ? <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/10" /> : null}
      <DialogPrimitive.Popup
        ref={popupRef}
        id={controlsId}
        aria-label={label}
        role={modal ? "dialog" : "complementary"}
        aria-modal={modal || undefined}
        initialFocus={modal}
        finalFocus={modal ? () => document.querySelector<HTMLElement>(`button[aria-controls="${controlsId}"]`) ?? false : false}
        data-workspace-panel={side}
        data-presentation={modal ? "modal" : "inline"}
        className={cn(
          "fixed flex min-h-0 min-w-0 flex-col overflow-hidden bg-[var(--emr-surface-content-panel)] outline-none",
          side === "left" ? "col-start-1 row-start-1 border-r" : "col-start-3 row-start-1 border-l",
          "border-[var(--emr-border-strong)]",
          modal ? "z-50 rounded-[var(--emr-radius-panel)] border shadow-lg" : "z-10",
          !open && "hidden",
        )}
        style={{
          left: side === "left" ? Math.max(8, position.left) : Math.max(8, position.right - width),
          top: Math.max(8, position.top),
          width,
          maxWidth: "calc(100vw - 16px)",
          height: position.height,
          maxHeight: `calc(100dvh - ${Math.max(8, position.top) + 8}px)`,
        }}
      >
        {children}
      </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function WorkspaceDocumentLayout({
  moduleDefinition, slotProps,
}: {
  moduleDefinition: ModuleDefinition;
  slotProps: ShellComponentProps;
}) {
  const config = moduleDefinition.documentLayout!;
  const Content = moduleDefinition.content;
  const ContentAside = moduleDefinition.contentAside;
  const RightPanel = moduleDefinition.rightPanel;
  const areaRef = useRef<HTMLDivElement>(null);
  const centerRef = useRef<HTMLDivElement>(null);
  const [toolbarHost, setToolbarHost] = useState<HTMLDivElement | null>(null);
  const [areaWidth, setAreaWidth] = useState(0);
  const [documentSpace, setDocumentSpace] = useState(0);
  const [position, setPosition] = useState<PanelPosition>({ left: 0, top: 0, right: 0, height: 0 });
  const [animateWidth, setAnimateWidth] = useState(false);
  const reduceMotion = useReducedMotion();
  const preferenceKey = `${slotProps.workspaceId}:${slotProps.moduleId}`;
  const widthMode = useLayoutStore((state) => state.documentWidthModes[preferenceKey] ?? (slotProps.moduleId === "treatment" ? "wide" : "narrow"));
  const setWidthMode = useLayoutStore((state) => state.setDocumentWidthMode);
  const leftOpen = useLayoutStore((state) => state.contentAsideOpen) && Boolean(slotProps.hasContentAside);
  const rightOpen = useLayoutStore((state) => state.rightPanelOpen) && Boolean(slotProps.hasRightPanel);
  const latest = useLayoutStore((state) => state.lastContentPanelOpened);
  const closeLeft = useLayoutStore((state) => state.setContentAsideOpen);
  const closeRight = useLayoutStore((state) => state.setRightPanelOpen);
  const leftWidth = SHELL_LAYOUT.contentAside.defaultWidth;
  const { rightPanelWidth: rightWidth, minimumCenterWidth, documentPadding, transitionMs } = SHELL_LAYOUT.documentLayout;
  const overlay = areaWidth > 0 && (leftOpen || rightOpen) &&
    areaWidth - (leftOpen ? leftWidth : 0) - (rightOpen ? rightWidth : 0) < minimumCenterWidth;
  const modalSide = rightOpen && (!leftOpen || latest === "right") ? "right" : "left";
  const inlineLeft = leftOpen && !overlay;
  const inlineRight = rightOpen && !overlay;
  const historyControlsId = `${config.historyPanelId}-surface`;
  const rightControlsId = config.rightPanelId ? `${config.rightPanelId}-surface` : "";

  useEffect(() => {
    const area = areaRef.current;
    const center = centerRef.current;
    if (!area || !center) return;
    let previousAreaWidth = -1;
    let previousDocumentSpace = -1;
    const measure = () => {
      const rect = area.getBoundingClientRect();
      const available = Math.max(0, center.clientWidth - documentPadding * 2);
      if (area.clientWidth !== previousAreaWidth || available !== previousDocumentSpace) {
        setAnimateWidth(false);
        setAreaWidth(area.clientWidth);
        setDocumentSpace(available);
        previousAreaWidth = area.clientWidth;
        previousDocumentSpace = available;
        if (available <= config.narrowWidth && document.activeElement?.hasAttribute("data-workspace-width-toggle")) {
          document.querySelector<HTMLButtonElement>(`button[aria-controls="${RightPanel ? rightControlsId : historyControlsId}"]`)?.focus({ preventScroll: true });
        }
      }
      setPosition((previous) => previous.left === rect.left && previous.top === rect.top && previous.right === rect.right && previous.height === rect.height
        ? previous : { left: rect.left, top: rect.top, right: rect.right, height: rect.height });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(area);
    observer.observe(center);
    measure();
    return () => observer.disconnect();
  }, [RightPanel, config.narrowWidth, documentPadding, historyControlsId, rightControlsId]);

  useEffect(() => {
    if (overlay && leftOpen && rightOpen) {
      if (modalSide === "right") closeLeft(false);
      else closeRight(false);
    }
  }, [closeLeft, closeRight, leftOpen, modalSide, overlay, rightOpen]);

  const narrow = widthMode === "narrow";
  const canToggle = documentSpace > config.narrowWidth;
  const targetWidth = documentSpace > 0
    ? narrow ? Math.min(config.narrowWidth, documentSpace) : documentSpace
    : config.narrowWidth;
  return (
    <DocumentLayout.Provider value={{
      toolbarHost, canToggle, narrow, historyControlsId, rightControlsId,
      toggleWidth: () => {
        setAnimateWidth(true);
        setWidthMode(preferenceKey, narrow ? "wide" : "narrow");
      },
    }}>
      <div ref={setToolbarHost} data-slot="instruction-header-title-bar" data-testid="workspace-document-toolbar" className="shrink-0 border-b border-[var(--emr-border-subtle)] px-4 empty:hidden" />
      <div ref={areaRef} data-testid="workspace-document-area" className="relative grid min-h-0 flex-1" style={{ gridTemplateColumns: `${inlineLeft ? leftWidth : 0}px minmax(0, 1fr) ${inlineRight ? rightWidth : 0}px` }}>
        <WorkspacePanel open={leftOpen && (!overlay || modalSide === "left")} modal={overlay} side="left" controlsId={historyControlsId} label={config.historyLabel} width={leftWidth} position={position} onClose={() => closeLeft(false)}>
          {ContentAside ? <ContentAside {...slotProps} /> : null}
        </WorkspacePanel>
        <div ref={centerRef} data-testid="workspace-document-center" className="col-start-2 row-start-1 min-h-0 min-w-0 overflow-hidden px-4">
          <div data-testid="workspace-document" data-width-mode={widthMode} className="mx-auto h-full min-h-0 w-full" style={{ maxWidth: targetWidth, transition: animateWidth && !reduceMotion ? `max-width ${transitionMs}ms cubic-bezier(.2,0,0,1)` : "none" }}>
            <Content {...slotProps} />
          </div>
        </div>
        {RightPanel && config.rightLabel ? <WorkspacePanel open={rightOpen && (!overlay || modalSide === "right")} modal={overlay} side="right" controlsId={rightControlsId} label={config.rightLabel} width={rightWidth} position={position} onClose={() => closeRight(false)}>
          {RightPanel ? <RightPanel {...slotProps} /> : null}
        </WorkspacePanel> : null}
      </div>
      <span className="sr-only" aria-live="polite">{overlay ? `${modalSide === "left" ? config.historyLabel : config.rightLabel} 패널을 공간이 좁아 겹쳐 표시합니다. 작성 중인 입력은 유지됩니다.` : ""}</span>
    </DocumentLayout.Provider>
  );
}
