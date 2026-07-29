"use client";

import { create } from "zustand";

export type CustomerListMode = "patient" | "guardian" | "deleted";
export type CustomerProfileReadStatus =
  "idle" | "loading" | "ready" | "denied" | "error";

type CustomerProfileReadState = {
  status: CustomerProfileReadStatus;
  workspaceId: string | null;
};

type CustomerStore = {
  archiveCount: number;
  archiveCountLoading: boolean;
  profileReadState: CustomerProfileReadState;
  listMode: CustomerListMode;
  query: string;
  setArchiveCount: (count: number) => void;
  setArchiveCountLoading: (loading: boolean) => void;
  setListMode: (listMode: CustomerListMode) => void;
  setProfileReadState: (state: CustomerProfileReadState) => void;
  setQuery: (query: string) => void;
};

export const useCustomerStore = create<CustomerStore>()((set) => ({
  archiveCount: 0,
  archiveCountLoading: false,
  profileReadState: { status: "idle", workspaceId: null },
  listMode: "patient",
  query: "",
  setArchiveCount: (archiveCount) => set({ archiveCount }),
  setArchiveCountLoading: (archiveCountLoading) => set({ archiveCountLoading }),
  setListMode: (listMode) => set({ listMode }),
  setProfileReadState: (profileReadState) => set({ profileReadState }),
  setQuery: (query) => set({ query }),
}));
