import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";
import {
  defaultNotificationPreferences,
  parseNotificationPreferences,
} from "@/features/notifications/notification-preferences";

type Context = { params: Promise<{ workspaceId: string }> };
async function authorize(workspaceId: string) {
  const client = await createClient();
  if (!client) return null;
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  const membership = await client
    .from("user_memberships")
    .select("status")
    .eq("workspace_id", workspaceId)
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (membership.error || membership.data?.status !== "active") return null;
  const appUser = await client
    .from("users")
    .select("status")
    .eq("id", data.user.id)
    .maybeSingle();
  if (appUser.error || appUser.data?.status !== "active") return null;
  return { client, userId: data.user.id };
}
export async function GET(_request: Request, { params }: Context) {
  const { workspaceId } = await params;
  const actor = await authorize(workspaceId);
  if (!actor) return Response.json({ ok: false }, { status: 403 });
  const { data, error } = await actor.client
    .from("workspace_notification_preferences")
    .select("popup,sound,categories")
    .eq("workspace_id", workspaceId)
    .eq("user_id", actor.userId)
    .maybeSingle();
  if (error) return Response.json({ ok: false }, { status: 503 });
  const preferences = data
    ? parseNotificationPreferences(data)
    : defaultNotificationPreferences();
  if (!preferences) return Response.json({ ok: false }, { status: 500 });
  return Response.json(
    { ok: true, preferences },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
export async function PATCH(request: Request, { params }: Context) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return Response.json({ ok: false }, { status: 415 });
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > 2048)
    return Response.json({ ok: false }, { status: 413 });
  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  const preferences = parseNotificationPreferences(input);
  if (!preferences) return Response.json({ ok: false }, { status: 400 });
  const { workspaceId } = await params;
  const actor = await authorize(workspaceId);
  if (!actor) return Response.json({ ok: false }, { status: 403 });
  const limited = enforceWorkspaceMutationRateLimit({
    request,
    actorUserId: actor.userId,
    workspaceId,
    operation: "personal_notification_preferences",
  });
  if (limited) return limited;
  const { data, error } = await actor.client
    .from("workspace_notification_preferences")
    .upsert(
      { workspace_id: workspaceId, user_id: actor.userId, ...preferences },
      { onConflict: "workspace_id,user_id" },
    )
    .select("popup,sound,categories")
    .single();
  if (error || !data) return Response.json({ ok: false }, { status: 500 });
  return Response.json({ ok: true, preferences: data });
}
