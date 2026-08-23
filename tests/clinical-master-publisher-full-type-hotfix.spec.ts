import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

import fixtureJson from "./fixtures/clinical-master-publisher-full-type-hotfix.fixture.json";

const migration = readFileSync(
  "supabase/migrations/20260823124500_clinical_master_publisher_full_type_hotfix.sql",
  "utf8",
);
const replay = readFileSync(
  "supabase/snippets/clinical_master_publisher_full_type_hotfix_replay.sql",
  "utf8",
);

type HotfixFixture = {
  releaseKey: string;
  records: Array<{
    masterKey: string;
    recordType: string;
    detail: Record<string, unknown>;
  }>;
  classificationPaths: Array<{
    pathKey: string;
    clinicalActionKey: string;
    chartGroupKey: string;
    taskRouteKey: string;
  }>;
  labPanelItems: Array<{
    panelMasterKey: string;
    testMasterKey: string;
    sortOrder: number;
  }>;
  labOrderProfiles: Array<{
    orderMasterKey: string;
    labTestMasterKey: string | null;
    labPanelMasterKey: string | null;
    specimenMasterKey: string | null;
  }>;
};

const fixture = fixtureJson as HotfixFixture;
const supportedRecordTypes = [
  "order_category",
  "clinical_action",
  "chart_group",
  "task_route",
  "order",
  "species",
  "unit",
  "specimen_type",
  "result_input_type",
  "lab_test",
  "lab_panel",
] as const;

const expectedChartMappings = [
  { masterKey: "phase1a2.fallback.chart.CG_CONSULTATION", groupCode: "CG_CONSULTATION", sortOrder: 901 },
  { masterKey: "phase1a2.fallback.chart.CG_MEDICATION_SUPPLY", groupCode: "CG_MEDICATION_SUPPLY", sortOrder: 902 },
  { masterKey: "phase1a2.fallback.chart.CG_PROCEDURE", groupCode: "CG_PROCEDURE", sortOrder: 903 },
  { masterKey: "phase1a2.fallback.chart.CG_EXAM", groupCode: "CG_EXAM", sortOrder: 904 },
  { masterKey: "cm.chart.treatment", groupCode: "CG_THERAPY", sortOrder: 905 },
];
const expectedRouteMappings = [
  { masterKey: "phase1a2.fallback.route.NT_CHART_ONLY", routeCode: "NT_CHART_ONLY", destinationModule: "chart_only", taskRequired: false, runtimeStatus: "active" },
  { masterKey: "phase1a2.fallback.route.NT_DISPENSING", routeCode: "NT_DISPENSING", destinationModule: "dispensing", taskRequired: true, runtimeStatus: "active" },
  { masterKey: "phase1a2.fallback.route.NT_IMAGING", routeCode: "NT_IMAGING", destinationModule: "imaging", taskRequired: true, runtimeStatus: "active" },
  { masterKey: "phase1a2.fallback.route.NT_LAB", routeCode: "NT_LAB", destinationModule: "lab", taskRequired: true, runtimeStatus: "active" },
  { masterKey: "phase1a2.fallback.route.NT_TREATMENT", routeCode: "NT_TREATMENT", destinationModule: "treatment", taskRequired: true, runtimeStatus: "active" },
];
const expectedSpeciesMappings = [
  { masterKey: "phase1a2.fallback.species.cat", speciesCode: "cat" },
  { masterKey: "phase1a2.fallback.species.dog", speciesCode: "dog" },
];
const expectedPathMappings = [
  { pathKey: "cm.path.consultation", clinicalActionKey: "cm.action.consultation", chartGroupKey: "phase1a2.fallback.chart.CG_CONSULTATION", taskRouteKey: "phase1a2.fallback.route.NT_CHART_ONLY" },
  { pathKey: "cm.path.dispensing", clinicalActionKey: "cm.action.dispensing", chartGroupKey: "phase1a2.fallback.chart.CG_MEDICATION_SUPPLY", taskRouteKey: "phase1a2.fallback.route.NT_DISPENSING" },
  { pathKey: "cm.path.imaging", clinicalActionKey: "cm.action.imaging", chartGroupKey: "phase1a2.fallback.chart.CG_PROCEDURE", taskRouteKey: "phase1a2.fallback.route.NT_IMAGING" },
  { pathKey: "cm.path.laboratory", clinicalActionKey: "cm.action.laboratory", chartGroupKey: "phase1a2.fallback.chart.CG_EXAM", taskRouteKey: "phase1a2.fallback.route.NT_LAB" },
  { pathKey: "cm.path.treatment", clinicalActionKey: "cm.action.treatment", chartGroupKey: "cm.chart.treatment", taskRouteKey: "phase1a2.fallback.route.NT_TREATMENT" },
];

