import type { ReactNode } from "react";
import {
  CalendarGnbIcon,
  HomeGnbIcon,
  HospitalGnbIcon,
  HotelGnbIcon,
  MedicalGnbIcon,
  PayGnbIcon,
  PetGnbIcon,
  PharmacyGnbIcon,
  PillGnbIcon,
  RadiographyGnbIcon,
} from "@/components/gnb-icons";
import {
  CdsGnbCalendarGnbIcon,
  CdsGnbHomeGnbIcon,
  CdsGnbHospitalGnbIcon,
  CdsGnbHotelGnbIcon,
  CdsGnbMedicalGnbIcon,
  CdsGnbPayGnbIcon,
  CdsGnbPetGnbIcon,
  CdsGnbPillGnbIcon,
  CdsGnbRadiographyGnbIcon,
} from "@/components/cds-icons/gnb";

export type GnbIcon = (props: { className?: string }) => ReactNode;

export const moduleIconById: Record<string, { icon: GnbIcon; iconClassName: string }> = {
  home: { icon: HomeGnbIcon, iconClassName: "h-[16.1px] w-[17.6px]" },
  reception: { icon: CalendarGnbIcon, iconClassName: "h-[17.4px] w-[18px]" },
  treatment: { icon: MedicalGnbIcon, iconClassName: "h-[16.8px] w-[18.4px]" },
  lab: { icon: PharmacyGnbIcon, iconClassName: "h-[16.5px] w-[11.8px] rotate-45" },
  imaging: { icon: RadiographyGnbIcon, iconClassName: "size-[17.6px]" },
  dispensing: { icon: PillGnbIcon, iconClassName: "h-[17.4px] w-[16.7px]" },
  billing: { icon: PayGnbIcon, iconClassName: "size-[18.4px]" },
  inpatient: { icon: HotelGnbIcon, iconClassName: "h-[13.7px] w-[17.6px]" },
  customer: { icon: PetGnbIcon, iconClassName: "h-[17.4px] w-[18.4px]" },
  orders: { icon: HospitalGnbIcon, iconClassName: "size-[18px]" },
};

export const workspaceTabIconById: Record<string, { icon: GnbIcon; iconClassName: string }> = {
  home: { icon: CdsGnbHomeGnbIcon, iconClassName: "size-4" },
  reception: { icon: CdsGnbCalendarGnbIcon, iconClassName: "size-4" },
  treatment: { icon: CdsGnbMedicalGnbIcon, iconClassName: "size-4" },
  lab: { icon: PharmacyGnbIcon, iconClassName: "rotate-45" },
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
