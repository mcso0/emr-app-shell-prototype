"use client";

import { create } from "zustand";
import { hospitalScheduleSeed } from "./fixtures";
import { applyApprovedRequest, cloneScheduleSeed } from "./model";
import type {
  HospitalScheduleDataState,
  HospitalSchedulePublication,
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

export type HospitalSchedulePersistenceAction =
  | { type: "request"; request: Omit<HospitalScheduleRequest, "id" | "status"> }
  | { type: "review_request"; requestId: string; decision: "approved" | "declined" }
  | { type: "save_shift"; shift: HospitalScheduleShift }
  | { type: "delete_shift"; shiftId: string }
  | { type: "publish_week"; weekStart: string };

export type HospitalSchedulePersistenceAdapter = {
  onError: (error: unknown) => void;
  persist: (action: HospitalSchedulePersistenceAction) => Promise<void>;
};

export type HospitalScheduleRemoteState = Pick<
  HospitalScheduleSeed,
  "requests" | "shifts" | "staff"
> & {
  publication: HospitalSchedulePublication;
  weekStart: string;
};

let persistenceAdapter: HospitalSchedulePersistenceAdapter | null = null;

export function setHospitalSchedulePersistenceAdapter(
  adapter: HospitalSchedulePersistenceAdapter | null,
) {
  persistenceAdapter = adapter;
}

function persistScheduleAction(action: HospitalSchedulePersistenceAction) {
  if (!persistenceAdapter) return;
  void persistenceAdapter.persist(action).catch(persistenceAdapter.onError);
}

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
  hydrateRemoteSchedule: (remote: HospitalScheduleRemoteState) => void;
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
const getNextId = (prefix: string) =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${prefix}-${Date.now().toString(36)}`;
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

      persistScheduleAction({ type: "review_request", requestId, decision: "approved" });
      return applyApprovedRequest(state, request);
    }),
  createShift: (draft) => {
    const shift: HospitalScheduleShift = { ...draft, id: draft.id ?? getNextId("schedule-shift") };

    set((state) => ({
      shifts: [...state.shifts, shift],
      ...markChanged(state, [shift.id]),
    }));

    persistScheduleAction({ type: "save_shift", shift });

    return shift;
  },
  declineRequest: (requestId) =>
    set((state) => {
      persistScheduleAction({ type: "review_request", requestId, decision: "declined" });
      return {
        requests: state.requests.map((request) =>
          request.id === requestId && request.status === "pending"
            ? { ...request, status: "declined" }
            : request,
        ),
      };
    }),
  deleteShift: (shiftId) =>
    set((state) => {
      persistScheduleAction({ type: "delete_shift", shiftId });
      return {
        shifts: state.shifts.filter((shift) => shift.id !== shiftId),
        ...markChanged(state, [shiftId]),
      };
    }),
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
  publish: () => {
    persistScheduleAction({ type: "publish_week", weekStart: get().weekStart });
    set({
      publication: {
        state: "published",
        publishedAtLabel: "방금 게시함",
        changedShiftIds: [],
      },
    });
  },
  hydrateRemoteSchedule: (remote) =>
    set((state) => ({
      ...remote,
      dataState: "ready",
      activeDate: remote.shifts.some((shift) => shift.date === state.activeDate)
        ? state.activeDate
        : remote.weekStart,
    })),
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
    set((state) => {
      persistScheduleAction({ type: "request", request });
      return {
        requests: [
          ...state.requests,
          {
            ...request,
            id: getNextId("schedule-request"),
            status: "pending",
          },
        ],
      };
    }),
  toggleShiftLeave: (shiftId) =>
    set((state) => {
      const target = state.shifts.find((shift) => shift.id === shiftId);
      if (!target) return state;

      const leaving = target.kind !== "leave";

      const shifts: HospitalScheduleShift[] = state.shifts.map((shift) =>
          shift.id === shiftId
            ? {
                ...shift,
                kind: leaving ? ("leave" as const) : ("clinical" as const),
                workLabel: leaving ? "휴무" : "진료",
                locationLabel: leaving ? null : "진료실 A",
            }
            : shift,
        );
      const updatedShift = shifts.find((shift) => shift.id === shiftId);
      if (updatedShift) persistScheduleAction({ type: "save_shift", shift: updatedShift });
      return {
        shifts,
        ...markChanged(state, [shiftId]),
      };
    }),
  updateShift: (shiftId, draft) =>
    set((state) => {
      const shifts: HospitalScheduleShift[] = state.shifts.map((shift) =>
        shift.id === shiftId ? { ...shift, ...draft, id: shiftId } : shift,
      );
      const updatedShift = shifts.find((shift) => shift.id === shiftId);
      if (updatedShift) persistScheduleAction({ type: "save_shift", shift: updatedShift });
      return { shifts, ...markChanged(state, [shiftId]) };
    }),
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
