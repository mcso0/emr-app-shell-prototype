import type { Patient } from "@/types/emr-domain";
import { getPatientSexLabel, getSpeciesLabel } from "./data";

export const formatProfileDate = (value?: string) => {
  if (!value || Number.isNaN(new Date(value).getTime())) return "미입력";

  return new Intl.DateTimeFormat("ko-KR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Seoul",
    year: "numeric",
  })
    .format(new Date(value))
    .replace(/\. /g, ".")
    .replace(/\.$/, "");
};

export const formatProfileSchedule = (value?: string) => {
  if (!value || Number.isNaN(new Date(value).getTime())) return "일정 미정";

  const parts = new Intl.DateTimeFormat("ko-KR", {
    day: "numeric",
    hour: "numeric",
    hour12: true,
    minute: "2-digit",
    month: "long",
    timeZone: "Asia/Seoul",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  const dayPeriod = part("dayPeriod");
  const rawHour = Number(part("hour"));
  const hour = dayPeriod === "오후" && rawHour !== 12 ? rawHour + 12 : rawHour === 12 && dayPeriod === "오전" ? 0 : rawHour;

  return `${part("month")} ${part("day")}일 ${hour}시 ${part("minute")}분`;
};

export const formatProfileTime = (value?: string) => {
  if (!value || Number.isNaN(new Date(value).getTime())) return undefined;

  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
};

export const getProfileSpeciesLabel = (patient: Patient) =>
  patient.species === "dog" ? "개" : patient.species === "cat" ? "고양이" : getSpeciesLabel(patient);

export const getProfileSexLabel = (patient: Patient) =>
  getPatientSexLabel(patient).replace("중성화·", "중성화 ");

export const getProfileMemo = (patient: Patient) =>
  patient.specialNote ?? patient.allergyNote ?? patient.handlingCautionNote ?? "환자 메모 미입력";

