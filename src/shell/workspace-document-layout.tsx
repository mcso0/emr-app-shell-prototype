"use client";

import { createContext, useContext, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { CdsNavigationMaximize2Icon, CdsNavigationMinimize2Icon } from "@/components/cds-icons/navigation";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useLayoutStore } from "@/stores/layout-store";
import type { ModuleDefinition, ShellComponentProps } from "@/types/emr";
import { SHELL_LAYOUT } from "./layout-contract";
import styles from "./workspace-document-layout.module.css";

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

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";
function subscribeReducedMotion(notify: () => void) {
  const media = window.matchMedia(reducedMotionQuery);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
}
const readReducedMotion = () => window.matchMedia(reducedMotionQuery).matches;
const serverReducedMotion = () => false;

export function WorkspaceDocumentToolbar({ children }: { children: ReactNode }) {
  const layout = useWorkspaceDocumentLayout();
  if (!layout) return children;
  return layout.toolbarHost ? createPortal(children, layout.toolbarHost) : null;
}

export function WorkspaceDocumentWidthToggle({
  showWhenUnavailable = false,
}: { showWhenUnavailable?: boolean }) {
  const layout = useWorkspaceDocumentLayout();
  const tooltipId = useId();
  if (!layout) return null;
  const Icon = layout.narrow ? CdsNavigationMaximize2Icon : CdsNavigationMinimize2Icon;
  const button = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="bg-card aria-disabled:opacity-50"
      hidden={!layout.canToggle && !showWhenUnavailable}
      disabled={!layout.canToggle}
      focusableWhenDisabled={showWhenUnavailable}
      data-workspace-width-toggle="true"
      aria-pressed={layout.narrow}
      aria-describedby={showWhenUnavailable && !layout.canToggle ? tooltipId : undefined}
      onClick={layout.toggleWidth}
    >
      <Icon data-icon="inline-start" />
      {layout.narrow ? "넓게 보기" : "좁게 보기"}
    </Button>
  );
  if (!showWhenUnavailable) return button;
  return (
    <Tooltip disabled={layout.canToggle}>
      <TooltipTrigger render={button} />
      <TooltipContent id={tooltipId} role="tooltip" side="bottom">
        현재 공간에서는 두 보기의 폭이 같습니다.
      </TooltipContent>
    </Tooltip>
  );
}

