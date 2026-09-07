import { createClient as createIsolatedClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { enforceRequestRateLimit } from "@/lib/security/rate-limit";
import {
  validatePersonalPassword,
  isSameOriginPasswordRequest,
} from "@/features/auth/personal-password";

export async function POST(request: Request) {
  if (!isSameOriginPasswordRequest(request))
    return Response.json({ ok: false }, { status: 403 });
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return Response.json({ ok: false }, { status: 415 });
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > 8192)
    return Response.json({ ok: false }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  const input = validatePersonalPassword(body);
  if (!input)
    return Response.json(
      {
        ok: false,
        message:
          "현재 비밀번호와 서로 일치하는 8자 이상의 새 비밀번호를 입력해 주세요.",
      },
      { status: 400 },
    );
  const config = getSupabasePublicConfig();
  const client = await createClient();
  if (!config || !client) return Response.json({ ok: false }, { status: 503 });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user?.email)
    return Response.json({ ok: false }, { status: 401 });
  const limited = enforceRequestRateLimit({
    request,
    keyParts: ["personal-password", data.user.id],
    limit: 5,
    windowMs: 15 * 60_000,
  });
  if (limited) return limited;
  // Verification never replaces the browser cookie session. Provider rate limits apply.
  const verifier = createIsolatedClient(config.url, config.publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  try {
    const verified = await verifier.auth.signInWithPassword({
      email: data.user.email,
      password: input.currentPassword,
    });
    if (verified.error || verified.data.user?.id !== data.user.id)
      return Response.json(
        {
          ok: false,
          message:
            "현재 비밀번호를 확인해 주세요. 반복해서 실패하면 잠시 후 다시 시도해 주세요.",
        },
        { status: 400 },
      );
    // Updating the authenticated original session preserves provider MFA/reauth requirements.
    const updated = await client.auth.updateUser({
      password: input.password,
      current_password: input.currentPassword,
    });
    if (updated.error)
      return Response.json(
        {
          ok: false,
          message:
            "비밀번호를 변경하지 못했습니다. 비밀번호 정책을 확인하거나 다시 로그인한 뒤 시도해 주세요.",
        },
        { status: 400 },
      );
    await client.auth.signOut({ scope: "local" });
    return Response.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } finally {
    await verifier.auth.signOut({ scope: "local" }).catch(() => undefined);
  }
}
