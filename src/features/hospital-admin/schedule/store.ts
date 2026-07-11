"use client";

import { create } from "zustand";
import { hospitalScheduleSeed } from "./fixtures";
import { applyApprovedRequest, cloneScheduleSeed } from "./model";
import type {
  HospitalScheduleDataState,
  HospitalScheduleRequest,
  HospitalScheduleRole,
  HospitalScheduleSeed,
  HospitalScheduleSettings,
  HospitalScheduleShift,
  HospitalScheduleShiftKind,
  HospitalScheduleSurface,
  HospitalScheduleViewMode,
} from "./types";

export type HospitalScheduleRoleFilter = "all" | HospitalScheduleRole;

export type HospitalScheduleShiftDraft = Omit<HospitalScheduleShift, "id"> & {
  id?: string;
};

type HospitalScheduleStore = HospitalScheduleSeed & {
  activeDate: string;
  dataState: HospitalScheduleDataState;
  personalStaffId: string;
  roleFilter: HospitalScheduleRoleFilter;
  surface: HospitalScheduleSurface;
  viewMode: HospitalScheduleViewMode;
  approveRequest: (requestId: string) => void;
  createShift: (draft: HospitalScheduleShiftDraft) => HospitalScheduleShift;
  declineRequest: (requestId: string) => void;
  deleteShift: (shiftId: string) => void;
  duplicateShift: (shiftId: string) => HospitalScheduleShift | null;
  publish: () => void;
  reset: () => void;
  setActiveDate: (date: string) => void;
  setDataState: (state: HospitalScheduleDataState) => void;
  setPersonalStaffId: (staffId: string) => void;
  setRoleFilter: (role: HospitalScheduleRoleFilter) => void;
  setSettings: (settings: Partial<HospitalScheduleSettings>) => void;
  setSurface: (surface: HospitalScheduleSurface) => void;
  setViewMode: (viewMode: HospitalScheduleViewMode) => void;
  submitRequest: (request: Omit<HospitalScheduleRequest, "id" | "status">) => void;
  toggleShiftLeave: (shiftId: string) => void;
  updateShift: (shiftId: string, draft: Partial<HospitalScheduleShiftDraft>) => void;
};

const createInitialSchedule = () => cloneScheduleSeed(hospitalScheduleSeed);
const getNextId = (prefix: string) => `${prefix}-${Date.now().toString(36)}`;
const toNextDate = (date: string) => {
  const current = new Date(`${date}T00:00:00.000Z`);
  current.setUTCDate(current.getUTCDate() + 1);
  return current.toISOString().slice(0, 10);
};

const markChanged = (state: HospitalScheduleStore, shiftIds: string[]) => ({
  publication: {
    ...state.publication,
    state: "changed" as const,
    changedShiftIds: Array.from(new Set([...state.publication.changedShiftIds, ...shiftIds])),
  },
});

export const useHospitalScheduleStore = create<HospitalScheduleStore>()((set, get) => ({
  ...createInitialSchedule(),
  activeDate: hospitalScheduleSeed.weekStart,
  dataState: "ready",
  personalStaffId: "staff-suji",
  roleFilter: "all",
  surface: "admin",
  viewMode: "week",
  approveRequest: (requestId) =>
    set((state) => {
      const request = state.requests.find((candidate) => candidate.id === requestId);
      if (!request) return state;

      return applyApprovedRequest(state, request);
    }),
  createShift: (draft) => {
    const shift: HospitalScheduleShift = { ...draft, id: draft.id ?? getNextId("schedule-shift") };

    set((state) => ({
      shifts: [...state.shifts, shift],
      ...markChanged(state, [shift.id]),
    }));

    return shift;
  },
  declineRequest: (requestId) =>
    set((state) => ({
      requests: state.requests.map((request) =>
        request.id === requestId && request.status === "pending"
          ? { ...request, status: "declined" }
          : request,
      ),
    })),
  deleteShift: (shiftId) =>
    set((state) => ({
      shifts: state.shifts.filter((shift) => shift.id !== shiftId),
      ...markChanged(state, [shiftId]),
    })),
  duplicateShift: (shiftId) => {
    const source = get().shifts.find((shift) => shift.id === shiftId);
    if (!source) return null;

    return get().createShift({
      ...source,
      id: getNextId("schedule-shift-copy"),
      date: toNextDate(source.date),
      note: source.note ? `${source.note} · 복제` : "복제된 근무",
    });
  },
  publish: () =>
    set({
      publication: {
        state: "published",
        publishedAtLabel: "방금 게시함",
        changedShiftIds: [],
      },
    }),
  reset: () =>
    set({
      ...createInitialSchedule(),
      activeDate: hospitalScheduleSeed.weekStart,
      dataState: "ready",
      personalStaffId: "staff-suji",
      roleFilter: "all",
      surface: "admin",
      viewMode: "week",
    }),
  setActiveDate: (activeDate) => set({ activeDate }),
  setDataState: (dataState) => set({ dataState }),
  setPersonalStaffId: (personalStaffId) => set({ personalStaffId }),
  setRoleFilter: (roleFilter) => set({ roleFilter }),
  setSettings: (settings) => set((state) => ({ settings: { ...state.settings, ...settings } })),
  setSurface: (surface) => set({ surface }),
  setViewMode: (viewMode) => set({ viewMode }),
  submitRequest: (request) =>
    set((state) => ({
      requests: [
        ...state.requests,
        {
          ...request,
          id: getNextId("schedule-request"),
          status: "pending",
        },
      ],
    })),
  toggleShiftLeave: (shiftId) =>
    set((state) => {
      const target = state.shifts.find((shift) => shift.id === shiftId);
      if (!target) return state;

      const leaving = target.kind !== "leave";

      return {
        shifts: state.shifts.map((shift) =>
          shift.id === shiftId
            ? {
                ...shift,
                kind: leaving ? "leave" : "clinical",
                workLabel: leaving ? "휴무" : "진료",
                locationLabel: leaving ? null : "진료실 A",
              }
            : shift,
        ),
        ...markChanged(state, [shiftId]),
      };
    }),
  updateShift: (shiftId, draft) =>
    set((state) => ({
      shifts: state.shifts.map((shift) =>
        shift.id === shiftId ? { ...shift, ...draft, id: shiftId } : shift,
      ),
      ...markChanged(state, [shiftId]),
    })),
}));

export const hospitalScheduleShiftKinds: Array<{
  label: string;
  value: HospitalScheduleShiftKind;
}> = [
  { value: "clinical", label: "진료" },
  { value: "support", label: "검사" },
  { value: "reception", label: "접수" },
  { value: "leave", label: "휴무" },
];