test("PR-011 fixture is the locked full publisher shape", () => {
  expect(fixture.releaseKey).toBe("cm.release.airtable.operational-pilot.v1");
  expect(fixture.records).toHaveLength(83);
  expect(new Set(fixture.records.map((record) => record.recordType))).toEqual(
    new Set(supportedRecordTypes),
  );
  expect(fixture.classificationPaths).toHaveLength(5);
  expect(fixture.labPanelItems).toHaveLength(13);
  expect(fixture.labOrderProfiles).toHaveLength(17);

  const counts = Object.fromEntries(
    supportedRecordTypes.map((recordType) => [
      recordType,
      fixture.records.filter((record) => record.recordType === recordType).length,
    ]),
  );
  expect(counts).toEqual({
    order_category: 6,
    clinical_action: 5,
    chart_group: 5,
    task_route: 5,
    order: 30,
    species: 2,
    unit: 6,
    specimen_type: 4,
    result_input_type: 3,
    lab_test: 13,
    lab_panel: 4,
  });
  expect(
    fixture.records.filter(
      (record) =>
        record.recordType === "order_category" &&
        record.detail.categoryLevel === "X",
    ),
  ).toHaveLength(1);
  expect(
    fixture.records.filter(
      (record) =>
        record.recordType === "order_category" &&
        record.detail.categoryLevel === "T",
    ),
  ).toHaveLength(5);
  expect(
    fixture.records
      .filter((record) => record.recordType === "chart_group")
      .map((record) => record.detail.groupCode)
      .sort(),
  ).toEqual(
    [
      "CG_CONSULTATION",
      "CG_EXAM",
      "CG_MEDICATION_SUPPLY",
      "CG_PROCEDURE",
      "CG_THERAPY",
    ].sort(),
  );
  expect(
    fixture.records
      .filter((record) => record.recordType === "chart_group")
      .map((record) => ({
        masterKey: record.masterKey,
        groupCode: record.detail.groupCode,
        sortOrder: record.detail.sortOrder,
      }))
      .sort((left, right) => Number(left.sortOrder) - Number(right.sortOrder)),
  ).toEqual(expectedChartMappings);
  expect(
    fixture.records
      .filter((record) => record.recordType === "task_route")
      .map((record) => ({
        masterKey: record.masterKey,
        routeCode: record.detail.routeCode,
        destinationModule: record.detail.destinationModule,
        taskRequired: record.detail.taskRequired,
        runtimeStatus: record.detail.runtimeStatus,
      }))
      .sort((left, right) => String(left.routeCode).localeCompare(String(right.routeCode))),
  ).toEqual(expectedRouteMappings);
  expect(
    fixture.records
      .filter((record) => record.recordType === "species")
      .map((record) => ({ masterKey: record.masterKey, speciesCode: record.detail.speciesCode }))
      .sort((left, right) => String(left.speciesCode).localeCompare(String(right.speciesCode))),
  ).toEqual(expectedSpeciesMappings);
  expect(fixture.classificationPaths).toEqual(expectedPathMappings);
});

