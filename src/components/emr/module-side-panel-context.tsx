"use client";

import { createContext, useContext, useEffect, useMemo, useRef, type RefObject } from "react";
import { ReadonlyURLSearchParams, usePathname, useRouter, useSearchParams } from "next/navigation";

export type ModuleSidePanelContextValue = {
  moduleId: string;
  ownerId: string;
  isCurrentModule: boolean;
  visible: boolean;
  floating: boolean;
  pathname: string;
  search: string;
  onToggle: () => void;
  onNavigate: (href: string, moduleId: string) => void;
};

// A presentation/route scope for the existing panel, never a second layout store.
export const ModuleSidePanelContext = createContext<ModuleSidePanelContextValue | null>(null);
export const useModuleSidePanel = () => useContext(ModuleSidePanelContext);

export function useModuleSidePanelSearchParams() {
  const panel = useModuleSidePanel();
  const current = useSearchParams();
  const search = panel && !panel.isCurrentModule ? panel.search : current.toString();
  return useMemo(() => new ReadonlyURLSearchParams(search), [search]);
}

export function useModuleSidePanelPathname() {
  const panel = useModuleSidePanel();
  const current = usePathname();
  return panel && !panel.isCurrentModule ? panel.pathname : current;
}

export function getSidePanelNavigationHref(href: string, pinned: boolean) {
  const url = new URL(href, "https://clair.invalid");
  url.searchParams.set("modulePanel", pinned ? "open" : "closed");
  return `${url.pathname}${url.search}${url.hash}`;
}

export function useModuleSidePanelRouter() {
  const panel = useModuleSidePanel();
  const router = useRouter();
  return useMemo(() => {
    if (!panel || (panel.isCurrentModule && !panel.floating)) return router;
    const destinationModule = (href: string) => href.split("?")[0].split("/")[3] ?? panel.moduleId;
    return {
      ...router,
      push: (href: string, options?: Parameters<typeof router.push>[1]) => {
        if (panel.isCurrentModule) router.push(getSidePanelNavigationHref(href, false), options);
        else panel.onNavigate(href, destinationModule(href));
      },
      replace: (href: string, options?: Parameters<typeof router.replace>[1]) => {
        if (panel.isCurrentModule) router.replace(getSidePanelNavigationHref(href, false), options);
        else panel.onNavigate(href, destinationModule(href));
      },
    };
  }, [panel, router]);
}

// Cached panels stay mounted. Close their portaled UI when their owner hides.
export function useModuleSidePanelPopupActions<T extends { close: () => void }>(provided?: RefObject<T | null>) {
  const panel = useModuleSidePanel();
  const local = useRef<T | null>(null);
  const actions = provided ?? local;
  useEffect(() => {
    if (panel?.visible === false) actions.current?.close();
  }, [actions, panel?.visible]);
  return actions;
}
