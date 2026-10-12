import type { Patient } from "@/types/emr-domain";
import type { ReceptionPatientSummary } from "./data";
import type { ReceptionPatientGuardianLookupItem } from "./patient-guardian-lookup";

export const getSpeciesLabel = (species: Patient["species"]) => {
  if (species === "dog") return "강아지";
  if (species === "cat") return "고양이";
  if (species === "rabbit") return "토끼";
  if (species === "ferret") return "페럿";
  if (species === "hamster") return "햄스터";
  if (species === "guinea_pig") return "기니피그";
  if (species === "hedgehog") return "고슴도치";
  if (species === "bird") return "조류";
  if (species === "reptile") return "파충류";
  if (species === "turtle") return "거북이";

  return "기타";
};

const getReceptionPatientAgeText = (patient: Patient) => {
  if (patient.estimatedAgeText) return patient.estimatedAgeText;
  if (!patient.birthDate) return "나이 미상";

  const birthYear = Number(patient.birthDate.slice(0, 4));

  return Number.isNaN(birthYear) ? "나이 미상" : `${2026 - birthYear}세`;
};

export const getReceptionPatientOptionLabel = (summary: ReceptionPatientSummary) =>
  [
    summary.patient.name,
    [getSpeciesLabel(summary.patient.species), summary.patient.breed]
      .filter(Boolean)
      .join("/"),
    getReceptionPatientAgeText(summary.patient),
    summary.primaryGuardian?.name ?? "보호자 미지정",
  ]
    .filter(Boolean)
    .join(" · ");

const getReceptionPatientSearchText = (
  patient: Patient,
  primaryGuardian?: ReceptionPatientSummary["primaryGuardian"],
) =>
  [
    patient.name,
    patient.patientNo,
    patient.breed,
    getSpeciesLabel(patient.species),
    primaryGuardian?.name,
    primaryGuardian?.mobilePhone,
    primaryGuardian?.phone,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

export const mapLookupItemToReceptionPatientSummary = (
  item: ReceptionPatientGuardianLookupItem,
): ReceptionPatientSummary => ({
  patient: item.patient,
  primaryGuardian: item.primaryGuardian,
  searchText:
    item.searchText ??
    getReceptionPatientSearchText(item.patient, item.primaryGuardian),
});

