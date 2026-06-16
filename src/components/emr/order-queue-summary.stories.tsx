import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { OrderQueueItem, OrderQueueStatusDefinition } from "@/types/emr";

import { OrderQueueSelectionSummary } from "./order-queue-summary";

type OrderQueueSelectionSummaryStoryArgs = {
  empty: boolean;
};

const statuses: OrderQueueStatusDefinition[] = [
  { id: "requested", label: "요청", colorToken: "--emr-status-info-text", sortOrder: 1 },
  { id: "in_progress", label: "진행", colorToken: "--emr-status-warning-text", sortOrder: 2 },
  { id: "completed", label: "완료", colorToken: "--emr-status-success-text", sortOrder: 3 },
];

const item: OrderQueueItem = {
  id: "sample-order-1",
  assigneeName: "샘플 담당",
  guardianName: "샘플 보호자",
  instructionId: "sample-instruction-1",
  orderName: "합성 오더 항목",
  orderType: "처치",
  orderTypeCategory: "treatment",
  patientName: "샘플 환자",
  receptionType: "접수",
  requesterName: "샘플 요청자",
  statusId: "in_progress",
  time: "10:30",
};

function OrderQueueSelectionSummaryExample({ empty }: OrderQueueSelectionSummaryStoryArgs) {
  return (
    <div className="w-[560px]">
      <OrderQueueSelectionSummary item={empty ? null : item} statuses={statuses} />
      {empty ? <div className="text-sm text-muted-foreground">선택된 샘플 항목이 없습니다.</div> : null}
    </div>
  );
}

const meta = {
  title: "Design System/EMR/OrderQueueSelectionSummary",
  component: OrderQueueSelectionSummaryExample,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Use OrderQueueSelectionSummary to summarize the currently selected synthetic order queue item next to a queue/detail surface. 사용할 때: a selected queue item needs compact identity, order, requester, assignee, and status context. 쓰지 말아야 할 때: no item is selected, table rows need inline cells, or real patient/guardian data would be exposed.",
      },
    },
  },
  argTypes: {
    empty: {
      control: "boolean",
      description: "Whether to render the null-item state.",
    },
  },
  args: {
    empty: false,
  },
  render: (args) => <OrderQueueSelectionSummaryExample {...args} />,
} satisfies Meta<OrderQueueSelectionSummaryStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SelectedItem: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: queue selection이 detail context에 연결되어 있음을 보여줄 때. 쓰지 말아야 할 때: 실제 식별 데이터나 결제 정보를 요약할 때.",
      },
    },
  },
};

export const Empty: Story = {
  args: {
    empty: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: selection summary가 null item에서 렌더링되지 않는 계약을 확인할 때. 쓰지 말아야 할 때: empty state copy를 이 컴포넌트 내부 책임으로 둘 때.",
      },
    },
  },
};
