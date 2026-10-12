import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import type { OrderQueueItem, OrderQueueStatusDefinition } from "@/types/emr";
import { formatKoreanOperatingDateLabel } from "@/lib/emr-domain/demo-date";

import { ActualQueueCaller, prepareInstructionCaller, instructionCallerParameters } from "./instruction-caller.stories.fixture";
import { EmrOrderQueueSidePanel } from "./order-queue-side-panel";

type EmrOrderQueueSidePanelStoryArgs = {
  title: string;
  typeFilterVisible: boolean;
};

const queueStatuses: OrderQueueStatusDefinition[] = [
  { id: "requested", label: "요청", colorToken: "--emr-status-info-text", sortOrder: 1 },
  { id: "in_progress", label: "진행", colorToken: "--emr-status-warning-text", sortOrder: 2 },
  { id: "completed", label: "완료", colorToken: "--emr-status-success-text", sortOrder: 3 },
];

const queueItems: OrderQueueItem[] = [
  {
    id: "sample-1",
    assigneeName: "샘플 담당",
    guardianName: "샘플 보호자 A",
    instructionId: "sample-instruction-1",
    orderName: "합성 처치 항목",
    orderType: "처치",
    orderTypeCategory: "treatment",
    patientName: "샘플 환자 A",
    receptionType: "접수",
    requesterName: "샘플 요청자",
    statusId: "in_progress",
    time: "10:30",
    waitMinutes: 18,
  },
  {
    id: "sample-2",
    guardianName: "샘플 보호자 B",
    instructionId: "sample-instruction-2",
    orderName: "합성 조제 항목",
    orderType: "조제",
    orderTypeCategory: "dispensing",
    patientName: "샘플 환자 B",
    receptionType: "예약",
    requesterName: "샘플 요청자",
    statusId: "requested",
    time: "10:45",
    waitMinutes: 8,
  },
  {
    id: "sample-3",
    assigneeName: "샘플 담당",
    guardianName: "샘플 보호자 C",
    instructionId: "sample-instruction-3",
    orderName: "합성 완료 항목",
    orderType: "처치",
    orderTypeCategory: "treatment",
    patientName: "샘플 환자 C",
    receptionType: "접수",
    requesterName: "샘플 요청자",
    statusId: "completed",
    time: "11:05",
    waitMinutes: 2,
  },
];

function EmrOrderQueueSidePanelExample({
  title,
  typeFilterVisible,
}: EmrOrderQueueSidePanelStoryArgs) {
  const [selectedId, setSelectedId] = useState("sample-1");
  const [date, setDate] = useState("2026-04-29");
  const [open, setOpen] = useState(true);
  return (
    <div className="h-[520px] w-[288px]">
      {open ? <EmrOrderQueueSidePanel
        items={queueItems}
        onSelectItem={setSelectedId}
        selectedDate={date} todayDate="2026-04-29" onDateChange={setDate}
        onCollapse={() => setOpen(false)}
        selectedItemId={selectedId}
        statuses={queueStatuses}
        title={title}
        typeFilterVisible={typeFilterVisible}
      /> : <button type="button" onClick={() => setOpen(true)}>대기열 다시 열기</button>}
      <output aria-label="선택 업무">{selectedId}</output>
    </div>
  );
}

