"use client";

import { useEffect, useMemo } from "react";
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
  const moduleDefinition = useMemo(() => getModule(moduleId), [moduleId]);
  const {
    activeDrawer,
    applyDefaults,
    contextPanelOpen,
    modulePanelOpen,
    rightPanelOpen,
    setActiveDrawer,
    setContextPanelOpen,
    setModulePanelOpen,
    setRightPanelOpen,
  } = useLayoutStore();

  useEffect(() => {
    applyDefaults(moduleDefinition);
  }, [applyDefaults, moduleDefinition]);

  useEffect(() => {
    const modulePanel = searchParams.get("modulePanel");
    const context = searchParams.get("context");
    const right = searchParams.get("right");
    const drawer = searchParams.get("drawer");

    if (modulePanel) setModulePanelOpen(modulePanel === "open");
    if (context) setContextPanelOpen(context !== "closed");
    if (right) setRightPanelOpen(right !== "closed");
    if (drawer) {
      const [type, id] = drawer.split(":");
      if (type && id) setActiveDrawer({ type, id });
    }
  }, [
    searchParams,
    setActiveDrawer,
    setContextPanelOpen,
    setModulePanelOpen,
    setRightPanelOpen,
  ]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("modulePanel", modulePanelOpen ? "open" : "closed");
    if (moduleDefinition.contextPanel) {
      params.set("context", contextPanelOpen ? "history" : "closed");
    }
    if (moduleDefinition.rightPanel) {
      params.set("right", rightPanelOpen ? "open" : "closed");
    }
    if (activeDrawer) {
      params.set("drawer", `${activeDrawer.type}:${activeDrawer.id}`);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [
    activeDrawer,
    contextPanelOpen,
    moduleDefinition.contextPanel,
    moduleDefinition.rightPanel,
    modulePanelOpen,
    pathname,
    rightPanelOpen,
    router,
  ]);

  return (
    <div className="h-screen min-h-0 overflow-hidden bg-background text-foreground">
      <TopMenu workspaceId={workspaceId} />
      <div className="grid h-[calc(100vh-44px)] grid-cols-[56px_1fr]">
        <NavRail activeModuleId={moduleDefinition.id} workspaceId={workspaceId} />
        <WorkspaceFrame moduleDefinition={moduleDefinition} workspaceId={workspaceId} />
      </div>
    </div>
  );
}
