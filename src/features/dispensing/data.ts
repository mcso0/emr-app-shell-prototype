import type { Order, OrderGroupWorkStatus, TechnicianUser } from "@/types/emr";

export const patient = {
  id: "P-260414-0008",
  name: "코코",
  age: "8세",
  sex: "중성화·암컷",
  guardian: "이지은",
  breed: "코리안숏헤어",
  weight: "5.96 kg",
  temperature: "39.3°C",
  respiration: "20 rmp",
  bloodPressure: "170 bpm",
};

export const currentTechnician: TechnicianUser = {
  id: "tech-sh",
  name: "송하윤",
  initial: "SH",
  role: "technician",
};

export const technicianUsers: TechnicianUser[] = [
  currentTechnician,
  {
    id: "tech-km",
    name: "김미래",
    initial: "김",
    role: "technician",
  },
  {
    id: "tech-jh",
    name: "박준호",
    initial: "박",
    role: "technician",
  },
  {
    id: "tech-de",
    name: "이다은",
    initial: "이",
    role: "technician",
  },
];

const unassignedOrder = {
  assignee: "미지정",
  assigneeInitial: "미",
};

export const orderRows: Order[] = [
  {
    id: "o-10023",
    category: "투약",
    name: "Amoxicillin 500(mg) C head 1mg",
    route: "PO",
    dose: "Atorvastatin 20mg",
    frequency: "T 9:00 AM",
    status: "재요청",
    requestedAt: "2026.04.14 10:30",
    doctor: "이수지",
    days: "888",
    doseTiming: "sid",
    servings: "88",
    amount: "8888.8",
    unit: "mmlg",
    quantity: "88.8",
    dosageForm: "T",
    storage: "실온보관",
    medicationGuide: "식전무관",
    ...unassignedOrder,
    workStatus: "대기",
    warningMessage: "용량이 0.4 T에서 0.5 T로 변경되었습니다 (+0.1 T)",
    diffs: {
      days: { previous: "888", current: "888" },
      doseTiming: { previous: "bid", current: "sid" },
      servings: { previous: "888", current: "888" },
      amount: { previous: "8888.8", current: "8888.8" },
      quantity: { previous: "88.8", current: "88.8" },
    },
  },
  {
    id: "o-10024",
    category: "처치",
    name: "Amoxicillin 500(mg) C head 1mg",
    route: "IV",
    dose: "Normal saline 120ml",
    frequency: "qd",
    status: "요청",
    requestedAt: "2026.04.14 10:35",
    doctor: "이수지",
    days: "888",
    doseTiming: "sid",
    servings: "88",
    amount: "8888.8",
    unit: "mmlg",
    quantity: "88.8",
    dosageForm: "T",
    storage: "실온보관",
    medicationGuide: "식전무관",
    ...unassignedOrder,
    workStatus: "대기",
  },
  {
    id: "o-10025",
    category: "조제",
    name: "Amoxicillin 500(mg) C head 1mg",
    route: "PO",
    dose: "Meloxicam 0.5mg",
    frequency: "bid",
    status: "요청",
    requestedAt: "2026.04.14 10:42",
    doctor: "이수지",
    days: "888",
    doseTiming: "sid",
    servings: "88",
    amount: "8888.8",
    unit: "mmlg",
    quantity: "88.8",
    dosageForm: "T",
    storage: "실온보관",
    medicationGuide: "식전무관",
    ...unassignedOrder,
    workStatus: "대기",
  },
  {
    id: "o-10026",
    category: "검사",
    name: "Amoxicillin 500(mg) C head 1mg",
    route: "LAB",
    dose: "Sample 1ea",
    frequency: "once",
    status: "요청",
    requestedAt: "2026.04.14 10:48",
    doctor: "김도윤",
    days: "888",
    doseTiming: "sid",
    servings: "88",
    amount: "8888.8",
    unit: "mmlg",
    quantity: "88.8",
    dosageForm: "T",
    storage: "실온보관",
    medicationGuide: "식전무관",
    ...unassignedOrder,
    workStatus: "대기",
  },
  {
    id: "o-10027",
    category: "조제",
    name: "Amoxicillin 500(mg) C head 1mg",
    route: "PO",
    dose: "Amoxicillin 500mg",
    frequency: "sid",
    status: "완료",
    requestedAt: "2026.04.14 10:52",
    doctor: "김도윤",
    days: "888",
    doseTiming: "sid",
    servings: "88",
    amount: "8888.8",
    unit: "mmlg",
    quantity: "88.8",
    dosageForm: "T",
    storage: "실온보관",
    medicationGuide: "식전무관",
    assigneeId: "tech-km",
    assignee: "김미래",
    assigneeInitial: "김",
    workStatus: "완료",
  },
  {
    id: "o-10028",
    category: "조제",
    name: "Amoxicillin 500(mg) C head 1mg",
    route: "PO",
    dose: "Amoxicillin 500mg",
    frequency: "sid",
    status: "취소",
    requestedAt: "2026.04.14 10:55",
    doctor: "김도윤",
    days: "888",
    doseTiming: "sid",
    servings: "88",
    amount: "8888.8",
    unit: "mmlg",
    quantity: "88.8",
    dosageForm: "T",
    storage: "실온보관",
    medicationGuide: "식전무관",
    assigneeId: "tech-km",
    assignee: "김미래",
    assigneeInitial: "김",
    workStatus: "완료",
  },
];

export type OrderTableGroup = {
  id: string;
  label: string;
  title: string;
  workStatus: OrderGroupWorkStatus;
  assigneeIds: string[];
  rows: Order[];
};

const cloneRowsForGroup = (groupId: string, category: string) =>
  orderRows.map((row) => ({
    ...row,
    id: `${groupId}-${row.id}`,
    category,
  }));

export const orderTableGroups: OrderTableGroup[] = [
  {
    id: "oral",
    label: "경구제 오더 그룹",
    title: "항생제 세트 A",
    workStatus: "요청",
    assigneeIds: [],
    rows: orderRows,
  },
  {
    id: "other",
    label: "기타 오더 그룹",
    title: "항생제 세트 A",
    workStatus: "요청",
    assigneeIds: [],
    rows: cloneRowsForGroup("other", "처치"),
  },
];

export const allOrderRows = orderTableGroups.flatMap((group) => group.rows);

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
