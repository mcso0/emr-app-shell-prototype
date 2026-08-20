import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

import {
  adoptClinicalMasterReleaseToWorkspace,
} from "../src/features/clinical-master/server-clinical-master-adoption-core";

const migration = readFileSync(
  "supabase/migrations/20260819130931_clinical_master_phase_1a2_workspace_adoption.sql",
  "utf8",
);
const a1Migration = readFileSync(
  "supabase/migrations/20260818120000_clinical_master_phase_1a1_private_foundation.sql",
  "utf8",
);
const replay = readFileSync(
  "supabase/snippets/clinical_master_phase1a2_replay.sql",
  "utf8",
);
const fixture = JSON.parse(
  readFileSync("tests/fixtures/clinical-master-phase1a2.fixture.json", "utf8"),
) as {
  fallbackPaths: Array<{ itemType: string; runtimeStatus: string; isOtherUnclassified: boolean }>;
  expected: Record<string, number | string>;
};

test("Phase 1A-2 fixture covers reviewed fallback paths and two-release adoption", () => {
  expect(fixture.fallbackPaths).toHaveLength(7);
  expect(new Set(fixture.fallbackPaths.map((path) => path.itemType)).size).toBe(7);
  expect(fixture.fallbackPaths.every((path) => path.runtimeStatus === "active")).toBe(true);
  expect(fixture.fallbackPaths.every((path) => path.isOtherUnclassified)).toBe(true);
  expect(fixture.expected.release2CustomizedReview).toBe(1);
  expect(fixture.expected.customizedPricePreserved).toBe(1234);
});

test("Phase 1A-2 migration protects lineage, direct DML, and exact adoption lock order", () => {
  const a1PublicationLock = a1Migration.match(
    /hashtextextended\('([^']+)',\s*0\)/,
  )?.[1];
  const a2LockNames = [...migration.matchAll(
    /hashtextextended\('([^']+)',\s*0\)/g,
  )].map((match) => match[1]);
  expect(a1PublicationLock).toBeTruthy();
  expect(a2LockNames).toContain(a1PublicationLock);
  expect(migration).toContain("origin_type");
  expect(migration).toContain("source_projection_fingerprint");
  expect(migration).toContain("workspace_master_updates");
  expect(migration).toContain("revoke insert, update, delete on public.order_catalog_items from authenticated");
  expect(migration).toContain("hashtextextended('clinical_master_workspace_adoption:' || p_workspace_id, 0)");
  expect(migration.indexOf(a1PublicationLock!)).toBeLessThan(
    migration.indexOf("clinical_master_workspace_adoption:"),
  );
  expect(migration).toContain("where classification_path_id is null");
  expect(migration).toContain("clinical_master_adopted_lineage_missing_classification");
  expect(migration).toContain("v_source.replacement_record_id is not null then 'replacement'");
  expect(migration).toContain("v_source.lifecycle_status in ('deprecated', 'deprecation_pending') then 'deprecated'");
  expect(migration).toContain("v_item.source_projection_fingerprint = v_fingerprint");
  expect(migration).toContain("v_existing_update.id is not null");
  expect(migration).toContain("update_row.source_snapshot = v_projection");
  expect(migration).toContain("then 'deprecated_source'");
  expect(migration).toContain("pending_activation_requires_accepted_review");
  expect(migration).toContain("clinical_master_classification_path_unusable");
  expect(migration).toContain("clair_resolve_workspace_master_update");
  expect(migration).toContain("workspace_master_update_already_resolved");
  expect(migration).toContain("p_action not in ('accept_source', 'dismiss')");
  expect(migration).toContain("pending_activation");
  expect(migration).toContain("catalog_revision_conflict");
  expect(migration).toContain("clinical_master_update_available");
});

test("adoption core normalizes safe identifiers and preserves DB result counts", async () => {
  const result = await adoptClinicalMasterReleaseToWorkspace({
    workspaceId: " workspace-a ",
    releaseId: " release-1 ",
    executor: {
      adoptMasterReleaseToWorkspace: async () => ({
        ok: true,
        createdCount: 1,
        autoAppliedCount: 2,
        reviewCount: 3,
        notificationCount: 3,
      }),
    },
  });
  expect(result).toMatchObject({
    ok: true,
    workspaceId: "workspace-a",
    releaseId: "release-1",
    createdCount: 1,
    autoAppliedCount: 2,
    reviewCount: 3,
    notificationCount: 3,
  });
});

test("A2 replay is ON_ERROR_STOP transaction with rollback cleanup assertions", () => {
  expect(replay).toContain("begin;");
  expect(replay).toContain("rollback;");
  expect(replay).toContain("clinical_master_phase1a2_replay_cleanup_ok");
  expect(replay).toContain("set local session_replication_role = replica;");
  expect(replay).toContain("skipped-release catch-up");
  expect(replay).toContain("metadata-only release");
  expect(replay).toContain("same-source dismissed review");
  expect(replay).toContain("deprecated-without-replacement");
  expect(replay).toContain("pending to paused to active bypass was accepted");
  expect(replay).toContain("historical workspace row");
  expect(replay).toContain("pricing_rule");
});
