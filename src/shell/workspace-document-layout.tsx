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
  historyVisible: boolean;
  rightVisible: boolean;
  toggleHistory: () => void;
  toggleRight: () => void;
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
  children, open, visible, drawer, side, controlsId, label, width, position, sliding = side === "left", instant = true, presentationInstant, reduceMotion, onClose,
}: {
  children: ReactNode;
  open: boolean;
  visible: boolean;
  drawer: boolean;
  side: "left" | "right";
  controlsId: string;
  label: string;
  width: number;
  position: PanelPosition;
  sliding?: boolean;
  instant?: boolean;
  presentationInstant: boolean;
  reduceMotion: boolean;
  onClose: (pointer: boolean) => void;
}) {
  const popupRef = useRef<HTMLDivElement>(null);
  const [hasOpened, setHasOpened] = useState(open);
  if (open && !hasOpened) setHasOpened(true);
  const [shadowState, setShadowState] = useState({ open, visible, drawer, instant: true });
  if (shadowState.open !== open || shadowState.visible !== visible || shadowState.drawer !== drawer) {
    // Resize changes elevation without replaying entry; keyboard/compact changes stay immediate.
    setShadowState({ open, visible, drawer, instant: reduceMotion || presentationInstant || (shadowState.open !== open ? instant : shadowState.visible !== visible) });
  }

  return (
    <div className={open && !visible ? "hidden" : "contents"} inert={!visible}>
    <DialogPrimitive.Root
      open={open}
      modal={false}
      disablePointerDismissal
      onOpenChange={(nextOpen, details) => {
        // Base UI listens for Escape globally, including other open, non-modal roots.
        if (!nextOpen && details.reason === "escape-key" && visible && popupRef.current?.contains(document.activeElement)) {
          onClose(false);
        } else {
          details.cancel();
          details.allowPropagation();
        }
      }}
    >
      {/* A stable portal preserves panel state and nested dialogs across presentation changes. */}
      <DialogPrimitive.Portal
        keepMounted={side === "left" && (open || hasOpened)}
        data-workspace-panel-portal={side}
        className={cn("fixed", styles.panelPortal)}
        style={{
          left: Math.max(8, side === "left" ? position.left : position.right - width), top: Math.max(8, position.top),
          width, height: position.height, maxWidth: "calc(100vw - 16px)",
          maxHeight: `calc(100dvh - ${Math.max(8, position.top) + 8}px)`,
          pointerEvents: visible ? undefined : "none",
          visibility: open && !visible ? "hidden" : undefined,
        }}
      >
      {/* Nested Base UI portals stay outside this visual mask. */}
      <div className={cn("absolute inset-0", styles.panelClip)} data-workspace-panel-clip={side}>
      <DialogPrimitive.Popup
        ref={popupRef}
        id={controlsId}
        aria-label={label}
        role="complementary"
        aria-hidden={!visible || undefined}
        inert={!visible}
        initialFocus={false}
        finalFocus={false}
        data-workspace-panel={side}
        data-presentation={drawer ? "drawer" : "inline"}
        data-instant={instant || undefined}
        data-shadow-instant={shadowState.instant || reduceMotion || undefined}
        data-shadow-visible={open && visible && drawer || undefined}
        className={cn(
          "flex min-h-0 min-w-0 flex-col outline-none",
          "absolute inset-0", styles.panel, sliding && styles.slide,
          !open && (!sliding || instant) && "hidden",
        )}
      >
        <div className={cn("relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--emr-surface-content-panel)] border-[var(--emr-border-strong)]", styles.panelSurface, side === "left" ? "border-r" : "border-l")}>
          {children}
        </div>
      </DialogPrimitive.Popup>
      </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
    </div>
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
  const panelIntent = useRef<{ left: number; pointer: boolean; side: "left" | "right" } | null>(null);
  const [historyMotion, setHistoryMotion] = useState(false);
  const [receiptMotion, setReceiptMotion] = useState(false);
  const [toolbarHost, setToolbarHost] = useState<HTMLDivElement | null>(null);
  const [areaWidth, setAreaWidth] = useState(0);
  const [toolbarHeight, setToolbarHeight] = useState(0);
  const [position, setPosition] = useState<PanelPosition>({ left: 0, top: 0, right: 0, height: 0 });
  const [animateWidth, setAnimateWidth] = useState(false);
  const [wasDrawer, setWasDrawer] = useState(false);
  const [compactSurface, setCompactSurface] = useState<"left" | "right" | "body">("body");
  const previousCompact = useRef(false);
  const compactEntrySurface = useRef<"left" | "right" | "body" | null>(null);
  const previousDrawer = useRef(false);
  const resizeIntent = useRef<{ left: number } | null>(null);
  const pendingFocusReturn = useRef<"left" | "right" | null>(null);
  const reduceMotion = useSyncExternalStore(subscribeReducedMotion, readReducedMotion, serverReducedMotion);
  const preferenceKey = `${slotProps.workspaceId}:${slotProps.moduleId}`;
  const widthMode = useLayoutStore((state) => state.documentWidthModes[preferenceKey] ?? "wide");
  const setWidthMode = useLayoutStore((state) => state.setDocumentWidthMode);
  const leftOpen = useLayoutStore((state) => state.contentAsideOpen) && Boolean(slotProps.hasContentAside);
  const rightOpen = useLayoutStore((state) => state.rightPanelOpen) && Boolean(slotProps.hasRightPanel);
  const receiptSliding = slotProps.moduleId === "lab";
  const latest = useLayoutStore((state) => state.lastContentPanelOpened);
  const closeLeft = useLayoutStore((state) => state.setContentAsideOpen);
  const closeRight = useLayoutStore((state) => state.setRightPanelOpen);
  const leftWidth = SHELL_LAYOUT.contentAside.defaultWidth;
  const { rightPanelWidth: rightWidth, minimumCenterWidth, drawerReturnBuffer, compactPanelWidth, documentPadding, transitionMs } = SHELL_LAYOUT.documentLayout;
  const overlay = areaWidth > 0 && (leftOpen || rightOpen) &&
    areaWidth - (leftOpen ? leftWidth : 0) - (rightOpen ? rightWidth : 0) < minimumCenterWidth + (wasDrawer ? drawerReturnBuffer : 0);
  if (wasDrawer !== overlay) setWasDrawer(overlay);
  const compact = overlay && areaWidth < compactPanelWidth;
  const [shadowPresentation, setShadowPresentation] = useState({ areaWidth, leftOpen, rightOpen, compact, instant: true });
  if (shadowPresentation.areaWidth !== areaWidth || shadowPresentation.leftOpen !== leftOpen || shadowPresentation.rightOpen !== rightOpen || shadowPresentation.compact !== compact) {
    const instant = compact || shadowPresentation.compact || (shadowPresentation.areaWidth !== areaWidth
      ? shadowPresentation.areaWidth === 0 || areaWidth === 0
      : shadowPresentation.leftOpen !== leftOpen ? !historyMotion : !receiptMotion);
    setShadowPresentation({ areaWidth, leftOpen, rightOpen, compact, instant });
  }
  const historyVisible = leftOpen && (!compact || compactSurface === "left");
  const rightVisible = rightOpen && (!compact || compactSurface === "right");
  const inlineLeft = leftOpen && !overlay;
  const inlineRight = rightOpen && !overlay;
  const historyControlsId = `${config.historyPanelId}-surface`;
  const rightControlsId = config.rightPanelId ? `${config.rightPanelId}-surface` : "";
  const documentSpace = Math.max(0, areaWidth - (inlineLeft ? leftWidth : 0) - (inlineRight ? rightWidth : 0) - documentPadding * 2);
  const narrow = widthMode === "narrow";
  const canToggle = documentSpace > config.narrowWidth;
  const targetWidth = areaWidth > 0 ? narrow ? Math.min(config.narrowWidth, documentSpace) : documentSpace : config.narrowWidth;
  const leftInset = (inlineLeft ? leftWidth : 0) + documentPadding;
  const documentLeft = Math.max(leftInset, Math.min((areaWidth - targetWidth) / 2, areaWidth - (inlineRight ? rightWidth : 0) - documentPadding - targetWidth));
  const panelWidth = Math.min(leftWidth, Math.max(0, areaWidth - 16));
  const switcherHeight = compact ? 64 : 0;

  const focusPanelTrigger = (side: "left" | "right") => {
    const controlsId = side === "left" ? historyControlsId : rightControlsId;
    const switcher = areaRef.current?.querySelector<HTMLButtonElement>('[data-panel-switch="body"]');
    const trigger = compact ? switcher : document.querySelector<HTMLButtonElement>(`button[aria-controls="${controlsId}"]`);
    (trigger ?? areaRef.current?.querySelector<HTMLButtonElement>('[data-panel-switch="body"]'))?.focus({ preventScroll: true });
  };

  useLayoutEffect(() => {
    const area = areaRef.current;
    const center = centerRef.current;
    if (!area || !center) return;
    let previousAreaWidth = -1;
    const measure = () => {
      const rect = area.getBoundingClientRect();
      const state = useLayoutStore.getState();
      const requestedPanels = (state.contentAsideOpen && slotProps.hasContentAside ? leftWidth : 0) + (state.rightPanelOpen && slotProps.hasRightPanel ? rightWidth : 0);
      const willOverlay = requestedPanels > 0 && area.clientWidth - requestedPanels < minimumCenterWidth + (previousDrawer.current ? drawerReturnBuffer : 0);
      if (willOverlay && area.clientWidth < compactPanelWidth && !previousCompact.current) {
        const left = document.getElementById(historyControlsId);
        const right = document.getElementById(rightControlsId);
        // Sample before concealment commits, while the currently focused input is still interactive.
        const owner = left?.hasAttribute("data-nested-dialog-open") || left?.contains(document.activeElement) ? "left"
          : right?.hasAttribute("data-nested-dialog-open") || right?.contains(document.activeElement) ? "right"
          : documentRef.current?.contains(document.activeElement) ? "body"
          : state.rightPanelOpen && (!state.contentAsideOpen || state.lastContentPanelOpened === "right") ? "right" : "left";
        compactEntrySurface.current = owner;
        setCompactSurface(owner);
      }
      const available = area.clientWidth - (willOverlay ? 0 : requestedPanels) - documentPadding * 2;
      if (available <= config.narrowWidth && document.activeElement?.hasAttribute("data-workspace-width-toggle")) {
        document.querySelector<HTMLButtonElement>(`button[aria-controls="${RightPanel ? rightControlsId : historyControlsId}"]`)?.focus({ preventScroll: true });
      }
      if (area.clientWidth !== previousAreaWidth) {
        resizeIntent.current = previousAreaWidth > 0 ? { left: documentRef.current?.getBoundingClientRect().left ?? 0 } : null;
        setAnimateWidth(false);
        setHistoryMotion(false);
        setReceiptMotion(false);
        panelIntent.current = null;
        documentAnimation.current?.cancel();
        center.removeAttribute("data-history-moving");
        setAreaWidth(area.clientWidth);
        previousAreaWidth = area.clientWidth;
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
  }, [RightPanel, compactPanelWidth, config.narrowWidth, documentPadding, drawerReturnBuffer, historyControlsId, leftWidth, minimumCenterWidth, rightControlsId, rightWidth, slotProps.hasContentAside, slotProps.hasRightPanel, toolbarHost]);

  useLayoutEffect(() => {
    if (compact && !previousCompact.current) {
      const left = document.getElementById(historyControlsId);
      const right = document.getElementById(rightControlsId);
      // A nested modal is portaled outside its parent panel but keeps its ownership.
      const owner = left?.hasAttribute("data-nested-dialog-open") || left?.contains(document.activeElement) ? "left"
        : right?.hasAttribute("data-nested-dialog-open") || right?.contains(document.activeElement) ? "right"
        : documentRef.current?.contains(document.activeElement) ? "body"
        : rightOpen && (!leftOpen || latest === "right") ? "right" : "left";
      setCompactSurface(compactEntrySurface.current ?? owner);
      compactEntrySurface.current = null;
    } else if (compact && ((compactSurface === "left" && !leftOpen) || (compactSurface === "right" && !rightOpen))) {
      setCompactSurface("body");
    }
    previousCompact.current = compact;
  }, [compact, compactSurface, historyControlsId, latest, leftOpen, rightControlsId, rightOpen]);

  useLayoutEffect(() => {
    const side = pendingFocusReturn.current;
    if (side && !(side === "left" ? leftOpen : rightOpen)) {
      pendingFocusReturn.current = null;
      focusPanelTrigger(side);
    }
  });

  const previousLeftOpen = useRef(leftOpen);
  const previousRightOpen = useRef(rightOpen);
  const previousInlineRight = useRef(inlineRight);
  useLayoutEffect(() => {
    const leftChanged = previousLeftOpen.current !== leftOpen;
    const rightChanged = previousRightOpen.current !== rightOpen;
    const presentationChanged = previousDrawer.current !== overlay;
    if (leftChanged || previousInlineRight.current !== inlineRight) setAnimateWidth(false);
    previousLeftOpen.current = leftOpen;
    previousRightOpen.current = rightOpen;
    previousInlineRight.current = inlineRight;
    previousDrawer.current = overlay;
    const intent = panelIntent.current;
    panelIntent.current = null;
    if (leftChanged && intent?.side !== "left") setHistoryMotion(false);
    if (rightChanged && intent?.side !== "right") setReceiptMotion(false);
    const element = documentRef.current;
    documentAnimation.current?.cancel();
    centerRef.current?.removeAttribute("data-history-moving");
    const resize = resizeIntent.current;
    resizeIntent.current = null;
    const changed = intent?.side === "left" ? leftChanged : receiptSliding && rightChanged;
    if (reduceMotion || !element || (!(presentationChanged && resize) && (!changed || !intent?.pointer))) return;
    // Measure the final layout once, then move the title and body together without scaling.
    const startLeft = intent?.left ?? resize?.left;
    if (startLeft === undefined) return;
    const delta = startLeft - element.getBoundingClientRect().left;
    if (Math.abs(delta) < 1) return;
    const tokens = getComputedStyle(element);
    const opening = presentationChanged || (intent?.side === "left" ? leftOpen : rightOpen);
    const timing = tokens.getPropertyValue(opening ? "--clair-motion-duration-drawer-enter" : "--clair-motion-duration-drawer-exit").trim();
    const duration = parseFloat(timing) * (timing.endsWith("ms") ? 1 : 1000);
    centerRef.current?.setAttribute("data-history-moving", "true");
    const animation = element.animate([{ transform: `translateX(${delta}px)` }, { transform: "translateX(0)" }], {
      duration, easing: tokens.getPropertyValue("--clair-motion-easing-panel-enter").trim(),
    });
    documentAnimation.current = animation;
    void animation.finished.then(() => {
      if (documentAnimation.current === animation) centerRef.current?.removeAttribute("data-history-moving");
    }).catch(() => {});
  }, [areaWidth, documentLeft, inlineLeft, inlineRight, leftOpen, overlay, receiptSliding, reduceMotion, rightOpen, targetWidth]);

  useEffect(() => () => { documentAnimation.current?.cancel(); }, []);

  const preparePanelMotion = (side: "left" | "right", pointer: boolean) => {
    panelIntent.current = { left: documentRef.current?.getBoundingClientRect().left ?? 0, pointer, side };
    if (side === "left") setHistoryMotion(pointer && !reduceMotion);
    else setReceiptMotion(pointer && !reduceMotion);
    setAnimateWidth(false);
    const controlsId = side === "left" ? historyControlsId : rightControlsId;
    const open = side === "left" ? leftOpen : rightOpen;
    if (open && document.getElementById(controlsId)?.contains(document.activeElement)) {
      pendingFocusReturn.current = side;
    }
  };
  const capturePanelClick = (event: MouseEvent<HTMLDivElement>) => {
    const button = event.target instanceof Element ? event.target.closest("button") : null;
    if (button?.getAttribute("aria-controls") === historyControlsId || button?.hasAttribute("data-workspace-history-collapse")) {
      preparePanelMotion("left", event.detail > 0);
    } else if (button?.getAttribute("aria-controls") === rightControlsId || button?.hasAttribute("data-workspace-receipt-collapse")) {
      preparePanelMotion("right", event.detail > 0);
    }
  };
  const panelPosition = { ...position, height: Math.max(0, position.height - switcherHeight) };
  const rightPosition = receiptSliding ? panelPosition : { ...panelPosition, top: position.top + toolbarHeight, height: Math.max(0, panelPosition.height - toolbarHeight) };
  const togglePanel = (side: "left" | "right") => {
    const visible = side === "left" ? historyVisible : rightVisible;
    if (!visible) {
      compactEntrySurface.current = side;
      setCompactSurface(side);
    }
    (side === "left" ? closeLeft : closeRight)(!visible);
  };
  return (
    <DocumentLayout.Provider value={{
      toolbarHost, canToggle, narrow, historyControlsId, rightControlsId, historyVisible, rightVisible,
      toggleHistory: () => togglePanel("left"), toggleRight: () => togglePanel("right"),
      toggleWidth: () => {
        setAnimateWidth(true);
        setWidthMode(preferenceKey, narrow ? "wide" : "narrow");
      },
    }}>
      <div ref={areaRef} onClickCapture={capturePanelClick} data-testid="workspace-document-area" data-presentation={overlay ? "drawer" : "inline"} className="relative grid min-h-0 flex-1 overflow-clip" style={{ gridTemplateColumns: `${inlineLeft ? leftWidth : 0}px minmax(0, 1fr) ${inlineRight ? rightWidth : 0}px` }}>
        <WorkspacePanel key={historyControlsId} open={leftOpen} visible={historyVisible} drawer={overlay} side="left" controlsId={historyControlsId} label={config.historyLabel} width={panelWidth} position={panelPosition} instant={!historyMotion || Boolean(reduceMotion)} presentationInstant={shadowPresentation.instant} reduceMotion={reduceMotion} onClose={(pointer) => { preparePanelMotion("left", pointer); closeLeft(false); }}>
          {ContentAside ? <ContentAside {...slotProps} /> : null}
        </WorkspacePanel>
        <div ref={centerRef} data-testid="workspace-document-center" onFocusCapture={(event) => {
          if (compact && centerRef.current?.contains(event.target as Node)) setCompactSurface("body");
        }} className={cn(styles.center, "col-start-2 row-start-1 min-h-0 min-w-0 overflow-clip px-4 has-[[data-chart-start-locked=true]]:bg-[var(--emr-surface-panel)] has-[[data-chart-start-locked=true]]:px-0")} style={{ paddingBottom: switcherHeight }}>
          <div ref={documentRef} data-testid="workspace-document" data-width-mode={widthMode} className="flex h-full min-h-0 w-full flex-col has-[[data-chart-start-locked=true]]:!max-w-none has-[[data-chart-start-locked=true]]:!ml-0" style={{ maxWidth: targetWidth, marginLeft: documentLeft - leftInset, transitionProperty: "max-width, margin-left", transitionDuration: animateWidth && !reduceMotion ? `${transitionMs}ms` : "0s", transitionTimingFunction: "cubic-bezier(.2,0,0,1)" }}>
            <div ref={setToolbarHost} data-slot="instruction-header-title-bar" data-testid="workspace-document-toolbar" className="shrink-0 empty:hidden" />
            <div className="min-h-0 flex-1"><Content {...slotProps} /></div>
          </div>
        </div>
        {RightPanel && config.rightLabel ? <WorkspacePanel key={rightControlsId} open={rightOpen} visible={rightVisible} drawer={overlay} side="right" controlsId={rightControlsId} label={config.rightLabel} width={panelWidth} position={rightPosition} sliding={receiptSliding} instant={!receiptMotion || Boolean(reduceMotion)} presentationInstant={shadowPresentation.instant} reduceMotion={reduceMotion} onClose={(pointer) => { preparePanelMotion("right", pointer); closeRight(false); }}>
          {RightPanel ? <RightPanel {...slotProps} /> : null}
        </WorkspacePanel> : null}
        {compact ? <div data-testid="workspace-panel-switcher" role="group" aria-label="작업 영역 선택" className="absolute inset-x-0 bottom-0 z-20 flex min-h-16 items-center gap-1 border-t bg-card p-2">
          {leftOpen ? <Button size="sm" variant="outline" className="min-w-0 flex-1 whitespace-normal px-1 text-xs leading-tight" data-panel-switch="left" aria-controls={historyControlsId} aria-pressed={historyVisible} onClick={() => setCompactSurface("left")}>이력 보기</Button> : null}
          {rightOpen ? <Button size="sm" variant="outline" className="min-w-0 flex-1 whitespace-normal px-1 text-xs leading-tight" data-panel-switch="right" aria-controls={rightControlsId} aria-pressed={rightVisible} onClick={() => setCompactSurface("right")}>{receiptSliding ? "수신함 보기" : slotProps.moduleId === "billing" ? "수납 요약 보기" : "종합소견 보기"}</Button> : null}
          <Button size="sm" variant="outline" className="min-w-0 flex-1 whitespace-normal px-1 text-xs leading-tight" data-panel-switch="body" aria-pressed={!historyVisible && !rightVisible} onClick={() => setCompactSurface("body")}>본문 보기</Button>
        </div> : null}
      </div>
      <span className="sr-only" aria-live="polite">{overlay ? compact ? "공간이 좁아 작업 영역 선택으로 이력, 보조 패널, 본문을 전환할 수 있습니다. 작성 중인 입력은 유지됩니다." : "공간이 좁아 패널을 본문 위에 표시합니다. 가려지지 않은 본문을 조작할 수 있습니다." : ""}</span>
    </DocumentLayout.Provider>
  );
}
