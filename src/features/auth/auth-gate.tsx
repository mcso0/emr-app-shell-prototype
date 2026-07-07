"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthClient } from "@/features/auth/auth-client";
import {
  readSessionWorkspacesState,
  resolveSessionWorkspaceAccess,
} from "@/features/auth/workspace-session";

type AuthGateProps = {
  children: React.ReactNode;
  workspaceId?: string;
};

type WorkspaceAccessState = "checking" | "allowed" | "denied";

function buildLoginHref(
  pathname: string,
  search: string,
  reason: "session_required" | "unauthorized"
) {
  const next = `${pathname}${search ? `?${search}` : ""}`;
  const params = new URLSearchParams({ next, reason });

  return `/login?${params.toString()}`;
}

function isActivePersistedWorkspace(
  workspaces: Array<{ id?: unknown; status?: unknown }>,
  workspaceId: string
) {
  return workspaces.some(
    (workspace) => workspace.id === workspaceId && workspace.status === "active"
  );
}

export function AuthGate({ children, workspaceId }: AuthGateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const { hydrated, session, hydrate } = useAuthClient();
  const [workspaceAccess, setWorkspaceAccess] =
    useState<WorkspaceAccessState>("checking");

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated || session) return;

    router.replace(buildLoginHref(pathname, search, "session_required"));
  }, [hydrated, pathname, router, search, session]);

  useEffect(() => {
    let ignore = false;

    async function verifyWorkspaceAccess() {
      if (!hydrated || !session) {
        setWorkspaceAccess("checking");
        return;
      }

      if (!workspaceId) {
        setWorkspaceAccess("allowed");
        return;
      }

      const sessionState = readSessionWorkspacesState(window.sessionStorage, window.localStorage);
      const sessionAccess = resolveSessionWorkspaceAccess(sessionState, workspaceId, session.id);

      if (sessionAccess === "active") {
        setWorkspaceAccess("allowed");
        return;
      }

      if (sessionAccess !== "unknown") {
        setWorkspaceAccess("denied");
        router.replace(buildLoginHref(pathname, search, "unauthorized"));
        return;
      }

      try {
        const response = await fetch("/api/workspaces");

        if (!response.ok) {
          throw new Error("workspace-list-unavailable");
        }

        const result = (await response.json()) as {
          ok?: boolean;
          workspaces?: Array<{ id?: unknown; status?: unknown }>;
        };
        const allowed = Boolean(
          result.ok &&
            Array.isArray(result.workspaces) &&
            isActivePersistedWorkspace(result.workspaces, workspaceId)
        );

        if (ignore) return;

        if (allowed) {
          setWorkspaceAccess("allowed");
          return;
        }
      } catch {
        // Fall through to denial. Unknown workspace access should not open a tenant route.
      }

      if (!ignore) {
        setWorkspaceAccess("denied");
        router.replace(buildLoginHref(pathname, search, "unauthorized"));
      }
    }

    void verifyWorkspaceAccess();

    return () => {
      ignore = true;
    };
  }, [hydrated, pathname, router, search, session, workspaceId]);

  if (!hydrated || !session || workspaceAccess !== "allowed") {
    return <AuthGateShellSkeleton />;
  }

  return <>{children}</>;
}

function AuthGateShellSkeleton() {
  return (
    <main
      aria-busy="true"
      className="min-h-svh bg-[var(--emr-surface-app)] p-3 text-foreground"
      data-testid="auth-gate-shell-skeleton"
    >
      <span className="sr-only">세션과 워크스페이스 접근 권한을 확인하는 중입니다.</span>
      <div className="grid min-h-[calc(100svh-24px)] grid-rows-[56px_minmax(0,1fr)] overflow-hidden rounded-lg border border-[var(--emr-line-default)] bg-[var(--emr-surface-workspace)] shadow-xs">
        <header className="flex items-center justify-between border-b bg-card px-4">
          <div className="flex items-center gap-3">
            <Skeleton className="size-8 rounded-[var(--clair-radius-md)]" />
            <Skeleton className="h-4 w-28" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-24 rounded-[var(--clair-radius-md)]" />
            <Skeleton className="size-8 rounded-full" />
          </div>
        </header>
        <div className="grid min-h-0 grid-cols-[64px_minmax(0,1fr)]">
          <aside className="flex flex-col items-center gap-3 border-r bg-card px-2 py-4">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="size-9 rounded-[var(--clair-radius-md)]" />
            ))}
          </aside>
          <section className="grid min-h-0 grid-cols-[280px_minmax(0,1fr)] max-md:grid-cols-1">
            <div className="min-h-0 border-r bg-[var(--emr-surface-content-panel)] p-4 max-md:hidden">
              <Skeleton className="mb-5 h-6 w-36" />
              <div className="space-y-2">
                {Array.from({ length: 8 }, (_, index) => (
                  <Skeleton key={index} className="h-9 w-full rounded-[var(--clair-radius-md)]" />
                ))}
              </div>
            </div>
            <div className="min-h-0 p-5">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div className="space-y-2">
                  <Skeleton className="h-7 w-44" />
                  <Skeleton className="h-4 w-64 max-w-[60vw]" />
                </div>
                <Skeleton className="h-9 w-28 rounded-[var(--clair-radius-md)]" />
              </div>
              <div className="grid gap-3">
                {Array.from({ length: 7 }, (_, index) => (
                  <Skeleton key={index} className="h-12 w-full rounded-[var(--clair-radius-md)]" />
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
