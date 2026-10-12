import { useState, type ReactNode } from "react";
import { expect, userEvent, waitFor } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { HomeAlert } from "../home.types";
import { AlertsPanel } from "./alerts-panel";

const alerts: HomeAlert[] = [
  { id: "synthetic-critical", title: "합성 긴급 확인", message: "우선 확인할 항목을 보여줍니다.", severity: "critical", sourceType: "chart", createdAt: "2026-10-11T09:00:00+09:00", actionHref: "#synthetic-alert", actionLabel: "합성 확인" },
  { id: "synthetic-warning", title: "합성 지연 안내", severity: "warning", sourceType: "lab", createdAt: "2026-10-11T09:00:00+09:00" },
  { id: "synthetic-info", title: "합성 참고 정보", message: "실제 환자·보호자·업무 요청이 없는 표시 예시입니다.", severity: "info", sourceType: "admin", createdAt: "2026-10-11T09:00:00+09:00" },
];

function LocalLinks({ children }: { children: ReactNode }) {
  const [requested, setRequested] = useState("없음");
  return <div className="max-w-2xl" onClickCapture={event => {
    const link = event.target instanceof Element ? event.target.closest("a") : null;
    if (link) { event.preventDefault(); setRequested(link.getAttribute("href") ?? "없음"); }
  }}>{children}<output className="block p-2 text-xs" aria-label="합성 홈 이동 요청">{requested}</output></div>;
}
const meta = {
  title: "Features/Home/Alerts Panel",
  component: AlertsPanel,
  tags: ["autodocs"],
  parameters: {
    docs: { description: { component: "기존 Home 표시 컴포넌트의 독립 갤러리입니다. 현재 HomeContent는 이 패널을 렌더링하지 않습니다. AlertsPanel은 중요도별 묶음과 빈 그룹을 표시하고 HomePanelCard를 사용합니다. 알림 조회·권한·이동은 호출자가 소유합니다. 모든 데이터는 합성이며 링크 요청은 로컬 output에 기록합니다." } },
  },
  args: { alerts },
  argTypes: { alerts: { control: "object", description: "실제 alerts prop에 전달하는 합성 알림 목록입니다. 네트워크로 조회하지 않습니다." } },
  decorators: [(Story) => <LocalLinks><Story /></LocalLinks>],
} satisfies Meta<typeof AlertsPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SeverityGroups: Story = {
  parameters: { docs: { description: { story: "긴급·지연/주의·참고 그룹, 선택적 설명과 링크를 함께 표시합니다. 링크는 합성 hash 대상이며 이동은 막습니다." } } },
  play: async ({ canvasElement }) => {
    const link = canvasElement.querySelector("a"); if (!link) throw new Error("Synthetic home link missing");
    await userEvent.click(link);
    await waitFor(() => expect(canvasElement.querySelector('[aria-label="합성 홈 이동 요청"]')).toHaveTextContent(link.getAttribute("href")!));
  },
};

export const Empty: Story = {
  args: { alerts: [] },
  parameters: { docs: { description: { story: "알림이 없으면 세 중요도 그룹 각각에 빈 안내를 표시합니다." } } },
};

export const OneSeverity: Story = {
  args: { alerts: [alerts[1]] },
  parameters: { docs: { description: { story: "주의 알림만 있고 다른 두 중요도 그룹은 비어 있는 상태입니다." } } },
};
