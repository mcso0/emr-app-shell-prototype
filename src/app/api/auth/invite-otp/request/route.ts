import { resolveInviteOtpRequest } from "@/features/auth/server-invite-otp-request";
import { checkRateLimit } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  const body = await readJsonBody(request);
  const email = typeof body.email === "string" ? body.email : null;
  const next = typeof body.next === "string" ? body.next : null;
  const rateLimit = checkRateLimit({
    keyParts: ["invite-otp-request", email, getClientFingerprint(request)],
    limit: 5,
    windowMs: 60_000,
  });

  if (!rateLimit.allowed) {
    return Response.json(
      {
        ok: false,
        denialReason: "rate_limited",
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      }
    );
  }

  const result = await resolveInviteOtpRequest({ email, next });
  return Response.json(result, { status: result.status });
}

async function readJsonBody(request: Request) {
  try {
    return (await request.json()) as { email?: unknown; next?: unknown };
  } catch {
    return {};
  }
}

function getClientFingerprint(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || request.headers.get("x-real-ip") || "local";
}
