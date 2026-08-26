import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const payloadPath =
  "docs/work/clinical-master/clinical-master-pr-017/supabase/dispensing-order-release-payload.v1.json";
const summaryPath =
  "docs/work/clinical-master/clinical-master-pr-017/supabase/dispensing-order-release-summary.v1.json";
const datasetPath =
  "docs/work/clinical-master/clinical-master-pr-017/datasets/dispensing-order-master.v1.json";
const migrationPath =
  "supabase/migrations/20260826151000_clinical_master_dispensing_order_publish_adopt.sql";
const replayPath =
  "supabase/snippets/clinical_master_dispensing_release_replay.sql";

const payloadText = readFileSync(payloadPath, "utf8");
const payload = JSON.parse(payloadText) as Record<string, unknown> & {
  payloadSha256: string;
  recordCount: number;
  clinicalUseAllowed: boolean;
  genericReleasePayload: {
    records: Array<{ masterKey: string; recordType: string }>;
    classificationPaths: Array<{ pathKey: string }>;
  };
  dispensingProfiles: Array<Record<string, unknown>>;
  products: Array<Record<string, unknown>>;
  clinicalReviews: Array<Record<string, unknown>>;
  regulatoryProfiles: Array<Record<string, unknown>>;
  [key: string]: unknown;
};
const summary = JSON.parse(readFileSync(summaryPath, "utf8")) as Record<
  string,
  unknown
>;
const migration = readFileSync(migrationPath, "utf8");
const replay = readFileSync(replayPath, "utf8");

const sha256 = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");
const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [
          key,
          canonicalize((value as Record<string, unknown>)[key]),
        ]),
    );
  }
  return value;
};

test("release payload is deterministic, source-pinned, self-contained, and inactive", () => {
  const { payloadSha256, ...withoutHash } = payload;
  const genericOrders = payload.genericReleasePayload.records.filter(
    (record) => record.recordType === "order",
  );
  const genericDependencies = payload.genericReleasePayload.records.filter(
    (record) => record.recordType !== "order",
  );

  expect(sha256(JSON.stringify(canonicalize(withoutHash)))).toBe(payloadSha256);
  expect(summary.payloadSha256).toBe(payloadSha256);
  expect(summary.payloadFileSha256).toBe(sha256(payloadText));
  expect(summary.sourceDatasetSha256).toBe(
    sha256(readFileSync(datasetPath)),
  );
  expect(payload.recordCount).toBe(108);
  expect(genericOrders).toHaveLength(108);
  expect(genericDependencies.map((record) => record.masterKey).sort()).toEqual(
    [
      "cm.action.dispensing",
      "cm.order-category.t.medication",
      "cm.order-category.x.clinical",
      "cm.unit.case",
      "phase1a2.fallback.chart.CG_MEDICATION_SUPPLY",
      "phase1a2.fallback.route.NT_DISPENSING",
      "phase1a2.fallback.species.cat",
      "phase1a2.fallback.species.dog",
    ].sort(),
  );
  expect(payload.genericReleasePayload.classificationPaths).toEqual([
    expect.objectContaining({ pathKey: "cm.path.dispensing" }),
  ]);
  expect(payload.clinicalUseAllowed).toBe(false);
  expect(
    payload.dispensingProfiles.every(
      (profile) =>
        profile.lifecycleStatus === "clinical_review_pending" &&
        profile.koreanTranslationReviewStatus === "pending" &&
        profile.prescriptionDefaultStatus === "none" &&
        profile.prescriptionDefaults === null,
    ),
  ).toBe(true);
  expect(
    payload.products.every(
      (product) =>
        product.lifecycleStatus === "clinical_review_pending" &&
        product.koreanReviewStatus === "pending",
    ),
  ).toBe(true);
  expect(
    payload.clinicalReviews.every((review) => review.decision === "pending"),
  ).toBe(true);
  expect(
    payload.regulatoryProfiles.every(
      (profile) =>
        profile.reviewStatus === "pending" &&
        profile.authorizationStatus === "not_verified" &&
        profile.controlledStatus === "not_screened",
    ),
  ).toBe(true);
});

test("publisher validates an exact hash and keeps publish/adopt entrypoints private", () => {
  for (const token of [
    "create table if not exists private.clinical_master_dispensing_adoption_events",
    "alter table private.clinical_master_dispensing_adoption_events enable row level security",
    "clinical_master_dispensing_adoption_event_immutable",
    "create or replace function private.publish_clinical_master_dispensing_release",
    "create or replace function private.adopt_clinical_master_dispensing_release",
    "private.clair_dispensing_assert_exact_keys('payload'",
    "order by entry.key collate \"C\"",
    "clinical_master_dispensing_payload_hash_mismatch",
    "clinical_master_dispensing_publish_actor_required",
    "pg_catalog.cardinality(p_allowed)::bigint",
    "clinical_master_dispensing_handling_review_gate_invalid",
    "clinical_master_dispensing_evidence_assertion_gate_invalid",
    "record->>'recordType' = 'order'",
    "record->>'masterKey' like 'cm.order.dispensing-v1-%'",
    "p_workspace_id = any(coalesce(p_approved_workspace_ids, '{}'))",
    "p_actor_user_id is null",
    "availability_status = 'pending_activation'",
    "catalog.clinical_use_allowed",
    "insert into private.clinical_master_dispensing_adoption_events",
    "from public, anon, authenticated, service_role",
  ]) {
    expect(migration).toContain(token);
  }
  expect(migration).not.toMatch(/grant\s+execute\s+on\s+function\s+private\./i);
  expect(migration).not.toContain(payload.payloadSha256);
});

test("release rollback replay proves publish, retry, scoped adoption, hidden pending rows, and foreign-workspace immutability", () => {
  for (const token of [
    "begin;",
    "rollback;",
    "20260826150000_clinical_master_dispensing_order_foundation.sql",
    "20260826151000_clinical_master_dispensing_order_publish_adopt.sql",
    "clinical_master_dispensing_publish_replay_assertion_failed",
    "clinical_master_dispensing_publish_retry_not_idempotent",
    "expected approval scope rejection",
    "array['clair-demo']",
    "clair-foreign-demo",
    "v_retry_fingerprint is distinct from v_first_fingerprint",
    "clinical_master_dispensing_adoption_event_mutation_accepted",
    "public.clair_list_order_catalog_chart_search_v2('clair-demo')",
    "clinical_master_dispensing_adoption_replay_assertion_failed",
    "clinical_master_dispensing_release_replay_ok",
  ]) {
    expect(replay).toContain(token);
  }
});
