"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createDefaultWorkspaceVitalSettingsSnapshot,
  parseWorkspaceVitalSettingsSnapshot,
  type WorkspaceVitalSettingsSnapshot,
} from "@/features/patient-vitals/workspace-vital-settings";

export type WorkspaceVitalSettingsReadStatus =
  | "loading"
  | "ready"
  | "denied"
  | "error";

export function useWorkspaceVitalSettings({
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
    () => actorHeaders ? Object.fromEntries(JSON.parse(actorHeaderKey) as [string, string][]) : undefined,
    // actorHeaderKey is the stable representation of the caller-owned HeadersInit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [actorHeaderKey],
  );
  const [snapshot, setSnapshot] = useState<WorkspaceVitalSettingsSnapshot>(() =>
    createDefaultWorkspaceVitalSettingsSnapshot(false),
  );
  const [status, setStatus] = useState<WorkspaceVitalSettingsReadStatus>("loading");

  const reload = useCallback(async () => {
    setStatus("loading");
    try {
      const response = await fetch(
        `/api/workspaces/${encodeURIComponent(workspaceId)}/vital-settings`,
        { cache: "no-store", headers: stableActorHeaders },
      );
      const body: unknown = await response.json();
      if (response.status === 401 || response.status === 403) {
        setStatus("denied");
        return;
      }
      const parsed = parseWorkspaceVitalSettingsSnapshot(body);
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

  return { reload, setSnapshot, snapshot, status };
}

export async function saveWorkspaceVitalSettings({
  actorHeaders,
  snapshot,
  workspaceId,
}: {
  actorHeaders?: HeadersInit;
  snapshot: WorkspaceVitalSettingsSnapshot;
  workspaceId: string;
}) {
  const response = await fetch(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/vital-settings`,
    {
      method: "PUT",
      headers: { "content-type": "application/json", ...headersToRecord(actorHeaders) },
      body: JSON.stringify({ items: snapshot.items }),
    },
  );
  const body: unknown = await response.json();
  const parsed = parseWorkspaceVitalSettingsSnapshot(body);
  if (!response.ok || !parsed) {
    throw new Error(response.status === 401 || response.status === 403 ? "denied" : "save_failed");
  }
  return parsed;
}

function headersToRecord(headers?: HeadersInit) {
  return headers ? Object.fromEntries(new Headers(headers).entries()) : {};
}
