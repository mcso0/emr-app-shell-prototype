import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import type { OrderQueueItem, OrderQueueStatusDefinition } from "@/types/emr";

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
  return (
    <div className="h-[520px] w-[288px]">
      <EmrOrderQueueSidePanel
        items={queueItems}
        selectedItemId="sample-1"
        statuses={queueStatuses}
        title={title}
        typeFilterVisible={typeFilterVisible}
      />
    </div>
  );
}

const meta = {
  title: "Design System/EMR/EmrOrderQueueSidePanel",
  component: EmrOrderQueueSidePanelExample,
  tags: ["autodocs"],
  parameters: {
    docs: {
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
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: EMR order queue shell의 filter/group/card 조합을 검토할 때. 쓰지 말아야 할 때: 실제 오더 mutation, 담당 배정, provider 연동 동작을 검증할 때.",
      },
    },
  },
};

function ReadFailureExample({ denied = false }: { denied?: boolean }) {
  const [failed, setFailed] = useState(true);
  return <div className="h-[520px] w-[288px]"><EmrOrderQueueSidePanel title="합성 대기열" items={queueItems} statuses={queueStatuses} readStatus={failed ? denied ? "permission_denied" : "error" : undefined} onRetry={() => setFailed(false)} /></div>;
}
export const ReadFailureRetry: Story = {
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
