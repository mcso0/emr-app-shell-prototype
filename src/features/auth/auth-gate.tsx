"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--emr-surface-muted)] px-6 text-foreground">
        <div className="rounded-[var(--clair-radius-lg)] border border-border bg-card px-6 py-5 text-center shadow-sm">
          <p className="text-[14px] font-semibold">로그인 확인 중</p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            워크스페이스 접근 권한을 확인합니다.
          </p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
