import type { ReactNode } from "react";
import {
  CdsGnbCalendarGnbIcon,
  CdsGnbHomeGnbIcon,
  CdsGnbHospitalGnbIcon,
  CdsGnbHotelGnbIcon,
  CdsGnbMedicalGnbIcon,
  CdsGnbPayGnbIcon,
  CdsGnbPetGnbIcon,
  CdsGnbPharmacyGnbIcon,
  CdsGnbPillGnbIcon,
  CdsGnbRadiographyGnbIcon,
} from "@/components/cds-icons/gnb";

export type GnbIcon = (props: { className?: string }) => ReactNode;

export const moduleIconById: Record<string, { icon: GnbIcon; iconClassName: string }> = {
  home: { icon: CdsGnbHomeGnbIcon, iconClassName: "size-4" },
  reception: { icon: CdsGnbCalendarGnbIcon, iconClassName: "size-4" },
  treatment: { icon: CdsGnbMedicalGnbIcon, iconClassName: "size-4" },
  lab: { icon: CdsGnbPharmacyGnbIcon, iconClassName: "size-4 rotate-45" },
  imaging: { icon: CdsGnbRadiographyGnbIcon, iconClassName: "size-4" },
  dispensing: { icon: CdsGnbPillGnbIcon, iconClassName: "size-4" },
  billing: { icon: CdsGnbPayGnbIcon, iconClassName: "size-4" },
  inpatient: { icon: CdsGnbHotelGnbIcon, iconClassName: "size-4" },
  customer: { icon: CdsGnbPetGnbIcon, iconClassName: "size-4" },
  orders: { icon: CdsGnbHospitalGnbIcon, iconClassName: "size-4" },
};

export const moduleNavLabelById: Partial<Record<string, string>> = {
  home: "원내 현황",
  treatment: "진료/차트",
  lab: "임상병리검사",
  imaging: "영상검사",
  dispensing: "조제/처치",
  inpatient: "입원",
  customer: "고객관리",
  orders: "병원관리",
};
