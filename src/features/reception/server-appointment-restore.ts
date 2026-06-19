import "server-only";

export {
  createSupabaseReceptionAppointmentRestoreGateway,
  restoreReceptionAppointment,
  type SupabaseReceptionAppointmentRestoreRpcClient,
} from "@/features/reception/server-appointment-restore-core";
