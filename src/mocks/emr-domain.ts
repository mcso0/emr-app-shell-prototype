import type {
  Appointment,
  AuditLogEntry,
  Consent,
  CsHistoryEntry,
  Diagnosis,
  EmrId,
  EmrAttachment,
  EmrOrder,
  Encounter,
  EquipmentReceipt,
  Guardian,
  ImagingStudy,
  Invoice,
  InvoiceLine,
  LabResult,
  LatestWorkShortcut,
  MessageDelivery,
  MessageTemplate,
  OrderAssignment,
  OrderEvent,
  OrderGroup,
  Patient,
  PatientGuardian,
  Payment,
  Prescription,
  PrescriptionItem,
  ServiceCategory,
  ServiceItem,
  ServiceItemPrice,
  SoapNote,
  WaitingQueueEntry,
} from "@/types/emr-domain";

export const MOCK_WORKSPACE_ID = "clair-demo";

export type MockStaffUser = {
  id: EmrId;
  workspaceId: EmrId;
  name: string;
  initial: string;
  role: "veterinarian" | "technician" | "desk" | "billing" | "admin";
  department: "진료" | "조제" | "검사" | "영상" | "수납" | "데스크" | "관리";
};

export const mockStaffUsers: MockStaffUser[] = [
  {
    id: "user-vet-suji",
    workspaceId: MOCK_WORKSPACE_ID,
    name: "이수지",
    initial: "SJ",
    role: "veterinarian",
    department: "진료",
  },
  {
    id: "user-vet-doyun",
    workspaceId: MOCK_WORKSPACE_ID,
    name: "김도윤",
    initial: "DY",
    role: "veterinarian",
    department: "진료",
  },
  {
    id: "user-tech-hayun",
    workspaceId: MOCK_WORKSPACE_ID,
    name: "송하윤",
    initial: "HY",
    role: "technician",
    department: "조제",
  },
  {
    id: "user-desk-yuna",
    workspaceId: MOCK_WORKSPACE_ID,
    name: "최유나",
    initial: "YN",
    role: "desk",
    department: "데스크",
  },
  {
    id: "user-billing-harin",
    workspaceId: MOCK_WORKSPACE_ID,
    name: "정하린",
    initial: "HR",
    role: "billing",
    department: "수납",
  },
  {
    id: "user-admin-minjae",
    workspaceId: MOCK_WORKSPACE_ID,
    name: "송민재",
    initial: "MJ",
    role: "admin",
    department: "관리",
  },
];

export const mockGuardians: Guardian[] = [
  {
    id: "guardian-lee-jieun",
    workspaceId: MOCK_WORKSPACE_ID,
    name: "이지은",
    mobilePhone: "010-3245-1188",
    email: "jieun.lee@example.com",
    address: "서울시 마포구 월드컵북로 12",
    occupation: "디자이너",
    memo: "문자보다 알림톡 선호",
    createdAt: "2026-03-12T09:00:00+09:00",
    updatedAt: "2026-04-14T09:48:00+09:00",
  },
  {
    id: "guardian-oh-sea",
    workspaceId: MOCK_WORKSPACE_ID,
    name: "오세아",
    mobilePhone: "010-7812-4401",
    address: "서울시 용산구 한강대로 84",
    memo: "내원 전 주차 안내 필요",
    createdAt: "2026-03-20T11:20:00+09:00",
    updatedAt: "2026-04-14T10:10:00+09:00",
  },
  {
    id: "guardian-kang-seoyun",
    workspaceId: MOCK_WORKSPACE_ID,
    name: "강서윤",
    mobilePhone: "010-9012-3300",
    email: "seoyun.kang@example.com",
    address: "서울시 서초구 사임당로 21",
    memo: "하루와 루이 모두 같은 보호자",
    createdAt: "2026-04-01T13:35:00+09:00",
    updatedAt: "2026-04-30T16:10:00+09:00",
  },
  {
    id: "guardian-jung-harin",
    workspaceId: MOCK_WORKSPACE_ID,
    name: "정하린",
    mobilePhone: "010-4922-8821",
    phone: "02-555-0187",
    address: "서울시 강남구 테헤란로 152",
    createdAt: "2026-04-02T15:00:00+09:00",
    updatedAt: "2026-05-01T09:42:00+09:00",
  },
];

export const mockPatients: Patient[] = [
  {
    id: "patient-coco",
    patientNo: "P-260414-0008",
    workspaceId: MOCK_WORKSPACE_ID,
    name: "코코",
    species: "cat",
    breed: "코리안숏헤어",
    birthDate: "2018-05-20",
    sex: "female",
    neutered: true,
    allergyNote: "세팔로스포린 계열 투약 후 구토 이력",
    specialNote: "심잡음 추적 관찰 중",
    handlingCautionNote: "낯선 사람에게 예민함. 채혈 시 넥카라 권장.",
    handlingCautionLocked: true,
    status: "active",
    createdAt: "2026-03-12T09:05:00+09:00",
    updatedAt: "2026-04-14T10:02:00+09:00",
  },
  {
    id: "patient-nabi",
    patientNo: "P-260414-0009",
    workspaceId: MOCK_WORKSPACE_ID,
    name: "나비",
    species: "cat",
    breed: "러시안블루",
    birthDate: "2021-02-03",
    sex: "male",
    neutered: true,
    specialNote: "피부 알러지 재발 확인 필요",
    handlingCautionLocked: true,
    status: "active",
    createdAt: "2026-03-20T11:25:00+09:00",
    updatedAt: "2026-04-14T10:20:00+09:00",
  },
  {
    id: "patient-haru",
    patientNo: "P-260501-0001",
    workspaceId: MOCK_WORKSPACE_ID,
    name: "하루",
    species: "dog",
    breed: "말티즈",
    birthDate: "2023-01-12",
    sex: "female",
    neutered: false,
    specialNote: "예방접종 예정",
    handlingCautionLocked: true,
    status: "active",
    createdAt: "2026-04-01T13:40:00+09:00",
    updatedAt: "2026-05-01T09:20:00+09:00",
  },
  {
    id: "patient-dubu",
    patientNo: "P-260501-0002",
    workspaceId: MOCK_WORKSPACE_ID,
    name: "두부",
    species: "dog",
    breed: "포메라니안",
    estimatedAgeText: "6세 추정",
    sex: "male",
    neutered: false,
    microchipNo: "410098765432109",
    specialNote: "슬개골 수술 후 재활 상담",
    handlingCautionLocked: true,
    status: "active",
    createdAt: "2026-04-02T15:05:00+09:00",
    updatedAt: "2026-05-01T09:45:00+09:00",
  },
];

export const mockPatientGuardians: PatientGuardian[] = [
  {
    id: "pg-coco-jieun",
    patientId: "patient-coco",
    guardianId: "guardian-lee-jieun",
    relationship: "주보호자",
    isPrimary: true,
    canReceiveMessages: true,
    createdAt: "2026-03-12T09:05:00+09:00",
  },
  {
    id: "pg-nabi-sea",
    patientId: "patient-nabi",
    guardianId: "guardian-oh-sea",
    relationship: "주보호자",
    isPrimary: true,
    canReceiveMessages: true,
    createdAt: "2026-03-20T11:25:00+09:00",
  },
  {
    id: "pg-haru-seoyun",
    patientId: "patient-haru",
    guardianId: "guardian-kang-seoyun",
    relationship: "주보호자",
    isPrimary: true,
    canReceiveMessages: true,
    createdAt: "2026-04-01T13:40:00+09:00",
  },
  {
    id: "pg-dubu-harin",
    patientId: "patient-dubu",
    guardianId: "guardian-jung-harin",
    relationship: "주보호자",
    isPrimary: true,
    canReceiveMessages: true,
    createdAt: "2026-04-02T15:05:00+09:00",
  },
  {
    id: "pg-dubu-seoyun",
    patientId: "patient-dubu",
    guardianId: "guardian-kang-seoyun",
    relationship: "가족",
    isPrimary: false,
    canReceiveMessages: false,
    createdAt: "2026-05-01T09:46:00+09:00",
  },
];

