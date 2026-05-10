import type { OrderQueueItem, OrderQueueStatusDefinition } from "@/types/emr";

export const defaultOrderQueueStatuses: OrderQueueStatusDefinition[] = [
  {
    id: "reRequested",
    label: "재요청",
    colorToken: "--clair-color-atomic-orange-400",
    sortOrder: 10,
  },
  {
    id: "inProgress",
    label: "진행중",
    colorToken: "--clair-color-atomic-blue-400",
    sortOrder: 20,
  },
  {
    id: "waiting",
    label: "대기중",
    colorToken: "--clair-color-atomic-gray-400",
    sortOrder: 30,
  },
  {
    id: "completed",
    label: "완료",
    colorToken: "--clair-color-atomic-green-400",
    sortOrder: 40,
  },
  {
    id: "canceled",
    label: "취소",
    colorToken: "--clair-color-atomic-red-400",
    sortOrder: 50,
  },
];

const partialCompletedStatus: OrderQueueStatusDefinition = {
  id: "partiallyCompleted",
  label: "부분완료",
  colorToken: "--clair-color-atomic-mint-400",
  sortOrder: 60,
};

export const moduleOrderQueueStatuses: Record<string, OrderQueueStatusDefinition[]> = {
  treatment: [partialCompletedStatus],
  inpatient: [partialCompletedStatus],
};

const moduleLabels: Record<string, string> = {
  billing: "수납",
  dispensing: "조제",
  home: "홈",
  imaging: "영상",
  inpatient: "병동",
  lab: "검사",
  orders: "오더",
  reception: "접수",
  treatment: "처치",
};

type OrderQueuePatient = Pick<
  OrderQueueItem,
  | "guardianName"
  | "patientAge"
  | "patientBloodPressure"
  | "patientBreed"
  | "patientName"
  | "patientRespiration"
  | "patientSex"
  | "patientTemperature"
  | "patientWeight"
>;

