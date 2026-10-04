import { getOperatingDateFromIso } from "@/lib/emr-domain/demo-date";
import type { Appointment, Encounter } from "@/types/emr-domain";

export type ProfileTodayStatus = "reservation" | "waiting" | "consulting" | "billing";
export type ProfileTodayItem = {
  id: string;
  patientId: string;
  patientName: string;
  scheduledAt: string;
  status: ProfileTodayStatus;
  title: string;
  description: string;
};
export type ProfileTodayEncounter = Pick<Encounter,
  "id" | "workspaceId" | "patientId" | "appointmentId" | "status" | "checkedInAt" |
  "createdAt" | "visitPurpose" | "chiefComplaint" | "receptionMemo"
>;

const statusOrder: Record<ProfileTodayStatus, number> = { consulting: 0, waiting: 1, billing: 2, reservation: 3 };
const firstText = (...values: Array<string | undefined>) => values.find((value) => value?.trim())?.trim();

export function getProfileTodayItems({ appointments, encounters, patientNames, workspaceId, date }: {
  appointments: Appointment[];
  encounters: ProfileTodayEncounter[];
  patientNames: Map<string, string>;
  workspaceId: string;
  date: string;
}): ProfileTodayItem[] {
  const relevantEncounters = encounters.filter((item) => item.workspaceId === workspaceId && patientNames.has(item.patientId));
  const appointmentById = new Map(appointments.filter((item) => item.workspaceId === workspaceId && patientNames.has(item.patientId)).map((item) => [item.id, item]));
  const linkedAppointments = new Set(relevantEncounters.map((item) => item.appointmentId).filter(Boolean));
  const items = new Map<string, ProfileTodayItem>();
  for (const encounter of relevantEncounters) {
    const status = encounter.status === "waiting" ? "waiting" : encounter.status === "in_consultation" ? "consulting" : encounter.status === "ready_for_billing" ? "billing" : undefined;
    const scheduledAt = encounter.checkedInAt ?? encounter.createdAt;
    if (!status || getOperatingDateFromIso(scheduledAt) !== date) continue;
    const linked = encounter.appointmentId ? appointmentById.get(encounter.appointmentId) : undefined;
    const appointment = linked?.patientId === encounter.patientId ? linked : undefined;
    const id = `encounter:${encounter.id}`;
    items.set(id, {
      id, patientId: encounter.patientId, patientName: patientNames.get(encounter.patientId)!, scheduledAt, status,
      title: status === "waiting" ? "진료 대기" : status === "consulting" ? "진료중" : "수납대기",
      description: firstText(encounter.visitPurpose, encounter.chiefComplaint, appointment?.visitPurpose, encounter.receptionMemo, appointment?.symptomNote) ?? "방문목적이 입력되지 않았습니다.",
    });
  }
  for (const appointment of appointmentById.values()) {
    if (!["requested", "confirmed", "changed"].includes(appointment.status) || linkedAppointments.has(appointment.id) || getOperatingDateFromIso(appointment.scheduledStartAt) !== date) continue;
    const parts = new Intl.DateTimeFormat("ko-KR", { hour: "numeric", hour12: false, minute: "2-digit", timeZone: "Asia/Seoul" }).formatToParts(new Date(appointment.scheduledStartAt));
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
    const id = `appointment:${appointment.id}`;
    items.set(id, {
      id, patientId: appointment.patientId, patientName: patientNames.get(appointment.patientId)!, scheduledAt: appointment.scheduledStartAt, status: "reservation",
      title: `오늘 ${Number(part("hour"))}시 ${part("minute")}분 · 예약`,
      description: firstText(appointment.visitPurpose, appointment.symptomNote) ?? "예약 메모가 입력되지 않았습니다.",
    });
  }
  return [...items.values()].sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt) || a.id.localeCompare(b.id));
}
