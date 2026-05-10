"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { HomeKanbanWorkspace } from "@/features/home/components/home-kanban-workspace";
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

  return (
    <div className="h-full min-h-0 bg-[var(--clair-color-background-normal)] p-2">
      <HomeKanbanWorkspace data={data} />
    </div>
  );
}

function HomeLoadingState() {
  return (
    <div className="grid h-full min-h-0 bg-[var(--clair-color-background-normal)] p-2">
      <div className="grid min-h-0 w-full grid-cols-[minmax(0,1fr)_minmax(300px,340px)] overflow-hidden bg-white">
        <div className="grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-3 border-r border-border p-4">
          <Skeleton className="h-9 w-64 rounded-[var(--clair-radius-sm)]" />
          <Skeleton className="h-7 w-96 rounded-full" />
          <Skeleton className="h-full rounded-[var(--clair-radius-md)]" />
        </div>
        <Skeleton className="m-4 rounded-[var(--clair-radius-md)]" />
      </div>
    </div>
  );
}