const meta = {
  title: "Design System/EMR/EmrOrderQueueSidePanel",
  component: EmrOrderQueueSidePanelExample,
  tags: ["autodocs"],
  parameters: {
    docs: {
      story: { inline: false, height: "680px" },
      description: {
        component:
          "Use EmrOrderQueueSidePanel for synthetic EMR order queues with date navigation, optional segmented type filters, sort/filter/display menus, status groups, and task cards. 사용할 때: dispensing/treatment-like modules need the shared queue shell. 쓰지 말아야 할 때: feature workflows without stable fixtures, real patient/guardian data, or server-side queue mutation behavior.",
      },
    },
  },
  argTypes: {
    title: {
      control: "text",
      description: "Queue side panel title.",
    },
    typeFilterVisible: {
      control: "boolean",
      description: "Shows the top segmented queue type filter when the queue workflow needs one.",
    },
  },
  args: {
    title: "오더 큐",
    typeFilterVisible: true,
  },
  render: (args) => <EmrOrderQueueSidePanelExample {...args} />,
} satisfies Meta<EmrOrderQueueSidePanelStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  beforeEach: prepareInstructionCaller,
  parameters: { nextjs: { ...instructionCallerParameters.nextjs, navigation: { ...instructionCallerParameters.nextjs.navigation, query: { date: "2026-04-29" } } }, controls: { disable: true }, docs: { description: { story: "Actual exported DispensingSidePanel. Source owns date selection, patient grouping, filters, task mapping and local layout selection. Legacy demo rows are synthetic; all API responses stay in the restored caller fixture." } } },
  render: () => <ActualQueueCaller />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement), card = await canvas.findByTestId("order-queue-item-dispensing-queue-0");
    await waitFor(() => expect(card).toBeVisible()); card.focus(); await userEvent.keyboard("{Enter}");
    await expect(card).toHaveAttribute("aria-pressed", "true");
    await expect(canvas.getByLabelText("선택 업무")).toHaveTextContent("dispensing-queue-0");
    await userEvent.click(canvas.getByRole("button", { name: "대기열 검색 열기" }));
    const search = canvas.getByRole("searchbox", { name: "조제/처치 업무 검색" });
    await userEvent.type(search, "존재하지않는합성업무");
    await waitFor(() => expect(canvas.queryByTestId("order-queue-item-dispensing-queue-0")).not.toBeInTheDocument());
    await userEvent.clear(search); await waitFor(() => expect(canvas.getByTestId("order-queue-item-dispensing-queue-0")).toBeVisible());
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: /날짜 선택$/ }));
    const nextDay = await body.findByRole("button", { name: `${formatKoreanOperatingDateLabel("2026-04-30")} 선택` });
    await waitFor(() => expect(nextDay).toBeVisible());
    await waitFor(() => expect(nextDay.getBoundingClientRect().width).toBe(28));
    nextDay.focus(); await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(canvas.getByRole("button", { name: /날짜 선택$/ })).toHaveTextContent("26.04.30"));
    await expect(canvas.getByLabelText("선택 업무")).toHaveTextContent("");
    await userEvent.click(canvas.getByRole("button", { name: /날짜 선택$/ }));
    await waitFor(() => expect(body.getByRole("button", { name: `${formatKoreanOperatingDateLabel("2026-04-30")} 선택됨` })).toHaveAttribute("aria-pressed", "true"));
    await userEvent.keyboard("{Escape}");
  },
};

function ReadFailureExample({ denied = false }: { denied?: boolean }) {
  const [failed, setFailed] = useState(true);
  const [selected, setSelected] = useState("sample-1");
  return <div className="h-[520px] w-[288px]"><EmrOrderQueueSidePanel title="합성 대기열" items={queueItems} statuses={queueStatuses} selectedItemId={selected} onSelectItem={setSelected} readStatus={failed ? denied ? "permission_denied" : "error" : undefined} onRetry={() => setFailed(false)} /></div>;
}
export const ReadFailureRetry: Story = {
  parameters: { controls: { disable: true }, docs: { description: { story: "Explicit read-state API branch with synthetic rows and local retry/selection. Actual default caller is in Default." } } },
  render: () => <ReadFailureExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByText("업무 대기열을 불러오지 못했습니다")).toBeVisible());
    await expect(canvas.queryByTestId("order-queue-item-sample-1")).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "재시도" }));
    await expect(canvas.getByTestId("order-queue-item-sample-1")).toBeVisible();
  },
};
export const PermissionDenied: Story = {
  parameters: { controls: { disable: true }, docs: { description: { story: "Explicit read-state API branch with synthetic rows and local retry/selection. Actual default caller is in Default." } } },
  render: () => <ReadFailureExample denied />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByText("업무 대기열을 볼 권한이 없습니다")).toBeVisible());
    await expect(canvas.queryByRole("button", { name: "재시도" })).not.toBeInTheDocument();
    await expect(canvas.queryByTestId("order-queue-item-sample-1")).not.toBeInTheDocument();
  },
};
export const FilterChoiceCloses: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "대기열 필터" }));
    await userEvent.click(await body.findByRole("menuitemradio", { name: "진행" }));
    await waitFor(() => expect(body.queryByRole("menu")).not.toBeInTheDocument());
    await expect(canvas.getByTestId("order-queue-item-sample-1")).toBeVisible();
    await expect(canvas.queryByTestId("order-queue-item-sample-2")).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "대기열 필터" }));
    await userEvent.click(await body.findByRole("menuitemradio", { name: "전체 조건" }));
    await expect(canvas.getByTestId("order-queue-item-sample-2")).toBeVisible();
  },
};

