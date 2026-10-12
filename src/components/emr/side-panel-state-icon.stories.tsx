import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  EmrSidePanelStateIcon,
  type EmrSidePanelStateIconState,
} from "./side-panel-state-icon";

type EmrSidePanelStateIconStoryArgs = {
  state: EmrSidePanelStateIconState;
};

const stateLabels: Record<EmrSidePanelStateIconState, string> = {
  cancel: "취소",
  done: "완료",
  "in-progress": "진행",
  rework: "재작업",
  stop: "중지",
  "to-do": "대기",
};

function EmrSidePanelStateIconExample({ state }: EmrSidePanelStateIconStoryArgs) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-card p-3">
      <EmrSidePanelStateIcon aria-label={stateLabels[state]} state={state} />
      <span className="text-sm font-medium">{stateLabels[state]}</span>
    </div>
  );
}

const meta = {
  title: "Design System/EMR/EmrSidePanelStateIcon",
  component: EmrSidePanelStateIconExample,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Use EmrSidePanelStateIcon for compact side-panel status markers that map workflow state to shared EMR tokens. 사용할 때: queue groups or dense task rows need a small state symbol next to text. 쓰지 말아야 할 때: standalone status explanation, arbitrary custom statuses, or replacing readable status text.",
      },
    },
  },
  argTypes: {
    state: {
      control: "radio",
      options: ["to-do", "in-progress", "done", "rework", "stop", "cancel"],
      description: "Supported side-panel state icon API specimen; actual getEmrSidePanelStatusIconState mapping remains in TaskQueueCard and SidePanelCollapsibleGroup caller compositions.",
    },
  },
  args: {
    state: "in-progress",
  },
  render: (args) => <EmrSidePanelStateIconExample {...args} />,
} satisfies Meta<EmrSidePanelStateIconStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: side panel row나 group title 안의 작은 workflow state. 쓰지 말아야 할 때: 텍스트 label 없이 아이콘만으로 상태를 전달할 때.",
      },
    },
  },
};

export const SupportedStates: Story = {
  argTypes: { state: { control: false, table: { disable: true } } },
  render: () => (
    <div className="grid gap-2">
      {(Object.keys(stateLabels) as EmrSidePanelStateIconState[]).map((state) => (
        <div key={state} className="flex items-center gap-2 rounded-md border border-border bg-card p-3">
          <EmrSidePanelStateIcon aria-label={stateLabels[state]} state={state} />
          <span className="text-sm font-medium">{stateLabels[state]}</span>
        </div>
      ))}
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: supported state icon set을 비교할 때. 쓰지 말아야 할 때: feature별 임의 색상 legend를 만들 때.",
      },
    },
  },
};