export const mockConsents: Consent[] = [
  {
    id: "consent-coco-privacy",
    workspaceId: MOCK_WORKSPACE_ID,
    guardianId: "guardian-lee-jieun",
    patientId: "patient-coco",
    consentType: "privacy",
    status: "granted",
    signedAt: "2026-03-12T09:10:00+09:00",
    documentUrl: "/mock-documents/consents/coco-privacy.pdf",
  },
  {
    id: "consent-coco-messaging",
    workspaceId: MOCK_WORKSPACE_ID,
    guardianId: "guardian-lee-jieun",
    patientId: "patient-coco",
    consentType: "messaging",
    status: "granted",
    signedAt: "2026-03-12T09:11:00+09:00",
  },
  {
    id: "consent-nabi-privacy",
    workspaceId: MOCK_WORKSPACE_ID,
    guardianId: "guardian-oh-sea",
    patientId: "patient-nabi",
    consentType: "privacy",
    status: "granted",
    signedAt: "2026-03-20T11:30:00+09:00",
  },
  {
    id: "consent-haru-marketing",
    workspaceId: MOCK_WORKSPACE_ID,
    guardianId: "guardian-kang-seoyun",
    patientId: "patient-haru",
    consentType: "marketing",
    status: "revoked",
    signedAt: "2026-04-01T13:45:00+09:00",
    revokedAt: "2026-04-30T16:10:00+09:00",
  },
];

export const mockAppointments: Appointment[] = [
  {
    id: "appointment-coco-260501",
    workspaceId: MOCK_WORKSPACE_ID,
    patientId: "patient-coco",
    guardianId: "guardian-lee-jieun",
    assignedVeterinarianId: "user-vet-suji",
    scheduledStartAt: "2026-05-01T10:00:00+09:00",
    scheduledEndAt: "2026-05-01T10:30:00+09:00",
    visitPurpose: "구토 및 식욕저하",
    symptomNote: "전날 밤부터 구토 2회",
    status: "checked_in",
    createdByUserId: "user-desk-yuna",
    createdAt: "2026-04-30T17:20:00+09:00",
    updatedAt: "2026-05-01T09:50:00+09:00",
  },
  {
    id: "appointment-nabi-260501",
    workspaceId: MOCK_WORKSPACE_ID,
    patientId: "patient-nabi",
    guardianId: "guardian-oh-sea",
    assignedVeterinarianId: "user-vet-doyun",
    scheduledStartAt: "2026-05-01T10:40:00+09:00",
    scheduledEndAt: "2026-05-01T11:00:00+09:00",
    visitPurpose: "피부 재진",
    status: "confirmed",
    createdByUserId: "user-desk-yuna",
    createdAt: "2026-04-30T11:10:00+09:00",
    updatedAt: "2026-04-30T11:10:00+09:00",
  },
  {
    id: "appointment-haru-260501",
    workspaceId: MOCK_WORKSPACE_ID,
    patientId: "patient-haru",
    guardianId: "guardian-kang-seoyun",
    assignedVeterinarianId: "user-vet-suji",
    scheduledStartAt: "2026-05-01T11:20:00+09:00",
    scheduledEndAt: "2026-05-01T11:40:00+09:00",
    visitPurpose: "예방접종",
    status: "no_show",
    createdByUserId: "user-desk-yuna",
    createdAt: "2026-04-29T14:05:00+09:00",
    updatedAt: "2026-05-01T11:50:00+09:00",
  },
];

export const mockEncounters: Encounter[] = [
  {
    id: "encounter-coco-260501",
    workspaceId: MOCK_WORKSPACE_ID,
    patientId: "patient-coco",
    guardianId: "guardian-lee-jieun",
    appointmentId: "appointment-coco-260501",
    primaryVeterinarianId: "user-vet-suji",
    encounterNo: "E-260501-0001",
    chiefComplaint: "구토와 식욕저하",
    visitPurpose: "내과 진료",
    status: "ordered",
    checkedInAt: "2026-05-01T09:50:00+09:00",
    startedAt: "2026-05-01T10:05:00+09:00",
    createdAt: "2026-05-01T09:50:00+09:00",
    updatedAt: "2026-05-01T10:36:00+09:00",
  },
  {
    id: "encounter-nabi-260414",
    workspaceId: MOCK_WORKSPACE_ID,
    patientId: "patient-nabi",
    guardianId: "guardian-oh-sea",
    primaryVeterinarianId: "user-vet-doyun",
    encounterNo: "E-260414-0007",
    chiefComplaint: "피부 가려움",
    visitPurpose: "재진",
    status: "completed",
    checkedInAt: "2026-04-14T10:16:00+09:00",
    startedAt: "2026-04-14T10:28:00+09:00",
    completedAt: "2026-04-14T11:15:00+09:00",
    createdAt: "2026-04-14T10:16:00+09:00",
    updatedAt: "2026-04-14T11:15:00+09:00",
  },
  {
    id: "encounter-dubu-260501",
    workspaceId: MOCK_WORKSPACE_ID,
    patientId: "patient-dubu",
    guardianId: "guardian-jung-harin",
    primaryVeterinarianId: "user-vet-doyun",
    encounterNo: "E-260501-0002",
    chiefComplaint: "수술 후 보행 확인",
    visitPurpose: "정형외과 재진",
    status: "ready_for_billing",
    checkedInAt: "2026-05-01T09:42:00+09:00",
    startedAt: "2026-05-01T09:55:00+09:00",
    createdAt: "2026-05-01T09:42:00+09:00",
    updatedAt: "2026-05-01T10:28:00+09:00",
  },
  {
    id: "encounter-haru-260430",
    workspaceId: MOCK_WORKSPACE_ID,
    patientId: "patient-haru",
    guardianId: "guardian-kang-seoyun",
    primaryVeterinarianId: "user-vet-suji",
    encounterNo: "E-260430-0005",
    chiefComplaint: "예방접종 전 건강 확인",
    visitPurpose: "예방접종",
    status: "waiting",
    checkedInAt: "2026-04-30T16:05:00+09:00",
    createdAt: "2026-04-30T16:05:00+09:00",
    updatedAt: "2026-04-30T16:05:00+09:00",
  },
];

export const mockWaitingQueueEntries: WaitingQueueEntry[] = [
  {
    id: "queue-coco-consultation",
    workspaceId: MOCK_WORKSPACE_ID,
    encounterId: "encounter-coco-260501",
    queueType: "consultation",
    status: "in_progress",
    priority: "high",
    sortOrder: 1,
    enteredAt: "2026-05-01T09:50:00+09:00",
    calledAt: "2026-05-01T10:05:00+09:00",
  },
  {
    id: "queue-coco-treatment",
    workspaceId: MOCK_WORKSPACE_ID,
    encounterId: "encounter-coco-260501",
    queueType: "treatment",
    status: "waiting",
    priority: "high",
    sortOrder: 1,
    enteredAt: "2026-05-01T10:36:00+09:00",
  },
  {
    id: "queue-dubu-billing",
    workspaceId: MOCK_WORKSPACE_ID,
    encounterId: "encounter-dubu-260501",
    queueType: "billing",
    status: "waiting",
    priority: "normal",
    sortOrder: 2,
    enteredAt: "2026-05-01T10:28:00+09:00",
  },
  {
    id: "queue-haru-consultation",
    workspaceId: MOCK_WORKSPACE_ID,
    encounterId: "encounter-haru-260430",
    queueType: "consultation",
    status: "waiting",
    priority: "normal",
    sortOrder: 3,
    enteredAt: "2026-04-30T16:05:00+09:00",
  },
];

