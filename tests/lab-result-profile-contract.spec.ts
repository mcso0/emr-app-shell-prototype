import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { evaluateLabProfileValue as evaluate, parseLabResultProfile, type LabResultProfile } from "../src/features/lab-imaging/result-profile-contract";
import { parsePersistedLabResult } from "../src/features/lab-imaging/persisted-result-contract";
import type { LabResult } from "../src/types/emr-domain";
import { createAtomicLabRetest, parseAtomicLabRetestInput } from "../src/features/lab-imaging/server-atomic-retest-core";
import { mutateLabProfileConfiguration } from "../src/features/lab-imaging/server-result-profile-core";
import { expandLabComposition } from "../src/features/lab-imaging/composition-contract";
import { validateClinicalMasterPublishPayload, normalizeClinicalMasterPublishPayload } from "../src/features/clinical-master/server-clinical-master-publisher-core";

const candidate = JSON.parse(readFileSync("docs/work/clinical-master/order-execution-defaults/artifacts/oed-lab-04/cbc-runtime.non-applied.v1.json", "utf8"));
const profiles: LabResultProfile[] = candidate.profiles;
const manual = profiles.find(p => p.profileKey === "cm.lab-profile.clair-demo-cbc.dog")!;
const wbc = manual.rules.find(r => r.code === "WBC")!;
const coded = profiles.flatMap(p => p.rules).find(r => r.resultValueKind === "coded")!;

test("complete522 reconciled candidate passes the real publish API without losing composition pins", () => {
  const candidate = JSON.parse(readFileSync("docs/work/clinical-master/order-execution-defaults/artifacts/wp-09/combined-release.non-applied.v1.json", "utf8"));
  expect(candidate.ledger).toHaveLength(522);
  expect(candidate.counts).toMatchObject({ retiredOriginals: 51, additionalOrders: 53, candidateOrders: 524 });
  expect(validateClinicalMasterPublishPayload(candidate.payload)).toEqual([]);
  expect(normalizeClinicalMasterPublishPayload(candidate.payload).labCompositions).toHaveLength(35);
  const external = structuredClone(candidate.payload);
  const externalOrder = external.records.find((r: { detail: { executionPreset?: { clinicalOrderType: string } } }) => r.detail.executionPreset?.clinicalOrderType === "clinical_lab");
  externalOrder.detail.executionPreset.clinicalOrderType = "external_lab";
  delete externalOrder.detail.adminSubcategoryCode;
  delete externalOrder.detail.labFamilyCode;
  expect(validateClinicalMasterPublishPayload(external)).toEqual([]);
  const invalid = structuredClone(candidate.payload);
  invalid.labCompositions[0].id = "invalid";
  expect(validateClinicalMasterPublishPayload(invalid).map(i => i.code)).toContain("lab_compositions_invalid");
  invalid.labCompositions = structuredClone(candidate.payload.labCompositions);
  invalid.labCompositions[0].members[0] = { kind: "composition", memberKey: invalid.labCompositions[0].masterKey, defaultIncluded: true };
  expect(validateClinicalMasterPublishPayload(invalid).map(i => i.code)).toContain("lab_composition_graph_invalid");
});

