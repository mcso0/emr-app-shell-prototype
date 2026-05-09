"use client";

import { create } from "zustand";

export type CustomerListMode = "patient" | "guardian" | "deleted";

type CustomerStore = {
  listMode: CustomerListMode;
  query: string;
  setListMode: (listMode: CustomerListMode) => void;
  setQuery: (query: string) => void;
};

export const useCustomerStore = create<CustomerStore>()((set) => ({
  listMode: "patient",
  query: "",
  setListMode: (listMode) => set({ listMode }),
  setQuery: (query) => set({ query }),
}));
