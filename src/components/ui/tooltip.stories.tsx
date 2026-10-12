import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { EmrHistorySortButton } from "@/components/emr/history-controls";
import { CdsActionsSearchIcon } from "@/components/cds-icons/actions-and-controls";

import { Button } from "./button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";

type TooltipStoryArgs = {
  content: string;
  disabled: boolean;
  side: "top" | "right" | "bottom" | "left";
  sideOffset: number;
};

// The installed Popup emits data-slot/data-open but no implicit tooltip role.
// Test the actual visible hint; do not add a role in a story-only replacement.
function visibleHint(document: Document) {
  const hint = document.body.querySelector<HTMLElement>('[data-slot="tooltip-content"][data-open]');
  if (!hint) throw new Error("The current Tooltip popup must open.");
  return hint;
}

function TooltipExample({
  content,
  disabled,
  side,
  sideOffset,
}: TooltipStoryArgs) {
  const [count, setCount] = useState(0);
  return (
    <div className="grid justify-items-start gap-3 p-12">
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => setCount((value) => value + 1)}
            >
              샘플 작업
            </Button>
          }
        />
        <TooltipContent side={side} sideOffset={sideOffset}>
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
    {disabled ? <p>이 API 예제는 trigger를 비활성으로 설정했습니다.</p> : null}
    <output aria-label="합성 툴팁 작업 결과">실행 {count}회</output>
    </div>
  );
}

function HistorySortTooltipCaller() {
  const [direction, setDirection] = useState<"newest" | "oldest">("newest");
  return <div className="grid justify-items-start gap-3 p-12"><TooltipProvider>
    <EmrHistorySortButton direction={direction} onChange={setDirection} dateLabel="수납 이력일" />
  </TooltipProvider><output aria-label="합성 이력 정렬">{direction}</output></div>;
}
function IconTooltipExample(args: TooltipStoryArgs) {
  const [count, setCount] = useState(0);
  return <div className="grid justify-items-start gap-3 p-12"><TooltipProvider><Tooltip>
    <TooltipTrigger render={<Button type="button" variant="outline" size="icon-sm" aria-label="샘플 검색" disabled={args.disabled} onClick={() => setCount((value) => value + 1)}><CdsActionsSearchIcon aria-hidden="true" /></Button>} />
    <TooltipContent side={args.side} sideOffset={args.sideOffset}>{args.content}</TooltipContent>
  </Tooltip></TooltipProvider><output aria-label="합성 검색 실행">실행 {count}회</output></div>;
}

const meta = {
  title: "Design System/UI/Tooltip",
  component: TooltipExample,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Controls는 TooltipExample 조합 설정입니다. content는 TooltipContent 자식, disabled는 trigger Button, side·sideOffset은 TooltipContent에 전달합니다. 호출자는 버튼 이름과 필수 설명을 제공해야 합니다. Use Tooltip for short helper text on icon-only controls, dense controls, and abbreviated UI. 사용할 때: the UI is already usable and the tooltip adds clarification. 쓰지 말아야 할 때: required instructions, errors, confirmations, or content the user must read to complete a workflow.",
      },
    },
  },
  argTypes: {
    content: {
      control: "text",
      description: "Short helper copy. Keep it synthetic and concise.",
    },
    disabled: {
      control: "boolean",
      description: "Disables the trigger in this example. Disabled controls may not expose hover/focus tooltips reliably.",
    },
    side: {
      control: "radio",
      options: ["top", "right", "bottom", "left"],
      description: "Preferred tooltip placement relative to the trigger.",
    },
    sideOffset: {
      control: { type: "number", min: 0, max: 16 },
      description: "Spacing between trigger and tooltip content.",
    },
  },
  args: {
    content: "짧은 보조 설명만 표시합니다.",
    disabled: false,
    side: "top",
    sideOffset: 6,
  },
  render: (args) => <TooltipExample {...args} />,
} satisfies Meta<TooltipStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <HistorySortTooltipCaller />,
  play: async ({ canvas, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole("button", { name: "정렬: 최신순" });
    await userEvent.hover(trigger);
    await waitFor(() => { const hint = visibleHint(canvasElement.ownerDocument); expect(hint).toBeVisible(); expect(hint).toHaveTextContent("정렬: 최신순"); });
    await userEvent.click(trigger);
    await userEvent.click(await page.findByRole("menuitemradio", { name: "오래된순" }));
    await waitFor(() => expect(canvas.getByLabelText("합성 이력 정렬")).toHaveTextContent("oldest"));
    await expect(canvas.getByRole("button", { name: "정렬: 오래된순" })).toBeVisible();
  },
  parameters: {
    controls: { disable: true },
    docs: {
      description: {
        story:
          "실제 이력 정렬 버튼의 bottom Tooltip과 DropdownMenuTrigger 조합입니다. 정렬 변경과 접근 가능한 이름을 원본이 소유하며 방향만 로컬 상태로 제공합니다.",
      },
    },
  },
};

export const IconButtonHint: Story = {
  play: async ({ canvas, canvasElement }) => {
    const button = canvas.getByRole("button", { name: "샘플 검색" });
    await userEvent.tab();
    await expect(button).toHaveFocus();
    await waitFor(() => { const hint = visibleHint(canvasElement.ownerDocument); expect(hint).toBeVisible(); expect(hint).toHaveTextContent("검색"); });
    await userEvent.click(button); await expect(canvas.getByLabelText("합성 검색 실행")).toHaveTextContent("실행 1회");
  },
  args: {
    content: "검색",
  },
  render: (args) => <IconTooltipExample {...args} />,
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: icon-only control에 이미 aria-label이 있고 visual hint만 보강할 때. 쓰지 말아야 할 때: accessible label을 tooltip에만 의존할 때.",
      },
    },
  },
};

export const BottomPlacement: Story = {
  play: async ({ canvas, canvasElement }) => {
    const button = canvas.getByRole("button", { name: "샘플 작업" });
    await userEvent.hover(button);
    await waitFor(() => { const hint = visibleHint(canvasElement.ownerDocument); expect(hint).toBeVisible(); expect(hint).toHaveAttribute("data-side", "bottom"); expect(hint).toHaveTextContent("아래쪽에 표시되는 합성 안내입니다."); });
    await userEvent.click(button); await expect(canvas.getByLabelText("합성 툴팁 작업 결과")).toHaveTextContent("실행 1회");
  },
  args: {
    content: "아래쪽에 표시되는 합성 안내입니다.",
    side: "bottom",
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 상단 공간이 부족해 아래 배치가 더 안정적인 control. 쓰지 말아야 할 때: tooltip이 다음 UI를 가리는 경우.",
      },
    },
  },
};

export const DisabledTrigger: Story = {
  play: async ({ canvas }) => {
    const button = canvas.getByRole("button", { name: "샘플 작업" });
    await expect(button).toBeDisabled(); button.focus(); await expect(button).not.toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(canvas.getByLabelText("합성 툴팁 작업 결과")).toHaveTextContent("실행 0회");
  },
  args: {
    content: "비활성 상태에서는 별도 설명 UI를 고려하세요.",
    disabled: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: disabled trigger의 시각 상태를 확인할 때. 쓰지 말아야 할 때: 비활성 이유를 tooltip에만 숨겨 둘 때.",
      },
    },
  },
};
