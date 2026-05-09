"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CompactFlowSummary } from "@/features/home/components/compact-flow-summary";
import { HomeCommandHeader } from "@/features/home/components/home-command-header";
import { MyWorkPanel } from "@/features/home/components/my-work-panel";
import { DemoLauncher } from "@/features/home/demo-launcher";
import { getHomeMockData } from "@/features/home/home.mock";
import { mapAuthRoleToHomeRole } from "@/features/home/home.presets";
import { useAuthClient } from "@/features/auth/auth-client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  HomeDomainFilter,
  HomeWorkFilter,
} from "@/features/home/home.types";
import type { ShellComponentProps } from "@/types/emr";

export function HomeContent({ workspaceId }: ShellComponentProps) {
  const searchParams = useSearchParams();
  const { hydrated, session, hydrate } = useAuthClient();
  const view = searchParams.get("view");
  const [activeFilter, setActiveFilter] = useState<HomeWorkFilter>("all");
  const [activeDomain, setActiveDomain] = useState<HomeDomainFilter>("all");

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
    <div className="flex h-full min-h-0 flex-col bg-[var(--clair-color-background-normal)]">
      <HomeCommandHeader
        data={data}
      />
      <ScrollArea className="min-h-0 flex-1">
        <div className="grid min-h-full w-full items-stretch gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
          <MyWorkPanel
            tasks={data.tasks}
            launchers={data.emptyLaunchers}
            activeFilter={activeFilter}
            activeDomain={activeDomain}
            onFilterChange={setActiveFilter}
            onDomainChange={setActiveDomain}
          />
          <div className="min-w-0 lg:flex lg:self-stretch">
            <CompactFlowSummary items={data.flowSummary} updatedAt={data.updatedAt} />
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

function HomeLoadingState() {
  return (
    <div className="grid h-full min-h-0 content-start gap-4 bg-[var(--clair-color-background-normal)] p-5">
      <Skeleton className="h-40 rounded-[var(--clair-radius-md)]" />
      <div className="grid min-h-[520px] w-full gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <Skeleton className="h-full rounded-[var(--clair-radius-md)]" />
        <Skeleton className="h-full rounded-[var(--clair-radius-md)]" />
      </div>
    </div>
  );
}
