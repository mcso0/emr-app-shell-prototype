import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useEffect, useRef, useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { Button } from "@/components/ui/button";
import { EmrProfilePanelLoading } from "@/components/emr/profile-panel";
import styles from "./profile-side-panel.module.css";

import {
  ProfileSidePanel,
  ProfileBasicInformation,
  type ProfileSidePanelModel,
  type ProfileSidePanelTab,
  type ProfileTabState,
} from "./profile-side-panel";

const reservationRows = [
  ["reservation-1", "2024-07-24T16:30:00+09:00", "7월 24일 4시 30분 · 예약"],
  ["reservation-2", "2024-07-26T12:30:00+09:00", "7월 26일 12시 30분 · 예약"],
  ["reservation-3", "2024-07-30T20:30:00+09:00", "7월 30일 8시 30분 · 예약"],
] as const;

const historyRows = Array.from({ length: 4 }, (_, index) => ({
  clinicianLabel: "정민재",
  dateAt: `2024-07-${String(24 - index).padStart(2, "0")}T16:30:00+09:00`,
  id: `history-${index + 1}`,
  kindLabel: "외래",
  patientId: "patient-choco",
  patientName: "초코",
  requestedAtLabel: "88:88 이수지 요청",
  statusLabel: "대기중",
  subjectLabel: "Order.name",
  title: "초코 · 한서연",
}));

const billingRows = Array.from({ length: 8 }, (_, index) => ({
  ...historyRows[index % historyRows.length],
  amountLabel: `${(88_000 + index * 1_000).toLocaleString("ko-KR")}원`,
  dateAt: `2024-07-${String(24 - index).padStart(2, "0")}T16:30:00+09:00`,
  id: `billing-${index + 1}`,
  paymentLabel: index % 2 ? "카드 89,000원 승인" : "결제 전",
  statusLabel: index % 2 ? "수납완료" : "미수납",
  subjectLabel: `INV-2407-${String(index + 1).padStart(4, "0")} · Order.name`,
}));

const patientModel: ProfileSidePanelModel = {
  avatarAlt: "초코 환자 프로필",
  avatarSrc: "/avatars/figma-patient-profile.jpg",
  billing: billingRows,
  history: historyRows,
  infoHeading: "환자 정보",
  infoRows: [
    { icon: "pet", label: "환자명", value: "초코" },
    { icon: "paw-print", label: "종류/품종", value: "개/포메라니안" },
    { icon: "user", label: "성별", value: "중성화 암컷" },
    { icon: "clock", label: "나이", value: "88년 88개월(추정)" },
    { icon: "calendar", label: "생년월일", value: "8888년 88월 88일(추정)" },
    { icon: "scan-line", label: "마이크로칩", value: "888888888888888" },
    { icon: "file-user", label: "동물등록번호", value: "888888888" },
    {
      icon: "notebook-text",
      label: "환자 메모",
      value: (
        <>
          환자메모가 들어가는 영역입니다.
          <br />
          환자메모가 들어가는 영역입니다.
        </>
      ),
    },
  ],
  kind: "patient",
  meta: ["개", "포메라니안", "8세", "중성화 수컷"],
  name: "초코",
  relatedGroups: [
    {
      id: "guardians",
      items: [
        {
          badge: "주",
          badgeTone: "primary",
          id: "guardian-1",
          imageSrc: "/avatars/figma-guardian-glyph.svg",
          meta: "010-8888-8888",
          name: "이승욱",
        },
        {
          badge: "추가",
          id: "guardian-2",
          imageSrc: "/avatars/figma-guardian-glyph.svg",
          meta: "010-8888-8888",
          name: "최주호",
        },
      ],
      title: "등록된 보호자",
    },
  ],
  reservationMonth: "2024-07",
  reservations: reservationRows.map(([id, scheduledAt, title]) => ({
    description: "예약 메모가 들어가는 영역입니다.",
    id,
    scheduledAt,
    title,
  })),
  today: {
    description: "예약 메모가 들어가는 영역입니다.",
    id: "today",
    title: "오늘 4시 30분 · 예약",
  },
  upcoming: {
    description: "예약 메모가 들어가는 영역입니다.",
    id: "upcoming",
    title: "7월 24일 4시 30분 · 예약",
  },
};

