"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getModule } from "@/modules/registry";
import { useLayoutStore } from "@/stores/layout-store";
import { NavRail } from "@/shell/nav-rail";
import { TopMenu } from "@/shell/top-menu";
import { WorkspaceFrame } from "@/shell/workspace-frame";

type AppShellProps = {
  workspaceId: string;
  moduleId: string;
};

export function AppShell({ workspaceId, moduleId }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const moduleDefinition = useMemo(() => getModule(moduleId), [moduleId]);
  const urlStateReadyRef = useRef(false);
  const {
    activeDrawer,
    contentAsideOpen,
    enterModule,
    modulePanelOpen,
    rightPanelOpen,
    setActiveDrawer,
    setContentAsideOpen,
    setModulePanelOpen,
    setRightPanelOpen,
  } = useLayoutStore();

  useEffect(() => {
    enterModule();
  }, [enterModule, moduleDefinition.id]);

  useEffect(() => {
    urlStateReadyRef.current = false;
    const readyTimer = window.setTimeout(() => {
      const urlParams = new URLSearchParams(search);
      const modulePanel = urlParams.get("modulePanel");
      const aside = urlParams.get("aside") ?? urlParams.get("context");
      const right = urlParams.get("right");
      const drawer = urlParams.get("drawer");

      if (modulePanel) setModulePanelOpen(modulePanel === "open");
      if (aside) setContentAsideOpen(aside !== "closed");
      if (right) setRightPanelOpen(right !== "closed");
      if (drawer) {
        const [type, id] = drawer.split(":");
        if (type && id) setActiveDrawer({ type, id });
      }
      window.setTimeout(() => {
        urlStateReadyRef.current = true;
      }, 0);
    }, 0);

    return () => window.clearTimeout(readyTimer);
  }, [
    search,
    setActiveDrawer,
    setContentAsideOpen,
    setModulePanelOpen,
    setRightPanelOpen,
  ]);

  useEffect(() => {
    if (!urlStateReadyRef.current) return;

    const params = new URLSearchParams();
    params.set("modulePanel", modulePanelOpen ? "open" : "closed");
    if (moduleDefinition.contentAside) {
      params.set("aside", contentAsideOpen ? "history" : "closed");
    }
    if (moduleDefinition.rightPanel) {
      params.set("right", rightPanelOpen ? "open" : "closed");
    }
    if (activeDrawer) {
      params.set("drawer", `${activeDrawer.type}:${activeDrawer.id}`);
    }
    const nextSearch = params.toString();
    if (search !== nextSearch) {
      router.replace(`${pathname}?${nextSearch}`, { scroll: false });
    }
  }, [
    activeDrawer,
    contentAsideOpen,
    moduleDefinition.contentAside,
    moduleDefinition.rightPanel,
    modulePanelOpen,
    pathname,
    rightPanelOpen,
    router,
    search,
  ]);

  return (
    <div className="h-screen min-h-0 overflow-hidden bg-secondary text-foreground">
      <TopMenu workspaceId={workspaceId} />
      <div className="grid h-[calc(100vh-52px)] grid-cols-[60px_1fr] gap-2.5 px-2.5 pb-2.5">
        <NavRail activeModuleId={moduleDefinition.id} workspaceId={workspaceId} />
        <WorkspaceFrame moduleDefinition={moduleDefinition} workspaceId={workspaceId} />
      </div>
    </div>
  );
}