export const mockSoapNotes: SoapNote[] = [
  {
    id: "soap-coco-260501",
    encounterId: "encounter-coco-260501",
    authorUserId: "user-vet-suji",
    subjective: "보호자 진술상 전날 밤부터 구토 2회, 식욕 감소.",
    objective: "체온 39.3C, 복부 촉진 시 경미한 긴장.",
    assessment: "급성 위장관염 의심, 탈수 경도.",
    plan: "CBC, 전해질 검사 및 수액 처치. 항구토제 처방.",
    status: "autosaved",
    createdAt: "2026-05-01T10:08:00+09:00",
    updatedAt: "2026-05-01T10:32:00+09:00",
  },
  {
    id: "soap-nabi-260414",
    encounterId: "encounter-nabi-260414",
    authorUserId: "user-vet-doyun",
    subjective: "귀 주변 긁음 감소. 식욕 정상.",
    objective: "피부 발적 감소, 체중 4.8kg.",
    assessment: "알러지성 피부염 호전.",
    plan: "소염제 5일 연장, 보호자에게 재발 징후 안내.",
    status: "signed",
    signedAt: "2026-04-14T10:58:00+09:00",
    createdAt: "2026-04-14T10:32:00+09:00",
    updatedAt: "2026-04-14T10:58:00+09:00",
  },
  {
    id: "soap-dubu-260501",
    encounterId: "encounter-dubu-260501",
    authorUserId: "user-vet-doyun",
    subjective: "수술 후 보행은 양호하나 계단 오르내림 불편.",
    objective: "수술 부위 발적 없음, 보행 시 좌측 후지 가벼운 파행.",
    assessment: "수술 후 회복 양호.",
    plan: "재활 운동 교육, 진통제 3일 처방.",
    status: "signed",
    signedAt: "2026-05-01T10:24:00+09:00",
    createdAt: "2026-05-01T10:00:00+09:00",
    updatedAt: "2026-05-01T10:24:00+09:00",
  },
];

export const mockDiagnoses: Diagnosis[] = [
  {
    id: "diagnosis-coco-gastroenteritis",
    encounterId: "encounter-coco-260501",
    diagnosisText: "급성 위장관염 의심",
    diagnosisType: "suspected",
    createdByUserId: "user-vet-suji",
    createdAt: "2026-05-01T10:28:00+09:00",
  },
  {
    id: "diagnosis-nabi-dermatitis",
    encounterId: "encounter-nabi-260414",
    diagnosisText: "알러지성 피부염",
    diagnosisType: "confirmed",
    createdByUserId: "user-vet-doyun",
    createdAt: "2026-04-14T10:50:00+09:00",
  },
  {
    id: "diagnosis-dubu-rehab",
    encounterId: "encounter-dubu-260501",
    diagnosisText: "슬개골 수술 후 재활 관리",
    diagnosisType: "confirmed",
    createdByUserId: "user-vet-doyun",
    createdAt: "2026-05-01T10:18:00+09:00",
  },
];

export const mockPrescriptions: Prescription[] = [
  {
    id: "prescription-coco-260501",
    encounterId: "encounter-coco-260501",
    prescriptionNo: "RX-260501-0001",
    prescriberUserId: "user-vet-suji",
    status: "ordered",
    issuedAt: "2026-05-01T10:34:00+09:00",
    createdAt: "2026-05-01T10:30:00+09:00",
    updatedAt: "2026-05-01T10:34:00+09:00",
  },
  {
    id: "prescription-nabi-260414",
    encounterId: "encounter-nabi-260414",
    prescriptionNo: "RX-260414-0007",
    prescriberUserId: "user-vet-doyun",
    status: "completed",
    issuedAt: "2026-04-14T10:55:00+09:00",
    createdAt: "2026-04-14T10:52:00+09:00",
    updatedAt: "2026-04-14T11:05:00+09:00",
  },
  {
    id: "prescription-dubu-260501",
    encounterId: "encounter-dubu-260501",
    prescriptionNo: "RX-260501-0002",
    prescriberUserId: "user-vet-doyun",
    status: "completed",
    issuedAt: "2026-05-01T10:20:00+09:00",
    createdAt: "2026-05-01T10:18:00+09:00",
    updatedAt: "2026-05-01T10:25:00+09:00",
  },
];

export const mockPrescriptionItems: PrescriptionItem[] = [
  {
    id: "rx-item-coco-maropitant",
    prescriptionId: "prescription-coco-260501",
    medicationNameSnapshot: "Maropitant 16mg T",
    dose: "0.5T",
    frequency: "sid",
    durationDays: 3,
    quantity: 2,
    instruction: "구토가 없으면 식후 투약",
    status: "active",
  },
  {
    id: "rx-item-coco-probiotic",
    prescriptionId: "prescription-coco-260501",
    medicationNameSnapshot: "Probiotic powder 1g",
    dose: "1포",
    frequency: "sid",
    durationDays: 5,
    quantity: 5,
    instruction: "사료에 섞어 급여",
    status: "active",
  },
  {
    id: "rx-item-nabi-meloxicam",
    prescriptionId: "prescription-nabi-260414",
    medicationNameSnapshot: "Meloxicam 0.5mg T",
    dose: "0.25T",
    frequency: "sid",
    durationDays: 5,
    quantity: 2,
    instruction: "식후 투약",
    status: "active",
  },
  {
    id: "rx-item-dubu-carprofen",
    prescriptionId: "prescription-dubu-260501",
    medicationNameSnapshot: "Carprofen 25mg T",
    dose: "0.5T",
    frequency: "bid",
    durationDays: 3,
    quantity: 3,
    instruction: "식후 투약, 구토 시 중단",
    status: "active",
  },
];

export const mockServiceCategories: ServiceCategory[] = [
  {
    id: "svc-cat-consultation",
    workspaceId: MOCK_WORKSPACE_ID,
    name: "진료",
    sortOrder: 10,
  },
  {
    id: "svc-cat-medication",
    workspaceId: MOCK_WORKSPACE_ID,
    name: "약품",
    sortOrder: 20,
  },
  {
    id: "svc-cat-treatment",
    workspaceId: MOCK_WORKSPACE_ID,
    name: "처치",
    sortOrder: 30,
  },
  {
    id: "svc-cat-lab",
    workspaceId: MOCK_WORKSPACE_ID,
    name: "검사",
    sortOrder: 40,
  },
  {
    id: "svc-cat-imaging",
    workspaceId: MOCK_WORKSPACE_ID,
    name: "영상",
    sortOrder: 50,
  },
];