const guardianPatients = [
  {
    id: "patient-choco",
    imageSrc: "/avatars/figma-patient-glyph.svg",
    meta: "개 · 말티즈 · 12살 6개월 · 중성화암컷",
    name: "초코",
  },
  {
    id: "patient-coco",
    imageSrc: "/avatars/figma-patient-glyph.svg",
    meta: "개 · 말티즈 · 12살 6개월 · 중성화암컷",
    name: "코코",
  },
];

const guardianModel: ProfileSidePanelModel = {
  ...patientModel,
  avatarAlt: "한서연 보호자 프로필",
  avatarSrc: "/avatars/figma-guardian-profile.png",
  infoHeading: "보호자 정보",
  infoRows: [
    { icon: "user", label: "보호자명", value: "한서연" },
    { icon: "calendar", label: "생년월일", value: "1988-88-88" },
    { icon: "phone", label: "전화번호", value: "010-8888-8888" },
    { icon: "mail", label: "이메일", value: "userEmail@email.com" },
    {
      icon: "map-pin",
      label: "주소",
      value: (
        <>
          북천시 찻마루로-999
          <br />
          미리내아파트 999동 999호
        </>
      ),
    },
    {
      icon: "notebook-text",
      label: "보호자메모",
      value: (
        <>
          보호자 메모가 들어가는 영역입니다.
          <br />
          보호자 메모가 들어가는 영역입니다.
        </>
      ),
    },
  ],
  kind: "guardian",
  meta: ["1999.99.99", "010-8888-8888"],
  name: "한서연",
  relatedGroups: [
    {
      accentPrefix: "주 보호자",
      // The supplied Figma fixture shows badge "1" while rendering two cards.
      // Keep that source inconsistency isolated to the pixel-reference story.
      badgeCount: 1,
      id: "primary-patients",
      items: guardianPatients,
      title: "로 등록된 환자",
    },
    {
      id: "additional-patients",
      items: [
        {
          id: "patient-cloud",
          imageSrc: "/avatars/figma-patient-glyph.svg",
          meta: "개 · 말티즈 · 12살 6개월 · 중성화암컷",
          name: "구름",
        },
      ],
      title: "추가 보호자로 등록된 환자",
    },
  ],
  reservations: reservationRows.map(([id, scheduledAt, title], index) => ({
    description: "예약 메모가 들어가는 영역입니다.",
    id,
    patientId: guardianPatients[index % guardianPatients.length]?.id,
    patientName: ["초코", "코코", "구름"][index],
    scheduledAt,
    title: `${["초코", "코코", "구름"][index]} · ${title}`,
  })),
  today: {
    description: "예약 메모가 들어가는 영역입니다.",
    id: "today",
    title: "초코 · 오늘 4시 30분 · 예약",
  },
  upcoming: {
    description: "예약 메모가 들어가는 영역입니다.",
    id: "upcoming",
    title: "초코 · 7월 24일 4시 30분 · 예약",
  },
};

function Specimen({
  defaultTab,
  model,
  onRetryToday,
}: {
  onRetryToday?: () => void;
  defaultTab: ProfileSidePanelTab;
  model: ProfileSidePanelModel;
}) {
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(true);
  const [currentModel, setCurrentModel] = useState(model);

  return (
    <div style={{ height: 1105, width: 380 }}>
      {open ? <ProfileSidePanel
        defaultTab={defaultTab}
        model={currentModel}
        onRetryToday={() => { onRetryToday?.(); setCurrentModel(current => ({ ...current, todayItems, todayState: { status: "ready" } })); setMessage("today-retry"); }}
        onClose={() => { setMessage("닫힘"); setOpen(false); }}
        onHeaderAction={(action) => setMessage(action)}
        onOpenRelated={(item) => setMessage(item.id)}
        onLoadSection={(section, filter, append) => setMessage(JSON.stringify({ section, filter, append: Boolean(append) }))}
        onTabChange={tab => setMessage(`tab:${tab}`)}
      /> : <Button onClick={() => setOpen(true)}>합성 프로필 다시 열기</Button>}
      <output className="sr-only" aria-label="합성 프로필 작업" aria-live="polite">{message}</output>
    </div>
  );
}