test("all86 laboratory identities preserve assay/specimen authority and explicit typed profile coverage", () => {
  const all = JSON.parse(readFileSync("docs/work/clinical-master/order-execution-defaults/artifacts/oed-lab-04/all-runtime.non-applied.v1.json", "utf8"));
  expect(all.reconciliation).toHaveLength(86); expect(all.labOrderProfiles).toHaveLength(90); expect(all.newAtomic).toHaveLength(13);
  expect(all.compositions).toHaveLength(35); expect(all.profiles).toHaveLength(24);
  const records = new Map<string, { detail: { species: string[] } }>(all.records.map((r: { masterKey: string; detail: { species: string[] } }) => [r.masterKey, r]));
  for (const p of all.profiles) expect(parseLabResultProfile(p)).not.toBeNull();
  for (const p of all.labOrderProfiles) for (const species of records.get(p.orderMasterKey)!.detail.species) {
    expect(all.profiles.some((profile: LabResultProfile) => profile.species === species && profile.specimenMasterKey === p.specimenMasterKey
      && profile.rules.some(r => r.testMasterKey === p.labTestMasterKey && r.supported))).toBe(true);
  }
  expect(all.labOrderProfiles.find((p: { orderMasterKey: string }) => p.orderMasterKey === "cm.order.v4.lab-test.14").specimenMasterKey).toBe("cm.specimen.edta-whole-blood");
  expect(all.newAtomic.some((p: { testMasterKey: string }) => p.testMasterKey === "cm.lab-test.cbc-wbc")).toBe(false);
  for (const c of all.compositions) expect(expandLabComposition(all.compositions, c.masterKey, new Set(all.requiresProfileOrderKeys)).length).toBeGreaterThan(0);
  const bloodType = all.profiles.flatMap((p: LabResultProfile) => p.rules).filter((r: { code: string }) => r.code === "BLOOD_TYPE");
  expect(bloodType.flatMap((r: { codes: Array<{ code: string }> }) => r.codes.map(c => c.code))).toEqual(expect.arrayContaining(["A", "B", "AB", "dea1_positive"]));
});

test("composition application requires explicit billing/version/CAS and verifies returned workspace", async () => {
  const input = { action: "apply_composition", versionId: candidate.compositions[0].id, requestId: "97050000-0000-4000-8000-000000000099",
    expectedSetRevisionId: null, billingPolicy: "no_charge" };
  let calls = 0;
  const client = { rpc: async () => { calls++; return { data: { ok: true, workspaceId: "foreign", compositionVersionId: input.versionId,
    billingPolicy: "no_charge", orderSetId: "set", orderSetRevisionId: input.requestId, leafCount: 26 }, error: null }; } };
  expect(await mutateLabProfileConfiguration(client, "workspace", { ...input, billingPolicy: undefined })).toMatchObject({ status: 400 });
  expect(calls).toBe(0);
  expect(await mutateLabProfileConfiguration(client, "workspace", input)).toMatchObject({ status: 502 });
});

test("all six explicit immutable CBC profiles satisfy the runtime contract without device integration", () => {
  expect(profiles).toHaveLength(6);
  for (const p of profiles) expect(parseLabResultProfile(p)).toEqual(p);
  expect(parseLabResultProfile({ ...manual, id: "invalid" })).toBeNull();
  expect(parseLabResultProfile({ ...manual, rules: [...manual.rules, manual.rules[0]] })).toBeNull();
  expect(parseLabResultProfile({ ...manual, clinicalUseAllowed: true })).toBeNull();
});
test("empty is not zero and interval boundaries are inclusive without rounding", () => {
  expect(evaluate(wbc, { value: "  " })).toEqual({ valid: true, value: null, state: "not_entered", judgment: "not_judged" });
  for (const n of [wbc.referenceInterval!.low, wbc.referenceInterval!.high]) expect(evaluate(wbc, { value: String(n) })).toMatchObject({ valid: true, judgment: "normal" });
  expect(evaluate(wbc, { value: String(wbc.referenceInterval!.high + 0.001) })).toMatchObject({ valid: true, judgment: "high" });
  expect(evaluate(wbc, { value: "0" })).toMatchObject({ valid: true, value: "0", judgment: "low" });
});
for (const invalid of ["-1", "NaN", "1e2", "Infinity", "1,000", "4 mg", "--2"]) {
  test(`numeric profile rejects ${invalid}`, () => expect(evaluate(wbc, { value: invalid })).toMatchObject({ valid: false }));
}
test("instrument state, qualifiers, flags and documented display bounds never invent judgment", () => {
  expect(evaluate(wbc, { value: null, resultState: "instrument_no_result" })).toMatchObject({ valid: true, state: "instrument_no_result", judgment: "not_judged" });
  expect(evaluate(wbc, { value: "4", resultState: "instrument_no_result" })).toMatchObject({ valid: false });
  expect(evaluate(wbc, { value: "4", qualifier: "less_than" })).toMatchObject({ valid: true, state: "qualified_result", judgment: "not_judged" });
  expect(evaluate(wbc, { value: "4", deviceFlag: "Review smear" })).toMatchObject({ valid: true, state: "flagged_result", judgment: "not_judged" });
  expect(evaluate({ ...wbc, displayRange: { low: 0, high: 10 } }, { value: "11" })).toMatchObject({ valid: true, state: "outside_documented_display_range", judgment: "not_judged" });
  expect(evaluate(wbc, { value: null, qualifier: "less_than" })).toMatchObject({ valid: false });
});
test("coded abnormal is not numeric high; unsupported or unrecognized codes fail", () => {
  expect(evaluate(coded, { value: "abnormal" })).toMatchObject({ valid: true, judgment: "abnormal" });
  expect(evaluate(coded, { value: "not_performed" })).toMatchObject({ valid: true, judgment: "not_judged" });
  expect(evaluate(coded, { value: "made-up" })).toMatchObject({ valid: false });
  expect(evaluate({ ...coded, supported: false }, { value: "normal" })).toMatchObject({ valid: false });
});
const expected = { workspaceId: "synthetic-workspace", orderId: "order", workItemId: "task", encounterId: "encounter" };
const base: LabResult = { id: "queue-only-placeholder", workspaceId: expected.workspaceId, orderId: expected.orderId,
  encounterId: expected.encounterId, patientId: "synthetic-patient", resultName: "WBC", status: "pending", rows: [] };