export const mockServiceItems: ServiceItem[] = [
  {
    id: "svc-consult-general",
    workspaceId: MOCK_WORKSPACE_ID,
    categoryId: "svc-cat-consultation",
    name: "일반 진료",
    itemType: "consultation",
    defaultDurationMinutes: 20,
    isOrderable: false,
    isBillable: true,
    isActive: true,
  },
  {
    id: "svc-med-maropitant",
    workspaceId: MOCK_WORKSPACE_ID,
    categoryId: "svc-cat-medication",
    name: "Maropitant 16mg T",
    itemType: "medication",
    isOrderable: true,
    isBillable: true,
    isActive: true,
  },
  {
    id: "svc-treatment-fluid",
    workspaceId: MOCK_WORKSPACE_ID,
    categoryId: "svc-cat-treatment",
    name: "피하 수액 처치",
    itemType: "treatment",
    defaultDurationMinutes: 15,
    isOrderable: true,
    isBillable: true,
    isActive: true,
  },
  {
    id: "svc-lab-cbc",
    workspaceId: MOCK_WORKSPACE_ID,
    categoryId: "svc-cat-lab",
    name: "CBC 검사",
    itemType: "lab",
    defaultDurationMinutes: 30,
    isOrderable: true,
    isBillable: true,
    isActive: true,
  },
  {
    id: "svc-med-carprofen",
    workspaceId: MOCK_WORKSPACE_ID,
    categoryId: "svc-cat-medication",
    name: "Carprofen 25mg T",
    itemType: "medication",
    isOrderable: true,
    isBillable: true,
    isActive: true,
  },
  {
    id: "svc-imaging-thorax",
    workspaceId: MOCK_WORKSPACE_ID,
    categoryId: "svc-cat-imaging",
    name: "흉부 방사선",
    itemType: "imaging",
    defaultDurationMinutes: 20,
    isOrderable: true,
    isBillable: true,
    isActive: true,
  },
];

export const mockServiceItemPrices: ServiceItemPrice[] = [
  {
    id: "price-consult-general-2026",
    serviceItemId: "svc-consult-general",
    price: 22000,
    currency: "KRW",
    effectiveFrom: "2026-01-01",
  },
  {
    id: "price-maropitant-2026",
    serviceItemId: "svc-med-maropitant",
    price: 4500,
    currency: "KRW",
    effectiveFrom: "2026-01-01",
  },
  {
    id: "price-fluid-2026",
    serviceItemId: "svc-treatment-fluid",
    price: 18000,
    currency: "KRW",
    effectiveFrom: "2026-01-01",
  },
  {
    id: "price-cbc-2026",
    serviceItemId: "svc-lab-cbc",
    price: 35000,
    currency: "KRW",
    effectiveFrom: "2026-01-01",
  },
  {
    id: "price-carprofen-2026",
    serviceItemId: "svc-med-carprofen",
    price: 3000,
    currency: "KRW",
    effectiveFrom: "2026-01-01",
  },
  {
    id: "price-thorax-2026",
    serviceItemId: "svc-imaging-thorax",
    price: 42000,
    currency: "KRW",
    effectiveFrom: "2026-01-01",
  },
];

export const mockOrderGroups: OrderGroup[] = [
  {
    id: "order-group-coco-dispensing",
    encounterId: "encounter-coco-260501",
    prescriptionId: "prescription-coco-260501",
    groupType: "dispensing",
    title: "항구토제 세트",
    label: "경구제 오더 그룹",
    status: "requested",
    priority: "high",
    sortOrder: 10,
    createdByUserId: "user-vet-suji",
    createdAt: "2026-05-01T10:34:00+09:00",
    updatedAt: "2026-05-01T10:34:00+09:00",
  },
  {
    id: "order-group-coco-lab",
    encounterId: "encounter-coco-260501",
    groupType: "lab",
    title: "구토 원인 검사",
    label: "임상병리 오더 그룹",
    status: "in_progress",
    priority: "high",
    sortOrder: 20,
    createdByUserId: "user-vet-suji",
    createdAt: "2026-05-01T10:35:00+09:00",
    updatedAt: "2026-05-01T10:40:00+09:00",
  },
  {
    id: "order-group-coco-imaging",
    encounterId: "encounter-coco-260501",
    groupType: "imaging",
    title: "구토 원인 영상 확인",
    label: "영상 오더 그룹",
    status: "in_progress",
    priority: "normal",
    sortOrder: 30,
    createdByUserId: "user-vet-suji",
    createdAt: "2026-05-01T10:37:00+09:00",
    updatedAt: "2026-05-01T10:52:00+09:00",
  },
  {
    id: "order-group-dubu-med",
    encounterId: "encounter-dubu-260501",
    prescriptionId: "prescription-dubu-260501",
    groupType: "dispensing",
    title: "수술 후 진통제",
    label: "경구제 오더 그룹",
    status: "completed",
    priority: "normal",
    sortOrder: 10,
    createdByUserId: "user-vet-doyun",
    createdAt: "2026-05-01T10:20:00+09:00",
    updatedAt: "2026-05-01T10:26:00+09:00",
  },
];

export const mockOrders: EmrOrder[] = [
  {
    id: "order-coco-maropitant",
    orderGroupId: "order-group-coco-dispensing",
    workspaceId: MOCK_WORKSPACE_ID,
    encounterId: "encounter-coco-260501",
    serviceItemId: "svc-med-maropitant",
    orderType: "dispensing",
    displayName: "Maropitant 16mg T",
    status: "requested",
    workStatus: "pending",
    priority: "high",
    requestedByUserId: "user-vet-suji",
    requestedAt: "2026-05-01T10:34:00+09:00",
    dueAt: "2026-05-01T10:55:00+09:00",
    instruction: "0.5T x 3일, 보호자 복약 안내 포함",
    sortOrder: 10,
    createdAt: "2026-05-01T10:34:00+09:00",
    updatedAt: "2026-05-01T10:34:00+09:00",
  },
  {
    id: "order-coco-cbc",
    orderGroupId: "order-group-coco-lab",
    workspaceId: MOCK_WORKSPACE_ID,
    encounterId: "encounter-coco-260501",
    serviceItemId: "svc-lab-cbc",
    orderType: "lab",
    displayName: "CBC 검사",
    status: "in_progress",
    workStatus: "pending",
    priority: "high",
    requestedByUserId: "user-vet-suji",
    requestedAt: "2026-05-01T10:35:00+09:00",
    dueAt: "2026-05-01T11:05:00+09:00",
    currentAssigneeUserId: "user-tech-hayun",
    instruction: "채혈 후 결과 수동 입력",
    sortOrder: 20,
    createdAt: "2026-05-01T10:35:00+09:00",
    updatedAt: "2026-05-01T10:40:00+09:00",
  },
  {
    id: "order-coco-fluid",
    workspaceId: MOCK_WORKSPACE_ID,
    encounterId: "encounter-coco-260501",
    serviceItemId: "svc-treatment-fluid",
    orderType: "treatment",
    displayName: "피하 수액 처치",
    status: "re_requested",
    workStatus: "pending",
    priority: "high",
    requestedByUserId: "user-vet-suji",
    requestedAt: "2026-05-01T10:36:00+09:00",
    dueAt: "2026-05-01T11:00:00+09:00",
    warningMessage: "수액량이 80ml에서 120ml로 변경되었습니다.",
    sortOrder: 30,
    createdAt: "2026-05-01T10:36:00+09:00",
    updatedAt: "2026-05-01T10:38:00+09:00",
  },
  {
    id: "order-coco-thorax",
    orderGroupId: "order-group-coco-imaging",
    workspaceId: MOCK_WORKSPACE_ID,
    encounterId: "encounter-coco-260501",
    serviceItemId: "svc-imaging-thorax",
    orderType: "imaging",
    displayName: "흉부 방사선",
    status: "in_progress",
    workStatus: "pending",
    priority: "normal",
    requestedByUserId: "user-vet-suji",
    requestedAt: "2026-05-01T10:37:00+09:00",
    dueAt: "2026-05-01T11:20:00+09:00",
    instruction: "구토 관련 흉복부 이상 여부 확인",
    sortOrder: 40,
    createdAt: "2026-05-01T10:37:00+09:00",
    updatedAt: "2026-05-01T10:52:00+09:00",
  },
  {
    id: "order-dubu-carprofen",
    orderGroupId: "order-group-dubu-med",
    workspaceId: MOCK_WORKSPACE_ID,
    encounterId: "encounter-dubu-260501",
    serviceItemId: "svc-med-carprofen",
    orderType: "dispensing",
    displayName: "Carprofen 25mg T",
    status: "completed",
    workStatus: "completed",
    priority: "normal",
    requestedByUserId: "user-vet-doyun",
    requestedAt: "2026-05-01T10:20:00+09:00",
    currentAssigneeUserId: "user-tech-hayun",
    instruction: "0.5T bid 3일",
    sortOrder: 10,
    createdAt: "2026-05-01T10:20:00+09:00",
    updatedAt: "2026-05-01T10:26:00+09:00",
  },
];

