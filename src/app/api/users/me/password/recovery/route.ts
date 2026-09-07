import { createClient } from "@/lib/supabase/server";
import { enforceRequestRateLimit } from "@/lib/security/rate-limit";
import {
  isRecentPasswordRecoveryClaim,
  isSameOriginPasswordRequest,
} from "@/features/auth/personal-password";

const headers = { "Cache-Control": "private, no-store" };
async function recoveryClient() {
  const client = await createClient();
  if (!client) return null;
  const { data: user, error: userError } = await client.auth.getUser();
  if (userError || !user.user) return null;
  const { data, error } = await client.auth.getClaims();
  if (error || !isRecentPasswordRecoveryClaim(data?.claims, user.user.id))
    return null;
  return { client, userId: user.user.id };
}
export async function GET() {
  return (await recoveryClient())
    ? Response.json({ ok: true }, { headers })
    : Response.json({ ok: false }, { status: 403, headers });
}
export async function POST(request: Request) {
  if (!isSameOriginPasswordRequest(request))
    return Response.json({ ok: false }, { status: 403, headers });
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return Response.json({ ok: false }, { status: 415, headers });
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > 8192)
    return Response.json({ ok: false }, { status: 413, headers });
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return Response.json({ ok: false }, { status: 400, headers });
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    return Response.json({ ok: false }, { status: 400, headers });
  const body = value as Record<string, unknown>;
  if (
    Object.keys(body).some(
      (key) => !["password", "confirmation"].includes(key),
    ) ||
    typeof body.password !== "string" ||
    body.password.length < 8 ||
    body.password.length > 1024 ||
    body.password !== body.confirmation
  )
    return Response.json({ ok: false }, { status: 400, headers });
  const actor = await recoveryClient();
  if (!actor)
    return Response.json(
      {
        ok: false,
        message: "재설정 링크가 만료되었습니다. 메일을 다시 요청해 주세요.",
      },
      { status: 403, headers },
    );
  const limited = enforceRequestRateLimit({
    request,
    keyParts: ["personal-password-recovery", actor.userId],
    limit: 5,
    windowMs: 15 * 60_000,
  });
  if (limited) return limited;
  const { error } = await actor.client.auth.updateUser({
    password: body.password,
  });
  if (error)
    return Response.json(
      {
        ok: false,
        message:
          "비밀번호를 변경하지 못했습니다. 비밀번호 정책을 확인한 뒤 다시 시도해 주세요.",
      },
      { status: 400, headers },
    );
  await actor.client.auth.signOut({ scope: "local" });
  return Response.json({ ok: true }, { headers });
}
