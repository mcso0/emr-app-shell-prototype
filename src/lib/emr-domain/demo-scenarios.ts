import type { EmrId } from "@/types/emr-domain";

export type DemoScenarioId = "kong-vomit" | "nabi-recheck" | "dubu-post-op";

export type DemoScenario = {
  id: DemoScenarioId;
  title: string;
  subtitle: string;
  description: string;
  guardianId: EmrId;
  patientId: EmrId;
  appointmentId?: EmrId;
  encounterId: EmrId;
  labResultId?: EmrId;
  imagingStudyId?: EmrId;
  invoiceId: EmrId;
  orderIds: EmrId[];
};

export const demoScenarios: DemoScenario[] = [
  {
    id: "kong-vomit",
    title: "콩이 구토 내원",
    subtitle: "김하늘 보호자 · 푸들 · 반복 구토",
    description:
      "첫 내원 환자가 접수부터 SOAP, 검사/영상, 조제/처치, 수납까지 하나의 encounter로 이어지는 7분 세일즈 데모 spine.",
    guardianId: "guardian-kim-haneul",
    patientId: "patient-kong",
    appointmentId: "appointment-kong-260501",
    encounterId: "encounter-kong-260501",
    labResultId: "lab-result-kong-cbc",
    imagingStudyId: "imaging-kong-abdomen",
    invoiceId: "invoice-kong-260501",
    orderIds: ["order-kong-maropitant", "order-kong-cbc", "order-kong-fluid", "order-kong-abdomen"],
  },
  {
    id: "nabi-recheck",
    title: "나비 피부 재진",
    subtitle: "오세아 보호자 · 러시안블루 · 과거 이력 확인",
    description: "재진 환자의 과거 SOAP와 완료된 수납 이력을 설명하기 위한 보조 데모 케이스.",
    guardianId: "guardian-oh-sea",
    patientId: "patient-nabi",
    appointmentId: "appointment-nabi-260501",
    encounterId: "encounter-nabi-260414",
    invoiceId: "invoice-nabi-260414",
    orderIds: [],
  },
  {
    id: "dubu-post-op",
    title: "두부 수술 후 재활",
    subtitle: "정하린 보호자 · 포메라니안 · 미납/재활 상담",
    description: "재진, 처방, 미납 상태를 함께 보여주는 보조 데모 케이스.",
    guardianId: "guardian-jung-harin",
    patientId: "patient-dubu",
    encounterId: "encounter-dubu-260501",
    invoiceId: "invoice-dubu-260501",
    orderIds: ["order-dubu-carprofen"],
  },
];

export const getDemoScenario = (scenarioId?: string | null) =>
  demoScenarios.find((scenario) => scenario.id === scenarioId);

export const getDemoScenarioFromParams = (params: { get: (name: string) => string | null }) =>
  getDemoScenario(params.get("scenario"));
