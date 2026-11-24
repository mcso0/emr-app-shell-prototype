import { z } from "zod";
import { readServerSession } from "@/features/auth/server-session-reader";
import { resolveRoleUpdateActorIdentity } from "@/features/auth/server-role-update-identity";
import { createClient } from "@/lib/supabase/server";
import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";
import {
  searchPage,
  searchWords,
} from "@/features/chart/advanced-search/ranking";
import type {
  SearchChart,
  SearchIndexRow,
} from "@/features/chart/advanced-search/contract";

const short = z.string().max(180);
const combinator = z.enum(["and", "or"]);
const rule = z.object({
  fieldId: short,
  operatorId: z.enum(["is", "contains", "on", "from", "to"]),
  value: short,
});
const groups = z.object({
  id: short,
  combinator,
  groups: z
    .array(
      z.object({
        id: short,
        combinator,
        rules: z
          .array(
            z.object({
              id: short,
              fieldId: short.nullable(),
              operatorId: short.nullable(),
              value: short,
              applied: rule.nullable(),
            }),
          )
          .max(32),
      }),
    )
    .max(16),
});
const search = z.object({
  query: z.string().max(300).optional(),
  includeDrafts: z.boolean().optional(),
  mine: z.boolean().optional(),
  doctor: short.optional(),
  from: z.string().date().or(z.literal("")).optional(),
  to: z.string().date().or(z.literal("")).optional(),
  sort: z.enum(["relevance", "recent", "oldest"]).optional(),
  groups: groups.optional(),
  cursor: z.string().uuid().nullish(),
  targets: z.boolean().optional(),
  chartId: z.string().uuid().optional(),
  excludeId: z.string().uuid().optional(),
});
const actions = new Set(["visits", "park", "pending", "discard", "apply"]);
const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
function dbError(message: string) {
  if (message === "chart_export_too_large") return json({ error: message }, 413);
  if (message === "target_patient_deleted")
    return json({ error: message }, 409);
  if (message === "catalog_permission_missing")
    return json({ error: message }, 403);
  if (
    /permission_missing|membership_missing|actor_mismatch|unauthenticated/.test(
      message,
    )
  )
    return json({ error: "permission_missing" }, 403);
  if (
    /conflict|unavailable|stale_status|invalid_resume|pending_exists|changed|duplicate|revision/.test(
      message,
    )
  )
    return json(
      {
        error:
          message.match(/\b[a-z]+(?:_[a-z]+)+\b/)?.[0] ?? "revision_conflict",
      },
      409,
    );
  if (
    /invalid_|required|order_chart_mismatch|prescription|quantity/.test(message)
  )
    return json({ error: "invalid_selection" }, 400);
  return json({ error: "request_failed" }, 500);
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;
  const identity = resolveRoleUpdateActorIdentity({
    serverSession: await readServerSession(),
    demoHeaderUserId: null,
  });
  if (!identity.ok) return json({ error: "unauthenticated" }, 401);
  const client = await createClient();
  if (!client) return json({ error: "connection_missing" }, 503);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_request" }, 400);
  }
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    !body.input ||
    typeof body.input !== "object" ||
    Array.isArray(body.input)
  )
    return json({ error: "invalid_request" }, 400);
  if (body.action === "search") {
    const parsed = search.safeParse(body.input);
    if (!parsed.success) return json({ error: "invalid_query" }, 400);
    const input = parsed.data;
    const recentOnly =
      !input.query?.trim() &&
      !input.targets &&
      !input.chartId &&
      !input.includeDrafts &&
      !input.mine &&
      !input.doctor &&
      !input.from &&
      !input.to &&
      !input.excludeId &&
      input.sort !== "oldest" &&
      !input.groups?.groups.some((g) => g.rules.some((r) => r.applied));
    if (recentOnly) {
      const recent = await client
        .rpc("clair_advanced_chart_recent", {
          p_workspace_id: workspaceId,
          p_after: input.cursor ?? null,
        })
        .abortSignal(request.signal);
      return recent.error ? dbError(recent.error.message) : json(recent.data);
    }
    const doctorId = z.string().uuid().safeParse(input.doctor);
    const scope = {
      p_workspace_id: workspaceId,
      p_include_drafts: Boolean(input.includeDrafts || input.chartId),
      p_targets: !!input.targets,
      p_mine: Boolean(input.mine && input.targets),
      p_doctor: doctorId.success ? doctorId.data : null,
      p_from: input.from || null,
      p_to: input.to || null,
    };
    if (input.chartId) {
      const read = await client
        .rpc("clair_advanced_chart_search_batch", {
          ...scope,
          p_chart_id: input.chartId,
        })
        .abortSignal(request.signal);
      if (read.error) return dbError(read.error.message);
      try {
        return json(
          searchPage(read.data as SearchChart[], input, identity.actorUserId),
        );
      } catch {
        return json({ error: "invalid_cursor" }, 400);
      }
    }

    // Rank lightweight fields first. Only the visible 25 charts need complete documents and attachment access checks.
    const includeBody = searchWords(input.query).length > 0;
    const rows: SearchIndexRow[] = [];
    let after: string | null = null;
    do {
      const read = await client
        .rpc("clair_advanced_chart_search_batch", {
          ...scope,
          p_index: true,
          p_include_body: includeBody,
          p_after: after,
        })
        .abortSignal(request.signal);
      if (read.error) return dbError(read.error.message);
      const batch = read.data as SearchIndexRow[];
      rows.push(...batch);
      after = batch.length === 500 ? batch[batch.length - 1].id : null;
    } while (after && !request.signal.aborted);
    let page;
    try {
      page = searchPage(rows, input, identity.actorUserId);
    } catch {
      return json({ error: "invalid_cursor" }, 400);
    }
    const ids = page.items.map((row) => row.id);
    const [details, roster] = await Promise.all([
      ids.length
        ? client
            .rpc("clair_advanced_chart_search_batch", { ...scope, p_ids: ids })
            .abortSignal(request.signal)
        : null,
      (input.mine || scope.p_doctor || scope.p_from || scope.p_to) &&
      !input.targets &&
      !input.cursor
        ? client
            .rpc("clair_advanced_chart_search_doctors", {
              p_workspace_id: workspaceId,
              p_include_drafts: scope.p_include_drafts,
            })
            .abortSignal(request.signal)
        : null,
    ]);
    if (details?.error) return dbError(details.error.message);
    if (roster?.error) return dbError(roster.error.message);
    const refreshed = searchPage(
      (details?.data as SearchChart[]) ?? [],
      { ...input, cursor: null },
      identity.actorUserId,
    );
    const byId = new Map(refreshed.items.map((chart) => [chart.id, chart]));
    return json({
      ...page,
      doctors: roster?.data ?? page.doctors,
      items: ids.flatMap((id) => byId.get(id) ?? []),
    });
  }
  if (body.action === "patientCharts") {
    const parsed = z.object({ patientId: z.string().uuid(), cursor: z.string().uuid().nullish() }).safeParse(body.input);
    if (!parsed.success) return json({ error: "invalid_request" }, 400);
    const read = await client.rpc("clair_search_patient_charts", {
      p_workspace_id: workspaceId, p_patient_id: parsed.data.patientId, p_after: parsed.data.cursor ?? null,
    }).abortSignal(request.signal);
    return read.error ? dbError(read.error.message) : json(read.data);
  }
  if (body.action === "export") {
    const parsed = z.object({ ids: z.array(z.string().uuid()).min(1).max(500), format: z.enum(["csv","pdf"]) }).safeParse(body.input);
    if (!parsed.success) return json({ error: "invalid_selection" }, 400);
    const limited = enforceWorkspaceMutationRateLimit({ request, actorUserId: identity.actorUserId, workspaceId, operation: "chart_summary_export" });
    if (limited) return limited;
    const result = await client.rpc("clair_export_chart_records", {
      p_workspace_id: workspaceId, p_ids: parsed.data.ids, p_format: parsed.data.format,
    });
    return result.error ? dbError(result.error.message) : json(result.data);
  }
  if (body.action === "history") {
    const id = z.string().uuid().safeParse(body.input.chartId);
    if (!id.success) return json({ error: "invalid_request" }, 400);
    const read = await client.rpc("clair_advanced_chart_copy_history", {
      p_workspace_id: workspaceId,
      p_chart_id: id.data,
    });
    return read.error ? dbError(read.error.message) : json(read.data);
  }
  if (!actions.has(body.action)) return json({ error: "invalid_action" }, 400);
  if (["park", "discard", "apply"].includes(body.action)) {
    const limited = enforceWorkspaceMutationRateLimit({
      request,
      actorUserId: identity.actorUserId,
      workspaceId,
      operation: "advanced_chart_copy",
    });
    if (limited) return limited;
  }
  if (JSON.stringify(body.input).length > 100000)
    return json({ error: "invalid_request" }, 400);
  const result = await client.rpc("clair_advanced_chart_transfer", {
    p_workspace_id: workspaceId,
    p_action: body.action,
    p_input: body.input,
  });
  return result.error ? dbError(result.error.message) : json(result.data);
}
