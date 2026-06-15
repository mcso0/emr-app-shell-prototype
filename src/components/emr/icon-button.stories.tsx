import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  CdsActionsFilterIcon,
  CdsActionsPlusIcon,
  CdsActionsSearchIcon,
} from "@/components/cds-icons/actions-and-controls";

import { EmrIconButton } from "./icon-button";

type EmrIconButtonStoryArgs = {
  disabled: boolean;
  iconSize: "sm" | "md";
  label: string;
};

function EmrIconButtonExample({ disabled, iconSize, label }: EmrIconButtonStoryArgs) {
  return (
    <div className="flex items-center gap-2">
      <EmrIconButton aria-label={label} disabled={disabled} iconSize={iconSize}>
        <CdsActionsSearchIcon aria-hidden="true" />
      </EmrIconButton>
      <EmrIconButton aria-label="샘플 필터" disabled={disabled} iconSize={iconSize}>
        <CdsActionsFilterIcon aria-hidden="true" />
      </EmrIconButton>
      <EmrIconButton aria-label="샘플 추가" disabled={disabled} iconSize={iconSize}>
        <CdsActionsPlusIcon aria-hidden="true" />
      </EmrIconButton>
    </div>
  );
}

const meta = {
  title: "Design System/EMR/EmrIconButton",
  component: EmrIconButtonExample,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Use EmrIconButton for dense EMR panel, table, and toolbar icon-only actions that need the shared hover/focus treatment. 사용할 때: compact search, filter, close, and overflow controls with a clear accessible label. 쓰지 말아야 할 때: visible text commands, navigation links, or high-risk actions that need explicit copy.",
      },
    },
  },
  argTypes: {
    disabled: {
      control: "boolean",
      description: "Whether the icon buttons are disabled.",
    },
    iconSize: {
      control: "radio",
      options: ["sm", "md"],
      description: "Icon slot size for dense or slightly larger controls.",
    },
    label: {
      control: "text",
      description: "Accessible label for the first icon button.",
    },
  },
  args: {
    disabled: false,
    iconSize: "sm",
    label: "샘플 검색",
  },
  render: (args) => <EmrIconButtonExample {...args} />,
} satisfies Meta<EmrIconButtonStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: side panel header나 dense toolbar의 icon-only command. 쓰지 말아야 할 때: 사용자가 action 의미를 텍스트로 확인해야 하는 primary command.",
      },
    },
  },
};

export const MediumIcon: Story = {
  args: {
    iconSize: "md",
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 24px control 안에서 아이콘 판독성이 더 필요할 때. 쓰지 말아야 할 때: row마다 반복되는 아주 촘촘한 action cell.",
      },
    },
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 권한이나 현재 상태상 command가 일시적으로 불가함을 보여줄 때. 쓰지 말아야 할 때: 서버 권한 검증을 대체할 때.",
      },
    },
  },
};
