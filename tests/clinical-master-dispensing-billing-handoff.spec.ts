import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260912230700_dispensing_execution_billing_candidate_handoff.sql",
  "utf8",
);
const rehearsal = readFileSync(
  "supabase/snippets/clinical_master_dispensing_set_confirmation_compatibility_rehearsal.sql",
  "utf8",
);
const remotePreflight = readFileSync(
  "supabase/snippets/clinical_master_dispensing_execution_billing_handoff_remote_apply_preflight.sql",
  "utf8",
);
const remotePostflight = readFileSync(
  "supabase/snippets/clinical_master_dispensing_execution_billing_handoff_remote_apply_postflight.sql",
  "utf8",
);

test("dispensing execution links a frozen billing candidate before using the legacy fallback", () => {
  expect(migration).toContain("candidate.status = 'candidate_created'");
  expect(migration).toContain("private.clair_link_chart_order_billing_candidates_internal");
  expect(migration).toContain("public.clair_sync_billing_invoice_candidates_from_fulfillment");
  expect(migration.indexOf("private.clair_link_chart_order_billing_candidates_internal")).toBeLessThan(
    migration.lastIndexOf("public.clair_sync_billing_invoice_candidates_from_fulfillment"),
  );
  expect(migration).toContain("dispensing_execution_billing_handoff_anchor_drift");
  expect(migration).not.toMatch(/update\s+public\.invoice_lines/i);
  expect(migration).not.toMatch(/update\s+public\.order_billing_candidates/i);
});

test("dispensing compatibility rehearsal proves the draft invoice mirrors candidate authority", () => {
  for (const token of [
    "dispensing_set_execution_invoice_candidate_mismatch",
    "invoice_line.quantity = candidate.quantity",
    "invoice_line.line_total = candidate.amount",
    "'billingAuthority'",
    "'order_billing_candidates'",
    "invoice.payment_state = 'none'",
    "dispensing_set_legacy_invoice_fallback_failed",
    "rollback_legacy_invoice_fallback_probe",
    "dispensing_set_execution_invoice_amendment_mutated",
  ]) {
    expect(rehearsal).toContain(token);
  }
});

test("remote handoff packet is one transaction and preserves billing business rows", () => {
  expect(remotePreflight).toContain("begin;");
  expect(remotePreflight).toContain("set local lock_timeout = '5s'");
  expect(remotePreflight).toContain("33763f9994cc60979c301435793c7c71207e5b41f4400a7c24d40d34340c4a7b");
  expect(remotePreflight).toContain("6e5ca8e3e043cb653cb0049c2d6864a8420a4bd1df47c0753c8d11f905b57ccc");
  expect(remotePostflight).toContain("dbd9321c23391fce6e559e01139fba53c1cfeea431fa2208513062ec4b982a18");
  expect(remotePostflight).toContain("current_setting(");
  expect(remotePostflight).toContain("remote_row_drift");
  expect(remotePostflight).toContain("commit;");
});
