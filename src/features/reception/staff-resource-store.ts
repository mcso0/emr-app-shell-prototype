"use client";

import { create } from "zustand";

export type ReceptionStaffOperationalStatus = {
  code:
    | "available"
    | "clocked_out"
    | "in_consultation"
    | "leave"
    | "off"
    | "scheduled"
    | "shift_ended";
  label: string;
  source: "reception" | "schedule" | "time_clock";
};

export type ReceptionStaffVeterinarian = {
  avatarUrl?: string;
  department?: string;
  id: string;
  initial?: string;
  name: string;
  operationalStatus?: ReceptionStaffOperationalStatus;
  role: "veterinarian";
  title?: string;
};

export type ReceptionStaffMember = {
  avatarUrl?: string;
  department?: string;
  id: string;
  initial?: string;
  name: string;
  operationalStatus?: ReceptionStaffOperationalStatus;
  roles: string[];
  title?: string;
};

export type ReceptionStaffReadStatus = "idle" | "loading" | "ready" | "error";

type ReceptionStaffResource = {
  actorUserId?: string;
  staff: ReceptionStaffMember[];
  status: ReceptionStaffReadStatus;
  updatedAt?: number;
  veterinarians: ReceptionStaffVeterinarian[];
};

type ReceptionStaffResourceStore = {
  resourcesByKey: Record<string, ReceptionStaffResource>;
  setResourceLoading: (key: string) => void;
  setResourceResult: (
    key: string,
    result: {
      actorUserId?: string;
      status: Extract<ReceptionStaffReadStatus, "ready" | "error">;
      staff: ReceptionStaffMember[];
      veterinarians: ReceptionStaffVeterinarian[];
    },
  ) => void;
};

export const emptyReceptionStaffVeterinarians: ReceptionStaffVeterinarian[] = [];
export const emptyReceptionStaffMembers: ReceptionStaffMember[] = [];

export function getReceptionStaffResourceKey({
  operatingDate,
  workspaceId,
}: {
  operatingDate: string;
  workspaceId: string;
}) {
  return `${workspaceId}\u0000${operatingDate}`;
}

export const useReceptionStaffResourceStore = create<ReceptionStaffResourceStore>()(
  (set) => ({
    resourcesByKey: {},
    setResourceLoading: (key) =>
      set((state) => ({
        resourcesByKey: {
          ...state.resourcesByKey,
          [key]: {
            actorUserId: state.resourcesByKey[key]?.actorUserId,
            staff: state.resourcesByKey[key]?.staff ?? emptyReceptionStaffMembers,
            status: "loading",
            updatedAt: state.resourcesByKey[key]?.updatedAt,
            veterinarians:
              state.resourcesByKey[key]?.veterinarians ??
              emptyReceptionStaffVeterinarians,
          },
        },
      })),
    setResourceResult: (key, result) =>
      set((state) => ({
        resourcesByKey: {
          ...state.resourcesByKey,
          [key]: {
            ...result,
            updatedAt: result.status === "ready" ? Date.now() : undefined,
          },
        },
      })),
  }),
);
