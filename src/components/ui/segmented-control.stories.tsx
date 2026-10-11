import { useState } from "react";
import type { ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

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

// Private chart history toolbar: the source owns its history projection; this section owns only mode.
function ChartHistoryDateModeCaller() {
  const [value, setValue] = useState<"visit" | "created">("visit");
  return <div className="grid justify-items-start gap-3">
    <div className="flex shrink-0 items-center px-1 py-2" data-testid="chart-history-date-mode-toolbar">
      <SegmentedControl aria-label="차트 이력 표시 기준" items={[{ value: "visit", label: "진료일 기준" }, { value: "created", label: "작성일 기준" }]}
        size="sm" value={value} variant="tabs" onValueChange={setValue} />
    </div>
    <output aria-label="합성 차트 이력 표시 기준">{value === "visit" ? "진료일" : "작성일"}</output>
  </div>;
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
      description: "Initial selected value in this local controlled fixture. Changing the Control restarts it; the runtime caller owns value and onValueChange.",
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
  render: (args) => <ControlledSegmentedControl key={args.value} {...args} />,
} satisfies Meta<typeof SegmentedControl>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <ChartHistoryDateModeCaller />,
  parameters: { controls: { disable: true }, docs: { description: { story: "차트 이력의 실제 비공개 toolbar 구성입니다. 진료일/작성일 값·이름·sm·tabs·부모 여백을 그대로 사용합니다. 선택은 로컬 결과로 확인하며 실제 차트 이력 조회·정렬·날짜 필터는 전체 모듈이 소유합니다." } } },
  play: async ({ canvas }) => {
    const group = within(canvas.getByRole("group", { name: "차트 이력 표시 기준" }));
    const created = group.getByRole("button", { name: "작성일 기준" });
    await userEvent.click(created); await waitFor(() => { expect(created).toHaveAttribute("aria-pressed", "true"); expect(canvas.getByLabelText("합성 차트 이력 표시 기준")).toHaveTextContent("작성일"); });
    const visit = group.getByRole("button", { name: "진료일 기준" }); visit.focus(); await userEvent.keyboard(" ");
    await waitFor(() => expect(visit).toHaveAttribute("aria-pressed", "true")); await expect(created).toHaveAttribute("aria-pressed", "false");
  },
};

export const WithCounts: Story = {
  play: async ({ canvas }) => { const waiting = canvas.getByRole("button", { name: "대기 12" }); await userEvent.click(waiting); await waitFor(() => expect(waiting).toHaveAttribute("aria-pressed", "true")); await expect(canvas.getByRole("button", { name: "진행 4" })).toHaveAttribute("aria-pressed", "false"); },
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
  play: async ({ canvas }) => { const button = canvas.getByRole("button", { name: "넓은 밀도" }); await userEvent.click(button); await waitFor(() => expect(button).toHaveAttribute("aria-pressed", "true")); },
  argTypes: { value: { options: ["compact", "standard", "comfortable"] } },
  args: {
    "aria-label": "표 밀도",
    items: densityItems,
    onValueChange: () => undefined,
    size: "xs",
    value: "standard",
    variant: "tabs",
  },
  render: (args) => <ControlledSegmentedControl key={args.value} {...args} />,
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
  play: async ({ canvas }) => { for (const label of ["xs 탭 그룹", "sm 탭 그룹", "md 탭 그룹"]) { const group = within(canvas.getByRole("group", { name: label })); const target = group.getByRole("button", { name: "넓은 밀도" }); await userEvent.click(target); await waitFor(() => expect(target).toHaveAttribute("aria-pressed", "true")); } },
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
    controls: { disable: true },
    docs: {
      description: {
        story:
          "Tabs support xs, sm, and md densities. xs matches compact side-panel filters; md matches the 32px CDS V2 toolbar tab group.",
      },
    },
  },
};

export const CdsV2MediumTabs: Story = {
  argTypes: { value: { options: ["day", "week", "month"] } },
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
  render: (args) => <ControlledSegmentedControl key={args.value} {...args} />,
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
  play: async ({ canvas }) => { const target = canvas.getByRole("button", { name: "좁은 밀도" }); await expect(target).toHaveTextContent("C"); await userEvent.click(target); await waitFor(() => expect(target).toHaveAttribute("aria-pressed", "true")); },
  argTypes: { value: { options: ["compact", "standard", "comfortable"] } },
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
  render: (args) => <ControlledSegmentedControl key={args.value} {...args} />,
  parameters: {
    docs: {
      description: {
        story:
          "When visible labels are abbreviated, each item should carry an ariaLabel so assistive technology gets the full meaning.",
      },
    },
  },
};
