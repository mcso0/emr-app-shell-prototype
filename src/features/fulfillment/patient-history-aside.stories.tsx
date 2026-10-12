import { useState, type ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Button } from "@/components/ui/button";
import { CdsFilesCalendarIcon } from "@/components/cds-icons/files-and-layout";
import { EmrContentHistoryGroup } from "@/components/emr/content-history-list";
import historyLayoutStyles from "@/components/emr/history-aside-layout.module.css";
import { PatientHistoryAside, type PatientHistoryEntry } from "./patient-history-aside";

const entries: PatientHistoryEntry[] = [
  { id: "synthetic-new", timestamp: "2026-10-10T03:00:00Z", title: "합성 결과 A", orderNames: ["합성 결과 A", "합성 결과 B"], status: "완료", assignee: "합성 담당 A", modality: "합성 분류 A", category: "dispensing" },
  { id: "synthetic-old", timestamp: "2026-10-09T01:00:00Z", title: "합성 결과 C", status: "진행 중", assignee: "합성 담당 B", modality: "합성 분류 B", category: "treatment" },
];
type Args = Omit<ComponentProps<typeof PatientHistoryAside>, "id" | "onCollapse">;
function Example(args: Args) {
  const [open, setOpen] = useState(true);
  const [selected, setSelected] = useState("synthetic-new");
  return <div className="h-[680px] w-[340px] bg-[var(--emr-surface-canvas)]">
    {open ? <PatientHistoryAside {...args} id="storybook-patient-history" onCollapse={() => setOpen(false)} entries={args.entries.map((entry) => ({ ...entry, selected: selected === entry.id, onSelect: () => setSelected(entry.id) }))} /> : <Button size="sm" variant="outline" onClick={() => setOpen(true)}>이력 다시 열기</Button>}
    <output className="sr-only" aria-label="합성 선택 이력">{selected}</output>
  </div>;
}
const meta = {
  title: "Features/Fulfillment/Patient History", component: Example, tags: ["autodocs"],
  args: { entries, kind: "lab", label: "검사 이력", status: "ready", showCategories: false },
  argTypes: { entries: { control: "object" }, kind: { control: "select", options: ["lab", "imaging", "fulfillment"] }, status: { control: "select", options: ["ready", "loading", "error", "permission_denied"] } },
  render: (args) => <Example key={`${args.kind}:${args.label}`} {...args} />,
  parameters: { docs: { description: { component: "검사·영상·조제/처치 caller가 공유하는 실제 PatientHistoryAside입니다. 날짜 그룹, 검색, 정렬, 필터, 선택, 접기를 제품 컴포넌트가 수행합니다. row 필드는 실제 caller와 같은 계약의 합성 값이며 선택 callback과 패널 상태는 로컬로 연결합니다. 실제 환자 이력 조회와 선택 후 결과 재조회는 이 예제의 범위에 없습니다." } } },
} satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;

