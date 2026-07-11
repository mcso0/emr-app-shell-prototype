import type { Appointment, Encounter } from "@/types/emr-domain";

type ReceptionVisitContextRecord = Pick<Appointment, "id" | "patientId">;

export type ReceptionVisitContextDetailTarget = {
  id: string;
  label: "예약 상세" | "접수 상세";
  patientId: string;
  type: "reception-appointment" | "reception-encounter";
};

export const getReceptionVisitContextDetailTarget = ({
  appointment,
  encounter,
}: {
  appointment?: ReceptionVisitContextRecord;
  encounter?: Pick<Encounter, "id" | "patientId">;
}): ReceptionVisitContextDetailTarget | undefined => {
  if (encounter) {
    return {
      id: encounter.id,
      label: "접수 상세",
      patientId: encounter.patientId,
      type: "reception-encounter",
    };
  }

  if (appointment) {
    return {
      id: appointment.id,
      label: "예약 상세",
      patientId: appointment.patientId,
      type: "reception-appointment",
    };
  }

  return undefined;
};