const modulePatients: Record<string, OrderQueuePatient[]> = {
  billing: [
    { patientName: "두부", guardianName: "정하린", patientAge: "6세", patientBreed: "포메라니안", patientSex: "수컷", patientWeight: "3.1 kg", patientTemperature: "38.7°C", patientRespiration: "24 rmp", patientBloodPressure: "142 bpm" },
    { patientName: "모카", guardianName: "송민재", patientAge: "4세", patientBreed: "비숑프리제", patientSex: "중성화·수컷", patientWeight: "5.4 kg", patientTemperature: "38.9°C", patientRespiration: "22 rmp", patientBloodPressure: "138 bpm" },
  ],
  dispensing: [
    { patientName: "코코", guardianName: "이지은", patientAge: "8세", patientBreed: "코리안숏헤어", patientSex: "중성화·암컷", patientWeight: "5.96 kg", patientTemperature: "39.3°C", patientRespiration: "20 rmp", patientBloodPressure: "170 bpm" },
    { patientName: "나비", guardianName: "오세아", patientAge: "5세", patientBreed: "러시안블루", patientSex: "중성화·수컷", patientWeight: "4.8 kg", patientTemperature: "38.8°C", patientRespiration: "24 rmp", patientBloodPressure: "150 bpm" },
  ],
  home: [
    { patientName: "하루", guardianName: "강서윤", patientAge: "3세", patientBreed: "말티즈", patientSex: "암컷", patientWeight: "2.9 kg", patientTemperature: "38.6°C", patientRespiration: "22 rmp", patientBloodPressure: "135 bpm" },
    { patientName: "루이", guardianName: "문태오", patientAge: "7세", patientBreed: "푸들", patientSex: "중성화·수컷", patientWeight: "4.2 kg", patientTemperature: "38.9°C", patientRespiration: "21 rmp", patientBloodPressure: "140 bpm" },
  ],
  imaging: [
    { patientName: "구름", guardianName: "한지호", patientAge: "9세", patientBreed: "시츄", patientSex: "수컷", patientWeight: "6.3 kg", patientTemperature: "38.5°C", patientRespiration: "20 rmp", patientBloodPressure: "148 bpm" },
    { patientName: "초코", guardianName: "배유진", patientAge: "2세", patientBreed: "닥스훈트", patientSex: "암컷", patientWeight: "4.7 kg", patientTemperature: "38.7°C", patientRespiration: "25 rmp", patientBloodPressure: "132 bpm" },
  ],
  inpatient: [
    { patientName: "마루", guardianName: "김은서", patientAge: "10세", patientBreed: "요크셔테리어", patientSex: "중성화·수컷", patientWeight: "3.8 kg", patientTemperature: "38.4°C", patientRespiration: "19 rmp", patientBloodPressure: "155 bpm" },
    { patientName: "보리", guardianName: "서도현", patientAge: "1세", patientBreed: "스코티시폴드", patientSex: "암컷", patientWeight: "3.5 kg", patientTemperature: "39.0°C", patientRespiration: "26 rmp", patientBloodPressure: "136 bpm" },
  ],
  lab: [
    { patientName: "별이", guardianName: "박준서", patientAge: "6세", patientBreed: "페르시안", patientSex: "중성화·암컷", patientWeight: "4.1 kg", patientTemperature: "38.6°C", patientRespiration: "21 rmp", patientBloodPressure: "145 bpm" },
    { patientName: "망고", guardianName: "윤채원", patientAge: "4세", patientBreed: "골든리트리버", patientSex: "수컷", patientWeight: "27.8 kg", patientTemperature: "38.3°C", patientRespiration: "18 rmp", patientBloodPressure: "160 bpm" },
  ],
  orders: [
    { patientName: "라떼", guardianName: "임하늘", patientAge: "5세", patientBreed: "코카스파니엘", patientSex: "암컷", patientWeight: "8.4 kg", patientTemperature: "38.8°C", patientRespiration: "20 rmp", patientBloodPressure: "146 bpm" },
    { patientName: "호두", guardianName: "권지안", patientAge: "8세", patientBreed: "랙돌", patientSex: "중성화·수컷", patientWeight: "6.1 kg", patientTemperature: "38.5°C", patientRespiration: "19 rmp", patientBloodPressure: "152 bpm" },
  ],
  reception: [
    { patientName: "콩이", guardianName: "최유나", patientAge: "2세", patientBreed: "치와와", patientSex: "수컷", patientWeight: "2.3 kg", patientTemperature: "38.9°C", patientRespiration: "24 rmp", patientBloodPressure: "130 bpm" },
    { patientName: "토리", guardianName: "이도윤", patientAge: "11세", patientBreed: "믹스견", patientSex: "중성화·암컷", patientWeight: "9.2 kg", patientTemperature: "38.2°C", patientRespiration: "18 rmp", patientBloodPressure: "158 bpm" },
  ],
  treatment: [
    { patientName: "코코", guardianName: "이지은", patientAge: "8세", patientBreed: "코리안숏헤어", patientSex: "중성화·암컷", patientWeight: "5.96 kg", patientTemperature: "39.3°C", patientRespiration: "20 rmp", patientBloodPressure: "170 bpm" },
    { patientName: "나비", guardianName: "오세아", patientAge: "5세", patientBreed: "러시안블루", patientSex: "중성화·수컷", patientWeight: "4.8 kg", patientTemperature: "38.8°C", patientRespiration: "24 rmp", patientBloodPressure: "150 bpm" },
  ],
};

const createItem = (
  moduleId: string,
  index: number,
  item: Omit<OrderQueueItem, "guardianName" | "id" | "instructionId" | "patientName"> & {
    instructionId?: string;
  }
): OrderQueueItem => {
  const patients = modulePatients[moduleId] ?? modulePatients.home;
  const patient = patients[index % patients.length];
  const defaultInstructionPrefix = moduleId.slice(0, 2).toUpperCase();

  return {
    ...patient,
    ...item,
    id: `${moduleId}-queue-${index}`,
    instructionId: item.instructionId ?? `${defaultInstructionPrefix}-260501-${String(index + 1).padStart(4, "0")}`,
  };
};

