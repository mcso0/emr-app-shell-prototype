"use client";

import { create } from "zustand";
import type { EmrId } from "@/types/emr-domain";

type LabImagingStore = {
  selectedImagingStudyId: EmrId;
  selectedLabResultId: EmrId;
  selectImagingStudy: (selectedImagingStudyId: EmrId) => void;
  selectLabResult: (selectedLabResultId: EmrId) => void;
};

export const useLabImagingStore = create<LabImagingStore>()((set) => ({
  selectedImagingStudyId: "imaging-coco-thorax",
  selectedLabResultId: "lab-result-coco-cbc",
  selectImagingStudy: (selectedImagingStudyId) => set({ selectedImagingStudyId }),
  selectLabResult: (selectedLabResultId) => set({ selectedLabResultId }),
}));
