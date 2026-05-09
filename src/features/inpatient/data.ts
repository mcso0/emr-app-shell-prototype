export type InpatientStatus = "admitted" | "critical" | "discharge_ready";
export type InpatientWardGroup = "dog" | "cat" | "icu";
export type InpatientFilter = "all" | InpatientWardGroup;
export type InpatientSearchField = "all" | "patient" | "guardian" | "room";

export type InpatientCautionTag = {
  label: string;
  tone: "care" | "danger" | "notice" | "purple";
};

export type InpatientAdmission = {
  id: string;
  room: string;
  patientName: string;
  patientNo: string;
  speciesLabel: string;
  breed: string;
  guardianName: string;
  chartAvailable: boolean;
  cautions: InpatientCautionTag[];
  diagnosis: string;
  admissionMemo: string;
  admittedAt: string;
  stayDayLabel: string;
  department: string;
  attendingVet: string;
  doctor: string;
  primaryNurse: string;
  secondaryNurse: string;
  status: InpatientStatus;
  wardGroup: InpatientWardGroup;
  carePoint: string;
  dischargeChecklist: Array<{
    id: string;
    label: string;
    done: boolean;
  }>;
};

export const inpatientFilterItems: Array<{ label: string; value: InpatientFilter }> = [
  { label: "전체", value: "all" },
  { label: "강아지", value: "dog" },
  { label: "고양이", value: "cat" },
  { label: "집중 치료실", value: "icu" },
];

export const inpatientSearchFieldItems: Array<{ label: string; value: InpatientSearchField }> = [
  { label: "전체", value: "all" },
  { label: "동물명", value: "patient" },
  { label: "보호자명", value: "guardian" },
  { label: "입원실", value: "room" },
];

export const inpatientWardGroups: Array<{ id: InpatientWardGroup; label: string }> = [
  { id: "dog", label: "강아지 입원실" },
  { id: "cat", label: "고양이 입원실" },
  { id: "icu", label: "집중 치료실" },
];

export const mockInpatientAdmissions: InpatientAdmission[] = [
  {
    id: "adm-kong-icu",
    room: "ICU-01",
    patientName: "콩이",
    patientNo: "P-260501-0003",
    speciesLabel: "강아지",
    breed: "푸들",
    guardianName: "김하늘",
    chartAvailable: true,
    cautions: [
      { label: "수액", tone: "care" },
      { label: "구토관찰", tone: "notice" },
      { label: "면회제한", tone: "purple" },
    ],
    diagnosis: "급성 위장관염 의심",
    admissionMemo: "탈수 여부와 구토 횟수 재평가. 식욕 회복 전까지 소량 급여.",
    admittedAt: "26.05.06 09:20",
    stayDayLabel: "1일차",
    department: "내과",
    attendingVet: "이수지",
    doctor: "이수지",
    primaryNurse: "송하윤",
    secondaryNurse: "정민재",
    status: "critical",
    wardGroup: "icu",
    carePoint: "오전 수액 반응과 구토 횟수를 확인하고 오후 회진 전 보호자에게 중간 안내한다.",
    dischargeChecklist: [
      { id: "vet-approval", label: "주치의 퇴실 승인", done: false },
      { id: "guardian-guide", label: "보호자 투약/식이 안내", done: false },
      { id: "billing-handoff", label: "수납 인계", done: false },
    ],
  },
  {
    id: "adm-dubu-203",
    room: "203호",
    patientName: "두부",
    patientNo: "P-260501-0002",
    speciesLabel: "강아지",
    breed: "포메라니안",
    guardianName: "정하린",
    chartAvailable: true,
    cautions: [
      { label: "재활주의", tone: "purple" },
      { label: "보행관찰", tone: "care" },
    ],
    diagnosis: "슬개골 수술 후 회복",
    admissionMemo: "보행 영상 확인 후 퇴실 안내. 점프 제한 설명 필요.",
    admittedAt: "26.05.04 14:10",
    stayDayLabel: "3일차",
    department: "정형외과",
    attendingVet: "김도윤",
    doctor: "김도윤",
    primaryNurse: "송하윤",
    secondaryNurse: "박서연",
    status: "discharge_ready",
    wardGroup: "dog",
    carePoint: "퇴실 전 보행 영상을 보호자에게 공유하고 재활 내원 일정을 잡는다.",
    dischargeChecklist: [
      { id: "vet-approval", label: "주치의 퇴실 승인", done: true },
      { id: "guardian-guide", label: "보호자 재활 안내", done: true },
      { id: "billing-handoff", label: "수납 인계", done: false },
    ],
  },
  {
    id: "adm-coco-201",
    room: "201호",
    patientName: "코코",
    patientNo: "P-260414-0008",
    speciesLabel: "고양이",
    breed: "코리안숏헤어",
    guardianName: "이지은",
    chartAvailable: true,
    cautions: [
      { label: "산소", tone: "danger" },
      { label: "금식", tone: "notice" },
      { label: "면회금지", tone: "purple" },
    ],
    diagnosis: "구토와 식욕저하",
    admissionMemo: "예민함. 채혈 시 보호자 동석 여부 확인.",
    admittedAt: "26.05.05 10:30",
    stayDayLabel: "2일차",
    department: "내과",
    attendingVet: "이수지",
    doctor: "이수지",
    primaryNurse: "송하윤",
    secondaryNurse: "최하린",
    status: "admitted",
    wardGroup: "cat",
    carePoint: "식욕 회복과 산소 케이지 반응을 관찰한다.",
    dischargeChecklist: [
      { id: "vet-approval", label: "주치의 퇴실 승인", done: false },
      { id: "guardian-guide", label: "보호자 안내", done: false },
      { id: "billing-handoff", label: "수납 인계", done: false },
    ],
  },
  {
    id: "adm-nabi-202",
    room: "202호",
    patientName: "나비",
    patientNo: "P-260414-0009",
    speciesLabel: "고양이",
    breed: "러시안블루",
    guardianName: "오세아",
    chartAvailable: true,
    cautions: [
      { label: "피부", tone: "care" },
      { label: "투약확인", tone: "notice" },
    ],
    diagnosis: "피부 알러지 재발",
    admissionMemo: "저녁 투약 후 피부 발적 변화 확인.",
    admittedAt: "26.05.05 15:40",
    stayDayLabel: "2일차",
    department: "피부과",
    attendingVet: "김도윤",
    doctor: "김도윤",
    primaryNurse: "정민재",
    secondaryNurse: "송하윤",
    status: "admitted",
    wardGroup: "cat",
    carePoint: "투약 이후 긁는 행동 감소 여부를 기록한다.",
    dischargeChecklist: [
      { id: "vet-approval", label: "주치의 퇴실 승인", done: false },
      { id: "guardian-guide", label: "보호자 안내", done: false },
      { id: "billing-handoff", label: "수납 인계", done: false },
    ],
  },
  {
    id: "adm-haru-204",
    room: "204호",
    patientName: "하루",
    patientNo: "P-260501-0001",
    speciesLabel: "강아지",
    breed: "말티즈",
    guardianName: "강서윤",
    chartAvailable: false,
    cautions: [
      { label: "체온관찰", tone: "care" },
    ],
    diagnosis: "예방접종 후 경과 관찰",
    admissionMemo: "발열 없으면 오후 퇴실 가능.",
    admittedAt: "26.05.06 11:10",
    stayDayLabel: "1일차",
    department: "예방의학",
    attendingVet: "이수지",
    doctor: "박서연",
    primaryNurse: "최하린",
    secondaryNurse: "송하윤",
    status: "discharge_ready",
    wardGroup: "dog",
    carePoint: "오후 체온 재측정 후 퇴실 가능 여부를 확정한다.",
    dischargeChecklist: [
      { id: "vet-approval", label: "주치의 퇴실 승인", done: true },
      { id: "guardian-guide", label: "보호자 안내", done: false },
      { id: "billing-handoff", label: "수납 인계", done: false },
    ],
  },
];

