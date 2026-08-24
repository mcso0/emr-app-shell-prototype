import type { LiveAuditEventInput } from "@/features/audit/server-audit-log-persistence-core";
import type { LiveMutationAuditResult } from "@/features/audit/server-mutation-audit-core";
import {
  demoSessionUserIdHeader,
  resolveRoleUpdateActorIdentity,
} from "@/features/auth/server-role-update-identity";
import type { ServerSessionReaderResult } from "@/features/auth/server-session-contract";
import {
  validateWorkspaceRoleCatalogMutation,
  type WorkspaceRoleCatalogGatewayResult,
} from "@/features/auth/server-workspace-role-catalog";

type WorkspaceRoleCatalogGateway = {
  read(input: { workspaceId: string }): Promise<WorkspaceRoleCatalogGatewayResult>;
  mutate(input: {
    workspaceId: string;
    mutation: unknown;
  }): Promise<WorkspaceRoleCatalogGatewayResult>;
};

export type WorkspaceRoleCatalogRouteDependencies<Client extends object> = {
  readServerSession(): Promise<ServerSessionReaderResult>;
  createClient(): Promise<Client | null>;
  createSupabaseWorkspaceRoleCatalogGateway(client: Client): WorkspaceRoleCatalogGateway;
  createAuditGateway(client: Client): unknown;
  enforceWorkspaceMutationRateLimit(input: {
    request: Request;
    actorUserId: string;
    workspaceId: string;
    operation: string;
  }): Response | null;
  emitLiveMutationAuditEvent(input: {
    auditGateway?: unknown;
    input: LiveAuditEventInput;
  }): Promise<LiveMutationAuditResult>;
};

export async function handleWorkspaceRoleCatalogGet<Client extends object>(
  request: Request,
  { workspaceId }: { workspaceId: string },
  dependencies: WorkspaceRoleCatalogRouteDependencies<Client>
) {
  const identity = await readSupabaseIdentity(request, dependencies);
  if (!identity.ok) return identity.response;

  const client = await dependencies.createClient();
  if (!client) return serverClientMissingResponse();

  const result = await dependencies.createSupabaseWorkspaceRoleCatalogGateway(client).read({
    workspaceId,
  });
  return catalogResultResponse(result);
}

export async function handleWorkspaceRoleCatalogMutation<Client extends object>(
  request: Request,
  { workspaceId }: { workspaceId: string },
  dependencies: WorkspaceRoleCatalogRouteDependencies<Client>
) {
  const identity = await readSupabaseIdentity(request, dependencies);
  if (!identity.ok) return identity.response;

  const rateLimitResponse = dependencies.enforceWorkspaceMutationRateLimit({
    request,
    actorUserId: identity.actorUserId,
    workspaceId,
    operation: "workspace_role_catalog_mutation",
  });
  if (rateLimitResponse) return rateLimitResponse;

  const body = await readJsonBody(request);
  const validation = validateWorkspaceRoleCatalogMutation(body);
  if (!validation.ok) {
    return Response.json({ ok: false, error: "invalid_input" }, { status: 400 });
  }

  const client = await dependencies.createClient();
  if (!client) return serverClientMissingResponse();

  const result = await dependencies.createSupabaseWorkspaceRoleCatalogGateway(client).mutate({
    workspaceId,
    mutation: body,
  });
  if (!result.ok) return catalogResultResponse(result);

  const audit = await dependencies.emitLiveMutationAuditEvent({
    auditGateway: dependencies.createAuditGateway(client),
    input: {
      workspaceId,
      actorUserId: identity.actorUserId,
      eventType: "workspace.role_catalog_changed",
      targetType: "workspace",
      targetId: workspaceId,
      requestId: getRequestId(request),
      after: {
        action: validation.value.action,
        roleKey: validation.value.roleKey,
        positionKey: validation.value.positionKey,
      },
      metadata: { source: "workspace-role-catalog-route" },
    },
  });
  if (!audit.ok) {
    return Response.json({ ok: false, error: "audit_write_failed" }, { status: 500 });
  }

  return Response.json({ ok: true, snapshot: result.snapshot }, { status: 200 });
}

async function readSupabaseIdentity<Client extends object>(
  request: Request,
  dependencies: WorkspaceRoleCatalogRouteDependencies<Client>
): Promise<{ ok: true; actorUserId: string } | { ok: false; response: Response }> {
  const serverSession = await dependencies.readServerSession();
  const identity = resolveRoleUpdateActorIdentity({
    serverSession,
    demoHeaderUserId: request.headers.get(demoSessionUserIdHeader),
  });

  if (!identity.ok) {
    return {
      ok: false,
      response: Response.json(
        {
          ok: false,
          denialReason: identity.denialReason,
          sessionStatus: identity.sessionStatus,
          sessionReason: identity.sessionReason,
        },
        { status: 401 }
      ),
    };
  }

  if (identity.source !== "supabase_session") {
    return {
      ok: false,
      response: Response.json({ ok: false, error: "mock_mode_not_supported" }, { status: 400 }),
    };
  }

  return { ok: true, actorUserId: identity.actorUserId };
}

function catalogResultResponse(result: WorkspaceRoleCatalogGatewayResult) {
  if (result.ok) {
    return Response.json({ ok: true, snapshot: result.snapshot }, { status: 200 });
  }

  const status = catalogErrorStatus(result.error);
  return Response.json({ ok: false, error: result.error }, { status });
}

function catalogErrorStatus(error: Exclude<WorkspaceRoleCatalogGatewayResult, { ok: true }>["error"]) {
  if (error === "workspace_missing") return 404;
  if (error === "conflict") return 409;
  if (error === "permission_missing") return 403;
  if (error === "invalid_input") return 400;
  return 500;
}

function serverClientMissingResponse() {
  return Response.json({ ok: false, error: "supabase_client_missing" }, { status: 500 });
}

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function getRequestId(request: Request) {
  return request.headers.get("x-request-id")?.trim() || null;
}
