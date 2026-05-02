import { expect, test } from "@playwright/test";
import { MOCK_WORKSPACE_ID } from "../src/mocks/emr-domain";
import {
  createMockEmrReadRepository,
  createMockEmrReadSnapshot,
} from "../src/lib/emr-domain/mock-read-repository";
import {
  selectBillingGroupsByGuardian,
  selectEncounterReadModel,
  selectPatientReadModel,
} from "../src/lib/emr-domain/read-selectors";

const scope = { workspaceId: MOCK_WORKSPACE_ID };

test("patient read selector joins connected clinical, lab, imaging, and billing records", () => {
  const snapshot = createMockEmrReadSnapshot(scope);
  const patient = selectPatientReadModel(snapshot, scope, "patient-coco");

  expect(patient?.primaryGuardian?.id).toBe("guardian-lee-jieun");
  expect(patient?.appointments.map((item) => item.id)).toContain("appointment-coco-260501");
  expect(patient?.encounters.map((item) => item.id)).toContain("encounter-coco-260501");
  expect(patient?.soapNotes.map((item) => item.id)).toContain("soap-coco-260501");
  expect(patient?.orders.map((item) => item.id)).toEqual(
    expect.arrayContaining(["order-coco-cbc", "order-coco-thorax"])
  );
  expect(patient?.labResults.map((item) => item.id)).toContain("lab-result-coco-cbc");
  expect(patient?.imagingStudies.map((item) => item.id)).toContain("imaging-coco-thorax");
  expect(patient?.invoices.map((item) => item.id)).toContain("invoice-coco-260501");
  expect(patient?.latestWorkShortcuts.map((item) => item.workType)).toEqual(
    expect.arrayContaining(["chart", "lab", "imaging", "dispensing", "billing"])
  );
});

test("encounter read selector narrows encounter-owned records", () => {
  const snapshot = createMockEmrReadSnapshot(scope);
  const encounter = selectEncounterReadModel(snapshot, scope, "encounter-coco-260501");

  expect(encounter?.patient.id).toBe("patient-coco");
  expect(encounter?.appointment?.id).toBe("appointment-coco-260501");
  expect(encounter?.encounters.map((item) => item.id)).toEqual(["encounter-coco-260501"]);
  expect(encounter?.equipmentReceipts.map((item) => item.id)).toContain(
    "equipment-coco-cbc-receipt"
  );
  expect(encounter?.attachments.map((item) => item.ownerType)).toEqual(
    expect.arrayContaining(["lab_result", "imaging_study"])
  );
  expect(encounter?.orders.every((item) => item.encounterId === "encounter-coco-260501")).toBe(
    true
  );
});

test("selectors enforce workspace scope at the root entity boundary", () => {
  const snapshot = createMockEmrReadSnapshot(scope);

  expect(selectPatientReadModel(snapshot, { workspaceId: "other-workspace" }, "patient-coco")).toBe(
    null
  );
  expect(
    selectEncounterReadModel(snapshot, { workspaceId: "other-workspace" }, "encounter-coco-260501")
  ).toBe(null);
});

test("repository helper exposes the same selector contract", async () => {
  const repository = createMockEmrReadRepository();

  await expect(repository.getPatient(scope, "missing-patient")).resolves.toBe(null);
  await expect(repository.getEncounter(scope, "encounter-coco-260501")).resolves.toMatchObject({
    encounter: { id: "encounter-coco-260501" },
    patient: { id: "patient-coco" },
  });
  await expect(repository.getGuardian(scope, "guardian-kang-seoyun")).resolves.toMatchObject({
    patients: expect.arrayContaining([
      expect.objectContaining({ id: "patient-haru" }),
      expect.objectContaining({ id: "patient-dubu" }),
    ]),
  });
});

test("billing group selector keeps due totals independent from feature state", () => {
  const snapshot = createMockEmrReadSnapshot(scope);
  const groups = selectBillingGroupsByGuardian(snapshot, scope);
  const harinGroup = groups.find((group) => group.guardian.id === "guardian-jung-harin");
  const jieunGroup = groups.find((group) => group.guardian.id === "guardian-lee-jieun");

  expect(harinGroup?.patients.map((item) => item.id)).toContain("patient-dubu");
  expect(harinGroup?.totalDueAmount).toBe(28000);
  expect(jieunGroup?.invoices.map((item) => item.id)).toContain("invoice-coco-260501");
  expect(jieunGroup?.totalDueAmount).toBe(121500);
});
