import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor } from "storybook/test";

import { ScheduleDataState } from "./schedule-data-state";

function ActionExample({ state }: { state: "empty" | "error" }) {
  const [requests, setRequests] = useState(0);
  const request = () => setRequests((count) => count + 1);
  return <div className="grid gap-3">
    <ScheduleDataState state={state} onCreateDraft={state === "empty" ? request : undefined} onRetry={state === "error" ? request : undefined} />
    <output aria-label="합성 요청 횟수">{requests}</output>
  </div>;
}

const meta = {
  title: "Features/Hospital Admin/Schedule Data State",
  component: ScheduleDataState,
  tags: ["autodocs"],
  args: { state: "loading" },
  argTypes: {
    state: { control: "select", options: ["loading", "empty", "error", "read-only"], description: "호출 기능이 결정한 근무표 조회 상태입니다." },
    onCreateDraft: { control: false, description: "빈 상태의 편집 버튼을 표시하는 선택 콜백입니다." },
    onRetry: { control: false, description: "오류 상태의 다시 시도 버튼을 표시하는 선택 콜백입니다." },
  },
  parameters: { docs: { description: { component: "근무표의 로딩, 빈 상태, 조회 오류와 게시된 읽기 전용 안내를 표시합니다. ScheduleDataState는 상태와 선택 콜백만 받습니다. 조회, 편집 권한, 초안 생성과 게시는 호출 기능이 담당합니다. ActionExample은 콜백 횟수만 기록하는 합성 예제입니다." } } },
} satisfies Meta<typeof ScheduleDataState>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  parameters: { docs: { description: { story: "조회 중 안내와 aria-busy 상태를 확인합니다." } } },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('[role="status"][aria-busy="true"]')) throw new Error("근무표 로딩 상태가 없습니다.");
  },
};
export const Empty: Story = {
  args: { state: "empty" },
  parameters: { docs: { description: { story: "편집 콜백이 없으면 빈 상태 안내만 표시합니다." } } },
  play: async ({ canvasElement }) => {
    if (!canvasElement.textContent?.includes("이번 주 근무가 아직 없습니다")) throw new Error("근무표 빈 상태 안내가 없습니다.");
    if (canvasElement.querySelector("button")) throw new Error("편집 콜백 없이 작업 버튼이 표시됩니다.");
  },
};
export const ErrorState: Story = {
  args: { state: "error" },
  parameters: { docs: { description: { story: "다시 시도 콜백이 없으면 조회 오류 안내만 표시합니다." } } },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('[role="alert"]')?.textContent?.includes("근무표를 불러오지 못했습니다")) throw new Error("근무표 조회 오류 안내가 없습니다.");
    if (canvasElement.querySelector("button")) throw new Error("다시 시도 콜백 없이 작업 버튼이 표시됩니다.");
  },
};
export const ReadOnly: Story = {
  args: { state: "read-only" },
  parameters: { docs: { description: { story: "게시된 근무표 안내를 표시합니다. 서버 권한 검증을 대신하지 않습니다." } } },
};
export const CreateDraftAction: Story = {
  args: { state: "empty" },
  parameters: { docs: { description: { story: "편집 버튼을 누르면 합성 요청 횟수가 늘어납니다. 실제 초안을 만들지 않습니다." } } },
  argTypes: { state: { control: false } },
  render: () => <ActionExample state="empty" />,
  play: async ({ canvasElement }) => {
    const button = Array.from(canvasElement.querySelectorAll("button")).find((item) => item.textContent === "근무표 편집");
    if (!button) throw new Error("근무표 편집 버튼이 없습니다.");
    await userEvent.click(button);
    await waitFor(() => expect(canvasElement.querySelector("output")).toHaveTextContent("1"));
  },
};
export const RetryAction: Story = {
  args: { state: "error" },
  parameters: { docs: { description: { story: "다시 시도 버튼의 합성 콜백을 확인합니다. 네트워크 요청은 수행하지 않습니다." } } },
  argTypes: { state: { control: false } },
  render: () => <ActionExample state="error" />,
  play: async ({ canvasElement }) => {
    const button = Array.from(canvasElement.querySelectorAll("button")).find((item) => item.textContent === "다시 시도");
    if (!button) throw new Error("다시 시도 버튼이 없습니다.");
    await userEvent.click(button);
    await waitFor(() => expect(canvasElement.querySelector("output")).toHaveTextContent("1"));
  },
};
