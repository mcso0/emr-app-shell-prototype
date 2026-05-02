import { expect, test } from "@playwright/test";
import { getStatusLabel } from "../src/lib/emr-domain/status-labels";
import {
  getMockBillingGroupsByGuardian,
  getMockEncounterBundle,
  getMockGuardianBundle,
  getMockLatestWorkShortcutsForPatient,
  getMockPatientBundle,
} from "../src/mocks/emr-domain";

test("patient bundle connects guardian through clinical and billing records", () => {
  const bundle = getMockPatientBundle("patient-coco");

  expect(bundle?.primaryGuardian?.id).toBe("guardian-lee-jieun");
  expect(bundle?.appointments.map((item) => item.id)).toContain("appointment-coco-260501");
  expect(bundle?.encounters.map((item) => item.id)).toContain("encounter-coco-260501");
  expect(bundle?.soapNotes.map((item) => item.id)).toContain("soap-coco-260501");
  expect(bundle?.orders.map((item) => item.id)).toContain("order-coco-cbc");
  expect(bundle?.invoices.map((item) => item.id)).toContain("invoice-coco-260501");
});

test("patient and encounter bundles include PR 3-6 domain baseline records", () => {
  const patientBundle = getMockPatientBundle("patient-coco");
  const encounterBundle = getMockEncounterBundle("encounter-coco-260501");
  const latestShortcuts = getMockLatestWorkShortcutsForPatient("patient-coco");

  expect(patientBundle?.csHistories.map((item) => item.id)).toContain("cs-coco-checkin-call");
  expect(patientBundle?.latestWorkShortcuts.map((item) => item.workType)).toEqual(
    expect.arrayContaining(["chart", "lab", "imaging", "dispensing", "billing"])
  );
  expect(latestShortcuts.find((item) => item.workType === "dispensing")).toMatchObject({
    enabled: true,
    href: "/w/clair-demo/dispensing",
  });
  expect(latestShortcuts.find((item) => item.workType === "lab")).toMatchObject({
    enabled: false,
  });
  expect(patientBundle?.labResults.map((item) => item.id)).toContain("lab-result-coco-cbc");
  expect(patientBundle?.imagingStudies.map((item) => item.id)).toContain("imaging-coco-thorax");
  expect(patientBundle?.attachments.map((item) => item.id)).toContain("attachment-coco-cbc-pdf");

  expect(encounterBundle?.labResults.map((item) => item.id)).toContain("lab-result-coco-cbc");
  expect(encounterBundle?.equipmentReceipts.map((item) => item.id)).toContain(
    "equipment-coco-cbc-receipt"
  );
  expect(encounterBundle?.imagingStudies.map((item) => item.id)).toContain("imaging-coco-thorax");
  expect(encounterBundle?.attachments.map((item) => item.ownerType)).toEqual(
    expect.arrayContaining(["lab_result", "imaging_study"])
  );
});

test("guardian bundle and billing groups expose multi-patient relationships", () => {
  const guardianBundle = getMockGuardianBundle("guardian-kang-seoyun");
  const billingGroups = getMockBillingGroupsByGuardian();

  expect(guardianBundle?.patients.map((item) => item.id)).toEqual(
    expect.arrayContaining(["patient-haru", "patient-dubu"])
  );
  expect(guardianBundle?.patientGuardians).toHaveLength(2);

  const harinBillingGroup = billingGroups.find(
    (group) => group.guardian.id === "guardian-jung-harin"
  );

  expect(harinBillingGroup?.patients.map((item) => item.id)).toContain("patient-dubu");
  expect(harinBillingGroup?.invoices.map((item) => item.id)).toContain("invoice-dubu-260501");
});

test("status label mapper covers PR 1 domain baseline statuses", () => {
  expect(getStatusLabel("csHistory", "needs_follow_up")).toBe("추적필요");
  expect(getStatusLabel("labResult", "received")).toBe("수신");
  expect(getStatusLabel("labJudgment", "critical")).toBe("위험");
  expect(getStatusLabel("equipmentReceipt", "unmatched")).toBe("미매칭");
  expect(getStatusLabel("imagingStudy", "reading")).toBe("판독중");
  expect(getStatusLabel("payment", "refunded")).toBe("환불");
});
