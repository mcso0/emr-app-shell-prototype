import type { PermissionId } from "@/types/emr-domain";

export type ReceptionMutationId =
  | "appointment_create"
  | "appointment_check_in"
  | "encounter_cancel"
  | "patient_guardian_registration"
  | "walk_in_encounter_create";

export type ReceptionMutationPermissionContract = {
  auditHookPoint: string;
  requiredPermission: PermissionId;
};

export const receptionMutationPermissionMatrix = {
  appointment_create: {
    auditHookPoint: "reception.appointment.create",
    requiredPermission: "reception:create",
  },
  appointment_check_in: {
    auditHookPoint: "reception.appointment.check_in",
    requiredPermission: "reception:create",
  },
  encounter_cancel: {
    auditHookPoint: "reception.encounter.cancel",
    requiredPermission: "reception:update",
  },
  patient_guardian_registration: {
    auditHookPoint: "reception.patient_guardian.register",
    requiredPermission: "reception:create",
  },
  walk_in_encounter_create: {
    auditHookPoint: "reception.walk_in.create",
    requiredPermission: "reception:create",
  },
} satisfies Record<ReceptionMutationId, ReceptionMutationPermissionContract>;

export function getReceptionMutationPermissionContract(mutationId: ReceptionMutationId) {
  return receptionMutationPermissionMatrix[mutationId];
}