export const mockOrderAssignments: OrderAssignment[] = [
  {
    id: "assignment-coco-cbc-hayun",
    orderId: "order-coco-cbc",
    assigneeUserId: "user-tech-hayun",
    assignedByUserId: "user-tech-hayun",
    status: "active",
    assignedAt: "2026-05-01T10:40:00+09:00",
  },
  {
    id: "assignment-dubu-carprofen-hayun",
    orderId: "order-dubu-carprofen",
    assigneeUserId: "user-tech-hayun",
    assignedByUserId: "user-tech-hayun",
    status: "completed",
    assignedAt: "2026-05-01T10:22:00+09:00",
    completedAt: "2026-05-01T10:26:00+09:00",
  },
];

export const mockOrderEvents: OrderEvent[] = [
  {
    id: "event-coco-maropitant-requested",
    orderId: "order-coco-maropitant",
    eventType: "requested",
    performedByUserId: "user-vet-suji",
    payload: { status: "requested" },
    createdAt: "2026-05-01T10:34:00+09:00",
  },
  {
    id: "event-coco-cbc-started",
    orderId: "order-coco-cbc",
    eventType: "started",
    performedByUserId: "user-tech-hayun",
    payload: { status: "in_progress" },
    createdAt: "2026-05-01T10:40:00+09:00",
  },
  {
    id: "event-coco-fluid-edited",
    orderId: "order-coco-fluid",
    eventType: "edited",
    performedByUserId: "user-vet-suji",
    payload: { fieldName: "instruction", previousValue: "80ml", currentValue: "120ml" },
    createdAt: "2026-05-01T10:38:00+09:00",
  },
  {
    id: "event-dubu-carprofen-completed",
    orderId: "order-dubu-carprofen",
    eventType: "completed",
    performedByUserId: "user-tech-hayun",
    payload: { status: "completed" },
    createdAt: "2026-05-01T10:26:00+09:00",
  },
];

export const mockInvoices: Invoice[] = [
  {
    id: "invoice-coco-260501",
    workspaceId: MOCK_WORKSPACE_ID,
    encounterId: "encounter-coco-260501",
    guardianId: "guardian-lee-jieun",
    invoiceNo: "INV-260501-0001",
    status: "draft",
    subtotalAmount: 121500,
    discountAmount: 0,
    taxAmount: 0,
    totalAmount: 121500,
    createdAt: "2026-05-01T10:40:00+09:00",
  },
  {
    id: "invoice-dubu-260501",
    workspaceId: MOCK_WORKSPACE_ID,
    encounterId: "encounter-dubu-260501",
    guardianId: "guardian-jung-harin",
    invoiceNo: "INV-260501-0002",
    status: "issued",
    subtotalAmount: 31000,
    discountAmount: 3000,
    taxAmount: 0,
    totalAmount: 28000,
    issuedAt: "2026-05-01T10:28:00+09:00",
    createdAt: "2026-05-01T10:25:00+09:00",
  },
  {
    id: "invoice-nabi-260414",
    workspaceId: MOCK_WORKSPACE_ID,
    encounterId: "encounter-nabi-260414",
    guardianId: "guardian-oh-sea",
    invoiceNo: "INV-260414-0007",
    status: "paid",
    subtotalAmount: 36500,
    discountAmount: 0,
    taxAmount: 0,
    totalAmount: 36500,
    issuedAt: "2026-04-14T11:00:00+09:00",
    createdAt: "2026-04-14T10:58:00+09:00",
  },
];

export const mockInvoiceLines: InvoiceLine[] = [
  {
    id: "invoice-line-coco-consult",
    invoiceId: "invoice-coco-260501",
    serviceItemId: "svc-consult-general",
    description: "일반 진료",
    quantity: 1,
    unitPrice: 22000,
    lineTotal: 22000,
  },
  {
    id: "invoice-line-coco-cbc",
    invoiceId: "invoice-coco-260501",
    serviceItemId: "svc-lab-cbc",
    orderId: "order-coco-cbc",
    description: "CBC 검사",
    quantity: 1,
    unitPrice: 35000,
    lineTotal: 35000,
  },
  {
    id: "invoice-line-coco-fluid",
    invoiceId: "invoice-coco-260501",
    serviceItemId: "svc-treatment-fluid",
    orderId: "order-coco-fluid",
    description: "피하 수액 처치",
    quantity: 1,
    unitPrice: 18000,
    lineTotal: 18000,
  },
  {
    id: "invoice-line-coco-maropitant",
    invoiceId: "invoice-coco-260501",
    serviceItemId: "svc-med-maropitant",
    orderId: "order-coco-maropitant",
    description: "Maropitant 16mg T",
    quantity: 1,
    unitPrice: 4500,
    lineTotal: 4500,
  },
  {
    id: "invoice-line-coco-thorax",
    invoiceId: "invoice-coco-260501",
    serviceItemId: "svc-imaging-thorax",
    orderId: "order-coco-thorax",
    description: "흉부 방사선",
    quantity: 1,
    unitPrice: 42000,
    lineTotal: 42000,
  },
  {
    id: "invoice-line-dubu-consult",
    invoiceId: "invoice-dubu-260501",
    serviceItemId: "svc-consult-general",
    description: "일반 진료",
    quantity: 1,
    unitPrice: 22000,
    lineTotal: 22000,
  },
  {
    id: "invoice-line-dubu-carprofen",
    invoiceId: "invoice-dubu-260501",
    serviceItemId: "svc-med-carprofen",
    orderId: "order-dubu-carprofen",
    description: "Carprofen 25mg T",
    quantity: 3,
    unitPrice: 3000,
    lineTotal: 9000,
  },
];

export const mockPayments: Payment[] = [
  {
    id: "payment-nabi-card",
    invoiceId: "invoice-nabi-260414",
    paymentMethod: "card",
    amount: 36500,
    status: "approved",
    paidAt: "2026-04-14T11:06:00+09:00",
    metadata: { approvalNo: "A2604147781" },
  },
];

export const mockCsHistories: CsHistoryEntry[] = [
  {
    id: "cs-coco-checkin-call",
    workspaceId: MOCK_WORKSPACE_ID,
    guardianId: "guardian-lee-jieun",
    patientId: "patient-coco",
    encounterId: "encounter-coco-260501",
    channel: "phone",
    direction: "inbound",
    status: "completed",
    category: "접수 문의",
    summary: "구토 증상으로 예약 시간보다 먼저 내원 가능한지 문의.",
    handledByUserId: "user-desk-yuna",
    occurredAt: "2026-05-01T09:20:00+09:00",
    createdAt: "2026-05-01T09:22:00+09:00",
  },
  {
    id: "cs-coco-result-followup",
    workspaceId: MOCK_WORKSPACE_ID,
    guardianId: "guardian-lee-jieun",
    patientId: "patient-coco",
    encounterId: "encounter-coco-260501",
    channel: "kakao_alimtalk",
    direction: "outbound",
    status: "needs_follow_up",
    category: "검사 결과 안내",
    summary: "CBC 결과와 복약 안내 발송 예정. 수의사 확인 후 후속 안내 필요.",
    handledByUserId: "user-desk-yuna",
    occurredAt: "2026-05-01T11:05:00+09:00",
    followUpAt: "2026-05-01T15:00:00+09:00",
    createdAt: "2026-05-01T11:05:00+09:00",
  },
  {
    id: "cs-dubu-rehab",
    workspaceId: MOCK_WORKSPACE_ID,
    guardianId: "guardian-kang-seoyun",
    patientId: "patient-dubu",
    encounterId: "encounter-dubu-260501",
    channel: "phone",
    direction: "outbound",
    status: "completed",
    category: "재활 안내",
    summary: "재활 운동 횟수와 계단 제한사항을 보호자에게 안내.",
    handledByUserId: "user-vet-doyun",
    occurredAt: "2026-05-01T10:35:00+09:00",
    createdAt: "2026-05-01T10:35:00+09:00",
  },
];

