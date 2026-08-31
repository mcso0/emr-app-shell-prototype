import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260831070920_clinical_master_consultation_runtime_resolver.sql",
  "utf8",
);

test("draft RPC resolves consultation clinician from the scoped encounter, never the actor", () => {
  expect(migration).toContain("encounter.workspace_id = p_workspace_id");
  expect(migration).toContain("encounter.id = p_encounter_id");
  expect(migration).toContain("encounter.primary_veterinarian_id");
  expect(migration).toContain("- 'responsibleClinicianId'");
  expect(migration).toContain("p_primary_veterinarian_id::text");
  expect(migration).not.toContain(
    "'responsibleClinicianId', p_actor_user_id",
  );
  expect(migration).not.toContain("'responsibleClinicianId', v_actor");
});

test("resolver covers individual and Order Set consultation rows only", () => {
  expect(migration).toContain("v_row ->> 'rowType' = 'individual'");
  expect(migration).toContain("v_row ->> 'rowType' = 'set'");
  expect(migration).toContain("v_row -> 'childInputs'");
  expect(migration).toContain("public.order_set_revision_items");
  expect(migration).toContain("catalog.clinical_order_type = 'consultation'");
  expect(migration).toContain("revision_item.child_kind = 'atomic'");
});

test("resolver preserves the latest CAS/removal writer and closes its direct ACL", () => {
  expect(migration).toContain(
    "rename to clair_save_chart_order_draft_pr022_base",
  );
  expect(migration).toContain(
    "revoke all on function public.clair_save_chart_order_draft_pr022_base(",
  );
  expect(migration).toContain(
    "revoke all on function public.clair_save_chart_order_draft_candidate_base(",
  );
  expect(migration).toContain(
    "revoke all on function public.clair_save_chart_order_draft_phase2_base(",
  );
  expect(migration).toContain(
    "return public.clair_save_chart_order_draft_pr022_base(",
  );
  expect(migration).toContain("private.clair_is_active_workspace_member");
  expect(migration).toContain(
    "private.clair_current_user_has_workspace_permission(",
  );
  expect(migration).toContain("'chart:update'");
  expect(migration).toContain(
    "grant execute on function public.clair_save_chart_order_draft(",
  );
  expect(migration).toContain("to authenticated");
});