export const LabSelectionAndSearch: Story = {
  play: async ({ canvas }) => {
    const row = canvas.getByTestId("patient-history-item-synthetic-old");
    row.focus();await userEvent.keyboard("{Enter}");
    await expect(row).toHaveAttribute("data-selected", "true");
    await expect(canvas.getByLabelText("합성 선택 이력")).toHaveTextContent("synthetic-old");
    await userEvent.click(canvas.getByRole("button", { name: "검색" }));
    const input = canvas.getByRole("searchbox", { name: "검사 이력 검색" });
    await expect(input).toHaveFocus();await userEvent.type(input, "결과 C");
    await expect(canvas.queryByTestId("patient-history-item-synthetic-new")).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "검색어 초기화" }));
    await expect(canvas.getByTestId("patient-history-item-synthetic-new")).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(canvas.getByRole("button", { name: "검색" })).toHaveFocus());
    await userEvent.click(canvas.getByRole("button", { name: "검사 이력 목록 접기" }));
    await expect(canvas.queryByTestId("patient-history-item-synthetic-new")).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "이력 다시 열기" }));
    await expect(canvas.getByTestId("patient-history-item-synthetic-new")).toBeVisible();
  },
};
export const FilterApplyCancelAndReset: Story = {
  play: async ({ canvas, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "필터" }));
    let popover = within(await body.findByRole("dialog", { name: "검사 이력 필터" }));
    await userEvent.click(popover.getByRole("checkbox", { name: "진행 중" }));
    await userEvent.click(popover.getByRole("button", { name: "취소" }));
    await expect(canvas.getByTestId("patient-history-item-synthetic-new")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "필터" }));
    popover = within(await body.findByRole("dialog", { name: "검사 이력 필터" }));
    await expect(popover.getByRole("checkbox", { name: "진행 중" })).not.toBeChecked();
    await userEvent.click(popover.getByRole("checkbox", { name: "진행 중" }));
    await userEvent.click(popover.getByRole("button", { name: "적용" }));
    await expect(canvas.queryByTestId("patient-history-item-synthetic-new")).not.toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "필터" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(canvas.getByRole("button", { name: "필터" }));
    popover = within(await body.findByRole("dialog", { name: "검사 이력 필터" }));
    await userEvent.click(popover.getByRole("button", { name: "초기화" }));
    await userEvent.click(popover.getByRole("button", { name: "적용" }));
    await expect(canvas.getByTestId("patient-history-item-synthetic-new")).toBeVisible();
  },
};
export const SortAndGroupCollapse: Story = {
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(canvas.getByRole("button", { name: "정렬: 최신순" }));
    await userEvent.click(await within(canvasElement.ownerDocument.body).findByRole("menuitemradio", { name: "오래된순" }));
    const groups = canvasElement.querySelectorAll('[data-testid^="storybook-patient-history-group-"]');
    await expect(groups[0]).toHaveAttribute("data-testid", "storybook-patient-history-group-2026-10-09");
    const toggle = within(groups[0] as HTMLElement).getByRole("button", { expanded: true });
    toggle.focus();await userEvent.keyboard(" ");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await waitFor(() => expect(canvas.queryByTestId("patient-history-item-synthetic-old")).not.toBeInTheDocument());
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(canvas.getByTestId("patient-history-item-synthetic-old")).toBeVisible());
  },
};
export const Imaging: Story = { args: { kind: "imaging", label: "영상 이력" }, play: async ({ canvas, canvasElement }) => { await userEvent.click(canvas.getByRole("button", { name: "필터" })); const body = within(canvasElement.ownerDocument.body); await waitFor(() => expect(body.getByText("검사 분류", { exact: true })).toBeVisible()); } };
export const FulfillmentCategories: Story = { args: { kind: "fulfillment", label: "조제/처치 이력", showCategories: true }, play: async ({ canvas }) => { const categories = within(canvas.getByRole("group", { name: "조제/처치 이력 종류" }));await userEvent.click(categories.getByRole("button", { name: "처치" }));await expect(canvas.queryByTestId("patient-history-item-synthetic-new")).not.toBeInTheDocument();await expect(canvas.getByTestId("patient-history-item-synthetic-old")).toBeVisible();await userEvent.click(categories.getByRole("button", { name: "전체" }));await expect(canvas.getByTestId("patient-history-item-synthetic-new")).toBeVisible(); } };
export const Loading: Story = { args: { status: "loading" }, play: async ({ canvas }) => { await expect(canvas.getByText("이력을 불러오는 중입니다.")).toBeVisible(); } };
export const PermissionDenied: Story = { args: { status: "permission_denied" }, play: async ({ canvas }) => { await expect(canvas.getByText("이력을 볼 권한이 없습니다.")).toBeVisible(); } };
export const ReadError: Story = { args: { status: "error" }, play: async ({ canvas }) => { await expect(canvas.getByText("이력을 불러오지 못했습니다.")).toBeVisible(); } };
export const Empty: Story = { args: { entries: [] }, play: async ({ canvas }) => { await waitFor(() => expect(canvas.getByText("기록된 이력이 없습니다")).toBeVisible()); } };


export const LongHistory: Story = {
  args: {
    entries: Array.from({ length: 24 }, (_, index) => ({
      id: `synthetic-history-${index}`,
      timestamp: `2026-10-${index < 12 ? "12" : "11"}T05:00:00Z`,
      title: `합성 검사 기록 ${index + 1}`,
      status: "요청",
    })),
  },
};

// Billing keeps a static group title; this specimen covers presentation only.
export const BillingStaticTitle: Story = {
  render: () => <div className={`${historyLayoutStyles.panel} p-4`}>
    <EmrContentHistoryGroup count={1} label="26.10.12" icon={<CdsFilesCalendarIcon aria-hidden="true" className="size-[var(--emr-content-history-group-action-icon-size)] shrink-0 text-[var(--emr-content-history-group-title-icon)]" />}>
      <div>합성 수납 기록</div>
    </EmrContentHistoryGroup>
  </div>,
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole("button")).toBeNull();
    await expect(canvas.getByText("합성 수납 기록")).toBeVisible();
  },
};
