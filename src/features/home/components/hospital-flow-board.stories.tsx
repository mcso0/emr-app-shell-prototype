import { useState, type ReactNode } from "react";
import { expect, userEvent, waitFor } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { HomeDashboardData, HospitalFlowItem } from "../home.types";
import { CompactFlowSummary } from "./compact-flow-summary";
import { HomeCommandHeader } from "./home-command-header";
import { HospitalFlowBoard } from "./hospital-flow-board";

const items: HospitalFlowItem[] = [
  { status: "reservation", label: "합성 예약", count: 3, averageWaitMinutes: 0, actionHref: "#synthetic-reservation" },
  { status: "waiting", label: "합성 접수", count: 4, delayedCount: 2, averageWaitMinutes: 18, topIssue: "합성 대기 확인", actionHref: "#synthetic-waiting" },
  { status: "chart", label: "합성 진료", count: 2, averageWaitMinutes: 7, actionHref: "#synthetic-chart" },
  { status: "billing", label: "합성 수납", count: 0, actionHref: "#synthetic-billing" },
];

const headerData: HomeDashboardData = {
  role: "desk", roleLabel: "합성 접수 역할", userName: "예시 사용자", hospitalName: "합성 동물병원", todayLabel: "2026년 10월 11일",
  columns: [], tasks: [], hospitalTasks: [], notifications: [], quickStatus: [], emptyLaunchers: [], flowSummary: [], roleNextActions: [], updatedAt: "2026-10-11T09:42:00+09:00",
};

function LocalLinks({ children }: { children: ReactNode }) {
  const [requested, setRequested] = useState("없음");
  return <div className="p-4" onClickCapture={event => {
    const link = event.target instanceof Element ? event.target.closest("a") : null;
    if (link) { event.preventDefault(); setRequested(link.getAttribute("href") ?? "없음"); }
  }}>{children}<output className="block p-2 text-xs" aria-label="합성 홈 이동 요청">{requested}</output></div>;
}
const meta = {
  title: "Features/Home/Hospital Flow Board",
  component: HospitalFlowBoard,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: { description: { component: "기존 병원 흐름 표시 컴포넌트의 독립 갤러리입니다. 현재 HomeContent는 이 보드·요약·인사말을 사용하지 않습니다. HospitalFlowBoard는 항목 수와 지연 정보를 표시하며 집계·갱신·이동은 호출자가 소유합니다. 보드의 updated 09:42 문구는 현재 소스의 고정 표시입니다. 합성 링크의 요청 URL을 로컬 output에 기록합니다." } },
  },
  args: { items },
  argTypes: { items: { control: "object", description: "실제 items prop에 전달하는 합성 흐름 집계입니다." } },
  decorators: [(Story) => <LocalLinks><Story /></LocalLinks>],
} satisfies Meta<typeof HospitalFlowBoard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DelayedAndNormal: Story = {
  parameters: { docs: { description: { story: "지연 건수·평균 대기·설명이 있는 항목과 0건인 항목을 함께 표시합니다. 실제 운영 지표가 아닙니다." } } },
  play: async ({ canvasElement }) => {
    const link = canvasElement.querySelector("a"); if (!link) throw new Error("Synthetic home link missing");
    await userEvent.click(link);
    await waitFor(() => expect(canvasElement.querySelector('[aria-label="합성 홈 이동 요청"]')).toHaveTextContent(link.getAttribute("href")!));
  },
};

export const Empty: Story = {
  args: { items: [] },
  parameters: { docs: { description: { story: "현재 소스는 빈 items에 별도 오류나 빈 문구를 추가하지 않고 제목과 보드 공간을 유지합니다." } } },
};

export const PresentationFamily: Story = {
  render: (args) => (
    <div className="grid gap-4">
      <HomeCommandHeader data={headerData} />
      <HospitalFlowBoard {...args} />
      <div className="max-w-md">
        <CompactFlowSummary
          updatedAt={headerData.updatedAt}
          items={args.items.map((item) => ({
            id: item.status, label: item.label, count: item.count,
            href: item.actionHref ?? "#synthetic-flow",
            detail: item.delayedCount ? `합성 지연 ${item.delayedCount}건` : undefined,
            tone: item.delayedCount ? "warning" : "normal",
          }))}
        />
      </div>
    </div>
  ),
  parameters: { docs: { description: { story: "HomeCommandHeader·HospitalFlowBoard·CompactFlowSummary의 기존 표시 API를 한 갤러리에서 비교합니다. 실제 Home 레이아웃을 재현한 화면은 아닙니다. items Control은 보드 항목이며 요약 항목으로 명시적으로 매핑합니다. 인사말과 갱신 시각은 고정 합성 데이터입니다." } } },
};

export const NarrowContainer: Story = {
  render: (args) => <div className="max-w-sm"><HospitalFlowBoard {...args} /></div>,
  parameters: { docs: { description: { story: "좁은 부모 안에서 보드의 기존 가로 스크롤 배치를 확인합니다. 최소 920px 보드 폭은 실제 컴포넌트가 소유합니다." } } },
};
