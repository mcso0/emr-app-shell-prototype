import "server-only";

type RateLimitRecord = {
  count: number;
  resetAt: number;
};

export type RateLimitDecision =
  | {
      allowed: true;
      remaining: number;
      resetAt: number;
    }
  | {
      allowed: false;
      retryAfterSeconds: number;
      resetAt: number;
    };

export type RateLimitOptions = {
  keyParts: Array<string | null | undefined>;
  limit?: number;
  windowMs?: number;
  now?: number;
  store?: Map<string, RateLimitRecord>;
};

export type RequestRateLimitOptions = {
  request: Request;
  keyParts: Array<string | null | undefined>;
  limit?: number;
  windowMs?: number;
};

const defaultMutationStore = new Map<string, RateLimitRecord>();
const defaultMutationLimit = 60;
const defaultWindowMs = 60_000;

export function checkRateLimit({
  keyParts,
  limit = defaultMutationLimit,
  windowMs = defaultWindowMs,
  now = Date.now(),
  store = defaultMutationStore,
}: RateLimitOptions): RateLimitDecision {
  const key = keyParts.map(normalizeKeyPart).join(":");
  const current = store.get(key);

  if (!current || current.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
      resetAt: current.resetAt,
    };
  }

  current.count += 1;
  return { allowed: true, remaining: limit - current.count, resetAt: current.resetAt };
}

export function enforceWorkspaceMutationRateLimit({
  request,
  actorUserId,
  workspaceId,
  operation,
}: {
  request: Request;
  actorUserId: string;
  workspaceId?: string | null;
  operation: string;
}): Response | null {
  return enforceRequestRateLimit({
    request,
    keyParts: [
      "workspace-live-mutation",
      operation,
      actorUserId,
      workspaceId ?? "self",
    ],
  });
}

export function enforceRequestRateLimit({
  request,
  keyParts,
  limit,
  windowMs,
}: RequestRateLimitOptions): Response | null {
  const decision = checkRateLimit({
    keyParts: [...keyParts, getClientFingerprint(request)],
    limit,
    windowMs,
  });

  return buildRateLimitResponse(decision);
}

function buildRateLimitResponse(decision: RateLimitDecision) {
  if (decision.allowed) return null;

  return Response.json(
    {
      ok: false,
      error: "rate_limited",
      retryAfterSeconds: decision.retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(decision.retryAfterSeconds),
      },
    }
  );
}

function normalizeKeyPart(value: string | null | undefined) {
  return (value ?? "unknown").replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 120);
}

function getClientFingerprint(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || request.headers.get("x-real-ip") || "local";
}
