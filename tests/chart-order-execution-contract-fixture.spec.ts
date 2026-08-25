import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const fixture = JSON.parse(
  readFileSync(
    "tests/fixtures/chart-order-execution-contract.fixture.json",
    "utf8",
  ),
) as {
  releaseKey: string;
  detailSchemaVersion: number;
  clinicalOrderTypes: Array<{
    type: string;
    destinationModule: string | null;
    executionMode: string;
    inlineFields: string[];
    detailFields: string[];
  }>;
  fieldDefinitionRequirements: string[];
  legacyMapping: {
    externalLabRule: string;
    destinationNormalization: Record<
      string,
      { destinationModule: string | null; executionMode: string }
    >;
  };
  confirmationScenario: {
    rows: Array<{
      rowType: string;
      children?: Array<{ rowType: string; included: boolean }>;
    }>;
    selectedRootOrderIds: string[];
    expected: Record<string, boolean | number | Record<string, number>>;
  };
};

test("execution fixture freezes the eight canonical types and master-owned routing", () => {
  expect(fixture.releaseKey).toBe("chart-order-execution-contract-v1");
  expect(fixture.detailSchemaVersion).toBe(1);
  expect(fixture.clinicalOrderTypes.map((entry) => entry.type)).toEqual([
    "consultation",
    "clinical_lab",
    "imaging",
    "external_lab",
    "dispensing",
    "treatment",
    "hospitalization",
    "other",
  ]);
  expect(
    fixture.clinicalOrderTypes.every(
      (entry) =>
        entry.inlineFields.length > 0 && entry.detailFields.length > 0,
    ),
  ).toBe(true);
  expect(
    fixture.clinicalOrderTypes
      .filter((entry) => entry.executionMode === "routed")
      .every((entry) => entry.destinationModule !== null),
  ).toBe(true);
  expect(
    fixture.clinicalOrderTypes
      .filter((entry) => entry.executionMode === "immediate_complete")
      .every((entry) => entry.destinationModule === null),
  ).toBe(true);
  expect(fixture.legacyMapping.externalLabRule).toBe(
    "canonical_master_field_only",
  );
});

test("execution fixture freezes complete versioned field-definition metadata", () => {
  expect(fixture.fieldDefinitionRequirements).toEqual([
    "key",
    "valueType",
    "label",
    "control",
    "unit",
    "options",
    "displayOrder",
    "required",
    "defaultValue",
    "validation",
    "placement",
    "bulkEditable",
    "semantics",
    "preConfirmEditable",
    "postConfirmBehavior",
    "snapshotPath",
  ]);
  expect(fixture.legacyMapping.destinationNormalization).toEqual({
    billing_only: {
      destinationModule: null,
      executionMode: "immediate_complete",
    },
    chart_only: {
      destinationModule: null,
      executionMode: "immediate_complete",
    },
  });
});

test("execution fixture covers a 13-root mixed draft, a set, partial confirmation, and retry invariants", () => {
  const scenario = fixture.confirmationScenario;
  const setParent = scenario.rows.find((row) => row.rowType === "set");

  expect(scenario.rows).toHaveLength(13);
  expect(setParent?.children).toHaveLength(3);
  expect(
    setParent?.children?.every(
      (child) => child.rowType === "set_child" && child.included,
    ),
  ).toBe(true);
  expect(scenario.selectedRootOrderIds).toHaveLength(3);
  expect(scenario.expected).toMatchObject({
    draftArtifactCounts: {
      tasks: 0,
      queues: 0,
      billingCandidates: 0,
      notifications: 0,
    },
    confirmedRootCount: 3,
    remainingDraftRootCount: 10,
    taskCount: 6,
    aggregateTaskCount: 1,
    executionTaskCount: 5,
    immediateCompleteTaskCount: 1,
    queueProjectionCount: 4,
    billingCandidateCount: 5,
    retryCreatesAdditionalArtifacts: false,
    differentPayloadSameKeyConflicts: true,
    staleEtagConflicts: true,
  });
});