const meta = {
  title: "Features/Customer/Patient Guardian Profile Side Panel",
  parameters: {
    layout: "fullscreen",
    docs: { story: { inline: false, height: "1150px" },
      description: {
        component:
          "환자와 보호자의 정보, 예약, 이력, 수납 내용을 확인합니다. 기능 소유 코드는 features/reception/profile-side-panel.tsx이며 공통 EmrProfilePanel 틀을 사용합니다. Customer는 제품 기준 분류입니다. Specimen과 patientModel, guardianModel은 제공된 Figma의 합성 표시 설정입니다. 예약·이력·수납 필터는 실제 컴포넌트가 관리합니다. 탭·기간 조회, 연결 대상, 접수·예약 요청은 로컬 output에 기록하고 닫기는 패널을 닫습니다. 오늘 오류 재시도는 합성 일정으로 복구합니다. 실제 프로필 편집·조회·접수 폼·결제·권한은 ProfileDrawer 호출 기능의 책임입니다.",
      },
    },
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const PatientInformation: Story = {
  parameters: { docs: { description: { story: "합성 환자의 기본 정보와 연결 보호자를 확인합니다." } } },
  render: () => <Specimen defaultTab="info" model={patientModel} />,
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole("button", { name: "카카오톡 발송" })).toBeDisabled();
    const body = within(canvasElement.ownerDocument.body);
    for (const [label, value] of [["접수하기", "walk-in"], ["예약하기", "reservation"]]) {
      await userEvent.click(canvas.getByRole("button", { name: "접수/예약" }));
      await userEvent.click(await body.findByRole("menuitem", { name: label }));
      await expect(canvas.getByLabelText("합성 프로필 작업")).toHaveTextContent(value);
      await waitFor(() => expect(body.queryByRole("menu")).not.toBeInTheDocument());
    }
    await userEvent.click(canvas.getByRole("button", { name: "보호자 이승욱 보기" }));
    await expect(canvas.getByLabelText("합성 프로필 작업")).toHaveTextContent("guardian-1");
    await userEvent.click(canvas.getByRole("button", { name: "상세 닫기" }));
    await expect(canvas.queryByTestId("profile-side-panel")).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "합성 프로필 다시 열기" }));
    await expect(canvas.getByTestId("profile-side-panel")).toBeVisible();
  },
};

export const GuardianInformation: Story = {
  parameters: { docs: { description: { story: "합성 보호자의 기본 정보와 연결 환자를 확인합니다." } } },
  render: () => <Specimen defaultTab="info" model={guardianModel} />,
  play: async ({ canvas }) => { await expect(canvas.getByRole("button", { name: "카카오톡 발송" })).toBeDisabled(); await expect(canvas.queryByRole("button", { name: "접수/예약" })).not.toBeInTheDocument(); await userEvent.click(canvas.getByRole("button", { name: "환자 코코 보기" })); await expect(canvas.getByLabelText("합성 프로필 작업")).toHaveTextContent("patient-coco"); },
};

export const PatientReservations: Story = {
  parameters: { docs: { description: { story: "환자 예약 목록이 있는 상태를 확인합니다." } } },
  render: () => <Specimen defaultTab="reservations" model={patientModel} />,
};

export const GuardianReservations: Story = {
  parameters: { docs: { description: { story: "보호자에 연결된 환자의 예약 목록을 확인합니다." } } },
  render: () => <Specimen defaultTab="reservations" model={guardianModel} />,
};

export const PatientHistory: Story = {
  parameters: { docs: { description: { story: "환자 진료 이력 목록을 확인합니다." } } },
  render: () => <Specimen defaultTab="history" model={patientModel} />,
};

export const GuardianHistory: Story = {
  parameters: { docs: { description: { story: "보호자에 연결된 환자의 이력을 확인합니다." } } },
  render: () => <Specimen defaultTab="history" model={guardianModel} />,
};

