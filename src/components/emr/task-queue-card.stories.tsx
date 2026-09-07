import { expect, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { EmrTaskQueueCard } from "./task-queue-card";

type EmrTaskQueueCardStoryArgs = {
  selected: boolean;
};

function EmrTaskQueueCardExample({ selected }: EmrTaskQueueCardStoryArgs) {
  return (
    <div className="w-[288px] rounded-lg bg-[var(--emr-surface-sidepanel)] p-3">
      <EmrTaskQueueCard
        item={{
          actionAriaLabel: "샘플 작업 더보기",
          actionItems: [
            { key: "open", label: "샘플 열기", onSelect: () => undefined },
            { key: "assign", label: "담당 확인", onSelect: () => undefined },
          ],
          assigneeName: "샘플 담당",
          eventActorName: "샘플 요청자",
          eventKind: "request",
          eventTime: "10:30",
          guardianName: "샘플 보호자",
          patientName: "샘플 환자",
          receptionType: "예약",
          secondLineBadgeLabel: "조제",
          secondLineText: "합성 오더 항목",
        }}
        selected={selected}
        onSelect={() => undefined}
      />
    </div>
  );
}

const meta = {
  title: "Design System/EMR/EmrTaskQueueCard",
  component: EmrTaskQueueCardExample,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Use EmrTaskQueueCard for repeated EMR task/order queue cards inside side panels. 사용할 때: a queue item needs identity, request metadata, assignee, event state, and overflow actions. 쓰지 말아야 할 때: full table rows, billing lines, or cards that need arbitrary freeform layout.",
      },
    },
  },
  argTypes: {
    selected: {
      control: "boolean",
      description: "Whether the queue card is selected.",
    },
  },
  args: {
    selected: true,
  },
  render: (args) => <EmrTaskQueueCardExample {...args} />,
} satisfies Meta<EmrTaskQueueCardStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Selected: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 현재 detail context와 연결된 queue item. 쓰지 말아야 할 때: selected state가 서버 작업 상태를 의미하는 것처럼 보일 때.",
      },
    },
  },
};

export const Unselected: Story = {
  args: {
    selected: false,
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 반복 queue에서 선택되지 않은 항목을 보여줄 때. 쓰지 말아야 할 때: disabled나 완료 상태를 단순 미선택으로만 표현할 때.",
      },
    },
  },
};

export const MenuOnly: Story = {
  render: () => <div className="w-[288px] p-3"><EmrTaskQueueCard selected={false} item={{
    patientName: "합성 환자", guardianName: "합성 보호자", receptionType: "외래",
    secondLineText: "CBC 검사", assigneeName: "합성 담당자", eventActorName: "", eventTime: "", eventText: "20분 경과",
    actionAriaLabel: "합성 환자 업무 메뉴", actionItems: [{ key: "open", label: "임상병리 화면으로 이동", onSelect: () => undefined }], testId: "menu-only-card",
  }} /></div>,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("menu-only-card")).not.toHaveAttribute("role", "button");
    await userEvent.hover(canvas.getByTestId("menu-only-card"));
    await userEvent.click(canvas.getByRole("button", { name: "합성 환자 업무 메뉴" }));
    await waitFor(async () => {
      await expect(within(canvasElement.ownerDocument.body).getByRole("menuitem", { name: "임상병리 화면으로 이동" })).toBeVisible();
    });
    await userEvent.keyboard("{Escape}");
  },
};
