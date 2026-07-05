"use client";

import { create } from "zustand";

export type CustomerListMode = "patient" | "guardian" | "deleted";
export type CustomerProfileReadStatus = "idle" | "loading" | "ready" | "error";

type CustomerProfileReadState = {
  status: CustomerProfileReadStatus;
  workspaceId: string | null;
};

type CustomerStore = {
  profileReadState: CustomerProfileReadState;
  listMode: CustomerListMode;
  query: string;
  setListMode: (listMode: CustomerListMode) => void;
  setProfileReadState: (state: CustomerProfileReadState) => void;
  setQuery: (query: string) => void;
};

export const useCustomerStore = create<CustomerStore>()((set) => ({
  profileReadState: { status: "idle", workspaceId: null },
  listMode: "patient",
  query: "",
  setListMode: (listMode) => set({ listMode }),
  setProfileReadState: (profileReadState) => set({ profileReadState }),
  setQuery: (query) => set({ query }),
}));
