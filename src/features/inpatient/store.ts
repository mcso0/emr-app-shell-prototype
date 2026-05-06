"use client";

import { create } from "zustand";
import type {
  InpatientFilter,
  InpatientSearchField,
} from "@/features/inpatient/data";

type InpatientStore = {
  filter: InpatientFilter;
  searchField: InpatientSearchField;
  searchQuery: string;
  selectedAdmissionId: string;
  selectAdmission: (selectedAdmissionId: string) => void;
  setFilter: (filter: InpatientFilter) => void;
  setSearchField: (searchField: InpatientSearchField) => void;
  setSearchQuery: (searchQuery: string) => void;
};

export const useInpatientStore = create<InpatientStore>()((set) => ({
  filter: "all",
  searchField: "all",
  searchQuery: "",
  selectedAdmissionId: "adm-kong-icu",
  selectAdmission: (selectedAdmissionId) => set({ selectedAdmissionId }),
  setFilter: (filter) => set({ filter }),
  setSearchField: (searchField) => set({ searchField }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
}));