export const getInpatientAdmission = (admissionId: string) =>
  mockInpatientAdmissions.find((admission) => admission.id === admissionId) ??
  mockInpatientAdmissions[0];

export const getFilteredInpatientAdmissions = ({
  filter,
  searchField,
  searchQuery,
}: {
  filter: InpatientFilter;
  searchField: InpatientSearchField;
  searchQuery: string;
}) => {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  return mockInpatientAdmissions.filter((admission) => {
    const matchesFilter = filter === "all" || admission.wardGroup === filter;

    if (!matchesFilter) return false;
    if (!normalizedQuery) return true;

    const valuesByField: Record<InpatientSearchField, string[]> = {
      all: [
        admission.patientName,
        admission.guardianName,
        admission.room,
        admission.breed,
        admission.diagnosis,
      ],
      patient: [admission.patientName, admission.patientNo],
      guardian: [admission.guardianName],
      room: [admission.room],
    };

    return valuesByField[searchField].some((value) =>
      value.toLowerCase().includes(normalizedQuery)
    );
  });
};

export const getInpatientCounts = () => ({
  all: mockInpatientAdmissions.length,
  dog: mockInpatientAdmissions.filter((admission) => admission.wardGroup === "dog").length,
  cat: mockInpatientAdmissions.filter((admission) => admission.wardGroup === "cat").length,
  icu: mockInpatientAdmissions.filter((admission) => admission.wardGroup === "icu").length,
  admitted: mockInpatientAdmissions.filter((admission) => admission.status === "admitted").length,
  critical: mockInpatientAdmissions.filter((admission) => admission.status === "critical").length,
  discharge_ready: mockInpatientAdmissions.filter((admission) => admission.status === "discharge_ready").length,
  cautionTags: mockInpatientAdmissions.reduce(
    (total, admission) => total + admission.cautions.length,
    0
  ),
  todayAdmissions: mockInpatientAdmissions.filter((admission) =>
    admission.admittedAt.startsWith("26.05.06")
  ).length,
});

export const getInpatientStatusLabel = (status: InpatientStatus) => {
  if (status === "critical") return "집중관리";
  if (status === "discharge_ready") return "퇴실준비";

  return "입원중";
};
