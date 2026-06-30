import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  EmrSidePanelCard,
  EmrSidePanelCardAction,
  EmrSidePanelIdentityLine,
  EmrSidePanelMetaBadge,
  EmrSidePanelStatusBadge,
  EmrSidePanelTypeBadge,
} from "./side-panel-card";

type EmrSidePanelCardStoryArgs = {
  selected: boolean;
  selectionVariant: "accentBar" | "modulePanel";
};

function EmrSidePanelCardExample({
  selected,
  selectionVariant,
}: EmrSidePanelCardStoryArgs) {
  return (
    <div className="w-[288px] rounded-lg bg-[var(--emr-surface-sidepanel)] p-3">
      <EmrSidePanelCard
        selected={selected}
        selectionVariant={selectionVariant}
        onSelect={() => undefined}
      >
        <div className="grid gap-2">
          <EmrSidePanelIdentityLine
            action={<EmrSidePanelCardAction ariaLabel="샘플 항목 더보기" />}
            guardianName="샘플 보호자"
            patientName="샘플 환자"
            typeBadge={<EmrSidePanelTypeBadge label="접수" />}
          />
          <div className="flex min-w-0 items-center gap-1.5">
            <EmrSidePanelStatusBadge>10:30 요청</EmrSidePanelStatusBadge>
            <EmrSidePanelMetaBadge label="담당" value="샘플 담당" />
          </div>
        </div>
      </EmrSidePanelCard>
    </div>
  );
}

const meta = {
  title: "Design System/EMR/EmrSidePanelCard",
  component: EmrSidePanelCardExample,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Use EmrSidePanelCard for selectable EMR side-panel task cards with shared selection, identity line, badges, and overflow action chrome. 사용할 때: dense side-panel queues need repeated selectable cards. 쓰지 말아야 할 때: general page cards, freeform content sections, or domain status badges outside a side-panel task row.",
      },
    },
  },
  argTypes: {
    selected: {
      control: "boolean",
      description: "Whether the card is selected.",
    },
    selectionVariant: {
      control: "radio",
      options: ["accentBar", "modulePanel"],
      description: "Side-panel selection treatment.",
    },
  },
  args: {
    selected: true,
    selectionVariant: "modulePanel",
  },
  render: (args) => <EmrSidePanelCardExample {...args} />,
} satisfies Meta<EmrSidePanelCardStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ModulePanel: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: module side panel queue card. 쓰지 말아야 할 때: table row나 broad layout surface.",
      },
    },
  },
};

export const AccentBar: Story = {
  args: {
    selectionVariant: "accentBar",
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: selected row를 좌측 accent bar로 강조해야 할 때. 쓰지 말아야 할 때: 선택 의미가 없는 informational card.",
      },
    },
  },
};
