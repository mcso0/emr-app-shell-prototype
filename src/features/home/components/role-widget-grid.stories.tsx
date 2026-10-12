import { useState, type ReactNode } from "react";
import { expect, userEvent, waitFor } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { HomeWidget } from "../home.types";
import { RoleWidgetGrid } from "./role-widget-grid";

const widgets: HomeWidget[] = [
  {
    id: "synthetic-work", title: "합성 요청 현황", description: "우선순위·보조 설명·값이 있는 항목입니다.", value: "5", badge: "합성",
    items: [
      { id: "one", title: "합성 긴급 검토", meta: "샘플 요청", value: "2건", status: "대기", priority: "critical" },
      { id: "two", title: "합성 주의 확인", priority: "high" },
      { id: "three", title: "합성 일반 작업", priority: "normal" },
      { id: "four", title: "합성 보조 작업", priority: "low" },
      { id: "five", title: "다섯 번째 합성 항목" },
    ],
    primaryAction: { label: "합성 전체 보기", href: "#synthetic-widget" },
  },
  { id: "synthetic-empty", title: "합성 빈 위젯", items: [], emptyState: "현재 합성 작업이 없습니다." },
];

function LocalLinks({ children }: { children: ReactNode }) {
  const [requested, setRequested] = useState("없음");
  return <div className="max-w-5xl" onClickCapture={event => {
    const link = event.target instanceof Element ? event.target.closest("a") : null;
    if (link) { event.preventDefault(); setRequested(link.getAttribute("href") ?? "없음"); }
  }}>{children}<output className="block p-2 text-xs" aria-label="합성 홈 이동 요청">{requested}</output></div>;
}
const meta = {
  title: "Features/Home/Role Widget Grid",
  component: RoleWidgetGrid,
  tags: ["autodocs"],
  parameters: {
    docs: { description: { component: "기존 RoleWidgetGrid → HomeWidgetCard → HomePanelCard 조합의 독립 갤러리입니다. 현재 HomeContent에서 렌더링하지 않습니다. 각 위젯은 최대 네 항목과 선택적 동작 링크를 표시합니다. 역할 권한·집계·데이터 조회는 이 컴포넌트가 수행하지 않습니다. 모든 데이터는 합성이며 링크 요청은 로컬 output에 기록합니다." } },
  },
  args: { widgets },
  argTypes: { widgets: { control: "object", description: "실제 widgets prop에 전달하는 합성 목록입니다. 컴포넌트는 권한별로 필터하지 않습니다." } },
  decorators: [(Story) => <LocalLinks><Story /></LocalLinks>],
} satisfies Meta<typeof RoleWidgetGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PopulatedAndEmpty: Story = {
  parameters: { docs: { description: { story: "상태가 있는 위젯과 사용자 지정 빈 안내를 함께 표시합니다. 다섯 번째 항목은 현재 네 항목 제한 때문에 표시하지 않습니다." } } },
  play: async ({ canvasElement }) => {
    if (!canvasElement.textContent?.includes("합성 보조 작업") || canvasElement.textContent.includes("다섯 번째 합성 항목")) {
      throw new Error("HomeWidgetCard must retain its four-item presentation limit.");
    }
    if (!canvasElement.textContent.includes("현재 합성 작업이 없습니다.")) {
      throw new Error("The empty widget must retain the caller's empty-state text.");
    }
    const link = canvasElement.querySelector("a")!; await userEvent.click(link); await waitFor(() => expect(canvasElement.querySelector('[aria-label="합성 홈 이동 요청"]')).toHaveTextContent("#synthetic-widget"));
  },
};

export const EmptyGrid: Story = {
  args: { widgets: [] },
  parameters: { docs: { description: { story: "위젯이 없으면 섹션 제목만 남습니다. 현재 소스에 없는 권한·로딩·오류 UI를 추가하지 않습니다." } } },
};

export const DefaultEmptyCopy: Story = {
  args: { widgets: [{ id: "synthetic-default-empty", title: "합성 빈 목록", items: [] }] },
  parameters: { docs: { description: { story: "emptyState를 전달하지 않았을 때 HomeWidgetCard의 기본 빈 문구를 표시합니다." } } },
};
