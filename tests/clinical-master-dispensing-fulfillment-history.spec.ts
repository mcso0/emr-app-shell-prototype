import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260826152000_clinical_master_dispensing_fulfillment_history.sql",
  "utf8",
);

test("PR-017 fulfillment history RPC is workspace and queue-permission scoped", () => {
  expect(migration).toContain(
    "create or replace function public.clair_list_fulfillment_work_item_history_v2",
  );
  expect(migration).toContain(
    "private.clair_is_active_workspace_member(p_workspace_id)",
  );
  expect(migration).toContain(
    "private.clair_current_user_has_workspace_permission",
  );
  expect(migration).toContain(
    "private.clair_queue_permission_for_destination",
  );
  expect(migration).toContain("item.workspace_id = p_workspace_id");
  expect(migration).toContain("item.id = p_work_item_id");
  expect(migration).toContain("event.workspace_id = p_workspace_id");
  expect(migration).toContain("event.order_id = v_item.order_id");
  expect(migration).toContain(
    "event.payload ->> 'fulfillmentWorkItemId' = p_work_item_id::text",
  );
  expect(migration).toContain("set search_path = pg_catalog, public, private");
  expect(migration).toContain("from public, anon, service_role");
  expect(migration).toContain("to authenticated");
  expect(migration).toContain("p_limit integer default 50");
  expect(migration).toContain("p_limit < 1 or p_limit > 100");
  expect(migration).toContain("p_before_created_at is null");
  expect(migration).toContain("limit v_limit + 1");
  expect(migration).toContain("'hasMore', v_has_more");
  expect(migration).toContain("'nextCursor'");
  expect(migration).not.toMatch(/\b(truncate|delete\s+from|drop\s+table)\b/i);
});

test("PR-017 fulfillment history returns immutable actor/reason/before/after facts", () => {
  expect(migration).toContain("'previousStatus'");
  expect(migration).toContain("'nextStatus'");
  expect(migration).toContain("'actorUserId'");
  expect(migration).toContain("'reason'");
  expect(migration).toContain("'work_item_created'");
  expect(migration).toContain("'order_event'");
  expect(migration).toContain(
    "event.payload ->> 'action' = 'fulfillment_work_item_update'",
  );
  expect(migration).toContain("fulfillment_reason_too_long");
  expect(migration).toContain("fulfillment_work_item_noop");
});
