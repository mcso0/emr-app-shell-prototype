import {
  getMockEncounterBundle,
  mockAttachments,
  mockEncounters,
  mockEquipmentReceipts,
  mockGuardians,
  mockImagingStudies,
  mockLabResults,
  mockOrders,
  mockPatients,
  mockStaffUsers,
} from "@/mocks/emr-domain";
import type {
  EmrAttachment,
  EmrId,
  EmrOrder,
  Encounter,
  EquipmentReceipt,
  Guardian,
  ImagingStudy,
  LabResult,
  Patient,
} from "@/types/emr-domain";

export type LabWorkItem = {
  encounter: Encounter;
  order?: EmrOrder;
  patient: Patient;
  primaryGuardian?: Guardian;
  result: LabResult;
  technicianName?: string;
};

export type ImagingWorkItem = {
  encounter: Encounter;
  order?: EmrOrder;
  patient: Patient;
  primaryGuardian?: Guardian;
  radiologistName?: string;
  study: ImagingStudy;
};

export type LabDetail = LabWorkItem & {
  allEquipmentReceipts: EquipmentReceipt[];
  attachments: EmrAttachment[];
  equipmentReceipts: EquipmentReceipt[];
};

export type ImagingDetail = ImagingWorkItem & {
  attachments: EmrAttachment[];
};

export const getStaffName = (userId?: EmrId) =>
  userId ? mockStaffUsers.find((user) => user.id === userId)?.name : undefined;

const getPatient = (patientId: EmrId) => mockPatients.find((patient) => patient.id === patientId);
const getEncounter = (encounterId: EmrId) =>
  mockEncounters.find((encounter) => encounter.id === encounterId);
const getOrder = (orderId?: EmrId) => orderId ? mockOrders.find((order) => order.id === orderId) : undefined;

const getPrimaryGuardian = (encounter: Encounter) =>
  encounter.guardianId
    ? mockGuardians.find((guardian) => guardian.id === encounter.guardianId)
    : getMockEncounterBundle(encounter.id)?.primaryGuardian;

const getAttachmentsForOwner = (ownerId: EmrId) =>
  mockAttachments.filter((attachment) => attachment.ownerId === ownerId);

export const getLabWorkItems = (): LabWorkItem[] =>
  mockLabResults
    .reduce<LabWorkItem[]>((items, result) => {
      const encounter = getEncounter(result.encounterId);
      const patient = getPatient(result.patientId);

      if (!encounter || !patient) return items;

      items.push({
        encounter,
        order: getOrder(result.orderId),
        patient,
        primaryGuardian: getPrimaryGuardian(encounter),
        result,
        technicianName: getStaffName(result.performedByUserId),
      });

      return items;
    }, [])
    .sort((a, b) => {
      const aTime = a.result.receivedAt ?? a.result.collectedAt ?? "";
      const bTime = b.result.receivedAt ?? b.result.collectedAt ?? "";

      return bTime.localeCompare(aTime);
    });

export const getLabDetail = (labResultId: EmrId): LabDetail | null => {
  const item = getLabWorkItems().find(({ result }) => result.id === labResultId);

  if (!item) return null;

  return {
    ...item,
    allEquipmentReceipts: mockEquipmentReceipts,
    attachments: getAttachmentsForOwner(item.result.id),
    equipmentReceipts: mockEquipmentReceipts.filter(
      (receipt) => receipt.encounterId === item.encounter.id || receipt.status === "unmatched"
    ),
  };
};

export const getImagingWorkItems = (): ImagingWorkItem[] =>
  mockImagingStudies
    .reduce<ImagingWorkItem[]>((items, study) => {
      const encounter = getEncounter(study.encounterId);
      const patient = getPatient(study.patientId);

      if (!encounter || !patient) return items;

      items.push({
        encounter,
        order: getOrder(study.orderId),
        patient,
        primaryGuardian: getPrimaryGuardian(encounter),
        radiologistName: getStaffName(study.radiologistUserId),
        study,
      });

      return items;
    }, [])
    .sort((a, b) => {
      const aTime = a.study.capturedAt ?? a.study.requestedAt;
      const bTime = b.study.capturedAt ?? b.study.requestedAt;

      return bTime.localeCompare(aTime);
    });

export const getImagingDetail = (imagingStudyId: EmrId): ImagingDetail | null => {
  const item = getImagingWorkItems().find(({ study }) => study.id === imagingStudyId);

  if (!item) return null;

  return {
    ...item,
    attachments: getAttachmentsForOwner(item.study.id),
  };
};
