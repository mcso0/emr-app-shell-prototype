import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { OrderQueueItem, OrderQueueStatusDefinition } from "@/types/emr";

import { EmrOrderQueueSidePanel } from "./order-queue-side-panel";

type EmrOrderQueueSidePanelStoryArgs = {
  title: string;
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

function EmrOrderQueueSidePanelExample({ title }: EmrOrderQueueSidePanelStoryArgs) {
  return (
    <div className="h-[520px]">
      <EmrOrderQueueSidePanel
        items={queueItems}
        selectedItemId="sample-1"
        statuses={queueStatuses}
        title={title}
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
          "Use EmrOrderQueueSidePanel for synthetic EMR order queues with date navigation, segmented type filters, sort/filter/display menus, status groups, and task cards. 사용할 때: dispensing/treatment-like modules need the shared queue shell. 쓰지 말아야 할 때: feature workflows without stable fixtures, real patient/guardian data, or server-side queue mutation behavior.",
      },
    },
  },
  argTypes: {
    title: {
      control: "text",
      description: "Queue side panel title.",
    },
  },
  args: {
    title: "오더 큐",
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
