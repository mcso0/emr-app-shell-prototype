import { expect, test } from "@playwright/test";
import { getReceptionVisitContextDetailTarget } from "@/features/reception/visit-context";

test("visit context prioritizes encounter detail over appointment detail", () => {
  expect(
    getReceptionVisitContextDetailTarget({
      appointment: { id: "appointment-1", patientId: "patient-1" },
      encounter: { id: "encounter-1", patientId: "patient-1" },
    }),
  ).toEqual({
    id: "encounter-1",
    label: "접수 상세",
    patientId: "patient-1",
    type: "reception-encounter",
  });
});

test("visit context falls back to appointment detail without an encounter", () => {
  expect(
    getReceptionVisitContextDetailTarget({
      appointment: { id: "appointment-1", patientId: "patient-1" },
    }),
  ).toEqual({
    id: "appointment-1",
    label: "예약 상세",
    patientId: "patient-1",
    type: "reception-appointment",
  });
});

test("visit context omits the detail action without a linked record", () => {
  expect(getReceptionVisitContextDetailTarget({})).toBeUndefined();
});
