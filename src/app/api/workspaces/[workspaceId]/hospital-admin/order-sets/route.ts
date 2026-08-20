import { readServerSession } from "@/features/auth/server-session-reader";
import {
  demoSessionUserIdHeader,
  resolveRoleUpdateActorIdentity,
} from "@/features/auth/server-role-update-identity";
import { demoClientSessionIdHeader } from "@/features/auth/demo-actor";
import {
  createSupabaseOrderCatalogGateway,
  getDemoOrderCatalogGateway,
  type OrderSetDefinition,
  type OrderSetMutationResponse,
  type SupabaseOrderCatalogRpcClient,
} from "@/features/hospital-admin/server-order-catalog";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ workspaceId: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
  const identity = await resolveIdentity(request);
  if (!identity.ok) return identity.response;
  const gateway = await resolveGateway(identity.source, request);
  const result = await gateway.listOrderSets({
    workspaceId,
    query:
      new URL(request.url).searchParams.get("query") ??
      new URL(request.url).searchParams.get("q") ??
      undefined,
  });
  if (result.ok) {
    return Response.json({ summaries: result.summaries }, { status: 200 });
  }
  return Response.json(result, { status: result.status });
}

export async function POST(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
  const identity = await resolveIdentity(request);
  if (!identity.ok) return identity.response;
  const requestId = request.headers.get("idempotency-key");
  if (request.headers.get("if-none-match") !== "*") {
    return mutationErrorResponse(
      "if_none_match_required",
      requestId,
      "If-None-Match",
      "If-None-Match: * is required.",
    );
  }
  if (!requestId || !isUuid(requestId)) {
    return mutationErrorResponse(
      "invalid_order_set_definition",
      requestId,
      "idempotencyKey",
      "Idempotency-Key must be a UUID.",
    );
  }
  const body = await readBody(request);
  if (!body || !isRecord(body.definition)) {
    return mutationErrorResponse(
      "invalid_order_set_definition",
      requestId,
      "definition",
      "A complete Order Set definition is required.",
    );
  }
  const availabilityStatus = body.availabilityStatus;
  if (availabilityStatus !== "active" && availabilityStatus !== "paused" && availabilityStatus !== "inactive") {
    return mutationErrorResponse(
      "invalid_order_set_definition",
      requestId,
      "availabilityStatus",
      "availabilityStatus must be active, paused, or inactive.",
    );
  }
  const gateway = await resolveGateway(identity.source, request);
  const result = await gateway.createOrderSet({
    availabilityStatus,
    definition: body.definition as unknown as OrderSetDefinition,
    requestId,
    workspaceId,
  });
  return mutationResponse(result);
}

async function resolveIdentity(request: Request) {
  const identity = resolveRoleUpdateActorIdentity({
    serverSession: await readServerSession(),
    demoHeaderUserId: request.headers.get(demoSessionUserIdHeader),
  });
  if (!identity.ok) {
    return {
      ok: false as const,
      response: Response.json({ ok: false, denialReason: identity.denialReason }, { status: 401 }),
    };
  }
  return { ok: true as const, actorUserId: identity.actorUserId, source: identity.source };
}

