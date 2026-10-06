"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { Transition } from "framer-motion";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { ModuleDefinition } from "@/types/emr";
import type { WorkspaceListOption } from "@/features/auth/workspace-display";
import { getSidePanelNavigationHref, ModuleSidePanelContext } from "@/components/emr/module-side-panel-context";
import { modules } from "@/modules/registry";
import { cn } from "@/lib/utils";
import { useLayoutStore } from "@/stores/layout-store";
import { NavRail } from "@/shell/nav-rail";
import { SHELL_LAYOUT } from "@/shell/layout-contract";
import { WorkspaceFrame } from "@/shell/workspace-frame";
import { WorkspaceSwitcher } from "@/shell/workspace-switcher";

type ShellMainProps = {
  moduleDefinition: ModuleDefinition;
  navigationSearch: string;
  topBar: ReactNode;
  userSessionId: string | null;
  workspaceId: string;
  onNavigateModule: (href: string, moduleId: string) => void;
  onSelectWorkspace: (workspace: WorkspaceListOption) => void;
};

const PANEL_ENTER_EASE = [0.16, 0, 0.08, 1] as const;
const PANEL_EXIT_EASE = [0.32, 0, 1, 1] as const;
const PREVIEW_OPEN_DELAY = 120;
const PREVIEW_CLOSE_DELAY = 220;
const desktopQuery = "(min-width: 768px)";
const subscribeDesktop = (notify: () => void) => {
  const media = window.matchMedia(desktopQuery);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};

