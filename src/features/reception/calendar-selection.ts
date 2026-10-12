import { getOperatingIsoAtMinutes, getOperatingMinutesFromIso } from "@/lib/emr-domain/demo-date";
import { getAppointmentPatient, type ReceptionDraftCheckIn } from "./data";
import type { Appointment } from "@/types/emr-domain";
import type { CalendarTimeScale } from "./calendar-time-scale";

// Selection eligibility and time normalization only. The screen owns pointer
// lifetime, form state, permissions and every registration/reservation write.
export const dayScheduleStartHour = 0;

export const dayScheduleEndHour = 24;

export const dayBusinessOpenHour = 9;

export const dayBusinessCloseHour = 19;

export const scheduleSlotMinutes = 15;

const maxReceptionCalendarDraftDurationMinutes = 240;

export const defaultWalkInDuration = "30분";

export const getReceptionIsoAtMinutes = (date: string, minutes: number) =>
  getOperatingIsoAtMinutes(date, minutes);

export const getDraftScheduleStartAt = (draft: ReceptionDraftCheckIn) =>
  draft.plannedStartAt ??
  draft.encounter.checkedInAt ??
  draft.encounter.createdAt;

export const clampScheduleMinutes = (minutes: number) =>
  Math.min(
    dayScheduleEndHour * 60,
    Math.max(dayScheduleStartHour * 60, minutes),
  );

export const snapScheduleStartMinutes = (minutes: number) =>
  clampScheduleMinutes(
    Math.floor(minutes / scheduleSlotMinutes) * scheduleSlotMinutes,
  );

export const snapScheduleEndMinutes = (minutes: number) =>
  clampScheduleMinutes(
    Math.ceil(minutes / scheduleSlotMinutes) * scheduleSlotMinutes,
  );

type ReceptionCalendarSelectionInvalidReason =
  | "outside-business-hours"
  | "past-time"
  | "unavailable-time"
  | "overlap"
  | "too-short"
  | "too-long"
  | "lane-boundary"
  | "date-boundary";

export type ReceptionCalendarScheduleBlock = {
  endMinutes: number;
  label: string;
  startMinutes: number;
  veterinarianId?: string;
};

type ReceptionCalendarSelectionValidationResult =
  | {
      durationMinutes: number;
      endMinutes: number;
      plannedStartAt: string;
      startMinutes: number;
      valid: true;
    }
  | {
      message: string;
      reason: ReceptionCalendarSelectionInvalidReason;
      valid: false;
    };

const dayBusinessOpenMinutes = dayBusinessOpenHour * 60;

const dayBusinessCloseMinutes = dayBusinessCloseHour * 60;

const receptionCalendarUnavailableBlocks: ReceptionCalendarScheduleBlock[] = [];

const rangesOverlap = (
  startMinutes: number,
  endMinutes: number,
  blockStart: number,
  blockEnd: number,
) => startMinutes < blockEnd && endMinutes > blockStart;

const normalizeReceptionCalendarSelection = ({
  endMinutes,
  startMinutes,
}: {
  endMinutes: number;
  startMinutes: number;
}) => {
  const rawStart = Math.min(startMinutes, endMinutes);
  const rawEnd = Math.max(startMinutes, endMinutes);
  const snappedStart = snapScheduleStartMinutes(rawStart);
  const snappedEnd = Math.max(
    snappedStart + scheduleSlotMinutes,
    snapScheduleEndMinutes(rawEnd),
  );

  return {
    durationMinutes: snappedEnd - snappedStart,
    endMinutes: snappedEnd,
    startMinutes: snappedStart,
  };
};

export const getAppointmentScheduleBlock = (
  appointment: Appointment,
): ReceptionCalendarScheduleBlock | undefined => {
  const startMinutes = getMinutesInDayFromDateTime(
    appointment.scheduledStartAt,
  );

  if (startMinutes === undefined) return undefined;

  const endMinutes =
    getMinutesInDayFromDateTime(appointment.scheduledEndAt) ??
    startMinutes + scheduleSlotMinutes;

  return {
    endMinutes,
    label: getAppointmentPatient(appointment)?.name ?? "예약",
    startMinutes,
    veterinarianId: appointment.assignedVeterinarianId,
  };
};

export const getDraftScheduleBlock = (
  draft: ReceptionDraftCheckIn,
): ReceptionCalendarScheduleBlock | undefined => {
  const startMinutes = getMinutesInDayFromDateTime(
    getDraftScheduleStartAt(draft),
  );
  const durationMinutes =
    draft.durationMinutes ??
    getDurationMinutesFromLabel(defaultWalkInDuration) ??
    30;

  if (startMinutes === undefined) return undefined;

  return {
    endMinutes: startMinutes + durationMinutes,
    label: draft.encounter.visitPurpose ?? "접수",
    startMinutes,
    veterinarianId: draft.encounter.primaryVeterinarianId,
  };
};

