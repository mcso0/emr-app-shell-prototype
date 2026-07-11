"use client";

import { create } from "zustand";

import {
  cloneHospitalBasicSettingsDraft,
  createInitialHospitalBasicSettingsDraft,
  type HospitalBasicSettingsDraft,
} from "@/features/hospital-admin/settings/hospital-basic-settings-model";

type HospitalBasicSettingsRecord = {
  draft: HospitalBasicSettingsDraft;
  savedDraft: HospitalBasicSettingsDraft;
};

type HospitalBasicSettingsStore = {
  records: Record<string, HospitalBasicSettingsRecord>;
  ensureWorkspace: (workspaceId: string) => void;
  setDraft: (workspaceId: string, draft: HospitalBasicSettingsDraft) => void;
  save: (workspaceId: string) => void;
  revert: (workspaceId: string) => void;
  discardAllDrafts: () => void;
};

const createRecord = (): HospitalBasicSettingsRecord => {
  const initialDraft = createInitialHospitalBasicSettingsDraft();
  return {
    draft: initialDraft,
    savedDraft: cloneHospitalBasicSettingsDraft(initialDraft),
  };
};

export const useHospitalBasicSettingsStore = create<HospitalBasicSettingsStore>()((set) => ({
  records: {},
  ensureWorkspace: (workspaceId) =>
    set((state) =>
      state.records[workspaceId]
        ? state
        : { records: { ...state.records, [workspaceId]: createRecord() } }
    ),
  setDraft: (workspaceId, draft) =>
    set((state) => {
      const record = state.records[workspaceId] ?? createRecord();
      return {
        records: {
          ...state.records,
          [workspaceId]: { ...record, draft: cloneHospitalBasicSettingsDraft(draft) },
        },
      };
    }),
  save: (workspaceId) =>
    set((state) => {
      const record = state.records[workspaceId] ?? createRecord();
      return {
        records: {
          ...state.records,
          [workspaceId]: {
            draft: cloneHospitalBasicSettingsDraft(record.draft),
            savedDraft: cloneHospitalBasicSettingsDraft(record.draft),
          },
        },
      };
    }),
  revert: (workspaceId) =>
    set((state) => {
      const record = state.records[workspaceId] ?? createRecord();
      return {
        records: {
          ...state.records,
          [workspaceId]: {
            ...record,
            draft: cloneHospitalBasicSettingsDraft(record.savedDraft),
          },
        },
      };
    }),
  discardAllDrafts: () =>
    set((state) => ({
      records: Object.fromEntries(
        Object.entries(state.records).map(([workspaceId, record]) => [
          workspaceId,
          { ...record, draft: cloneHospitalBasicSettingsDraft(record.savedDraft) },
        ])
      ),
    })),
}));