function CountedListHeaderExample({ total = 10 }: { total?: number }) {
  const items = Array.from({ length: total }, (_, index) => ({
    ...queueItems[index < total * 0.4 ? 1 : 0],
    id: `counted-${index}`,
  }));
  return (
    <div className="h-[520px] w-[288px]">
      <EmrOrderQueueSidePanel
        title="조제/처치"
        items={items}
        statuses={queueStatuses}
        typeFilterPlacement="list-header"
        patientGrouping={{ workspaceId: "synthetic-counted-queue", readable: true, ready: true }}
      />
    </div>
  );
}

export const CountedListHeader: Story = {
  render: () => <CountedListHeaderExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const group = canvas.getByRole("group", { name: "오더 유형 필터" });
    const buttons = within(group);
    await expect(buttons.getByRole("button", { name: "전체 10" })).toBeVisible();
    const bounds = group.getBoundingClientRect();
    for (const button of buttons.getAllByRole("button")) {
      const rect = button.getBoundingClientRect();
      await expect(rect.left).toBeGreaterThanOrEqual(bounds.left);
      await expect(rect.right).toBeLessThanOrEqual(bounds.right);
    }
    const actions = group.parentElement!.parentElement!.nextElementSibling!;
    await expect(bounds.right).toBeLessThanOrEqual(actions.getBoundingClientRect().left);
    await userEvent.click(canvas.getByTestId("patient-queue-view-toggle"));
    await userEvent.click(buttons.getByRole("button", { name: "처치 6" }));
    await expect(buttons.getByRole("button", { name: "처치 6" })).toHaveAttribute("aria-pressed", "true");
    await expect(canvasElement.querySelectorAll("[data-patient-queue-item]")).toHaveLength(6);
    await userEvent.click(buttons.getByRole("button", { name: "조제 4" }));
    await expect(canvasElement.querySelectorAll("[data-patient-queue-item]")).toHaveLength(4);
    await userEvent.click(buttons.getByRole("button", { name: "전체 10" }));
    await expect(canvasElement.querySelectorAll("[data-patient-queue-item]")).toHaveLength(10);
  },
};

export const CountedListHeaderLargeCounts: Story = {
  render: () => <CountedListHeaderExample total={300} />,
  play: async ({ canvasElement }) => {
    const group = within(canvasElement).getByRole("group", { name: "오더 유형 필터" });
    const bounds = group.getBoundingClientRect();
    for (const button of within(group).getAllByRole("button")) {
      await expect(button.getBoundingClientRect().right).toBeLessThanOrEqual(bounds.right);
    }
    const header = group.parentElement!.parentElement!.parentElement!;
    const actions = header.lastElementChild!.getBoundingClientRect();
    await expect(bounds.right).toBeLessThanOrEqual(header.getBoundingClientRect().right);
    await expect(actions.top).toBeGreaterThanOrEqual(bounds.bottom);
    await expect(actions.right).toBeLessThanOrEqual(header.getBoundingClientRect().right);
  },
};
