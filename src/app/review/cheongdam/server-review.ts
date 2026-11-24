import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { CheongdamReviewRecord } from "./contract";
import fictionalRecords from "./records.json";

const workspaceId = "workspace-clair-cheongdam";

/** No mock, role header, or policy fallback can unlock the synthetic review. */
export async function readCheongdamReview(): Promise<readonly CheongdamReviewRecord[] | null> {
  try {
    const client = await createClient({
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    });
    if (!client) return null;

    const { data, error } = await client.auth.getUser();
    const actor = data.user;
    if (error || !actor || actor.is_anonymous || actor.role !== "authenticated") return null;

    const [membership, appUser] = await Promise.all([
      client
        .from("user_memberships")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("user_id", actor.id)
        .eq("status", "active")
        .maybeSingle(),
      client
        .from("users")
        .select("id")
        .eq("id", actor.id)
        .eq("status", "active")
        .maybeSingle(),
    ]);
    if (membership.error || appUser.error || !membership.data?.id || appUser.data?.id !== actor.id) return null;

    const ownerRole = await client
      .from("workspace_permission_roles")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("role_key", "owner")
      .eq("role_type", "owner")
      .eq("is_system", true)
      .eq("status", "active")
      .maybeSingle();
    if (ownerRole.error || !ownerRole.data?.id) return null;

    const assignment = await client
      .from("workspace_membership_permission_role_assignments")
      .select("permission_role_id")
      .eq("workspace_id", workspaceId)
      .eq("membership_id", membership.data.id)
      .eq("permission_role_id", ownerRole.data.id)
      .in("owner_source", ["explicit", "legacy_creator"])
      .maybeSingle();
    if (assignment.error || assignment.data?.permission_role_id !== ownerRole.data.id) return null;

    return fictionalRecords;
  } catch {
    // Availability or consistency failures must not make the fixture public.
    return null;
  }
}