export const PatientBilling: Story = {
  parameters: { docs: { description: { story: "환자 수납 내역의 표시를 확인합니다. 실제 결제는 수행하지 않습니다." } } },
  render: () => <Specimen defaultTab="billing" model={patientModel} />,
};

export const GuardianBilling: Story = {
  parameters: { docs: { description: { story: "보호자의 수납 내역 표시를 확인합니다. 실제 결제는 수행하지 않습니다." } } },
  render: () => <Specimen defaultTab="billing" model={guardianModel} />,
};

export const PatientReservationsEmpty: Story = {
  parameters: { docs: { description: { story: "환자 예약이 없을 때의 안내를 확인합니다." } } },
  render: () => <Specimen defaultTab="reservations" model={{ ...patientModel, reservations: [] }} />,
};

export const PatientHistoryEmpty: Story = {
  parameters: { docs: { description: { story: "환자 이력이 없을 때의 안내를 확인합니다." } } },
  render: () => <Specimen defaultTab="history" model={{ ...patientModel, history: [] }} />,
};

export const PatientBillingEmpty: Story = {
  parameters: { docs: { description: { story: "환자 수납 내역이 없을 때의 안내를 확인합니다." } } },
  render: () => <Specimen defaultTab="billing" model={{ ...patientModel, billing: [] }} />,
};

const todayItems: NonNullable<ProfileSidePanelModel["todayItems"]> = [
  { id: "today-consulting", patientId: "patient-choco", patientName: "예시 환자 초코", scheduledAt: "2026-10-04T09:00:00+09:00", status: "consulting", title: "진료중", description: "진료 목적을 확인합니다." },
  { id: "today-waiting", patientId: "patient-coco", patientName: "긴 이름의 예시 환자 코코", scheduledAt: "2026-10-04T10:00:00+09:00", status: "waiting", title: "진료 대기", description: "정기 검진과 예방접종 상담을 위해 방문합니다. 지난 방문 이후 식욕과 활동량의 변화를 함께 확인하고, 보호자가 가져온 기록을 검토할 예정입니다. 화면 검증용 가상 메모입니다." },
  { id: "today-billing", patientId: "patient-choco", patientName: "예시 환자 초코", scheduledAt: "2026-10-04T11:00:00+09:00", status: "billing", title: "수납대기", description: "진료를 마친 뒤 수납을 기다립니다." },
  { id: "today-reservation", patientId: "patient-coco", patientName: "예시 환자 코코", scheduledAt: "2026-10-04T16:30:00+09:00", status: "reservation", title: "오늘 16시 30분 · 예약", description: "예약 메모입니다." },
];

export const TodayPatientStates: Story = {
  parameters: { docs: { description: { story: "글꼴 로딩이 완료된 뒤 환자의 오늘 접수와 예약 상태 및 긴 내용의 펼침·접힘을 확인합니다. 초기 글꼴 로딩 중 빠른 펼침에서 토글이 사라지는 main의 측정 경합은 이 안정 상태 검증과 별개입니다." } } },
  render: () => <Specimen defaultTab="info" model={{ ...patientModel, todayItems }} />,
  play: async ({ canvas }) => {
    await document.fonts.ready;
    await expect(canvas.getByText("수납대기", { exact: true })).toBeVisible();
    const more = await canvas.findByRole("button", { name: "더보기" });
    const icon = canvas.getAllByTestId("profile-today-icon")[1];
    const initial = icon.getBoundingClientRect().top;
    more.focus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(canvas.getByRole("button", { name: "접기" })).toHaveAttribute("aria-expanded", "true"));
    await expect(icon.getBoundingClientRect().top).toBe(initial);
    await userEvent.click(canvas.getByRole("button", { name: "접기" }));
    await waitFor(() => expect(canvas.getByRole("button", { name: "더보기" })).toHaveAttribute("aria-expanded", "false"));
  },
};