test("PR-011 migration restores A1 ordering, action-code snapshots, and exact stage guard", () => {
  const stageCheck = [
    "order_category",
    "clinical_action",
    "chart_group",
    "task_route",
    "order",
    "species",
    "unit",
    "specimen_type",
    "result_input_type",
    "lab_test",
    "lab_panel",
  ];
  expect(migration).toContain(
    "clinical_master_lab_publish_stage_record_type_check",
  );
  expect(migration).toContain(
    "check (record_type in (\n      'order_category','clinical_action','chart_group','task_route','order',\n      'species','unit','specimen_type','result_input_type','lab_test','lab_panel'",
  );
  for (const type of stageCheck) expect(migration).toContain(`'${type}'`);

  const publisherStart = migration.indexOf(
    "create or replace function private.publish_clinical_master_release(",
  );
  const publisherEnd = migration.indexOf(
    "revoke all on function private.publish_clinical_master_release",
    publisherStart,
  );
  expect(publisherStart).toBeGreaterThanOrEqual(0);
  expect(publisherEnd).toBeGreaterThan(publisherStart);
  const publisher = migration.slice(publisherStart, publisherEnd);

  expect(publisher).toContain(
    "returns jsonb language plpgsql security definer set search_path = public, private, master, extensions, pg_catalog",
  );
  expect(publisher).toContain(
    "clinical_master_record_content(records.value,case when records.value->>'recordType'='clinical_action'",
  );
  expect(publisher).toContain(
    "select action_code into v_action_code from master.clinical_actions",
  );
  expect(publisher).toContain(
    "private.clinical_master_record_content(records.value,case when records.value->>'recordType'='clinical_action'",
  );
  expect(publisher).toContain(
    "v_incoming_content := private.clinical_master_record_content(v_record,v_action_code)",
  );
  expect(publisher).toContain(
    "v_snapshot := jsonb_set(v_incoming_content,'{revision}',to_jsonb(v_revision),true)",
  );
  expect(publisher).toContain(
    "clinical_master_category_code_conflict",
  );
  expect(publisher).toContain("clinical_master_chart_group_code_conflict");
  expect(publisher).toContain("clinical_master_task_route_code_conflict");
  expect(migration).toContain("end\n  where stage.release_id=v_release.id;");

  const passOrder = [
    "where value->>'recordType'='order_category'",
    "where value->>'recordType'='clinical_action'",
    "where value->>'recordType'='chart_group'",
    "where value->>'recordType'='task_route'",
    "where value->>'recordType'='order'",
  ].map((token) => publisher.indexOf(token));
  expect(passOrder.every((index) => index >= 0)).toBe(true);
  expect(passOrder).toEqual([...passOrder].sort((left, right) => left - right));

  expect(migration).toContain(
    "revoke all on function private.publish_clinical_master_release(jsonb,uuid) from public, anon, authenticated, service_role",
  );
});

test("PR-011 migration is directly reapply-safe and replay remains rollback-only", () => {
  expect(migration).toContain("if exists (");
  expect(migration).toContain(
    "drop constraint clinical_master_lab_publish_stage_record_type_check",
  );
  expect(migration).toContain(
    "add constraint clinical_master_lab_publish_stage_record_type_check",
  );
  expect(migration.match(/create or replace function private\.publish_clinical_master_release\(/g)).toHaveLength(1);

  expect(replay).toContain("\\set ON_ERROR_STOP on");
  expect(replay).toContain("begin;");
  expect(replay).toContain(
    "\\ir ../migrations/20260823124500_clinical_master_publisher_full_type_hotfix.sql",
  );
  expect(replay).toContain("rollback;");
  expect(replay).toContain(
    "clinical_master_publisher_full_type_hotfix_direct_migration_reapply_ok",
  );
  expect(replay).toContain(
    "clinical_master_publisher_full_type_hotfix_replay_ok",
  );
  for (const token of [
    "all_11_types",
    "existing_identity_revision_failed",
    "classification_relation_failed",
    "new_path",
    "typed_rows",
    "stage_types",
    "specialized_stage",
    "same_payload_not_idempotent",
    "unchanged_action_false_bumped",
    "action_code_snapshot",
    "execute_leaked",
    "preexisting_stage_fingerprint_failed",
    "natural_collision_boundary_failed",
    "natural_collision_not_rejected",
    "natural_collision_residue",
    "chart_mapping_failed",
    "route_mapping_failed",
    "species_mapping_failed",
    "classification_tuple_failed",
  ]) {
    expect(replay).toContain(`clinical_master_publisher_full_type_hotfix_${token}`);
  }
  expect(replay).toContain("v_existing_identity_keys");
  expect(replay).toContain("v_existing_identity_state");
  expect(replay).toContain("v_before_lab_stage_fingerprint");
  expect(replay).toContain("v_expected_chart_mappings");
  expect(replay).toContain("v_expected_route_mappings");
  expect(replay).toContain("v_expected_species_mappings");
  expect(replay).toContain("v_expected_path_mappings");
  expect(replay).toContain("v_probe_sqlstate = returned_sqlstate");
  expect(replay).toContain("v_probe_constraint = constraint_name");
  expect(replay).toContain("v_probe_sqlstate <> '23505'");
  expect(replay).toContain("chart_groups_group_code_key");
  expect(replay).toContain("task_routes_route_code_key");
  expect(replay).toContain("species_species_code_key");
  expect(replay).toContain("clinical_master_publisher_full_type_hotfix_natural_collision_probes_ok");
  expect(replay).toContain("v_before_records + 72");
  expect(replay).toContain("v_before_chart_groups + 1");
  expect(replay).toContain("v_before_task_routes + 0");
  expect(replay).toContain("v_before_species + 0");
  expect(replay).toContain("v_before_records + 72");
});