const buildModuleQueueItems = (moduleId: string): OrderQueueItem[] => {
  const moduleLabel = moduleLabels[moduleId] ?? moduleId;

  if (moduleId === "dispensing") {
    return [
      createItem(moduleId, 0, {
        assigneeName: "김미래",
        instructionId: "RX-260414-0006",
        orderName: "항생제 세트 A",
        orderType: "경구제",
        orderTypeCategory: "dispensing",
        receptionType: "예약",
        requesterName: "이수지",
        startedAt: "10:34",
        statusId: "reRequested",
        time: "10:30",
      }),
      createItem(moduleId, 1, {
        assigneeName: "송하윤",
        instructionId: "RX-260414-0007",
        orderName: "수액 처치",
        orderType: "주사제",
        orderTypeCategory: "treatment",
        receptionType: "외래",
        requesterName: "김도윤",
        startedAt: "10:45",
        statusId: "inProgress",
        time: "10:42",
      }),
      createItem(moduleId, 2, {
        instructionId: "RX-260414-0008",
        orderName: "소염제 세트",
        orderType: "경구제",
        orderTypeCategory: "dispensing",
        receptionType: "외래",
        requesterName: "이수지",
        statusId: "waiting",
        time: "10:47",
        waitMinutes: 8,
      }),
      createItem(moduleId, 3, {
        instructionId: "RX-260414-0009",
        orderName: "위장약 세트",
        orderType: "조제-기타",
        orderTypeCategory: "dispensing",
        receptionType: "외래",
        requesterName: "김도윤",
        statusId: "waiting",
        time: "10:55",
        waitMinutes: 3,
      }),
      createItem(moduleId, 4, {
        assigneeName: "박준호",
        instructionId: "RX-260414-0010",
        orderName: "네뷸라이징",
        orderType: "처치-기타",
        orderTypeCategory: "treatment",
        receptionType: "예약",
        requesterName: "이수지",
        startedAt: "11:08",
        statusId: "completed",
        time: "11:05",
      }),
      createItem(moduleId, 5, {
        assigneeName: "김미래",
        instructionId: "RX-260414-0011",
        orderName: "심장약 세트",
        orderType: "경구제",
        orderTypeCategory: "dispensing",
        receptionType: "외래",
        requesterName: "김도윤",
        startedAt: "11:16",
        statusId: "canceled",
        time: "11:12",
      }),
    ];
  }

  const hasPartialStatus = Boolean(moduleOrderQueueStatuses[moduleId]?.some((status) => status.id === "partiallyCompleted"));
  const baseItems: OrderQueueItem[] = [
    createItem(moduleId, 0, {
      assigneeName: "김미래",
      orderName: `${moduleLabel} 재요청 확인`,
      orderType: "조제-기타",
      orderTypeCategory: "dispensing",
      receptionType: "예약",
      requesterName: "이수지",
      startedAt: "09:25",
      statusId: "reRequested",
      time: "09:20",
    }),
    createItem(moduleId, 1, {
      assigneeName: "송하윤",
      orderName: `${moduleLabel} 진행 오더`,
      orderType: "처치-기타",
      orderTypeCategory: "treatment",
      receptionType: "외래",
      requesterName: "김도윤",
      startedAt: "09:50",
      statusId: "inProgress",
      time: "09:45",
    }),
    createItem(moduleId, 2, {
      orderName: `${moduleLabel} 대기 오더`,
      orderType: "경구제",
      orderTypeCategory: "dispensing",
      receptionType: "외래",
      requesterName: "박서연",
      statusId: "waiting",
      time: "10:05",
      waitMinutes: 18,
    }),
    createItem(moduleId, 3, {
      assigneeName: "이다은",
      orderName: `${moduleLabel} 완료 오더`,
      orderType: "주사제",
      orderTypeCategory: "treatment",
      receptionType: "예약",
      requesterName: "이수지",
      startedAt: "10:30",
      statusId: "completed",
      time: "10:25",
    }),
    createItem(moduleId, 4, {
      assigneeName: "박준호",
      orderName: `${moduleLabel} 취소 오더`,
      orderType: "조제-기타",
      orderTypeCategory: "dispensing",
      receptionType: "외래",
      requesterName: "김도윤",
      startedAt: "10:45",
      statusId: "canceled",
      time: "10:40",
    }),
  ];

  if (!hasPartialStatus) return baseItems;

  return [
    ...baseItems,
    createItem(moduleId, 5, {
      assigneeName: "송하윤",
      orderName: `${moduleLabel} 부분완료 오더`,
      orderType: "처치-기타",
      orderTypeCategory: "treatment",
      receptionType: "외래",
      requesterName: "박서연",
      startedAt: "11:08",
      statusId: "partiallyCompleted",
      time: "11:05",
    }),
  ];
};

export const moduleOrderQueueItems: Record<string, OrderQueueItem[]> = Object.fromEntries(
  Object.keys(moduleLabels).map((moduleId) => [moduleId, buildModuleQueueItems(moduleId)])
);

export const getOrderQueueStatuses = (moduleId: string) => [
  ...defaultOrderQueueStatuses,
  ...(moduleOrderQueueStatuses[moduleId] ?? []),
];

export const getOrderQueueItems = (moduleId: string) =>
  moduleOrderQueueItems[moduleId] ?? buildModuleQueueItems(moduleId);

export const getSelectedOrderQueueItem = (moduleId: string, selectedItemId?: string) => {
  const items = getOrderQueueItems(moduleId);

  return items.find((item) => item.id === selectedItemId) ?? items[0] ?? null;
};
