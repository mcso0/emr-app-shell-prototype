import { readServerSession } from "@/features/auth/server-session-reader";
import {
  demoSessionUserIdHeader,
  resolveRoleUpdateActorIdentity,
} from "@/features/auth/server-role-update-identity";
import {
  createSupabasePersonalProfileGateway,
  createSupabasePersonalProfileReadGateway,
  readPersonalProfile,
  savePersonalProfile,
  type SupabasePersonalProfileReadClient,
  type SupabasePersonalProfileRpcClient,
} from "@/features/auth/server-personal-profile";
import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

const privateNoStoreHeaders = {
  "Cache-Control": "private, no-store",
};

export async function GET(request: Request) {
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
      { status: 401, headers: privateNoStoreHeaders },
    );
  }

  if (identity.source !== "supabase_session") {
    return Response.json(
      {
        ok: false,
        status: 503,
        error: "configured_data_source_required",
      },
      { status: 503, headers: privateNoStoreHeaders },
    );
  }

  const client = await createClient();
  const result = await readPersonalProfile({
    actorUserId: identity.actorUserId,
    gateway: client
      ? createSupabasePersonalProfileReadGateway(
          client as unknown as SupabasePersonalProfileReadClient,
        )
      : undefined,
  });

  return Response.json(result, {
    status: result.status,
    headers: privateNoStoreHeaders,
  });
}

export async function PATCH(request: Request) {
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
    operation: "personal_profile_update",
  });
  if (rateLimitResponse) return rateLimitResponse;

  const body = await readJsonBody(request);
  const client = identity.source === "supabase_session" ? await createClient() : null;
  const result = await savePersonalProfile({
    actorUserId: identity.actorUserId,
    rawBody: body,
    gateway: client
      ? createSupabasePersonalProfileGateway(
          client as unknown as SupabasePersonalProfileRpcClient
        )
      : undefined,
  });

  return Response.json(result, { status: result.status });
}

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const value = (await request.json()) as unknown;
    return value && typeof value === "object" ? value as Record<string, unknown> : {};
  } catch {
    return {};
  }
}
