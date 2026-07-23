"use client";

import { create } from "zustand";

import {
  cloneHospitalBasicSettingsDraft,
  createInitialHospitalBasicSettingsDraft,
  type HospitalBasicSettingsDraft,
} from "@/features/hospital-admin/settings/hospital-basic-settings-model";
import type {
  HospitalProfile,
  HospitalProfilePendingChangeRequest,
} from "@/features/hospital-admin/settings/hospital-profile-model";

type HospitalBasicSettingsRecord = {
  draft: HospitalBasicSettingsDraft;
  savedDraft: HospitalBasicSettingsDraft;
};

type HospitalBasicSettingsStore = {
  records: Record<string, HospitalBasicSettingsRecord>;
  profiles: Record<
    string,
    {
      status: "idle" | "loading" | "ready" | "denied" | "error";
      profile: HospitalProfile | null;
    }
  >;
  ensureWorkspace: (workspaceId: string) => void;
  setDraft: (workspaceId: string, draft: HospitalBasicSettingsDraft) => void;
  save: (workspaceId: string) => void;
  saveContact: (workspaceId: string) => void;
  saveOperatingHours: (workspaceId: string) => void;
  hydrateOperatingHours: (workspaceId: string, settings: Pick<HospitalBasicSettingsDraft, "timezone" | "weeklyHours" | "holidayPolicy" | "exceptions">) => void;
  hydrateProfile: (workspaceId: string, profile: HospitalProfile) => void;
  setProfileReadStatus: (
    workspaceId: string,
    status: "idle" | "loading" | "ready" | "denied" | "error"
  ) => void;
  setPendingChangeRequest: (
    workspaceId: string,
    request: HospitalProfilePendingChangeRequest
  ) => void;
  setProfileLogoResult: (
    workspaceId: string,
    result: { url: string | null; revision: number }
  ) => void;
  revert: (workspaceId: string) => void;
  revertContact: (workspaceId: string) => void;
  revertOperatingHours: (workspaceId: string) => void;
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
  profiles: {},
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
  saveContact: (workspaceId) =>
    set((state) => {
      const record = state.records[workspaceId] ?? createRecord();
      return {
        records: {
          ...state.records,
          [workspaceId]: {
            draft: cloneHospitalBasicSettingsDraft(record.draft),
            savedDraft: cloneHospitalBasicSettingsDraft({
              ...record.savedDraft,
              contact: { ...record.draft.contact },
            }),
          },
        },
      };
    }),
  saveOperatingHours: (workspaceId) =>
    set((state) => {
      const record = state.records[workspaceId] ?? createRecord();
      return {
        records: {
          ...state.records,
          [workspaceId]: {
            draft: cloneHospitalBasicSettingsDraft(record.draft),
            savedDraft: cloneHospitalBasicSettingsDraft({
              ...record.savedDraft,
              timezone: record.draft.timezone,
              weeklyHours: record.draft.weeklyHours,
              holidayPolicy: record.draft.holidayPolicy,
              exceptions: record.draft.exceptions,
            }),
          },
        },
      };
    }),
  hydrateOperatingHours: (workspaceId, settings) =>
    set((state) => {
      const record = state.records[workspaceId] ?? createRecord();
      const savedDraft = cloneHospitalBasicSettingsDraft({ ...record.savedDraft, ...settings });
      return {
        records: {
          ...state.records,
          [workspaceId]: {
            savedDraft,
            draft: cloneHospitalBasicSettingsDraft({ ...record.draft, ...settings }),
          },
        },
      };
    }),
  hydrateProfile: (workspaceId, profile) =>
    set((state) => {
      const record = state.records[workspaceId] ?? createRecord();
      const contact = {
        phone: profile.contact.phone,
        fax: profile.contact.fax,
        homepage: profile.contact.homepage,
        instagram: profile.contact.instagram,
        customerGuideMemo: profile.contact.customerGuideMemo,
      };
      const nextDraft = cloneHospitalBasicSettingsDraft({
        ...record.draft,
        contact,
      });
      const nextSavedDraft = cloneHospitalBasicSettingsDraft({
        ...record.savedDraft,
        contact,
      });
      return {
        records: {
          ...state.records,
          [workspaceId]: {
            draft: nextDraft,
            savedDraft: nextSavedDraft,
          },
        },
        profiles: {
          ...state.profiles,
          [workspaceId]: {
            status: "ready",
            profile: {
              ...profile,
              contact: { ...profile.contact },
              logo: { ...profile.logo },
              pendingChangeRequest: profile.pendingChangeRequest
                ? {
                    ...profile.pendingChangeRequest,
                    fields: [...profile.pendingChangeRequest.fields],
                  }
                : null,
            },
          },
        },
      };
    }),
  setProfileReadStatus: (workspaceId, status) =>
    set((state) => ({
      profiles: {
        ...state.profiles,
        [workspaceId]: {
          status,
          profile: state.profiles[workspaceId]?.profile ?? null,
        },
      },
    })),
  setPendingChangeRequest: (workspaceId, request) =>
    set((state) => {
      const current = state.profiles[workspaceId];
      if (!current?.profile) return state;
      return {
        profiles: {
          ...state.profiles,
          [workspaceId]: {
            status: "ready",
            profile: {
              ...current.profile,
              pendingChangeRequest: {
                ...request,
                fields: [...request.fields],
              },
            },
          },
        },
      };
    }),
  setProfileLogoResult: (workspaceId, result) =>
    set((state) => {
      const current = state.profiles[workspaceId];
      if (!current?.profile) return state;
      return {
        profiles: {
          ...state.profiles,
          [workspaceId]: {
            status: "ready",
            profile: {
              ...current.profile,
              logo: {
                hasCustomLogo: result.url !== null,
                url: result.url,
              },
              revision: result.revision,
            },
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
  revertContact: (workspaceId) =>
    set((state) => {
      const record = state.records[workspaceId] ?? createRecord();
      return {
        records: {
          ...state.records,
          [workspaceId]: {
            ...record,
            draft: cloneHospitalBasicSettingsDraft({
              ...record.draft,
              contact: { ...record.savedDraft.contact },
            }),
          },
        },
      };
    }),
  revertOperatingHours: (workspaceId) =>
    set((state) => {
      const record = state.records[workspaceId] ?? createRecord();
      return {
        records: {
          ...state.records,
          [workspaceId]: {
            ...record,
            draft: cloneHospitalBasicSettingsDraft({
              ...record.draft,
              timezone: record.savedDraft.timezone,
              weeklyHours: record.savedDraft.weeklyHours,
              holidayPolicy: record.savedDraft.holidayPolicy,
              exceptions: record.savedDraft.exceptions,
            }),
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
