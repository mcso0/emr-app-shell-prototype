import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Badge } from "@/components/ui/badge";

import {
  EmrContentHistoryGroup,
  EmrContentHistoryItem,
} from "./content-history-list";

type EmrContentHistoryListStoryArgs = {
  collapsed: boolean;
  selected: boolean;
};

function EmrContentHistoryListExample({
  collapsed,
  selected,
}: EmrContentHistoryListStoryArgs) {
  const [isCollapsed, setIsCollapsed] = useState(collapsed);
  const [selection, setSelection] = useState<string | null>(selected ? "a" : null);

  return (
    <div className="w-[320px] rounded-lg border border-border bg-card p-4">
      <EmrContentHistoryGroup
        collapsed={isCollapsed}
        count={2}
        label="2026.10.11"
        onToggle={() => setIsCollapsed((current) => !current)}
      >
        <EmrContentHistoryItem
          selected={selection === "a"}
          onSelect={() => setSelection("a")}
          badge={<Badge variant="outline" className="h-5 shrink-0 rounded-md px-1.5 emr-text-micro">완료</Badge>}
          meta={<span className="truncate">담당 합성 수의사 A</span>}
          subtitle="10:30"
          title="샘플 히스토리 A"
        />
        <EmrContentHistoryItem selected={selection === "b"} onSelect={() => setSelection("b")}
          badge={<Badge variant="outline" className="h-5 shrink-0 rounded-md px-1.5 emr-text-micro">진행 중</Badge>}
          meta={<span className="truncate">담당 합성 수의사 B</span>} subtitle="11:10" title="샘플 히스토리 B" />
      </EmrContentHistoryGroup>
    </div>
  );
}

const selectAndDisclose: StoryObj<EmrContentHistoryListStoryArgs>["play"] = async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  const toggle = canvas.getByRole("button", { name: /2026.10.11/ });
  if (toggle.getAttribute("aria-expanded") === "false") await userEvent.click(toggle);
  const second = await canvas.findByRole("button", { name: /샘플 히스토리 B/ });
  second.focus();
  await userEvent.keyboard(" ");
  await expect(second).toHaveAttribute("aria-pressed", "true");
  await expect(canvas.getByRole("button", { name: /샘플 히스토리 A/ })).toHaveAttribute("aria-pressed", "false");
  await userEvent.click(toggle);
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await waitFor(async () => { await expect(canvas.queryByRole("button", { name: /샘플 히스토리 B/ })).not.toBeInTheDocument(); });
  toggle.focus(); await userEvent.keyboard("{Enter}");
  await expect(await canvas.findByRole("button", { name: /샘플 히스토리 B/ })).toHaveAttribute("aria-pressed", "true");
};

const meta = {
  title: "Design System/EMR/EmrContentHistoryList",
  component: EmrContentHistoryListExample,
  tags: ["autodocs"],
  play: selectAndDisclose,
  parameters: {
    docs: {
      description: {
        component:
          "Use EmrContentHistoryList primitives for chronological content-aside history groups and selectable history cards. 사용할 때: supporting records need date grouping, timeline gutter, and compact metadata. Actual chart caller fields: visit purpose, status outline badge, short clock time, 담당 veterinarian. Selection and group state are local synthetic values. 쓰지 말아야 할 때: primary editable tables, audit-compliance logs, or unbounded freeform feeds.",
      },
    },
  },
  argTypes: {
    collapsed: {
      control: "boolean",
      description: "Initial collapsed state for the history group.",
    },
    selected: {
      control: "boolean",
      description: "Whether the first history item is selected.",
    },
  },
  args: {
    collapsed: false,
    selected: true,
  },
  render: (args) => <EmrContentHistoryListExample key={`${args.collapsed}-${args.selected}`} {...args} />,
} satisfies Meta<EmrContentHistoryListStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: content aside 안에서 관련 기록을 날짜별로 보여줄 때. 쓰지 말아야 할 때: feature source of truth인 full audit table을 대체할 때.",
      },
    },
  },
};

export const InitiallyCollapsed: Story = {
  args: {
    collapsed: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 오래된 history group을 접어 정보 밀도를 낮출 때. 쓰지 말아야 할 때: 가장 최근 중요 기록을 숨길 때.",
      },
    },
  },
};