async function resolveGateway(
  source: "supabase_session" | "demo_header_mock_mode",
  request: Request,
) {
  if (source === "demo_header_mock_mode") {
    return getDemoOrderCatalogGateway(request.headers.get(demoClientSessionIdHeader) ?? "shared");
  }
  return createSupabaseOrderCatalogGateway(
    await createClient() as unknown as SupabaseOrderCatalogRpcClient,
  );
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return isRecord(body) ? body : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function mutationResponse(result: { ok: boolean; [key: string]: unknown }) {
  const normalized = normalizeMutationResponse(result);
  const headers = new Headers();
  const current = isRecord(normalized.result) && isRecord(normalized.result.current)
    ? normalized.result.current
    : null;
  if (current && typeof current.etag === "string") headers.set("ETag", `"${current.etag}"`);
  return Response.json(normalized, {
    status: normalized.ok ? 201 : statusForError(normalized),
    headers,
  });
}

type OrderSetApiErrorCode =
  | "workspace_membership_missing"
  | "permission_missing"
  | "order_set_not_found"
  | "revision_conflict"
  | "idempotency_conflict"
  | "invalid_order_set_definition"
  | "order_set_member_unavailable"
  | "child_revision_requires_refresh"
  | "order_set_review_obsolete"
  | "if_none_match_required"
  | "if_match_required";

type OrderSetApiMutationResponse =
  | (Extract<OrderSetMutationResponse, { ok: true }> & { error: null })
  | {
      ok: false;
      outcome: "rejected" | "conflict" | "obsolete" | "superseded";
      requestId: string;
      error: { code: OrderSetApiErrorCode; field: string | null; message: string };
      result: null;
    };

function mutationErrorResponse(
  code: OrderSetApiErrorCode,
  requestId: string | null,
  field: string | null,
  message: string,
) {
  const response: OrderSetApiMutationResponse = {
    ok: false,
    outcome: failureOutcomeForError(code),
    requestId: validRequestIdOrGenerated(requestId),
    error: { code, field, message },
    result: null,
  };
  return Response.json(response, { status: statusForError(response) });
}

function normalizeMutationResponse(result: { ok: boolean; [key: string]: unknown }): OrderSetApiMutationResponse {
  if (result.ok) return result as OrderSetApiMutationResponse;
  const error = isRecord(result.error) ? result.error : {};
  const code = normalizeErrorCode(error.code);
  const outcome = isFailureOutcome(result.outcome) ? result.outcome : failureOutcomeForError(code);
  return {
    ok: false,
    outcome,
    requestId: validRequestIdOrGenerated(typeof result.requestId === "string" ? result.requestId : null),
    error: {
      code,
      field: typeof error.field === "string" ? error.field : null,
      message: typeof error.message === "string" ? error.message : code,
    },
    result: null,
  };
}

function normalizeErrorCode(value: unknown): OrderSetApiErrorCode {
  if (
    value === "workspace_membership_missing" ||
    value === "permission_missing" ||
    value === "order_set_not_found" ||
    value === "revision_conflict" ||
    value === "idempotency_conflict" ||
    value === "invalid_order_set_definition" ||
    value === "order_set_member_unavailable" ||
    value === "child_revision_requires_refresh" ||
    value === "order_set_review_obsolete" ||
    value === "if_none_match_required" ||
    value === "if_match_required"
  ) {
    return value;
  }
  return "invalid_order_set_definition";
}

function isFailureOutcome(value: unknown): value is "rejected" | "conflict" | "obsolete" | "superseded" {
  return value === "rejected" || value === "conflict" || value === "obsolete" || value === "superseded";
}

function failureOutcomeForError(code: OrderSetApiErrorCode) {
  if (code === "revision_conflict" || code === "idempotency_conflict" || code === "child_revision_requires_refresh") {
    return "conflict" as const;
  }
  if (code === "order_set_review_obsolete") return "obsolete" as const;
  return "rejected" as const;
}

function validRequestIdOrGenerated(value: string | null) {
  return value && isUuid(value) ? value : crypto.randomUUID();
}

function statusForError(result: { error?: { code?: OrderSetApiErrorCode } | null }) {
  const error = result.error?.code;
  if (error === "permission_missing" || error === "workspace_membership_missing") return 403;
  if (error === "order_set_not_found") return 404;
  if (error === "if_none_match_required" || error === "if_match_required") return 428;
  if (error === "order_set_member_unavailable") return 422;
  if (error === "invalid_order_set_definition") return 422;
  if (
    error === "revision_conflict" ||
    error === "idempotency_conflict" ||
    error === "child_revision_requires_refresh" ||
    error === "order_set_review_obsolete"
  ) return 409;
  return 422;
}
