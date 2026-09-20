"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { getDemoActorHeaders } from "@/features/auth/demo-actor";
import type { AuthSession } from "@/features/auth/auth-client";
import {
  parseConsultationCallRoomResponse,
  type ConsultationCallRoom,
} from "@/features/chart/consultation-room-contract";

export type ConsultationRoomReadStatus = "loading" | "ready" | "denied" | "error";

export function useWorkspaceConsultationRooms({
  session,
  workspaceId,
}: {
  session: AuthSession | null;
  workspaceId: string;
}) {
  const actorHeaders = useMemo(() => getDemoActorHeaders(session), [session]);
  const [rooms, setRooms] = useState<ConsultationCallRoom[]>([]);
  const [status, setStatus] = useState<ConsultationRoomReadStatus>("loading");
  const reloadRooms = useCallback(async () => {
    setStatus("loading");
    try {
      const response = await fetch(
        `/api/workspaces/${encodeURIComponent(workspaceId)}/chart/consultation-rooms`,
        { cache: "no-store", headers: actorHeaders },
      );
      const body: unknown = await response.json();
      if (response.status === 401 || response.status === 403) {
        setRooms([]);
        setStatus("denied");
        return null;
      }
      const parsed = parseConsultationCallRoomResponse(body);
      if (!response.ok || !parsed || parsed.workspaceId !== workspaceId) {
        setRooms([]);
        setStatus("error");
        return null;
      }
      setRooms(parsed.rooms);
      setStatus("ready");
      return parsed.rooms;
    } catch {
      setRooms([]);
      setStatus("error");
      return null;
    }
  }, [actorHeaders, workspaceId]);

  useEffect(() => {
    // Fetching is the external synchronization owned by this resource hook.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reloadRooms();
  }, [reloadRooms]);

  return { reload: reloadRooms, rooms, status };
}