export const mockLabResults: LabResult[] = [
  {
    id: "lab-result-coco-cbc",
    workspaceId: MOCK_WORKSPACE_ID,
    patientId: "patient-coco",
    encounterId: "encounter-coco-260501",
    orderId: "order-coco-cbc",
    resultName: "CBC 검사",
    status: "entered",
    collectedAt: "2026-05-01T10:42:00+09:00",
    receivedAt: "2026-05-01T10:49:00+09:00",
    enteredAt: "2026-05-01T10:55:00+09:00",
    performedByUserId: "user-tech-hayun",
    rows: [
      {
        id: "lab-row-coco-wbc",
        analyteName: "WBC",
        value: "18.2",
        unit: "K/uL",
        referenceRange: "5.5-19.5",
        judgment: "normal",
      },
      {
        id: "lab-row-coco-hct",
        analyteName: "HCT",
        value: "27",
        unit: "%",
        referenceRange: "30-45",
        judgment: "low",
        note: "경도 저하",
      },
      {
        id: "lab-row-coco-plt",
        analyteName: "PLT",
        value: "620",
        unit: "K/uL",
        referenceRange: "175-500",
        judgment: "high",
      },
    ],
  },
];

export const mockEquipmentReceipts: EquipmentReceipt[] = [
  {
    id: "equipment-coco-cbc-receipt",
    workspaceId: MOCK_WORKSPACE_ID,
    equipmentName: "ProCyte Dx",
    externalResultId: "PCDX-260501-1011",
    status: "matched",
    patientId: "patient-coco",
    encounterId: "encounter-coco-260501",
    orderId: "order-coco-cbc",
    receivedAt: "2026-05-01T10:49:00+09:00",
    payloadSummary: "CBC 18개 항목 수신. 환자/오더 mock 매칭 완료.",
  },
  {
    id: "equipment-unmatched-260501",
    workspaceId: MOCK_WORKSPACE_ID,
    equipmentName: "Catalyst One",
    externalResultId: "CAT-260501-0032",
    status: "unmatched",
    receivedAt: "2026-05-01T11:08:00+09:00",
    payloadSummary: "장비 수신은 되었으나 환자번호가 없어 수동 매칭 필요.",
  },
];

export const mockImagingStudies: ImagingStudy[] = [
  {
    id: "imaging-coco-thorax",
    workspaceId: MOCK_WORKSPACE_ID,
    patientId: "patient-coco",
    encounterId: "encounter-coco-260501",
    orderId: "order-coco-thorax",
    modality: "X-ray",
    bodyPart: "흉복부",
    status: "reading",
    reading: "복부 가스 음영 증가. 명확한 이물 소견은 보이지 않음.",
    impression: "위장관염 가능성. 임상 증상과 CBC 결과 종합 필요.",
    requestedAt: "2026-05-01T10:37:00+09:00",
    capturedAt: "2026-05-01T10:52:00+09:00",
    radiologistUserId: "user-vet-suji",
  },
];

export const mockAttachments: EmrAttachment[] = [
  {
    id: "attachment-coco-cbc-pdf",
    workspaceId: MOCK_WORKSPACE_ID,
    ownerType: "lab_result",
    ownerId: "lab-result-coco-cbc",
    patientId: "patient-coco",
    encounterId: "encounter-coco-260501",
    fileName: "coco-cbc-260501.pdf",
    mimeType: "application/pdf",
    fileSizeBytes: 184320,
    url: "/mock-documents/lab/coco-cbc-260501.pdf",
    uploadedByUserId: "user-tech-hayun",
    uploadedAt: "2026-05-01T10:56:00+09:00",
  },
  {
    id: "attachment-coco-thorax-image",
    workspaceId: MOCK_WORKSPACE_ID,
    ownerType: "imaging_study",
    ownerId: "imaging-coco-thorax",
    patientId: "patient-coco",
    encounterId: "encounter-coco-260501",
    fileName: "coco-thorax-lateral.png",
    mimeType: "image/png",
    fileSizeBytes: 734003,
    url: "/mock-documents/imaging/coco-thorax-lateral.png",
    uploadedByUserId: "user-vet-suji",
    uploadedAt: "2026-05-01T10:53:00+09:00",
  },
];

export const mockMessageTemplates: MessageTemplate[] = [
  {
    id: "template-checkin",
    workspaceId: MOCK_WORKSPACE_ID,
    channel: "kakao_alimtalk",
    messageType: "checkin",
    name: "접수 완료 안내",
    body: "#{patientName} 접수가 완료되었습니다. 대기 순서를 확인해 주세요.",
    providerTemplateCode: "CHECKIN_001",
    isActive: true,
  },
  {
    id: "template-medication-guide",
    workspaceId: MOCK_WORKSPACE_ID,
    channel: "kakao_alimtalk",
    messageType: "medication_guide",
    name: "복약 지도",
    body: "#{patientName} 복약 안내입니다. #{instruction}",
    providerTemplateCode: "MED_GUIDE_001",
    isActive: true,
  },
];

export const mockMessageDeliveries: MessageDelivery[] = [
  {
    id: "message-coco-checkin",
    workspaceId: MOCK_WORKSPACE_ID,
    templateId: "template-checkin",
    guardianId: "guardian-lee-jieun",
    patientId: "patient-coco",
    encounterId: "encounter-coco-260501",
    channel: "kakao_alimtalk",
    recipient: "010-3245-1188",
    bodySnapshot: "코코 접수가 완료되었습니다. 대기 순서를 확인해 주세요.",
    status: "delivered",
    providerMessageId: "alimtalk-260501-0001",
    retryCount: 0,
    sentAt: "2026-05-01T09:51:00+09:00",
    createdAt: "2026-05-01T09:50:00+09:00",
  },
  {
    id: "message-nabi-med-guide",
    workspaceId: MOCK_WORKSPACE_ID,
    templateId: "template-medication-guide",
    guardianId: "guardian-oh-sea",
    patientId: "patient-nabi",
    encounterId: "encounter-nabi-260414",
    channel: "kakao_alimtalk",
    recipient: "010-7812-4401",
    bodySnapshot: "나비 복약 안내입니다. 식후 투약, 구토 시 중단해 주세요.",
    status: "sent",
    providerMessageId: "alimtalk-260414-0007",
    retryCount: 0,
    sentAt: "2026-04-14T11:02:00+09:00",
    createdAt: "2026-04-14T11:00:00+09:00",
  },
];

