import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Button } from "@/components/ui/button";
import { PatientHistoryAside, type PatientHistoryEntry } from "@/features/fulfillment/patient-history-aside";

type Args = { title: string; status: "ready" | "loading" | "error" | "permission_denied"; empty: boolean };

// Actual exported caller. Its search, sort, filter, grouping and card rendering stay source-owned.
function EmrContentAsidePanelExample({ title, status, empty }: Args) {
  const [open, setOpen] = useState(true);
  const [selected, setSelected] = useState("a");
  const entries: PatientHistoryEntry[] = empty ? [] : [
    { id: "a", title: "합성 CBC 검사", timestamp: "2026-10-11T01:30:00Z", status: "완료", assignee: "합성 담당 A" },
    { id: "b", title: "합성 혈청화학 검사", timestamp: "2026-10-10T02:10:00Z", status: "진행 중", assignee: "합성 담당 B" },
  ];
  return <div className="h-[520px] w-[320px] border border-border">
    {open ? <PatientHistoryAside id="storybook-lab-history" kind="lab" label={title} status={status}
      entries={entries.map(entry => ({ ...entry, selected: selected === entry.id, onSelect: () => setSelected(entry.id) }))}
      onCollapse={() => setOpen(false)} /> : <Button onClick={() => setOpen(true)}>이력 다시 열기</Button>}
  </div>;
}

const meta = {
  title: "Design System/EMR/EmrContentAsidePanel", component: EmrContentAsidePanelExample, tags: ["autodocs"],
  args: { title: "검사 이력", status: "ready", empty: false },
  argTypes: { title: { control: "text" }, status: { control: "select", options: ["ready", "loading", "error", "permission_denied"] }, empty: { control: "boolean" } },
  parameters: { docs: {
      story: { inline: false, height: "620px" }, description: { component: "PatientHistoryAside의 실제 검사 이력 조합입니다. EmrContentAsidePanel·Header, 정렬·검색·필터·날짜 그룹·선택 카드를 그대로 사용합니다. 데이터와 선택·패널 상태만 합성입니다. usePatientFulfillmentHistory와 API를 호출하지 않습니다." } } },
  render: args => <EmrContentAsidePanelExample {...args} />,
} satisfies Meta<Args>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    if (args.status !== "ready" || args.empty) return;
    const second = canvas.getByTestId("patient-history-item-b");
    await userEvent.click(second);
    await expect(second).toHaveAttribute("data-selected", "true");
    await userEvent.click(canvas.getByRole("button", { name: "검색" }));
    const search = canvas.getByRole("searchbox", { name: "검사 이력 검색" });
    await userEvent.type(search, "없는검사");
    await waitFor(async () => { await expect(canvas.getByText("검색 결과가 없습니다")).toBeVisible(); });
    await userEvent.clear(search);
    await waitFor(async () => { await expect(canvas.getByTestId("patient-history-item-b")).toBeVisible(); });
    await userEvent.click(canvas.getByRole("button", { name: /검색 닫기/ }));
    await userEvent.click(canvas.getByRole("button", { name: `${args.title} 목록 접기` }));
    await expect(canvas.getByRole("button", { name: "이력 다시 열기" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "이력 다시 열기" }));
    await expect(canvas.getByTestId("patient-history-item-b")).toHaveAttribute("data-selected", "true");
  },
};
export const Loading: Story = { args: { status: "loading" }, play: async ({ canvas }) => { await expect(canvas.getByText("이력을 불러오는 중입니다.")).toBeVisible(); } };
export const ReadFailure: Story = { args: { status: "error" }, play: async ({ canvas }) => { await expect(canvas.getByText("이력을 불러오지 못했습니다.")).toBeVisible(); } };
export const PermissionDenied: Story = { args: { status: "permission_denied" }, play: async ({ canvas }) => { await expect(canvas.getByText("이력을 볼 권한이 없습니다.")).toBeVisible(); } };
export const EmptyHistory: Story = { args: { empty: true }, play: async ({ canvas }) => { await waitFor(async () => { await expect(canvas.getByText("기록된 이력이 없습니다")).toBeVisible(); }); } };
