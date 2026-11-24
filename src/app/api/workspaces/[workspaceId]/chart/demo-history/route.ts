import { createClient } from "@/lib/supabase/server";
import { cheongdamWorkspaceId } from "@/features/chart/demo-history-contract";
import { z } from "zod";

type Context = { params: Promise<{ workspaceId: string }> };
const json = (payload: unknown, status = 200) =>
  Response.json(payload, { status, headers: { "Cache-Control": "private, no-store" } });
const writeInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("activate"), payload: z.array(z.unknown()).length(18) }).strict(),
  z.object({ action: z.literal("retire") }).strict(),
]);

async function signedInClient() {
  const client = await createClient({ fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) });
  if (!client) return null;
  const { data, error } = await client.auth.getUser();
  return !error && data.user?.role === "authenticated" && !data.user.is_anonymous ? client : null;
}

export async function GET(request: Request, { params }: Context) {
  const { workspaceId } = await params;
  if (workspaceId !== cheongdamWorkspaceId) return json({ items: [] });
  const patient = new URL(request.url).searchParams.get("patientId");
  if (patient !== null && !z.string().uuid().safeParse(patient).success)
    return json({ error: "invalid_patient" }, 400);
  const client = await signedInClient();
  if (!client) return json({ error: "unauthenticated" }, 401);
  const { data, error } = await client.rpc("clair_read_cheongdam_demo_history", {
    p_workspace_id: workspaceId, p_patient_id: patient,
  });
  if (error?.code === "PGRST202") return json({ items: [] });
  if (error?.code === "42501") return json({ error: "permission_missing" }, 403);
  return error || !Array.isArray(data) ? json({ error: "read_failed" }, 503) : json({ items: data });
}

export async function POST(request: Request, { params }: Context) {
  const { workspaceId } = await params;
  const origin = request.headers.get("Origin");
  if (workspaceId !== cheongdamWorkspaceId || !origin || origin !== new URL(request.url).origin)
    return json({ error: "permission_missing" }, 403);
  if (!request.headers.get("Content-Type")?.startsWith("application/json"))
    return json({ error: "invalid_request" }, 415);
  let raw: unknown;
  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > 32_768) return json({ error: "invalid_request" }, 413);
    raw = JSON.parse(body);
  } catch {
    return json({ error: "invalid_request" }, 400);
  }
  const input = writeInput.safeParse(raw);
  if (!input.success) return json({ error: "invalid_request" }, 400);
  const client = await signedInClient();
  if (!client) return json({ error: "unauthenticated" }, 401);
  const result = input.data.action === "activate"
    ? await client.rpc("clair_activate_cheongdam_demo_history", {
        p_workspace_id: workspaceId, p_payload: input.data.payload,
      })
    : await client.rpc("clair_retire_cheongdam_demo_history", { p_workspace_id: workspaceId });
  if (result.error?.code === "42501") return json({ error: "permission_missing" }, 403);
  if (result.error?.code === "22023") return json({ error: result.error.message }, 409);
  return result.error ? json({ error: "operation_failed" }, 503) : json(result.data);
}
