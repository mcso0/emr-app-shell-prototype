import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger } from "@/components/ui/popover";

import {
  EmrPopoverFieldRow,
  EmrPopoverOption,
  EmrPopoverOptionGroup,
  EmrPopoverShell,
} from "./popover-shell";

type EmrPopoverShellStoryArgs = {
  bodyScroll: boolean;
  density: "compact" | "default";
  title: string;
  triggerLabel: string;
  width: "anchor" | "sm" | "md" | "lg";
};

function EmrPopoverShellExample({
  bodyScroll,
  density,
  title,
  triggerLabel,
  width,
}: EmrPopoverShellStoryArgs) {
  return (
    <Popover>
      <PopoverTrigger render={<Button type="button" variant="outline" />}>
        {triggerLabel}
      </PopoverTrigger>
      <EmrPopoverShell
        align="start"
        bodyScroll={bodyScroll}
        density={density}
        description="합성 조건을 빠르게 고르는 예시입니다."
        footer={<span className="emr-text-metadata text-muted-foreground">현재 화면에만 적용</span>}
        showClose
        title={title}
        width={width}
      >
        <EmrPopoverOptionGroup selectionMode="single">
          <EmrPopoverOption selected title="전체 보기" value="all" />
          <EmrPopoverOption title="담당 미정" value="unassigned" />
          <EmrPopoverOption disabled title="완료 숨김" value="hide-complete" />
        </EmrPopoverOptionGroup>
      </EmrPopoverShell>
    </Popover>
  );
}

const meta = {
  title: "Design System/EMR/EmrPopoverShell",
  component: EmrPopoverShellExample,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Use EmrPopoverShell for EMR anchored filter, picker, and compact detail popovers with shared header/body/footer density. 사용할 때: row, toolbar, or side panel controls need a small non-modal surface. 쓰지 말아야 할 때: blocking confirmation, long forms, or feature workflows that need modal focus.",
      },
    },
  },
  argTypes: {
    bodyScroll: {
      control: "boolean",
      description: "Whether the popover body should constrain height and scroll.",
    },
    density: {
      control: "radio",
      options: ["compact", "default"],
      description: "Text density for the popover shell.",
    },
    title: {
      control: "text",
      description: "Popover header title.",
    },
    triggerLabel: {
      control: "text",
      description: "Visible trigger label.",
    },
    width: {
      control: "radio",
      options: ["anchor", "sm", "md", "lg"],
      description: "Shared popover shell width.",
    },
  },
  args: {
    bodyScroll: false,
    density: "default",
    title: "샘플 필터",
    triggerLabel: "EMR 팝오버 열기",
    width: "md",
  },
  render: (args) => <EmrPopoverShellExample {...args} />,
} satisfies Meta<EmrPopoverShellStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

async function openEmrPopover(canvasElement: HTMLElement, title: string) {
  const button = Array.from(canvasElement.querySelectorAll("button")).find(
    (candidate) => candidate.textContent?.trim() === "EMR 팝오버 열기"
  );

  if (!button) throw new Error("Expected an EMR popover trigger button.");

  button.click();
  await new Promise((resolve) => window.setTimeout(resolve, 0));

  if (!canvasElement.ownerDocument.body.textContent?.includes(title)) {
    throw new Error("Expected the EMR popover shell title to appear.");
  }
}

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: table/queue 주변의 anchored filter surface. 쓰지 말아야 할 때: 저장/삭제처럼 explicit confirmation이 필요한 action.",
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    await openEmrPopover(canvasElement, args.title);
  },
};

export const CompactFields: Story = {
  args: {
    density: "compact",
    title: "수치 조건",
    width: "sm",
  },
  render: (args) => (
    <Popover>
      <PopoverTrigger render={<Button type="button" variant="outline" />}>
        {args.triggerLabel}
      </PopoverTrigger>
      <EmrPopoverShell align="start" density={args.density} title={args.title} width={args.width}>
        <EmrPopoverFieldRow label="범위" unit="분">
          <input
            className="h-8 w-full rounded-md border border-input bg-background px-2 pr-8 text-sm"
            defaultValue="30"
          />
        </EmrPopoverFieldRow>
        <EmrPopoverFieldRow label="필수" required>
          <input
            className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
            defaultValue="샘플"
          />
        </EmrPopoverFieldRow>
      </EmrPopoverShell>
    </Popover>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 작은 numeric/string 조건을 빠르게 조정할 때. 쓰지 말아야 할 때: validation, 저장, mutation 흐름이 필요한 form.",
      },
    },
  },
};
