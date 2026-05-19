import { readServerSession } from "@/features/auth/server-session-reader";
import {
  demoSessionUserIdHeader,
  resolveRoleUpdateActorIdentity,
} from "@/features/auth/server-role-update-identity";
import {
  createSupabaseChartDiagnosisGateway,
  readChartDiagnoses,
  saveChartDiagnoses,
  type ChartDiagnosisInput,
  type SupabaseChartDiagnosisRpcClient,
} from "@/features/chart/server-diagnosis-persistence";
import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    workspaceId: string;
  }>;
};

export async function GET(request: Request, { params }: RouteContext) {
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

  const url = new URL(request.url);
  const encounterId = url.searchParams.get("encounterId");
  const client = identity.source === "supabase_session" ? await createClient() : null;
  const result = await readChartDiagnoses({
    actorUserId: identity.actorUserId,
    workspaceId,
    encounterId,
    gateway: client
      ? createSupabaseChartDiagnosisGateway(
          client as unknown as SupabaseChartDiagnosisRpcClient
        )
      : undefined,
  });

  return Response.json(result, { status: result.status });
}

export async function PATCH(request: Request, { params }: RouteContext) {
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
    operation: "chart_diagnosis_save",
  });
  if (rateLimitResponse) return rateLimitResponse;

  const input = await readJsonBody(request);
  const client = identity.source === "supabase_session" ? await createClient() : null;
  const result = await saveChartDiagnoses({
    actorUserId: identity.actorUserId,
    workspaceId,
    input,
    gateway: client
      ? createSupabaseChartDiagnosisGateway(
          client as unknown as SupabaseChartDiagnosisRpcClient
        )
      : undefined,
  });

  return Response.json(result, { status: result.status });
}

async function readJsonBody(request: Request): Promise<ChartDiagnosisInput> {
  try {
    const value = (await request.json()) as unknown;
    return value && typeof value === "object" ? value as ChartDiagnosisInput : {};
  } catch {
    return {};
  }
}
