import { useState } from "react";
import type { ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";

import {
  SegmentedControl,
  type SegmentedControlItem,
} from "./segmented-control";

type WorkStatusFilter = "all" | "waiting" | "active" | "done";
type DensityMode = "compact" | "standard" | "comfortable";

const workStatusItems: Array<SegmentedControlItem<WorkStatusFilter>> = [
  { value: "all", label: "전체" },
  { value: "waiting", label: "대기", count: 12 },
  { value: "active", label: "진행", count: 4 },
  { value: "done", label: "완료", count: 8 },
];

const densityItems: Array<SegmentedControlItem<DensityMode>> = [
  { value: "compact", label: "좁게", ariaLabel: "좁은 밀도" },
  { value: "standard", label: "기본", ariaLabel: "기본 밀도" },
  { value: "comfortable", label: "넓게", ariaLabel: "넓은 밀도" },
];

type SegmentedControlArgs = ComponentProps<typeof SegmentedControl<string>>;

function ControlledSegmentedControl(args: SegmentedControlArgs) {
  const [value, setValue] = useState<string>(args.value);

  return (
    <SegmentedControl
      {...args}
      value={value}
      onValueChange={setValue}
    />
  );
}

const meta = {
  title: "Design System/UI/SegmentedControl",
  component: SegmentedControl,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Use SegmentedControl for compact filters, display modes, and small mutually exclusive choices. Do not use it for page navigation, long taxonomies, or actions that require confirmation.",
      },
    },
  },
  argTypes: {
    value: {
      control: "select",
      options: ["all", "waiting", "active", "done"],
      description: "Currently selected item value. Keep one selected value at all times.",
    },
    items: {
      control: "object",
      description:
        "Short mutually exclusive options. Include counts only when they help scan an operational queue.",
    },
    "aria-label": {
      control: "text",
      description: "Required group label that names what the segmented control changes.",
    },
    variant: {
      control: "radio",
      options: ["pill", "tabs"],
      description: "Use pill for filters and tabs for compact display-mode selectors.",
    },
    size: {
      control: "radio",
      options: ["xs", "sm", "md"],
      description: "Tabs density. xs is 24px, sm is 28px, and md is 32px.",
    },
    onValueChange: {
      table: {
        disable: true,
      },
    },
  },
  args: {
    "aria-label": "업무 상태 필터",
    items: workStatusItems,
    onValueChange: () => undefined,
    size: "xs",
    value: "waiting",
    variant: "pill",
  },
  render: (args) => <ControlledSegmentedControl {...args} />,
} satisfies Meta<typeof SegmentedControl>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Default segmented control for a small filter set. Use it when changing the view does not navigate away.",
      },
    },
  },
};

export const WithCounts: Story = {
  args: {
    value: "active",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Counts are useful for queue filters when they reflect the currently visible data set. Avoid stale or remote-unverified counts.",
      },
    },
  },
};

export const TabsVariant: Story = {
  args: {
    "aria-label": "표 밀도",
    items: densityItems,
    onValueChange: () => undefined,
    size: "xs",
    value: "standard",
    variant: "tabs",
  },
  render: (args) => <ControlledSegmentedControl {...args} />,
  parameters: {
    docs: {
      description: {
        story:
          "Use the tabs variant for very compact display settings such as density. It is not shell navigation.",
      },
    },
  },
};

export const TabSizes: Story = {
  render: () => (
    <div className="grid gap-3">
      <ControlledSegmentedControl
        aria-label="xs 탭 그룹"
        items={densityItems}
        onValueChange={() => undefined}
        size="xs"
        value="standard"
        variant="tabs"
      />
      <ControlledSegmentedControl
        aria-label="sm 탭 그룹"
        items={densityItems}
        onValueChange={() => undefined}
        size="sm"
        value="standard"
        variant="tabs"
      />
      <ControlledSegmentedControl
        aria-label="md 탭 그룹"
        items={densityItems}
        onValueChange={() => undefined}
        size="md"
        value="standard"
        variant="tabs"
      />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Tabs support xs, sm, and md densities. xs matches compact side-panel filters; md matches the 32px CDS V2 toolbar tab group.",
      },
    },
  },
};

export const CdsV2MediumTabs: Story = {
  args: {
    "aria-label": "접수 캘린더 보기",
    items: [
      { value: "day", label: "일" },
      { value: "week", label: "주" },
      { value: "month", label: "월" },
    ],
    onValueChange: () => undefined,
    size: "md",
    value: "day",
    variant: "tabs",
  },
  render: (args) => <ControlledSegmentedControl {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const group = canvas.getByRole("group", { name: "접수 캘린더 보기" });
    const day = within(group).getByRole("button", { name: "일" });
    const week = within(group).getByRole("button", { name: "주" });

    await expect(day).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(week);
    await expect(week).toHaveAttribute("aria-pressed", "true");
  },
  parameters: {
    docs: {
      description: {
        story:
          "CDS.V2 node 27630:20825 medium tab group: 32px group, 28px items, 12px/10px radii, body/2 typography, and shadow-sm selected state.",
      },
    },
  },
};

export const ShortLabelsNeedAriaLabels: Story = {
  args: {
    "aria-label": "표 밀도",
    items: [
      { value: "compact", label: "C", ariaLabel: "좁은 밀도" },
      { value: "standard", label: "S", ariaLabel: "기본 밀도" },
      { value: "comfortable", label: "L", ariaLabel: "넓은 밀도" },
    ],
    onValueChange: () => undefined,
    size: "xs",
    value: "standard",
    variant: "tabs",
  },
  render: (args) => <ControlledSegmentedControl {...args} />,
  parameters: {
    docs: {
      description: {
        story:
          "When visible labels are abbreviated, each item should carry an ariaLabel so assistive technology gets the full meaning.",
      },
    },
  },
};