type PanelPosition = { left: number; top: number; right: number; height: number };
function WorkspacePanel({
  children, open, modal, side, controlsId, label, width, position, instant = true, onClose,
}: {
  children: ReactNode;
  open: boolean;
  modal: boolean;
  side: "left" | "right";
  controlsId: string;
  label: string;
  width: number;
  position: PanelPosition;
  instant?: boolean;
  onClose: (pointer: boolean) => void;
}) {
  const popupRef = useRef<HTMLDivElement>(null);
  const wasModal = useRef(false);
  const [hasOpened, setHasOpened] = useState(open);
  if (open && !hasOpened) setHasOpened(true);
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
      onOpenChange={(nextOpen, details) => { if (!nextOpen && modal) onClose(details.reason === "outside-press"); }}
    >
      {/* A stable portal preserves panel state and nested dialogs across presentation changes. */}
      <DialogPrimitive.Portal
        keepMounted={side === "left" && (open || hasOpened)}
        className={side === "left" ? "fixed overflow-hidden" : undefined}
        style={side === "left" ? {
          left: Math.max(8, position.left), top: Math.max(8, position.top),
          width, height: position.height, maxWidth: "calc(100vw - 16px)",
          maxHeight: `calc(100dvh - ${Math.max(8, position.top) + 8}px)`,
          zIndex: modal ? 50 : 10, pointerEvents: open ? undefined : "none",
        } : undefined}
      >
      {open && modal ? <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/10" /> : null}
      <DialogPrimitive.Popup
        ref={popupRef}
        id={controlsId}
        aria-label={label}
        role={modal ? "dialog" : "complementary"}
        aria-modal={modal || undefined}
        aria-hidden={!open || undefined}
        inert={!open}
        initialFocus={modal}
        finalFocus={modal ? () => document.querySelector<HTMLElement>(`button[aria-controls="${controlsId}"]`) ?? false : false}
        data-workspace-panel={side}
        data-presentation={modal ? "modal" : "inline"}
        data-instant={instant || undefined}
        className={cn(
          "flex min-h-0 min-w-0 flex-col overflow-hidden bg-[var(--emr-surface-content-panel)] outline-none",
          side === "left" ? cn("absolute inset-0 border-r", styles.history) : "fixed border-l",
          "border-[var(--emr-border-strong)]",
          modal ? "z-50 rounded-[var(--emr-radius-panel)] border shadow-lg" : "z-10",
          !open && side === "right" && "hidden",
        )}
        style={side === "right" ? {
          left: Math.max(8, position.right - width),
          top: Math.max(8, position.top),
          width,
          maxWidth: "calc(100vw - 16px)",
          height: position.height,
          maxHeight: `calc(100dvh - ${Math.max(8, position.top) + 8}px)`,
        } : undefined}
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
  const documentRef = useRef<HTMLDivElement>(null);
  const documentAnimation = useRef<Animation | null>(null);
  const historyIntent = useRef<{ left: number; pointer: boolean } | null>(null);
  const [historyMotion, setHistoryMotion] = useState(false);
  const [toolbarHost, setToolbarHost] = useState<HTMLDivElement | null>(null);
  const [areaWidth, setAreaWidth] = useState(0);
  const [toolbarHeight, setToolbarHeight] = useState(0);
  const [position, setPosition] = useState<PanelPosition>({ left: 0, top: 0, right: 0, height: 0 });
  const [animateWidth, setAnimateWidth] = useState(false);
  const reduceMotion = useSyncExternalStore(subscribeReducedMotion, readReducedMotion, serverReducedMotion);
  const preferenceKey = `${slotProps.workspaceId}:${slotProps.moduleId}`;
  const widthMode = useLayoutStore((state) => state.documentWidthModes[preferenceKey] ?? "wide");
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
  const documentSpace = Math.max(0, areaWidth - (inlineLeft ? leftWidth : 0) - (inlineRight ? rightWidth : 0) - documentPadding * 2);

  useLayoutEffect(() => {
    const area = areaRef.current;
    const center = centerRef.current;
    if (!area || !center) return;
    let previousAreaWidth = -1;
    const measure = () => {
      const rect = area.getBoundingClientRect();
      const available = Math.max(0, center.clientWidth - documentPadding * 2);
      if (area.clientWidth !== previousAreaWidth) {
        setAnimateWidth(false);
        setHistoryMotion(false);
        historyIntent.current = null;
        documentAnimation.current?.cancel();
        center.removeAttribute("data-history-moving");
        setAreaWidth(area.clientWidth);
        previousAreaWidth = area.clientWidth;
      }
      if (available <= config.narrowWidth && document.activeElement?.hasAttribute("data-workspace-width-toggle")) {
        document.querySelector<HTMLButtonElement>(`button[aria-controls="${RightPanel ? rightControlsId : historyControlsId}"]`)?.focus({ preventScroll: true });
      }
      setToolbarHeight(toolbarHost?.getBoundingClientRect().height ?? 0);
      setPosition((previous) => previous.left === rect.left && previous.top === rect.top && previous.right === rect.right && previous.height === rect.height
        ? previous : { left: rect.left, top: rect.top, right: rect.right, height: rect.height });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(area);
    observer.observe(center);
    if (toolbarHost) observer.observe(toolbarHost);
    measure();
    return () => observer.disconnect();
  }, [RightPanel, config.narrowWidth, documentPadding, historyControlsId, rightControlsId, toolbarHost]);

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

  const previousLeftOpen = useRef(leftOpen);
  const previousInlineRight = useRef(inlineRight);
  useLayoutEffect(() => {
    const changed = previousLeftOpen.current !== leftOpen;
    if (changed || previousInlineRight.current !== inlineRight) setAnimateWidth(false);
    previousLeftOpen.current = leftOpen;
    previousInlineRight.current = inlineRight;
    const intent = historyIntent.current;
    historyIntent.current = null;
    if (changed && !intent) setHistoryMotion(false);
    const element = documentRef.current;
    documentAnimation.current?.cancel();
    centerRef.current?.removeAttribute("data-history-moving");
    if (!changed || !intent?.pointer || reduceMotion || !element) return;
    // Measure the final layout once, then move the title and body together without scaling.
    const delta = intent.left - element.getBoundingClientRect().left;
    if (Math.abs(delta) < 1) return;
    const tokens = getComputedStyle(element);
    const timing = tokens.getPropertyValue(leftOpen ? "--clair-motion-duration-drawer-enter" : "--clair-motion-duration-drawer-exit").trim();
    const duration = parseFloat(timing) * (timing.endsWith("ms") ? 1 : 1000);
    centerRef.current?.setAttribute("data-history-moving", "true");
    const animation = element.animate([{ transform: `translateX(${delta}px)` }, { transform: "translateX(0)" }], {
      duration, easing: tokens.getPropertyValue("--clair-motion-easing-panel-enter").trim(),
    });
    documentAnimation.current = animation;
    void animation.finished.then(() => {
      if (documentAnimation.current === animation) centerRef.current?.removeAttribute("data-history-moving");
    }).catch(() => {});
  }, [areaWidth, inlineLeft, inlineRight, leftOpen, reduceMotion, targetWidth]);

  useEffect(() => () => { documentAnimation.current?.cancel(); }, []);

  const prepareHistoryMotion = (pointer: boolean) => {
    historyIntent.current = { left: documentRef.current?.getBoundingClientRect().left ?? 0, pointer };
    setHistoryMotion(pointer && !reduceMotion);
    setAnimateWidth(false);
    if (leftOpen && document.querySelector(`[id="${historyControlsId}"]`)?.contains(document.activeElement)) {
      document.querySelector<HTMLButtonElement>(`button[aria-controls="${historyControlsId}"]`)?.focus({ preventScroll: true });
    }
  };
  const captureHistoryClick = (event: MouseEvent<HTMLDivElement>) => {
    const button = event.target instanceof Element ? event.target.closest("button") : null;
    if (button?.getAttribute("aria-controls") === historyControlsId || button?.hasAttribute("data-workspace-history-collapse")) {
      prepareHistoryMotion(event.detail > 0);
    }
  };
  const rightPosition = { ...position, top: position.top + toolbarHeight, height: Math.max(0, position.height - toolbarHeight) };
  return (
    <DocumentLayout.Provider value={{
      toolbarHost, canToggle, narrow, historyControlsId, rightControlsId,
      toggleWidth: () => {
        setAnimateWidth(true);
        setWidthMode(preferenceKey, narrow ? "wide" : "narrow");
      },
    }}>
      <div ref={areaRef} onClickCapture={captureHistoryClick} data-testid="workspace-document-area" className="relative grid min-h-0 flex-1 overflow-hidden" style={{ gridTemplateColumns: `${inlineLeft ? leftWidth : 0}px minmax(0, 1fr) ${inlineRight ? rightWidth : 0}px` }}>
        <WorkspacePanel key={historyControlsId} open={leftOpen && (!overlay || modalSide === "left")} modal={overlay} side="left" controlsId={historyControlsId} label={config.historyLabel} width={leftWidth} position={position} instant={!historyMotion || Boolean(reduceMotion)} onClose={(pointer) => { prepareHistoryMotion(pointer); closeLeft(false); }}>
          {ContentAside ? <ContentAside {...slotProps} /> : null}
        </WorkspacePanel>
        <div ref={centerRef} data-testid="workspace-document-center" className={cn(styles.center, "col-start-2 row-start-1 min-h-0 min-w-0 overflow-hidden px-4 has-[[data-chart-start-locked=true]]:bg-[var(--emr-surface-panel)] has-[[data-chart-start-locked=true]]:px-0")}>
          <div ref={documentRef} data-testid="workspace-document" data-width-mode={widthMode} className="mx-auto flex h-full min-h-0 w-full flex-col has-[[data-chart-start-locked=true]]:!max-w-none" style={{ maxWidth: targetWidth, transition: animateWidth && !reduceMotion ? `max-width ${transitionMs}ms cubic-bezier(.2,0,0,1)` : "none" }}>
            <div ref={setToolbarHost} data-slot="instruction-header-title-bar" data-testid="workspace-document-toolbar" className="shrink-0 empty:hidden" />
            <div className="min-h-0 flex-1"><Content {...slotProps} /></div>
          </div>
        </div>
        {RightPanel && config.rightLabel ? <WorkspacePanel open={rightOpen && (!overlay || modalSide === "right")} modal={overlay} side="right" controlsId={rightControlsId} label={config.rightLabel} width={rightWidth} position={rightPosition} onClose={() => closeRight(false)}>
          {RightPanel ? <RightPanel {...slotProps} /> : null}
        </WorkspacePanel> : null}
      </div>
      <span className="sr-only" aria-live="polite">{overlay ? `${modalSide === "left" ? config.historyLabel : config.rightLabel} 패널을 공간이 좁아 겹쳐 표시합니다. 작성 중인 입력은 유지됩니다.` : ""}</span>
    </DocumentLayout.Provider>
  );
}
