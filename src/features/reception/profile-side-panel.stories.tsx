import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, fn, userEvent } from "storybook/test";

import {
  ProfileSidePanel,
  type ProfileSidePanelModel,
  type ProfileSidePanelTab,
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

  return (
    <div style={{ height: 1105, width: 380 }}>
      <ProfileSidePanel
        defaultTab={defaultTab}
        model={model}
        onRetryToday={onRetryToday}
        onClose={() => setMessage("닫힘")}
        onHeaderAction={(action) => setMessage(action)}
        onOpenRelated={(item) => setMessage(item.id)}
      />
      <span className="sr-only" aria-live="polite">{message}</span>
    </div>
  );
}

const meta = {
  title: "Features/Customer/Patient Guardian Profile Side Panel",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "CDS V2 patient/guardian profile side panel at the 380 x 1105 Figma source viewport. Story data is synthetic and exists only for visual regression.",
      },
    },
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const PatientInformation: Story = {
  render: () => <Specimen defaultTab="info" model={patientModel} />,
};

export const GuardianInformation: Story = {
  render: () => <Specimen defaultTab="info" model={guardianModel} />,
};

export const PatientReservations: Story = {
  render: () => <Specimen defaultTab="reservations" model={patientModel} />,
};

export const GuardianReservations: Story = {
  render: () => <Specimen defaultTab="reservations" model={guardianModel} />,
};

export const PatientHistory: Story = {
  render: () => <Specimen defaultTab="history" model={patientModel} />,
};

export const GuardianHistory: Story = {
  render: () => <Specimen defaultTab="history" model={guardianModel} />,
};

export const PatientBilling: Story = {
  render: () => <Specimen defaultTab="billing" model={patientModel} />,
};

export const GuardianBilling: Story = {
  render: () => <Specimen defaultTab="billing" model={guardianModel} />,
};

export const PatientReservationsEmpty: Story = {
  render: () => <Specimen defaultTab="reservations" model={{ ...patientModel, reservations: [] }} />,
};

export const PatientHistoryEmpty: Story = {
  render: () => <Specimen defaultTab="history" model={{ ...patientModel, history: [] }} />,
};

export const PatientBillingEmpty: Story = {
  render: () => <Specimen defaultTab="billing" model={{ ...patientModel, billing: [] }} />,
};

const todayItems: NonNullable<ProfileSidePanelModel["todayItems"]> = [
  { id: "today-consulting", patientId: "patient-choco", patientName: "예시 환자 초코", scheduledAt: "2026-10-04T09:00:00+09:00", status: "consulting", title: "진료중", description: "진료 목적을 확인합니다." },
  { id: "today-waiting", patientId: "patient-coco", patientName: "긴 이름의 예시 환자 코코", scheduledAt: "2026-10-04T10:00:00+09:00", status: "waiting", title: "진료 대기", description: "정기 검진과 예방접종 상담을 위해 방문합니다. 지난 방문 이후 식욕과 활동량의 변화를 함께 확인하고, 보호자가 가져온 기록을 검토할 예정입니다. 화면 검증용 가상 메모입니다." },
  { id: "today-billing", patientId: "patient-choco", patientName: "예시 환자 초코", scheduledAt: "2026-10-04T11:00:00+09:00", status: "billing", title: "수납대기", description: "진료를 마친 뒤 수납을 기다립니다." },
  { id: "today-reservation", patientId: "patient-coco", patientName: "예시 환자 코코", scheduledAt: "2026-10-04T16:30:00+09:00", status: "reservation", title: "오늘 16시 30분 · 예약", description: "예약 메모입니다." },
];

export const TodayPatientStates: Story = {
  render: () => <Specimen defaultTab="info" model={{ ...patientModel, todayItems }} />,
  play: async ({ canvas }) => {
    await expect(canvas.getByText("수납대기", { exact: true })).toBeVisible();
    const more = await canvas.findByRole("button", { name: "더보기" });
    const icon = canvas.getAllByTestId("profile-today-icon")[1];
    const initial = icon.getBoundingClientRect().top;
    more.focus();
    await userEvent.keyboard("{Enter}");
    await expect(canvas.getByRole("button", { name: "접기" })).toHaveAttribute("aria-expanded", "true");
    await expect(icon.getBoundingClientRect().top).toBe(initial);
    await userEvent.click(canvas.getByRole("button", { name: "접기" }));
    await expect(more).toHaveAttribute("aria-expanded", "false");
  },
};

export const TodayGuardianStates: Story = {
  render: () => <Specimen defaultTab="info" model={{ ...guardianModel, todayItems }} />,
  play: async ({ canvas }) => {
    await expect(canvas.getByText("긴 이름의 예시 환자 코코 ·", { exact: false })).toBeVisible();
    const more = await canvas.findByRole("button", { name: "더보기" });
    const icon = canvas.getAllByTestId("profile-today-icon")[1];
    const initial = icon.getBoundingClientRect().top;
    await userEvent.click(more);
    await expect(icon.getBoundingClientRect().top).toBe(initial);
  },
};

export const TodayEmpty: Story = {
  render: () => <Specimen defaultTab="info" model={{ ...patientModel, todayItems: [] }} />,
  play: async ({ canvas }) => { await expect(canvas.getByText("접수/예약 일정이 없습니다")).toBeVisible(); },
};
export const TodayLoading: Story = {
  render: () => <Specimen defaultTab="info" model={{ ...patientModel, todayItems: [], todayState: { status: "loading" } }} />,
  play: async ({ canvas }) => { await expect(canvas.getByText("오늘 접수/예약을 불러오는 중입니다")).toBeVisible(); await expect(canvas.getByText("환자명", { exact: true })).toBeVisible(); },
};
export const TodayDenied: Story = {
  render: () => <Specimen defaultTab="info" model={{ ...guardianModel, todayItems: [], todayState: { status: "denied" } }} />,
  play: async ({ canvas }) => { await expect(canvas.getByText("오늘 접수/예약을 볼 권한이 없습니다")).toBeVisible(); await expect(canvas.queryByRole("button", { name: "다시 시도" })).not.toBeInTheDocument(); },
};
const retryToday = fn();
export const TodayError: Story = {
  beforeEach: () => { retryToday.mockClear(); },
  render: () => <Specimen defaultTab="info" model={{ ...patientModel, todayItems: [], todayState: { status: "error" } }} onRetryToday={retryToday} />,
  play: async ({ canvas }) => {
    const button = canvas.getByRole("button", { name: "다시 시도" });
    await expect(button.getBoundingClientRect().height).toBe(24);
    await expect(button.querySelector('svg[data-icon="inline-start"]')).not.toBeNull();
    await userEvent.click(button);
    await expect(retryToday).toHaveBeenCalledTimes(1);
  },
};
