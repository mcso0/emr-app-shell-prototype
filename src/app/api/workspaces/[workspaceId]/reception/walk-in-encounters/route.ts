import { readServerSession } from "@/features/auth/server-session-reader";
import {
  demoSessionUserIdHeader,
  resolveRoleUpdateActorIdentity,
} from "@/features/auth/server-role-update-identity";
import {
  createReceptionWalkInEncounter,
  createSupabaseReceptionWalkInEncounterGateway,
  type SupabaseReceptionWalkInEncounterRpcClient,
} from "@/features/reception/server-walk-in-encounter";
import type { ReceptionWalkInEncounterInput } from "@/features/reception/walk-in-encounter";
import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    workspaceId: string;
  }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
  const serverSession = await readServerSession();
  const identity = resolveRoleUpdateActorIdentity({
    serverSession,
    demoHeaderUserId: request.headers.get(demoSessionUserIdHeader),
  });

  if (!identity.ok) {
    return Response.json(
      {
        ok: false,
        denialReason: identity.denialReason,
        sessionStatus: identity.sessionStatus,
        sessionReason: identity.sessionReason,
      },
      { status: 401 }
    );
  }

  const rateLimitResponse = enforceWorkspaceMutationRateLimit({
    request,
    actorUserId: identity.actorUserId,
    workspaceId,
    operation: "reception_walk_in_encounter_create",
  });
  if (rateLimitResponse) return rateLimitResponse;

  const input = await readJsonBody(request);
  const client = identity.source === "supabase_session" ? await createClient() : null;
  const result = await createReceptionWalkInEncounter({
    actorUserId: identity.actorUserId,
    workspaceId,
    input,
    gateway: client
      ? createSupabaseReceptionWalkInEncounterGateway(
          client as unknown as SupabaseReceptionWalkInEncounterRpcClient
        )
      : undefined,
  });

  return Response.json(result, { status: result.status });
}

async function readJsonBody(request: Request): Promise<ReceptionWalkInEncounterInput> {
  try {
    const value = (await request.json()) as unknown;
    return value && typeof value === "object"
      ? value as ReceptionWalkInEncounterInput
      : { patientId: "" };
  } catch {
    return { patientId: "" };
  }
}