export const TodayGuardianStates: Story = {
  parameters: { docs: { description: { story: "보호자와 연결된 환자의 오늘 접수와 예약 상태를 확인합니다." } } },
  render: () => <Specimen defaultTab="info" model={{ ...guardianModel, todayItems }} />,
  play: async ({ canvas }) => {
    await document.fonts.ready;
    await expect(canvas.getByText("긴 이름의 예시 환자 코코 ·", { exact: false })).toBeVisible();
    const more = await canvas.findByRole("button", { name: "더보기" });
    const icon = canvas.getAllByTestId("profile-today-icon")[1];
    const initial = icon.getBoundingClientRect().top;
    await userEvent.click(more);
    await expect(icon.getBoundingClientRect().top).toBe(initial);
  },
};

export const TodayEmpty: Story = {
  parameters: { docs: { description: { story: "오늘 접수나 예약이 없을 때의 안내를 확인합니다." } } },
  render: () => <Specimen defaultTab="info" model={{ ...patientModel, todayItems: [] }} />,
  play: async ({ canvas }) => { await expect(canvas.getByText("접수/예약 일정이 없습니다")).toBeVisible(); },
};
export const TodayLoading: Story = {
  parameters: { docs: { description: { story: "오늘 접수와 예약을 불러오는 동안 기본 정보를 유지하는지 확인합니다." } } },
  render: () => <Specimen defaultTab="info" model={{ ...patientModel, todayItems: [], todayState: { status: "loading" } }} />,
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByText("오늘 접수/예약을 불러오는 중입니다")).toBeInTheDocument();
    await expect(canvasElement.querySelector('[skullet-loading]')).toHaveAttribute("aria-hidden", "true");
    await expect(canvas.getByText("환자명", { exact: true })).toBeVisible();
  },
};
export const TodayDenied: Story = {
  parameters: { docs: { description: { story: "조회 권한이 없을 때 다시 시도 버튼 없이 안내하는지 확인합니다." } } },
  render: () => <Specimen defaultTab="info" model={{ ...guardianModel, todayItems: [], todayState: { status: "denied" } }} />,
  play: async ({ canvas }) => { await expect(canvas.getByText("오늘 접수/예약을 볼 권한이 없습니다")).toBeVisible(); await expect(canvas.queryByRole("button", { name: "다시 시도" })).not.toBeInTheDocument(); },
};
const retryToday = fn();
export const TodayError: Story = {
  parameters: { docs: { description: { story: "오늘 접수와 예약 조회 오류 및 합성 다시 시도 콜백을 확인합니다." } } },
  beforeEach: () => { retryToday.mockClear(); },
  render: () => <Specimen defaultTab="info" model={{ ...patientModel, todayItems: [], todayState: { status: "error" } }} onRetryToday={retryToday} />,
  play: async ({ canvas }) => {
    const button = canvas.getByRole("button", { name: "다시 시도" });
    await expect(button.getBoundingClientRect().height).toBe(24);
    await expect(button.querySelector('svg[data-icon="inline-start"]')).not.toBeNull();
    await userEvent.click(button);
    await expect(retryToday).toHaveBeenCalledTimes(1);
    await expect(canvas.queryByRole("button", { name: "다시 시도" })).not.toBeInTheDocument();
    await expect(canvas.getByText("수납대기", { exact: true })).toBeVisible();
  },
};