const getReceptionCalendarSelectionMessage = (
  reason: ReceptionCalendarSelectionInvalidReason,
  block?: ReceptionCalendarScheduleBlock,
) => {
  if (reason === "outside-business-hours") {
    return "설정된 영업시간 안에서만 접수/예약을 만들 수 있습니다.";
  }
  if (reason === "past-time") {
    return "이미 지난 시간에는 접수/예약을 만들 수 없습니다. 현재 이후 시간을 선택해 주세요.";
  }
  if (reason === "unavailable-time") {
    return `${block?.label ?? "접수/예약 불가 시간"}에는 접수/예약을 만들 수 없습니다.`;
  }
  if (reason === "overlap") {
    return `${block?.label ?? "기존 일정"}과 겹치는 시간에는 접수/예약을 만들 수 없습니다.`;
  }
  if (reason === "too-long") {
    return `접수 task는 최대 ${maxReceptionCalendarDraftDurationMinutes}분까지 만들 수 있습니다.`;
  }
  if (reason === "too-short") {
    return "접수 task는 최소 15분 이상이어야 합니다.";
  }

  return "선택한 캘린더 위치에서는 접수/예약을 만들 수 없습니다.";
};

export const validateReceptionCalendarSelection = ({
  appointments,
  currentDate,
  currentOperatingMinutes,
  draftCheckIns,
  endMinutes,
  operatingDate,
  startMinutes,
  timeScale,
  veterinarianId,
}: {
  appointments: Appointment[];
  currentDate: string;
  currentOperatingMinutes: number;
  draftCheckIns: ReceptionDraftCheckIn[];
  endMinutes: number;
  operatingDate: string;
  startMinutes: number;
  timeScale?: CalendarTimeScale;
  veterinarianId: string;
}): ReceptionCalendarSelectionValidationResult => {
  const normalized = normalizeReceptionCalendarSelection({
    endMinutes,
    startMinutes,
  });

  if (normalized.durationMinutes < scheduleSlotMinutes) {
    return {
      message: getReceptionCalendarSelectionMessage("too-short"),
      reason: "too-short",
      valid: false,
    };
  }

  if (normalized.durationMinutes > maxReceptionCalendarDraftDurationMinutes) {
    return {
      message: getReceptionCalendarSelectionMessage("too-long"),
      reason: "too-long",
      valid: false,
    };
  }

  if (timeScale
    ? !timeScale.isSelectable(normalized.startMinutes, normalized.durationMinutes)
    : normalized.startMinutes < dayBusinessOpenMinutes || normalized.endMinutes > dayBusinessCloseMinutes) {
    return {
      message: getReceptionCalendarSelectionMessage("outside-business-hours"),
      reason: "outside-business-hours",
      valid: false,
    };
  }

  if (operatingDate === currentDate && normalized.startMinutes < currentOperatingMinutes) {
    return {
      message: getReceptionCalendarSelectionMessage("past-time"),
      reason: "past-time",
      valid: false,
    };
  }

  const unavailableBlock = receptionCalendarUnavailableBlocks.find(
    (block) =>
      (!block.veterinarianId || block.veterinarianId === veterinarianId) &&
      rangesOverlap(
        normalized.startMinutes,
        normalized.endMinutes,
        block.startMinutes,
        block.endMinutes,
      ),
  );

  if (unavailableBlock) {
    return {
      message: getReceptionCalendarSelectionMessage(
        "unavailable-time",
        unavailableBlock,
      ),
      reason: "unavailable-time",
      valid: false,
    };
  }

  const scheduleBlocks = [
    ...appointments.map(getAppointmentScheduleBlock),
    ...draftCheckIns.map(getDraftScheduleBlock),
  ].filter((block): block is ReceptionCalendarScheduleBlock => Boolean(block));
  const overlappingBlock = scheduleBlocks.find(
    (block) =>
      block.veterinarianId === veterinarianId &&
      rangesOverlap(
        normalized.startMinutes,
        normalized.endMinutes,
        block.startMinutes,
        block.endMinutes,
      ),
  );

  if (overlappingBlock) {
    return {
      message: getReceptionCalendarSelectionMessage(
        "overlap",
        overlappingBlock,
      ),
      reason: "overlap",
      valid: false,
    };
  }

  return {
    ...normalized,
    plannedStartAt: getReceptionIsoAtMinutes(
      operatingDate,
      normalized.startMinutes,
    ),
    valid: true,
  };
};

export const getMinutesInDayFromDateTime = (dateTime?: string) => {
  return getOperatingMinutesFromIso(dateTime);
};

export const getDurationMinutesFromLabel = (label: string) => {
  const minutes = Number(label.replace("분", ""));

  return Number.isFinite(minutes) ? minutes : undefined;
};