export const mockAuditLogs: AuditLogEntry[] = [
  {
    id: "audit-coco-checkin",
    workspaceId: MOCK_WORKSPACE_ID,
    actorUserId: "user-desk-yuna",
    action: "status_change",
    entityType: "appointment",
    entityId: "appointment-coco-260501",
    patientId: "patient-coco",
    encounterId: "encounter-coco-260501",
    beforeValue: { status: "confirmed" },
    afterValue: { status: "checked_in" },
    createdAt: "2026-05-01T09:50:00+09:00",
  },
  {
    id: "audit-coco-order-edit",
    workspaceId: MOCK_WORKSPACE_ID,
    actorUserId: "user-vet-suji",
    action: "update",
    entityType: "order",
    entityId: "order-coco-fluid",
    patientId: "patient-coco",
    encounterId: "encounter-coco-260501",
    beforeValue: { instruction: "80ml" },
    afterValue: { instruction: "120ml" },
    reason: "탈수 소견 반영",
    createdAt: "2026-05-01T10:38:00+09:00",
  },
  {
    id: "audit-dubu-invoice-issued",
    workspaceId: MOCK_WORKSPACE_ID,
    actorUserId: "user-billing-harin",
    action: "status_change",
    entityType: "invoice",
    entityId: "invoice-dubu-260501",
    patientId: "patient-dubu",
    encounterId: "encounter-dubu-260501",
    beforeValue: { status: "draft" },
    afterValue: { status: "issued" },
    createdAt: "2026-05-01T10:28:00+09:00",
  },
];

const getLatestByTime = <Item>(
  items: Item[],
  getTime: (item: Item) => string | undefined
) =>
  [...items].sort((a, b) => {
    const aTime = getTime(a) ?? "";
    const bTime = getTime(b) ?? "";

    return bTime.localeCompare(aTime);
  })[0];

export const getMockLatestWorkShortcutsForPatient = (
  patientId: EmrId
): LatestWorkShortcut[] => {
  const patient = mockPatients.find((item) => item.id === patientId);

  if (!patient) return [];

  const encounters = mockEncounters.filter((item) => item.patientId === patientId);
  const encounterIds = new Set(encounters.map((item) => item.id));
  const guardianId = mockPatientGuardians.find(
    (item) => item.patientId === patientId && item.isPrimary
  )?.guardianId;
  const latestEncounter = getLatestByTime(encounters, (item) => item.updatedAt);
  const latestSoap = getLatestByTime(
    mockSoapNotes.filter((item) => encounterIds.has(item.encounterId)),
    (item) => item.updatedAt
  );
  const latestLab = getLatestByTime(
    mockLabResults.filter((item) => item.patientId === patientId),
    (item) => item.reviewedAt ?? item.enteredAt ?? item.receivedAt ?? item.collectedAt
  );
  const latestImaging = getLatestByTime(
    mockImagingStudies.filter((item) => item.patientId === patientId),
    (item) => item.reviewedAt ?? item.readAt ?? item.capturedAt ?? item.requestedAt
  );
  const latestDispensingOrder = getLatestByTime(
    mockOrders.filter(
      (item) => item.orderType === "dispensing" && encounterIds.has(item.encounterId)
    ),
    (item) => item.updatedAt
  );
  const latestInvoice = getLatestByTime(
    mockInvoices.filter((item) => encounterIds.has(item.encounterId)),
    (item) => item.issuedAt ?? item.createdAt
  );

  return [
    {
      id: `latest-chart-${patientId}`,
      workspaceId: MOCK_WORKSPACE_ID,
      patientId,
      guardianId,
      encounterId: latestSoap?.encounterId ?? latestEncounter?.id,
      workType: "chart",
      title: "최근 차트",
      description: latestSoap?.assessment ?? latestEncounter?.chiefComplaint ?? "차트 내역 없음",
      statusLabel: latestSoap?.status,
      occurredAt: latestSoap?.updatedAt ?? latestEncounter?.updatedAt,
      enabled: false,
    },
    {
      id: `latest-lab-${patientId}`,
      workspaceId: MOCK_WORKSPACE_ID,
      patientId,
      guardianId,
      encounterId: latestLab?.encounterId,
      workType: "lab",
      title: "최근 검사",
      description: latestLab?.resultName ?? "검사 내역 없음",
      statusLabel: latestLab?.status,
      occurredAt: latestLab?.reviewedAt ?? latestLab?.enteredAt ?? latestLab?.receivedAt,
      enabled: false,
    },
    {
      id: `latest-imaging-${patientId}`,
      workspaceId: MOCK_WORKSPACE_ID,
      patientId,
      guardianId,
      encounterId: latestImaging?.encounterId,
      workType: "imaging",
      title: "최근 영상",
      description: latestImaging
        ? `${latestImaging.modality} · ${latestImaging.bodyPart}`
        : "영상 내역 없음",
      statusLabel: latestImaging?.status,
      occurredAt: latestImaging?.reviewedAt ?? latestImaging?.readAt ?? latestImaging?.capturedAt,
      enabled: false,
    },
    {
      id: `latest-dispensing-${patientId}`,
      workspaceId: MOCK_WORKSPACE_ID,
      patientId,
      guardianId,
      encounterId: latestDispensingOrder?.encounterId,
      workType: "dispensing",
      title: "최근 조제",
      description: latestDispensingOrder?.displayName ?? "조제 내역 없음",
      statusLabel: latestDispensingOrder?.status,
      occurredAt: latestDispensingOrder?.updatedAt,
      href: latestDispensingOrder ? `/w/${MOCK_WORKSPACE_ID}/dispensing` : undefined,
      enabled: Boolean(latestDispensingOrder),
    },
    {
      id: `latest-billing-${patientId}`,
      workspaceId: MOCK_WORKSPACE_ID,
      patientId,
      guardianId,
      encounterId: latestInvoice?.encounterId,
      workType: "billing",
      title: "최근 수납",
      description: latestInvoice
        ? `${latestInvoice.invoiceNo} · ${latestInvoice.totalAmount.toLocaleString()}원`
        : "수납 내역 없음",
      statusLabel: latestInvoice?.status,
      occurredAt: latestInvoice?.issuedAt ?? latestInvoice?.createdAt,
      enabled: false,
    },
  ];
};

export const getMockPatientBundle = (patientId: EmrId) => {
  const patient = mockPatients.find((item) => item.id === patientId);

  if (!patient) return null;

  const patientGuardians = mockPatientGuardians.filter((item) => item.patientId === patientId);
  const guardianIds = new Set(patientGuardians.map((item) => item.guardianId));
  const guardians = mockGuardians.filter((item) => guardianIds.has(item.id));
  const primaryGuardian = guardians.find((guardian) =>
    patientGuardians.some((link) => link.guardianId === guardian.id && link.isPrimary)
  );
  const appointments = mockAppointments.filter((item) => item.patientId === patientId);
  const encounters = mockEncounters.filter((item) => item.patientId === patientId);
  const encounterIds = new Set(encounters.map((item) => item.id));
  const prescriptions = mockPrescriptions.filter((item) => encounterIds.has(item.encounterId));
  const prescriptionIds = new Set(prescriptions.map((item) => item.id));
  const orders = mockOrders.filter((item) => encounterIds.has(item.encounterId));
  const orderIds = new Set(orders.map((item) => item.id));
  const invoices = mockInvoices.filter((item) => encounterIds.has(item.encounterId));
  const invoiceIds = new Set(invoices.map((item) => item.id));
  const labResults = mockLabResults.filter((item) => item.patientId === patientId);
  const labResultIds = new Set(labResults.map((item) => item.id));
  const imagingStudies = mockImagingStudies.filter((item) => item.patientId === patientId);
  const imagingStudyIds = new Set(imagingStudies.map((item) => item.id));

  return {
    patient,
    patientGuardians,
    guardians,
    primaryGuardian,
    consents: mockConsents.filter((item) => item.patientId === patientId || guardianIds.has(item.guardianId)),
    appointments,
    encounters,
    waitingQueueEntries: mockWaitingQueueEntries.filter((item) => encounterIds.has(item.encounterId)),
    soapNotes: mockSoapNotes.filter((item) => encounterIds.has(item.encounterId)),
    diagnoses: mockDiagnoses.filter((item) => encounterIds.has(item.encounterId)),
    prescriptions,
    prescriptionItems: mockPrescriptionItems.filter((item) => prescriptionIds.has(item.prescriptionId)),
    orderGroups: mockOrderGroups.filter((item) => encounterIds.has(item.encounterId)),
    orders,
    orderAssignments: mockOrderAssignments.filter((item) => orderIds.has(item.orderId)),
    orderEvents: mockOrderEvents.filter((item) => orderIds.has(item.orderId)),
    invoices,
    invoiceLines: mockInvoiceLines.filter((item) => invoiceIds.has(item.invoiceId)),
    payments: mockPayments.filter((item) => invoiceIds.has(item.invoiceId)),
    csHistories: mockCsHistories.filter(
      (item) => item.patientId === patientId || Boolean(item.guardianId && guardianIds.has(item.guardianId))
    ),
    latestWorkShortcuts: getMockLatestWorkShortcutsForPatient(patientId),
    labResults,
    equipmentReceipts: mockEquipmentReceipts.filter(
      (item) =>
        item.patientId === patientId || Boolean(item.encounterId && encounterIds.has(item.encounterId))
    ),
    imagingStudies,
    attachments: mockAttachments.filter(
      (item) =>
        item.patientId === patientId ||
        Boolean(item.encounterId && encounterIds.has(item.encounterId)) ||
        labResultIds.has(item.ownerId) ||
        imagingStudyIds.has(item.ownerId)
    ),
    messageDeliveries: mockMessageDeliveries.filter(
      (item) => item.patientId === patientId || Boolean(item.encounterId && encounterIds.has(item.encounterId))
    ),
    auditLogs: mockAuditLogs.filter(
      (item) => item.patientId === patientId || Boolean(item.encounterId && encounterIds.has(item.encounterId))
    ),
  };
};