export function ShellMain({
  moduleDefinition,
  navigationSearch,
  topBar,
  userSessionId,
  workspaceId,
  onNavigateModule,
  onSelectWorkspace,
}: ShellMainProps) {
  const reduceMotion = useReducedMotion();
  const desktop = useSyncExternalStore(subscribeDesktop, () => window.matchMedia(desktopQuery).matches, () => true);
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const modulePanelOpen = useLayoutStore((state) => state.modulePanelOpen);
  const activeDrawer = useLayoutStore((state) => state.activeDrawer);
  const setModulePanelOpen = useLayoutStore((state) => state.setModulePanelOpen);
  const routeKey = `${pathname}?${search}`;
  const [preview, setPreview] = useState<{ moduleId: string; route: string } | null>(null);
  const [cachedSearch, setCachedSearch] = useState<Record<string, string>>(() =>
    modulePanelOpen && moduleDefinition.sidePanel ? { [moduleDefinition.id]: search } : {});
  const [observedRoute, setObservedRoute] = useState({ routeKey, modulePanelOpen, activeDrawer });
  if (observedRoute.routeKey !== routeKey || observedRoute.modulePanelOpen !== modulePanelOpen || observedRoute.activeDrawer !== activeDrawer) {
    setObservedRoute({ routeKey, modulePanelOpen, activeDrawer });
    setPreview(null);
    setCachedSearch((cache) => moduleDefinition.sidePanel && (modulePanelOpen || cache[moduleDefinition.id] !== undefined) && cache[moduleDefinition.id] !== search ? { ...cache, [moduleDefinition.id]: search } : cache);
  }
  const panelHost = useRef<HTMLDivElement>(null);
  const panelArea = useRef<HTMLDivElement>(null);
  const trigger = useRef<{ moduleId: string; element: HTMLElement } | null>(null);
  const lastTrigger = useRef<HTMLElement | null>(null);
  const suppressedTrigger = useRef<HTMLElement | null>(null);
  const panelInside = useRef(false);
  const composing = useRef(false);
  const dragging = useRef(false);
  const openTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const focusFrame = useRef<number | undefined>(undefined);
  const [sheetTop, setSheetTop] = useState(60);
  const floatingModuleId = preview?.route === routeKey && !modulePanelOpen && !activeDrawer && desktop ? preview.moduleId : null;
  const shownModuleId = modulePanelOpen && moduleDefinition.sidePanel ? moduleDefinition.id : floatingModuleId;
  const visible = Boolean(shownModuleId);
  const floating = Boolean(floatingModuleId);
  const sheet = visible && !desktop;
  const shouldShowModuleSidePanel = Boolean(modulePanelOpen && moduleDefinition.sidePanel);
  const navigationColumnWidth = shouldShowModuleSidePanel
    ? SHELL_LAYOUT.navigationColumn.openWidth
    : SHELL_LAYOUT.navigationColumn.collapsedWidth;
  const modulePanelTransition: Transition = reduceMotion
    ? { duration: 0 }
    : {
      duration: modulePanelOpen ? 0.16 : 0.12,
      ease: modulePanelOpen ? PANEL_ENTER_EASE : PANEL_EXIT_EASE,
    };
  const current = useRef({ floatingModuleId, shownModuleId, routeKey, desktop, sheet });
  useLayoutEffect(() => { current.current = { floatingModuleId, shownModuleId, routeKey, desktop, sheet }; });

  const cancelTimers = useCallback(() => {
    clearTimeout(openTimer.current);
    clearTimeout(closeTimer.current);
  }, []);
  const owns = useCallback((target: EventTarget | null) => {
    if (!(target instanceof Node)) return false;
    if (panelHost.current?.contains(target)) return true;
    const owner = target instanceof Element ? target.closest<HTMLElement>("[data-module-side-panel-owner]") : target.parentElement?.closest<HTMLElement>("[data-module-side-panel-owner]");
    return owner?.dataset.moduleSidePanelOwner === `module-side-panel-${current.current.shownModuleId}`;
  }, []);
  const hasOwnedPopup = useCallback(() =>
    [...document.querySelectorAll<HTMLElement>("[data-module-side-panel-owner]")].some((element) =>
      element.dataset.moduleSidePanelOwner === `module-side-panel-${current.current.shownModuleId}` && !element.hasAttribute("data-closed") && element.getClientRects().length > 0), []);
  const blockedByDialog = useCallback(() =>
    [...document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')].some((element) =>
      !owns(element) && !element.hasAttribute("data-closed") && element.getClientRects().length > 0), [owns]);
  const locked = useCallback(() => composing.current || dragging.current || owns(document.activeElement) || hasOwnedPopup(), [owns, hasOwnedPopup]);
  const closePreview = useCallback((returnFocus = false) => {
    cancelTimers();
    const focusInside = owns(document.activeElement);
    suppressedTrigger.current = trigger.current?.element ?? null;
    panelInside.current = false;
    setPreview(null);
    if (returnFocus && focusInside) lastTrigger.current?.focus({ preventScroll: true });
  }, [cancelTimers, owns]);
  const focusHeader = useCallback(() => {
    focusFrame.current = requestAnimationFrame(() => {
      const id = current.current.shownModuleId;
      panelHost.current?.querySelector<HTMLButtonElement>(`[data-side-panel-module="${id}"] button[aria-label$="패널 펼치기"], [data-side-panel-module="${id}"] button[aria-label$="패널 접기"]`)?.focus({ preventScroll: true });
    });
  }, []);
  const openPreview = useCallback((moduleId: string, element: HTMLElement, keyboard = false) => {
    if (!current.current.desktop || useLayoutStore.getState().modulePanelOpen || useLayoutStore.getState().activeDrawer || blockedByDialog()) return;
    if (!modules.some((module) => module.id === moduleId && module.sidePanel)) return;
    cancelTimers();
    lastTrigger.current = element;
    const previewSearch = moduleId === moduleDefinition.id ? search : navigationSearch;
    setCachedSearch((cache) => cache[moduleId] === previewSearch ? cache : { ...cache, [moduleId]: previewSearch });
    setPreview({ moduleId, route: current.current.routeKey });
    if (keyboard) focusHeader();
  }, [blockedByDialog, cancelTimers, focusHeader, moduleDefinition.id, navigationSearch, search]);
  const scheduleClose = useCallback(() => {
    clearTimeout(closeTimer.current);
    if (!current.current.floatingModuleId || locked()) return;
    const hovered = trigger.current;
    if (hovered?.element.matches(":hover")) {
      if (hovered.moduleId !== current.current.floatingModuleId && suppressedTrigger.current !== hovered.element) {
        clearTimeout(openTimer.current);
        openTimer.current = setTimeout(() => openPreview(hovered.moduleId, hovered.element), PREVIEW_OPEN_DELAY);
      }
      return;
    }
    if (panelInside.current) return;
    const route = current.current.routeKey;
    closeTimer.current = setTimeout(() => {
      if (current.current.routeKey === route && !panelInside.current && !trigger.current?.element.matches(":hover") && !locked()) closePreview();
    }, PREVIEW_CLOSE_DELAY);
  }, [closePreview, locked, openPreview]);
  const handlePreviewEnter = (moduleId: string, element: HTMLElement, pointerType: string) => {
    if (pointerType !== "mouse") return;
    cancelTimers();
    trigger.current = { moduleId, element };
    if (!modules.some((module) => module.id === moduleId && module.sidePanel)) {
      if (!locked()) closePreview();
      return;
    }
    if (!desktop || !window.matchMedia("(any-hover: hover)").matches || modulePanelOpen || activeDrawer || suppressedTrigger.current === element || blockedByDialog() || locked()) return;
    const route = routeKey;
    openTimer.current = setTimeout(() => {
      if (current.current.routeKey === route && trigger.current?.element === element && element.matches(":hover")) openPreview(moduleId, element);
    }, PREVIEW_OPEN_DELAY);
  };
  const handlePreviewLeave = (element: HTMLElement, relatedTarget: EventTarget | null, pointerType: string) => {
    if (pointerType !== "mouse" || (relatedTarget instanceof Node && element.contains(relatedTarget))) return;
    clearTimeout(openTimer.current);
    if (trigger.current?.element === element) trigger.current = null;
    if (suppressedTrigger.current === element) suppressedTrigger.current = null;
    scheduleClose();
  };
  const restoreTriggerFocus = useCallback(() => {
    requestAnimationFrame(() => {
      const previous = lastTrigger.current;
      const target = previous?.isConnected && !previous.closest("[inert]")
        ? previous
        : panelArea.current?.querySelector<HTMLButtonElement>('button[aria-label="사이드 패널 펼치기"]');
      target?.focus({ preventScroll: true });
    });
  }, []);
  const expandCurrentPanel = () => {
    if (!current.current.floatingModuleId) lastTrigger.current = panelArea.current?.querySelector<HTMLButtonElement>('button[aria-label="사이드 패널 펼치기"]') ?? null;
    closePreview();
    setModulePanelOpen(true);
    focusHeader();
  };
  const navigateFromPanel = (href: string, moduleId: string) => {
    onNavigateModule(getSidePanelNavigationHref(href, useLayoutStore.getState().modulePanelOpen), moduleId);
  };
  const togglePanel = (moduleId: string) => {
    if (modulePanelOpen) {
      closePreview();
      setModulePanelOpen(false);
      restoreTriggerFocus();
    } else if (moduleId === moduleDefinition.id) {
      expandCurrentPanel();
    } else {
      // The destination URL owns this explicit pin. A duplicate-tab dialog can
      // cancel navigation without pinning the current page as a side effect.
      const params = new URLSearchParams(cachedSearch[moduleId] ?? navigationSearch);
      params.set("modulePanel", "open");
      onNavigateModule(`/w/${workspaceId}/${moduleId}?${params.toString()}`, moduleId);
    }
  };

  useEffect(() => {
    cancelTimers();
    suppressedTrigger.current = trigger.current?.element.matches(":hover") ? trigger.current.element : null;
    trigger.current = null;
    panelInside.current = false;
    if (!modulePanelOpen && focusFrame.current !== undefined) cancelAnimationFrame(focusFrame.current);
    return cancelTimers;
  }, [routeKey, moduleDefinition.id, moduleDefinition.sidePanel, modulePanelOpen, search, activeDrawer, cancelTimers]);

  useLayoutEffect(() => {
    if (!sheet) return;
    setSheetTop(panelArea.current?.getBoundingClientRect().top ?? 60);
    focusHeader();
  }, [sheet, focusHeader]);

  useEffect(() => {
    const pointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") closePreview();
      if (owns(event.target) || trigger.current?.element.contains(event.target as Node)) return;
      dragging.current = event.pointerType === "mouse";
      closePreview(); // Leave the original click and navigation intact.
    };
    const pointerOver = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || !current.current.floatingModuleId) return;
      panelInside.current = owns(event.target);
      if (panelInside.current) clearTimeout(closeTimer.current);
      else scheduleClose();
    };
    const keyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || blockedByDialog() || hasOwnedPopup()) return;
      if (event.key === "Escape") {
        if (current.current.sheet) { event.preventDefault(); setModulePanelOpen(false); restoreTriggerFocus(); }
        else if (current.current.floatingModuleId) { event.preventDefault(); closePreview(true); }
      }
      if (event.key === "Tab" && current.current.sheet) {
        const elements = [...(panelHost.current?.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex="0"]') ?? [])].filter((element) => !element.closest("[hidden], [inert]") && !element.matches("[disabled], [aria-disabled=true]") && element.getClientRects().length > 0);
        const first = elements[0], last = elements.at(-1);
        if (event.shiftKey && (document.activeElement === first || !owns(document.activeElement))) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !owns(document.activeElement))) { event.preventDefault(); first?.focus(); }
      }
    };
    const dragStart = (event: DragEvent) => {
      if (owns(event.target)) return;
      dragging.current = true;
      closePreview();
    };
    const dragEnd = () => { dragging.current = false; scheduleClose(); };
    const blur = () => { composing.current = false; dragging.current = false; closePreview(); };
    const visibility = () => { if (document.hidden) closePreview(); };
    const observer = new MutationObserver(() => {
      if (blockedByDialog()) closePreview();
      else scheduleClose();
    });
    document.addEventListener("pointerdown", pointerDown, true);
    document.addEventListener("pointerover", pointerOver);
    document.addEventListener("keydown", keyDown);
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("dragstart", dragStart);
    document.addEventListener("dragend", dragEnd);
    document.addEventListener("pointercancel", dragEnd);
    document.addEventListener("pointerup", dragEnd);
    window.addEventListener("blur", blur);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-open", "data-closed"] });
    return () => {
      cancelTimers(); observer.disconnect();
      if (focusFrame.current !== undefined) cancelAnimationFrame(focusFrame.current);
      document.removeEventListener("pointerdown", pointerDown, true);
      document.removeEventListener("pointerover", pointerOver);
      document.removeEventListener("keydown", keyDown);
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("dragstart", dragStart);
      document.removeEventListener("dragend", dragEnd);
      document.removeEventListener("pointercancel", dragEnd);
      document.removeEventListener("pointerup", dragEnd);
      window.removeEventListener("blur", blur);
    };
  }, [blockedByDialog, cancelTimers, closePreview, hasOwnedPopup, owns, scheduleClose, setModulePanelOpen, restoreTriggerFocus]);

  const panelModules = modules.filter((module) => module.sidePanel && (cachedSearch[module.id] !== undefined || module.id === shownModuleId));
  return (
    <div
      className="grid h-full min-h-0 grid-cols-[var(--emr-navrail-width)_minmax(0,1fr)] transition-[grid-template-columns] md:grid-cols-[var(--clair-shell-main-columns)]"
      style={{
        "--clair-shell-main-columns": `${navigationColumnWidth}px minmax(0, 1fr)`,
        "--clair-shell-gap": `${SHELL_LAYOUT.shell.gap}px`,
        gap: SHELL_LAYOUT.shell.gap,
        padding: SHELL_LAYOUT.shell.bodyPadding,
        transitionDuration: reduceMotion ? "0ms" : "160ms",
        transitionTimingFunction: "var(--clair-motion-easing-panel-enter)",
      } as CSSProperties}
    >
      <section data-testid="shell-navigation-column" className="flex min-h-0 min-w-0 flex-col" style={{ gap: SHELL_LAYOUT.shell.gap }}>
        <WorkspaceSwitcher
          collapsed={!shouldShowModuleSidePanel}
          className="max-md:w-[var(--emr-navrail-width)] max-md:min-w-[var(--emr-navrail-width)] max-md:max-w-[var(--emr-navrail-width)] max-md:[&>[data-slot=workspace-switcher-label]]:hidden"
          userSessionId={userSessionId}
          workspaceId={workspaceId}
          onSelectWorkspace={onSelectWorkspace}
        />
        <div
          ref={panelArea}
          data-testid="module-panel-area"
          className="relative grid min-h-0 flex-1 grid-cols-[var(--emr-navrail-width)] transition-[grid-template-columns] md:grid-cols-[var(--clair-module-panel-columns)]"
          style={{
            "--clair-module-panel-columns": shouldShowModuleSidePanel ? `${SHELL_LAYOUT.navRailWidth}px minmax(0, ${SHELL_LAYOUT.moduleSidePanel.defaultWidth}px)` : `${SHELL_LAYOUT.navRailWidth}px 0px`,
            gap: SHELL_LAYOUT.shell.gap,
            transitionDuration: reduceMotion ? "0ms" : "160ms",
            transitionTimingFunction: "var(--clair-motion-easing-panel-enter)",
          } as CSSProperties}
        >
          <NavRail
            activeModuleId={moduleDefinition.id}
            navigationSearch={navigationSearch}
            workspaceId={workspaceId}
            onNavigateModule={onNavigateModule}
            onExpandModulePanel={expandCurrentPanel}
            previewModuleId={floatingModuleId}
            previewEnabled={desktop}
            onPreviewEnter={handlePreviewEnter}
            onPreviewLeave={handlePreviewLeave}
            onPreviewKeyboard={(moduleId, element) => openPreview(moduleId, element, true)}
            inert={sheet}
          />
          {sheet ? <div aria-hidden="true" className="fixed inset-0 z-30 bg-black/10" onPointerDown={() => { setModulePanelOpen(false); restoreTriggerFocus(); }} /> : null}
          <div
            ref={panelHost}
            data-testid="module-side-panel-host"
            data-panel-mode={floating ? "floating" : sheet ? "sheet" : visible ? "docked" : "hidden"}
            role={sheet ? "dialog" : "region"}
            aria-label={`${modules.find((module) => module.id === shownModuleId)?.label ?? moduleDefinition.label} 사이드 패널`}
            aria-modal={sheet ? true : undefined}
            aria-hidden={!visible}
            inert={!visible}
            className="h-full min-h-0 min-w-0"
            style={sheet ? { position: "fixed", right: SHELL_LAYOUT.shell.bodyPadding, top: sheetTop, bottom: SHELL_LAYOUT.shell.bodyPadding, height: "auto", width: SHELL_LAYOUT.moduleSidePanel.defaultWidth, zIndex: 40 } : { position: floating || !visible ? "absolute" : "relative", left: floating || !visible ? SHELL_LAYOUT.navRailWidth + SHELL_LAYOUT.shell.gap : undefined, top: floating || !visible ? 0 : undefined, width: visible ? SHELL_LAYOUT.moduleSidePanel.defaultWidth : 0, zIndex: floating ? 40 : undefined, pointerEvents: visible ? undefined : "none" }}
            onPointerEnter={(event) => { if (event.pointerType === "mouse") { panelInside.current = true; clearTimeout(closeTimer.current); } }}
            onPointerLeave={(event) => { if (event.pointerType !== "mouse" || owns(event.relatedTarget)) return; panelInside.current = false; scheduleClose(); }}
            onFocusCapture={() => clearTimeout(closeTimer.current)}
            onBlurCapture={(event) => { if (!owns(event.relatedTarget)) scheduleClose(); }}
            onCompositionStart={() => { composing.current = true; cancelTimers(); }}
            onCompositionEnd={() => { composing.current = false; scheduleClose(); }}
            onDragStartCapture={() => { dragging.current = true; cancelTimers(); }}
            onDragEndCapture={() => { dragging.current = false; scheduleClose(); }}
          >
            {floating ? <div aria-hidden="true" data-testid="module-side-panel-hover-bridge" className="absolute inset-y-0" style={{ left: -20, width: 20 }} /> : null}
            <aside className={cn("h-full min-h-0 min-w-0 overflow-hidden rounded-[var(--emr-radius-panel)] border border-[var(--emr-border-strong)] bg-[var(--emr-surface-sidepanel)] shadow-xs", !visible && "pointer-events-none border-transparent opacity-0")}>
              <div className="relative flex h-full flex-col" style={{ minWidth: SHELL_LAYOUT.moduleSidePanel.minWidth, width: SHELL_LAYOUT.moduleSidePanel.defaultWidth }}>
                {panelModules.map((definition) => {
                  const SidePanel = definition.sidePanel!;
                  const shown = visible && definition.id === shownModuleId;
                  return (
                    <ModuleSidePanelContext.Provider key={definition.id} value={{ moduleId: definition.id, ownerId: `module-side-panel-${definition.id}`, isCurrentModule: definition.id === moduleDefinition.id, visible: shown, floating: shown && floating, pathname: `/w/${workspaceId}/${definition.id}`, search: cachedSearch[definition.id] ?? navigationSearch, onToggle: () => togglePanel(definition.id), onNavigate: navigateFromPanel }}>
                      <motion.div id={`module-side-panel-${definition.id}`} data-side-panel-module={definition.id} hidden={!shown} inert={!shown} aria-hidden={!shown} initial={false} animate={{ opacity: shown ? 1 : 0, x: shown ? 0 : -12 }} transition={modulePanelTransition} className="h-full min-h-0">
                        <SidePanel workspaceId={workspaceId} moduleId={definition.id} moduleLabel={definition.label} hasContentAside={Boolean(definition.contentAside)} hasRightPanel={Boolean(definition.rightPanel)} onNavigateWorkspaceSurface={navigateFromPanel} />
                      </motion.div>
                    </ModuleSidePanelContext.Provider>
                  );
                })}
              </div>
            </aside>
          </div>
        </div>
      </section>
      <section data-testid="shell-right-section" className="flex min-h-0 min-w-0 flex-col" style={{ gap: SHELL_LAYOUT.shell.gap }} inert={sheet}>
        {topBar}
        <section data-testid="shell-workspace-area" className="min-h-0 min-w-0 flex-1">
          <div data-testid="workspace-frame" className="h-full min-h-0 min-w-0 [&>main]:h-full">
            <WorkspaceFrame moduleDefinition={moduleDefinition} workspaceId={workspaceId} onNavigateWorkspaceSurface={onNavigateModule} />
          </div>
        </section>
      </section>
    </div>
  );
}
