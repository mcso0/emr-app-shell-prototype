import { expect, userEvent, waitFor, within } from "storybook/test";
import { BillingHistoryPeriodCallerExample } from "./caller-parity.stories.fixture";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button } from "./button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "./popover";

type PopoverStoryArgs = {
  description: string;
  side: "top" | "right" | "bottom" | "left";
  sideOffset: number;
  title: string;
  triggerLabel: string;
};

function PopoverExample({
  description,
  side,
  sideOffset,
  title,
  triggerLabel,
}: PopoverStoryArgs) {
  return (
    <Popover>
      <PopoverTrigger render={<Button type="button" variant="outline" />}>
        {triggerLabel}
      </PopoverTrigger>
      <PopoverContent align="start" side={side} sideOffset={sideOffset}>
        <PopoverHeader>
          <PopoverTitle>{title}</PopoverTitle>
          <PopoverDescription>{description}</PopoverDescription>
        </PopoverHeader>
        <div className="grid gap-2 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span>샘플 조건</span>
            <span className="text-muted-foreground">전체</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>샘플 상태</span>
            <span className="text-muted-foreground">진행</span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

const meta = {
  title: "Design System/UI/Popover",
  component: PopoverExample,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Default는 수납 이력의 실제 기간 필터입니다. 나머지 Controls는 PopoverExample API 조합 설정입니다. title·description은 하위 제목·설명, side·sideOffset은 PopoverContent에 전달합니다. 표시된 필터 값은 합성 요약이며 편집하거나 저장하지 않습니다. Use Popover for anchored non-modal controls such as small filters, pickers, and contextual details. 사용할 때: the user can keep working outside the surface. 쓰지 말아야 할 때: blocking confirmation, destructive decisions, or long forms that need modal focus.",
      },
    },
  },
  argTypes: {
    description: {
      control: "text",
      description: "Short supporting copy for the popover header.",
    },
    side: {
      control: "radio",
      options: ["top", "right", "bottom", "left"],
      description: "Preferred popover side relative to the trigger.",
    },
    sideOffset: {
      control: { type: "number", min: 0, max: 16 },
      description: "Spacing between trigger and popover.",
    },
    title: {
      control: "text",
      description: "Popover title. Keep it scoped to the anchored task.",
    },
    triggerLabel: {
      control: "text",
      description: "Visible trigger label for opening the popover.",
    },
  },
  args: {
    description: "Popover API의 조회 전용 요약 예제입니다.",
    side: "bottom",
    sideOffset: 6,
    title: "샘플 필터",
    triggerLabel: "팝오버 열기",
  },
  render: (args) => <PopoverExample {...args} />,
} satisfies Meta<PopoverStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

async function openPopover(canvasElement: HTMLElement, label: string, title: string) {
  const trigger = within(canvasElement).getByRole("button", { name: label });
  await userEvent.click(trigger);
  let popup: HTMLElement | null = null;
  await waitFor(() => {
    const id = trigger.getAttribute("aria-controls");
    popup = id ? canvasElement.ownerDocument.getElementById(id) : null;
    expect(popup).toBeVisible();
    expect(popup).toHaveTextContent(title);
  });
  return popup!;
}

export const Default: Story = {
  render: () => <BillingHistoryPeriodCallerExample />,
  parameters: { controls: { disable: true }, docs: { description: { story: "수납 이력의 실제 EmrHistoryFilterPopover와 동일한 직접 기간 조합입니다. 날짜의 draft/apply/cancel, 초기화, 필수 날짜 검증을 유지하고 적용 결과만 로컬로 기록합니다. 원시 Popover의 위치 Controls는 이 고정된 호출자 조합에서 사용하지 않습니다." } } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    let popup = await openPopover(canvasElement, "직접", "수납 이력 기간");
    await userEvent.click(within(popup).getByRole("button", { name: "초기화" }));
    await expect(within(popup).getByRole("alert")).toHaveTextContent("시작일과 종료일을 모두 입력해 주세요.");
    await expect(within(popup).getByRole("button", { name: "적용" })).toBeDisabled();
    await userEvent.click(within(popup).getByRole("button", { name: "취소" }));
    await waitFor(() => expect(popup).not.toBeVisible());
    await expect(canvas.getByLabelText("합성 수납 기간 결과")).toHaveTextContent("적용 0회");
    popup = await openPopover(canvasElement, "직접", "수납 이력 기간");
    await expect(within(popup).getByLabelText("시작일")).toHaveValue("2026-07-11");
    await userEvent.clear(within(popup).getByLabelText("시작일"));
    await userEvent.type(within(popup).getByLabelText("시작일"), "2026-06-01");
    await expect(within(popup).getByRole("button", { name: "적용" })).toBeEnabled();
    await userEvent.click(within(popup).getByRole("button", { name: "적용" }));
    await waitFor(() => expect(popup).not.toBeVisible());
    await expect(canvas.getByLabelText("합성 수납 기간 결과")).toHaveTextContent("2026-06-01 ~ 2026-10-11 · 적용 1회");
    await userEvent.click(canvas.getByRole("button", { name: "직접 기간 조건 해제" }));
    await expect(canvas.getByRole("button", { name: "직접" })).toHaveAttribute("aria-pressed", "false");
    popup = await openPopover(canvasElement, "직접", "수납 이력 기간");
    await expect(within(popup).getByLabelText("시작일")).toHaveValue("2026-07-11");
    await expect(within(popup).getByLabelText("종료일")).toHaveValue("2026-10-11");
    await userEvent.click(within(popup).getByRole("button", { name: "취소" }));
    await waitFor(() => expect(popup).not.toBeVisible());
  },
};

export const FilterSummary: Story = {
  play: async ({ canvasElement, args }) => { const popup = await openPopover(canvasElement, args.triggerLabel, args.title); await expect(popup).toHaveTextContent("샘플 조건"); await userEvent.keyboard("{Escape}"); await waitFor(() => expect(popup).not.toBeVisible()); },
  args: {
    description: "Popover API의 읽기 전용 합성 필터 요약입니다.",
    title: "표 필터",
    triggerLabel: "필터 열기",
  },
  parameters: {
    docs: {
      description: {
        story:
          "원시 Popover API의 읽기 전용 필터 요약입니다. 표시 값은 편집하거나 적용하지 않으며 열기와 Escape 닫기만 검증합니다.",
      },
    },
  },
};

export const RightPlacement: Story = {
  play: async ({ canvasElement, args }) => { const popup = await openPopover(canvasElement, args.triggerLabel, args.title); await expect(popup).toHaveAttribute("data-side", args.side); await userEvent.keyboard("{Escape}"); await waitFor(() => expect(popup).not.toBeVisible()); },
  args: {
    description: "오른쪽 공간을 사용하는 합성 popover입니다.",
    side: "right",
    title: "오른쪽 패널",
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 왼쪽 rail이나 compact toolbar 옆에 anchored details를 보여줄 때. 쓰지 말아야 할 때: viewport 밖으로 잘리는 좁은 화면.",
      },
    },
  },
};