export const getMockEncounterBundle = (encounterId: EmrId) => {
  const encounter = mockEncounters.find((item) => item.id === encounterId);

  if (!encounter) return null;

  const patientBundle = getMockPatientBundle(encounter.patientId);
  const prescriptions = mockPrescriptions.filter((item) => item.encounterId === encounterId);
  const prescriptionIds = new Set(prescriptions.map((item) => item.id));
  const orders = mockOrders.filter((item) => item.encounterId === encounterId);
  const orderIds = new Set(orders.map((item) => item.id));
  const invoices = mockInvoices.filter((item) => item.encounterId === encounterId);
  const invoiceIds = new Set(invoices.map((item) => item.id));
  const labResults = mockLabResults.filter((item) => item.encounterId === encounterId);
  const labResultIds = new Set(labResults.map((item) => item.id));
  const imagingStudies = mockImagingStudies.filter((item) => item.encounterId === encounterId);
  const imagingStudyIds = new Set(imagingStudies.map((item) => item.id));

  if (!patientBundle) return null;

  return {
    encounter,
    patient: patientBundle.patient,
    guardians: patientBundle.guardians,
    primaryGuardian: patientBundle.primaryGuardian,
    appointment: encounter.appointmentId
      ? mockAppointments.find((item) => item.id === encounter.appointmentId)
      : undefined,
    waitingQueueEntries: mockWaitingQueueEntries.filter((item) => item.encounterId === encounterId),
    soapNotes: mockSoapNotes.filter((item) => item.encounterId === encounterId),
    diagnoses: mockDiagnoses.filter((item) => item.encounterId === encounterId),
    prescriptions,
    prescriptionItems: mockPrescriptionItems.filter((item) => prescriptionIds.has(item.prescriptionId)),
    orderGroups: mockOrderGroups.filter((item) => item.encounterId === encounterId),
    orders,
    orderAssignments: mockOrderAssignments.filter((item) => orderIds.has(item.orderId)),
    orderEvents: mockOrderEvents.filter((item) => orderIds.has(item.orderId)),
    invoices,
    invoiceLines: mockInvoiceLines.filter((item) => invoiceIds.has(item.invoiceId)),
    payments: mockPayments.filter((item) => invoiceIds.has(item.invoiceId)),
    csHistories: mockCsHistories.filter((item) => item.encounterId === encounterId),
    labResults,
    equipmentReceipts: mockEquipmentReceipts.filter((item) => item.encounterId === encounterId),
    imagingStudies,
    attachments: mockAttachments.filter(
      (item) =>
        item.encounterId === encounterId ||
        labResultIds.has(item.ownerId) ||
        imagingStudyIds.has(item.ownerId)
    ),
    messageDeliveries: mockMessageDeliveries.filter((item) => item.encounterId === encounterId),
    auditLogs: mockAuditLogs.filter((item) => item.encounterId === encounterId),
  };
};

export const getMockGuardianBundle = (guardianId: EmrId) => {
  const guardian = mockGuardians.find((item) => item.id === guardianId);

  if (!guardian) return null;

  const patientGuardians = mockPatientGuardians.filter((item) => item.guardianId === guardianId);
  const patientIds = new Set(patientGuardians.map((item) => item.patientId));
  const patients = mockPatients.filter((item) => patientIds.has(item.id));
  const encounters = mockEncounters.filter((item) => patientIds.has(item.patientId));
  const encounterIds = new Set(encounters.map((item) => item.id));
  const invoices = mockInvoices.filter(
    (item) => item.guardianId === guardianId || encounterIds.has(item.encounterId)
  );
  const invoiceIds = new Set(invoices.map((item) => item.id));

  return {
    guardian,
    patientGuardians,
    patients,
    consents: mockConsents.filter(
      (item) => item.guardianId === guardianId || Boolean(item.patientId && patientIds.has(item.patientId))
    ),
    appointments: mockAppointments.filter(
      (item) => item.guardianId === guardianId || patientIds.has(item.patientId)
    ),
    encounters,
    invoices,
    invoiceLines: mockInvoiceLines.filter((item) => invoiceIds.has(item.invoiceId)),
    payments: mockPayments.filter((item) => invoiceIds.has(item.invoiceId)),
    csHistories: mockCsHistories.filter(
      (item) => item.guardianId === guardianId || Boolean(item.patientId && patientIds.has(item.patientId))
    ),
    messageDeliveries: mockMessageDeliveries.filter(
      (item) => item.guardianId === guardianId || Boolean(item.patientId && patientIds.has(item.patientId))
    ),
    latestWorkShortcuts: patients.flatMap((patientItem) =>
      getMockLatestWorkShortcutsForPatient(patientItem.id)
    ),
    auditLogs: mockAuditLogs.filter(
      (item) => Boolean(item.patientId && patientIds.has(item.patientId)) || invoiceIds.has(item.entityId)
    ),
  };
};

export const getMockBillingGroupsByGuardian = () =>
  mockGuardians
    .map((guardian) => {
      const invoices = mockInvoices.filter((invoice) => invoice.guardianId === guardian.id);
      const invoiceIds = new Set(invoices.map((invoice) => invoice.id));
      const encounterIds = new Set(invoices.map((invoice) => invoice.encounterId));
      const patientIds = new Set(
        mockEncounters
          .filter((encounter) => encounterIds.has(encounter.id))
          .map((encounter) => encounter.patientId)
      );

      return {
        guardian,
        patients: mockPatients.filter((patient) => patientIds.has(patient.id)),
        invoices,
        invoiceLines: mockInvoiceLines.filter((line) => invoiceIds.has(line.invoiceId)),
        payments: mockPayments.filter((payment) => invoiceIds.has(payment.invoiceId)),
        totalDueAmount: invoices
          .filter((invoice) => invoice.status !== "paid" && invoice.status !== "refunded" && invoice.status !== "voided")
          .reduce((total, invoice) => total + invoice.totalAmount, 0),
      };
    })
    .filter((group) => group.invoices.length > 0);