const result = () => ({ ...expected, ok: true, resultId: "actual-persisted-result-id", entryWriteRevision: 0,
  resultDefinitionSnapshot: { schemaVersion: 2, resultProfile: { profileKey: manual.profileKey, revision: 1,
    clinicalUseAllowed: false, integrationStatus: "not_integrated", device: { name: "Explicit manual" } } },
  rows: [{ id: "row", analyteName: "WBC", value: null, unit: wbc.unit, referenceRange: "1–10", judgment: "not_judged",
    resultValueKind: "numeric", decimalScale: wbc.decimalScale, interpretationRule: wbc,
    resultPresence: "value", resultState: "not_entered", qualifier: "exact", deviceFlag: null }] });
test("persisted result reader uses exact identity, rejects cross-workspace and corrupted interpretation", () => {
  expect(parsePersistedLabResult(result(), expected, base)).toMatchObject({ id: "actual-persisted-result-id", entryWriteRevision: 0, rows: [{ value: undefined, interpretationRule: wbc }] });
  for (const key of ["workspaceId", "orderId", "workItemId", "encounterId"]) expect(parsePersistedLabResult({ ...result(), [key]: "foreign" }, expected, base)).toBeNull();
  const wrong = result(); wrong.rows[0].judgment = "normal";
  expect(parsePersistedLabResult(wrong, expected, base)).toBeNull();
  const duplicate = result(); duplicate.rows.push(duplicate.rows[0]);
  expect(parsePersistedLabResult(duplicate, expected, base)).toBeNull();
});

test("atomic retest requires explicit specimen, billing, profile, and exact prior revision", async () => {
  const input = { requestId: "97050000-0000-4000-8000-000000000031", profileVersionId: manual.id, deviceId: "97050000-0000-4000-8000-000000000032",
    resultId: "result", rowId: "row", expectedEntryWriteRevision: 1, reason: "Synthetic repeat", specimenDecision: "new_specimen",
    specimenReference: "synthetic-new-001", billingPolicy: "no_charge" };
  expect(parseAtomicLabRetestInput(input)).toEqual(input);
  for (const key of ["specimenDecision", "billingPolicy", "profileVersionId", "reason", "specimenReference"]) expect(parseAtomicLabRetestInput({ ...input, [key]: "" })).toBeNull();
  expect(parseAtomicLabRetestInput({ ...input, expectedEntryWriteRevision: 0 })).toBeNull();
  expect(parseAtomicLabRetestInput({ ...input, actorUserId: "spoofed" })).toBeNull();
  const foreign = await createAtomicLabRetest({ rpc: async () => ({ data: { ok: true, workspaceId: "foreign" }, error: null }) }, "workspace", input);
  expect(foreign).toMatchObject({ ok: false, status: 502 });
  const denied = await createAtomicLabRetest({ rpc: async () => ({ data: null, error: { message: "permission_missing" } }) }, "workspace", input);
  expect(denied).toMatchObject({ ok: false, status: 403, error: "permission_missing" });
});
