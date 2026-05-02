import { expect, test } from "@playwright/test";
import { getDemoScenario } from "@/lib/emr-domain/demo-scenarios";
import {
  getMockEncounterBundle,
  getMockPatientBundle,
  mockAppointments,
  mockGuardians,
  mockInvoices,
  mockLabResults,
  mockOrders,
  mockPatients,
} from "@/mocks/emr-domain";

test("kong-vomit demo scenario links the full encounter spine", () => {
  const scenario = getDemoScenario("kong-vomit");

  expect(scenario).toBeTruthy();
  expect(mockGuardians.find((guardian) => guardian.id === scenario?.guardianId)?.name).toBe("김하늘");
  expect(mockPatients.find((patient) => patient.id === scenario?.patientId)?.name).toBe("콩이");
  expect(mockAppointments.find((appointment) => appointment.id === scenario?.appointmentId)?.status).toBe(
    "checked_in"
  );

  const patientBundle = getMockPatientBundle(scenario!.patientId);
  const encounterBundle = getMockEncounterBundle(scenario!.encounterId);

  expect(patientBundle?.primaryGuardian?.id).toBe(scenario?.guardianId);
  expect(encounterBundle?.encounter.patientId).toBe(scenario?.patientId);
  expect(encounterBundle?.soapNotes.at(-1)?.assessment).toContain("급성 위장관염");
  expect(encounterBundle?.diagnoses.map((diagnosis) => diagnosis.diagnosisText)).toContain(
    "급성 위장관염 의심"
  );
  expect(mockLabResults.find((result) => result.id === scenario?.labResultId)?.orderId).toBe(
    "order-kong-cbc"
  );
  expect(encounterBundle?.imagingStudies.find((study) => study.id === scenario?.imagingStudyId)?.orderId).toBe(
    "order-kong-abdomen"
  );
  expect(scenario?.orderIds.every((orderId) => mockOrders.some((order) => order.id === orderId))).toBe(
    true
  );
  expect(mockInvoices.find((invoice) => invoice.id === scenario?.invoiceId)?.totalAmount).toBe(156500);
});
