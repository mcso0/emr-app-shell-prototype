import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260820100000_clinical_master_phase1b2_order_set_revisions.sql",
  "utf8",
);

test("B2 review notifications have stable identity and private resolution", () => {
  expect(migration).toContain("event_scope_id,event_key,dedupe_key");
  expect(migration).toContain("source_entity_id");
  expect(migration).toContain("order-set-child-review:'||p_review_id::text");
  expect(migration).toContain("requires_action=false,badge_count=false");
  expect(migration).toContain("order_set_review_notification_resolution_status_ck");
  expect(migration).toContain("order_set_review_notification_resolution_payload_ck");
  expect(migration).toContain("private.clair_b2_resolve_review_notification");
});

test("B2 review terminal outcomes remain in the allow-list", () => {
  expect(migration).toContain("outcome in ('accepted', 'dismissed', 'superseded', 'conflict', 'obsolete')");
  expect(migration).toContain("status in ('pending', 'accepted', 'dismissed', 'superseded')");
});
