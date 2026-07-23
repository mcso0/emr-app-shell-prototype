"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createDefaultWorkspaceSpaceManagementSnapshot,
  parseWorkspaceSpaceManagementSnapshot,
  type SpaceManagementErrorCode,
  type SpaceManagementMutationInput,
  type WorkspaceSpaceManagementSnapshot,
} from "@/features/hospital-admin/space-management/model";

export type WorkspaceSpaceManagementReadStatus =
  | "loading"
  | "ready"
  | "denied"
  | "error";

export class SpaceManagementRequestError extends Error {
  constructor(
    public readonly code: SpaceManagementErrorCode | "request_failed",
  ) {
    super(code);
    this.name = "SpaceManagementRequestError";
  }
}

export function useWorkspaceSpaceManagement({
  actorHeaders,
  workspaceId,
}: {
  actorHeaders?: HeadersInit;
  workspaceId: string;
}) {
  const actorHeaderKey = JSON.stringify(
    actorHeaders ? Array.from(new Headers(actorHeaders).entries()).sort() : [],
  );
  const stableActorHeaders = useMemo<HeadersInit | undefined>(
    () => actorHeaders
      ? Object.fromEntries(JSON.parse(actorHeaderKey) as [string, string][])
      : undefined,
    // actorHeaderKey is the stable representation of caller-owned headers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [actorHeaderKey],
  );
  const [snapshot, setSnapshot] = useState<WorkspaceSpaceManagementSnapshot>(
    () => createDefaultWorkspaceSpaceManagementSnapshot(workspaceId),
  );
  const [status, setStatus] =
    useState<WorkspaceSpaceManagementReadStatus>("loading");

  const reload = useCallback(async () => {
    setStatus("loading");
    try {
      const response = await fetch(
        `/api/workspaces/${encodeURIComponent(workspaceId)}/hospital-admin/space-management`,
        {
          cache: "no-store",
          headers: stableActorHeaders,
        },
      );
      const body: unknown = await response.json();
      if (response.status === 401 || response.status === 403) {
        setStatus("denied");
        return;
      }
      const parsed = parseWorkspaceSpaceManagementSnapshot(body);
      if (!response.ok || !parsed) {
        setStatus("error");
        return;
      }
      setSnapshot(parsed);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [stableActorHeaders, workspaceId]);

  useEffect(() => {
    // Fetching is the external synchronization owned by this resource hook.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  return {
    actorHeaders: stableActorHeaders,
    reload,
    setSnapshot,
    snapshot,
    status,
  };
}

export async function sendSpaceManagementMutation({
  actorHeaders,
  command,
  workspaceId,
}: {
  actorHeaders?: HeadersInit;
  command: SpaceManagementMutationInput;
  workspaceId: string;
}) {
  let response: Response;
  let body: unknown;
  try {
    response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/hospital-admin/space-management`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...headersToRecord(actorHeaders),
        },
        body: JSON.stringify(command),
      },
    );
    body = await response.json();
  } catch {
    throw new SpaceManagementRequestError("request_failed");
  }

  const parsed = parseWorkspaceSpaceManagementSnapshot(body);
  if (!response.ok || !parsed) {
    const code = readErrorCode(body);
    throw new SpaceManagementRequestError(code);
  }
  return parsed;
}

function readErrorCode(value: unknown): SpaceManagementErrorCode | "request_failed" {
  if (!value || typeof value !== "object" || !("error" in value)) {
    return "request_failed";
  }
  return typeof value.error === "string"
    ? value.error as SpaceManagementErrorCode
    : "request_failed";
}

function headersToRecord(headers?: HeadersInit) {
  return headers ? Object.fromEntries(new Headers(headers).entries()) : {};
}
