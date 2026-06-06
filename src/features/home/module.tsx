"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  HomeHospitalStatusSidePanel,
  HomeKanbanWorkspace,
} from "@/features/home/components/home-kanban-workspace";
import { DemoLauncher } from "@/features/home/demo-launcher";
import { getHomeMockData } from "@/features/home/home.mock";
import { mapAuthRoleToHomeRole } from "@/features/home/home.presets";
import { useAuthClient } from "@/features/auth/auth-client";
import { Skeleton } from "@/components/ui/skeleton";
import type { ShellComponentProps } from "@/types/emr";

export function HomeContent({ workspaceId }: ShellComponentProps) {
  const searchParams = useSearchParams();
  const { hydrated, session, hydrate } = useAuthClient();
  const view = searchParams.get("view");

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (view === "demo") {
    return <DemoLauncher />;
  }

  if (!hydrated) {
    return <HomeLoadingState />;
  }

  const role = mapAuthRoleToHomeRole(session?.role);
  const data = getHomeMockData(role, workspaceId);

  return <HomeKanbanWorkspace data={data} />;
}

export function HomeSidePanel({ workspaceId }: ShellComponentProps) {
  const { hydrated, session, hydrate } = useAuthClient();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!hydrated) {
    return <HomeSidePanelLoadingState />;
  }

  const role = mapAuthRoleToHomeRole(session?.role);
  const data = getHomeMockData(role, workspaceId);
  const tasks = [...data.tasks, ...data.hospitalTasks]
    .filter((task, index, allTasks) => allTasks.findIndex((item) => item.id === task.id) === index);

  return <HomeHospitalStatusSidePanel tasks={tasks} />;
}

function HomeLoadingState() {
  return (
    <div className="grid h-full min-h-0 overflow-hidden bg-[var(--emr-surface-workspace)]">
      <div className="grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-3 p-4">
        <div className="flex items-start justify-between">
          <Skeleton className="h-9 w-48 rounded-[var(--clair-radius-sm)]" />
          <div className="flex gap-2">
            <Skeleton className="h-12 w-24 rounded-[var(--clair-radius-md)]" />
            <Skeleton className="h-12 w-24 rounded-[var(--clair-radius-md)]" />
            <Skeleton className="h-12 w-24 rounded-[var(--clair-radius-md)]" />
          </div>
        </div>
        <Skeleton className="h-20 rounded-[var(--clair-radius-md)]" />
        <div className="grid grid-flow-col auto-cols-[280px] gap-3 overflow-hidden">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-full rounded-[var(--clair-radius-md)]" />
          ))}
        </div>
      </div>
    </div>
  );
}

function HomeSidePanelLoadingState() {
  return (
    <div className="grid h-full min-h-0 grid-rows-[48px_minmax(0,1fr)] gap-3 bg-[var(--emr-surface-sidepanel)] p-3">
        <Skeleton className="h-6 w-28 rounded-[var(--clair-radius-sm)]" />
        <div className="grid content-start gap-2">
          <Skeleton className="h-28 rounded-[var(--clair-radius-md)]" />
          <Skeleton className="h-28 rounded-[var(--clair-radius-md)]" />
          <Skeleton className="h-28 rounded-[var(--clair-radius-md)]" />
        </div>
    </div>
  );
}