function LoadingComparison() {
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<"patient" | "guardian">("patient");
  const [long, setLong] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const original = kind === "patient" ? patientModel : guardianModel;
  const model = { ...original, infoRows: original.infoRows.map((row, index) =>
    index === 0 && long ? { ...row, value: "아주 긴 이름을 가진 가상 프로필 예시입니다" } : row) };
  const replay = () => {
    if (timer.current) clearTimeout(timer.current);
    setLoading(true);
    timer.current = setTimeout(() => setLoading(false), 1800);
  };
  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap gap-2">
        <Button onClick={replay}>로딩 재생</Button>
        <Button variant="outline" onClick={() => {
          if (timer.current) clearTimeout(timer.current);
          setLoading((value) => !value);
        }}>{loading ? "내용 보기" : "로딩 유지"}</Button>
        <Button variant="outline" onClick={() => { setKind(kind === "patient" ? "guardian" : "patient"); replay(); }}>
          {kind === "patient" ? "보호자로 전환" : "환자로 전환"}
        </Button>
        <Button variant="outline" aria-pressed={long} onClick={() => setLong(!long)}>긴 이름</Button>
      </div>
      <div className="flex flex-wrap items-start gap-6">
        {["기존 방식", "Skullet"].map((label, index) => (
          <div key={label} className="w-[380px] max-w-full space-y-3">
            <h2 className="text-base font-semibold">{label}</h2>
            <div className={styles.panel} style={{ width: "100%", minHeight: 450, height: "auto", padding: "16px 0" }}>
              {index === 0 && loading ? <EmrProfilePanelLoading /> : <ProfileBasicInformation model={model} loading={loading} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const SkulletComparison: Story = {
  render: () => <LoadingComparison />,
  parameters: { docs: { description: { story: "로컬 Skullet 0.0.3 시험. 합성 데이터만 사용합니다. 기존 전체 정보 로딩과 기본 정보 자동 스켈레톤을 비교합니다. 성능 측정 결과가 아닙니다." } } },
};

export const SkulletProfileLoading: Story = {
  play: async ({ canvasElement }) => {
    const busy = canvasElement.querySelector('[aria-busy="true"]');
    if (!busy) throw new Error("Basic information must report loading");
    const skeleton = busy.querySelector<HTMLElement>("[skullet-loading]");
    if (!skeleton?.inert || skeleton.getAttribute("aria-hidden") !== "true")
      throw new Error("Loading sample must be inert and hidden from assistive technology");
    if (canvasElement.textContent?.includes("다가오는 일정"))
      throw new Error("Previous profile schedule must not appear while loading");
    if (canvasElement.querySelector('[data-testid="profile-today-section"]'))
      throw new Error("Previous profile today section must not appear while loading");
  },
  render: () => (
    <div style={{ height: 850, width: 380 }}>
      <ProfileSidePanel model={patientModel} sectionStates={{ info: { status: "loading" } }} onClose={() => {}} onHeaderAction={() => {}} />
    </div>
  ),
};


export const ActivityInitialLoading: Story = {
  render: () => <div className="flex flex-wrap gap-4">{(["reservations", "history", "billing"] as const).map(tab =>
    <div key={tab} style={{ height: 700, width: 380 }}><ProfileSidePanel model={patientModel} defaultTab={tab}
      sectionStates={{ [tab]: { status: "loading" } }} onClose={() => {}} onHeaderAction={() => {}} /></div>
  )}</div>,
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll('[skullet-loading]')).toHaveLength(3);
  },
};

function HistoryAppendExample() {
  const [state, setState] = useState<ProfileTabState>({ status: "ready", nextCursor: "next-page" });
  return <div className="space-y-3">
    <Button onClick={() => setState({ status: "ready", nextCursor: "next-page", readError: "append" })}>조회 실패 응답</Button>
    <div style={{ height: 700, width: 380 }}><ProfileSidePanel defaultTab="history"
      model={{ ...patientModel, history: [{ ...patientModel.history[0], title: "유지할 가상 진료 이력", dateAt: new Date().toISOString() }] }}
      sectionStates={{ history: state }} onClose={() => {}} onHeaderAction={() => {}}
      onLoadSection={() => setState({ status: "ready", nextCursor: "next-page", pending: "append" })} /></div>
  </div>;
}
export const HistoryAppendRetainsRows: Story = {
  render: () => <HistoryAppendExample />,
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(canvas.getByRole("button", { name: "더 보기" }));
    await expect(canvas.getByText("유지할 가상 진료 이력")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "불러오는 중" })).toBeDisabled();
    await expect(canvasElement.querySelector('[skullet-loading]')).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "조회 실패 응답" }));
    await expect(canvas.getByText("유지할 가상 진료 이력")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "추가 정보를 불러오지 못했습니다. 다시 시도" }));
    await expect(canvas.getByRole("button", { name: "불러오는 중" })).toBeDisabled();
  },
};
