import type { Order } from "@/types/emr";

export const patient = {
  id: "P-260414-0008",
  name: "코코",
  age: "8세",
  sex: "중성화·암컷",
  guardian: "이지은",
  weight: "5.96 kg",
  temperature: "39.3°C",
  respiration: "20 rmp",
};

export const orderRows: Order[] = [
  {
    id: "o-10023",
    category: "투약",
    name: "[CBC] CBC 검사 세트",
    route: "PO",
    dose: "Atorvastatin 20mg",
    frequency: "T 9:00 AM",
    status: "검토",
    requestedAt: "2026.04.14 10:30",
    doctor: "이수지",
  },
  {
    id: "o-10024",
    category: "처치",
    name: "수액 처치",
    route: "IV",
    dose: "Normal saline 120ml",
    frequency: "qd",
    status: "대기",
    requestedAt: "2026.04.14 10:35",
    doctor: "이수지",
  },
  {
    id: "o-10025",
    category: "조제",
    name: "소염진통제 조제",
    route: "PO",
    dose: "Meloxicam 0.5mg",
    frequency: "bid",
    status: "조제중",
    requestedAt: "2026.04.14 10:42",
    doctor: "이수지",
  },
  {
    id: "o-10026",
    category: "검사",
    name: "혈청화학 검사",
    route: "LAB",
    dose: "Sample 1ea",
    frequency: "once",
    status: "완료",
    requestedAt: "2026.04.14 10:48",
    doctor: "김도윤",
  },
];

export const historyGroups = [
  {
    date: "26.04.11",
    count: 2,
    items: ["[CBC] CBC 검사 세트", "경구/기타 Atorvastatin 20(mg) T 9:00 AM"],
  },
  {
    date: "26.03.12",
    count: 2,
    items: ["[CBC] CBC 검사 세트", "경구/기타 Atorvastatin 20(mg) T 9:00 AM"],
  },
  {
    date: "26.03.10",
    count: 1,
    items: ["예방 접종 및 기본 처치"],
  },
];
