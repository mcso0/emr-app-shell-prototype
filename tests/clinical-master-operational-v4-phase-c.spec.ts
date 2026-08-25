import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import manifest from "./fixtures/clinical-master-operational-v4-phase-c-operation-manifest.json";
import executionReadback from "./fixtures/clinical-master-operational-v4-phase-c-execution-readback.json";

const root = process.cwd();
const rollbackPath = resolve(root,"supabase/snippets/clinical_master_operational_v4_phase_c_rollback.sql");
const commitPath = resolve(root,"supabase/snippets/clinical_master_operational_v4_phase_c_commit_candidate.sql");
const sha = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");

test("V4 Phase C is exact, RPC-guarded, and excludes the foreign workspace", () => {
  expect(manifest).toMatchObject({ payloadRecords: 554, atomicOrders: 400, workspaces: 3, orderSets: 60, excludedWorkspace: "clair-foreign-demo", remoteWritesPerformed: false });
  expect(sha(rollbackPath)).toBe(manifest.files.rollback.sha256);
  expect(sha(commitPath)).toBe(manifest.files.commit.sha256);
  const rollback = readFileSync(rollbackPath,"utf8");
  const commit = readFileSync(commitPath,"utf8");
  expect(rollback).toContain("rollback;\nselect 'clinical_master_operational_v4_phase_c_rollback_ok'");
  expect(commit).toContain("commit;\nselect 'clinical_master_operational_v4_phase_c_commit_ok'");
  expect(commit).toContain("private.publish_clinical_master_release(v_payload,null)");
  expect(commit).toContain("private.clair_adopt_master_release_to_workspace(v_workspace,v_release_id)");
  expect(commit).toContain("public.clair_update_order_catalog_item");
  expect(commit).toContain("public.clair_resolve_workspace_master_update");
  expect(commit).toContain("public.clair_resolve_workspace_lab_definition_update");
  expect(commit).toContain("public.clair_create_order_set");
  expect(commit).not.toMatch(/(?:insert|update|delete)\s+(?:into\s+)?public\.order_catalog_items/iu);
  expect(commit).not.toMatch(/(?:insert|update|delete)\s+(?:into\s+)?public\.order_sets/iu);
  expect((commit.match(/clair-foreign-demo/g) ?? []).length).toBeGreaterThan(10);
  expect(commit).toContain("clinical_master_v4_foreign_postflight_changed");
  expect(commit).toContain("v_retry is distinct from v_result");
});

test("V4 execution readback records exact coverage and the excluded workspace", () => {
  expect(executionReadback.release).toMatchObject({ releaseNo: 12, recordCount: 554, adoptionScope: "payload" });
  expect(executionReadback.workspaces.map((workspace) => [workspace.workspaceId, workspace.payloadOrders, workspace.activeV4Sets])).toEqual([
    ["workspace-clinical-master-pilot-v1", 400, 20],
    ["workspace-clair-cheongdam", 400, 20],
    ["clair-demo", 400, 20],
  ]);
  expect(executionReadback.workspaces.every((workspace) => workspace.pendingPayloadReviews === 0)).toBe(true);
  expect(Object.values(executionReadback.excludedWorkspace.surfaceCounts).every((count) => count === 0)).toBe(true);
});
