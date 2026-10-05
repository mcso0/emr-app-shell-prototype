import type { ReceptionEncounterCancelResponse } from "@/features/reception/encounter-cancel";
import type { ReceptionEncounterRestoreResponse } from "@/features/reception/encounter-restore";
import type { ReceptionAppointmentRestoreResponse } from "@/features/reception/appointment-restore";
import { getReceptionDemoActorId } from "@/features/reception/reception-demo-actor";

type ReceptionLifecycleWriteFailure = {
  ok: false;
  status: number;
  error: "db_write_failed";
};

async function readReceptionLifecycleResponse<T extends { ok: boolean; status?: number }>(
  response: Response,
): Promise<T | ReceptionLifecycleWriteFailure> {
  const body = (await response.json()) as T;

  if (!response.ok || !body.ok) {
    if (!body.ok) return { ...body, status: response.status };
    return { ok: false, status: response.status, error: "db_write_failed" };
  }

  return body;
}

export async function submitReceptionEncounterCancel({
  actorRole,
  encounterId,
  workspaceId,
}: {
  actorRole?: string;
  encounterId: string;
  workspaceId: string;
}): Promise<ReceptionEncounterCancelResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/reception/encounters/${encodeURIComponent(encounterId)}/cancel`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-clair-demo-session-user-id": getReceptionDemoActorId(actorRole),
        },
        body: JSON.stringify({ cancelReason: "접수 화면에서 취소" }),
      },
    );
    return await readReceptionLifecycleResponse<ReceptionEncounterCancelResponse>(response);
  } catch {
    return { ok: false, status: 500, error: "db_write_failed" };
  }
}

export async function submitReceptionEncounterRestore({
  actorRole,
  encounterId,
  workspaceId,
}: {
  actorRole?: string;
  encounterId: string;
  workspaceId: string;
}): Promise<ReceptionEncounterRestoreResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/reception/encounters/${encodeURIComponent(encounterId)}/restore`,
      {
        method: "POST",
        headers: {
          "x-clair-demo-session-user-id": getReceptionDemoActorId(actorRole),
        },
      },
    );
    return await readReceptionLifecycleResponse<ReceptionEncounterRestoreResponse>(response);
  } catch {
    return { ok: false, status: 500, error: "db_write_failed" };
  }
}

export async function submitReceptionAppointmentRestore({
  actorRole,
  appointmentId,
  workspaceId,
}: {
  actorRole?: string;
  appointmentId: string;
  workspaceId: string;
}): Promise<ReceptionAppointmentRestoreResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/reception/appointments/${encodeURIComponent(appointmentId)}/restore`,
      {
        method: "POST",
        headers: {
          "x-clair-demo-session-user-id": getReceptionDemoActorId(actorRole),
        },
      },
    );
    return await readReceptionLifecycleResponse<ReceptionAppointmentRestoreResponse>(response);
  } catch {
    return { ok: false, status: 500, error: "db_write_failed" };
  }
}
