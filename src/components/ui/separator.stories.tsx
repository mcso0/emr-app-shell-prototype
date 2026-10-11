import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, userEvent } from "storybook/test";
import { EmrRegistrationSection } from "@/components/emr/registration-dialog";

import { Button } from "./button";
import { Separator } from "./separator";

type SeparatorStoryArgs = {
  orientation: "horizontal" | "vertical";
};

function SeparatorExample({ orientation }: SeparatorStoryArgs) {
  const [viewed, setViewed] = useState(false);
  if (orientation === "vertical") {
    return (
      <div className="flex h-16 items-center gap-3 rounded-md border border-border bg-card p-4">
        <span className="text-sm font-medium">샘플 요약</span>
        <Separator orientation="vertical" />
        <span className="text-sm text-muted-foreground">보조 정보</span>
        <Separator orientation="vertical" />
        <Button type="button" variant="outline" size="sm" onClick={() => setViewed((value) => !value)}>
          보기
        </Button>
        {viewed ? <output aria-label="합성 구분 영역 보기">보조 정보 선택</output> : null}
      </div>
    );
  }

  return (
    <div className="max-w-md rounded-md border border-border bg-card p-4">
      <div>
        <div className="text-sm font-medium">샘플 섹션</div>
        <p className="mt-1 text-sm text-muted-foreground">
          구분선은 관련 없는 내용을 나누되, 새 panel처럼 보이게 만들지 않습니다.
        </p>
      </div>
      <Separator className="my-4" />
      <div className="text-sm text-muted-foreground">
        실제 환자, 보호자, 병원, 결제, 신원 정보는 포함하지 않습니다.
      </div>
    </div>
  );
}

const meta = {
  title: "Design System/UI/Separator",
  component: SeparatorExample,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "orientation Control은 Separator에 전달하는 실제 방향입니다. 나머지 콘텐츠와 높이는 SeparatorExample이 제공하며 구분할 영역과 배치는 호출자가 소유합니다. Use Separator to divide related groups inside one surface without creating a new panel. 사용할 때: menu groups, metadata rows, or sections need a subtle boundary. 쓰지 말아야 할 때: spacing alone is enough, or content needs a semantic heading/table boundary instead.",
      },
    },
  },
  argTypes: {
    orientation: {
      control: "radio",
      options: ["horizontal", "vertical"],
      description: "Separator orientation.",
    },
  },
  args: {
    orientation: "horizontal",
  },
  render: (args) => <SeparatorExample {...args} />,
} satisfies Meta<SeparatorStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

function assertSeparatorGeometry(canvasElement: HTMLElement, orientation: "horizontal" | "vertical") {
  const separators = canvasElement.querySelectorAll<HTMLElement>('[role="separator"]');
  if (!separators.length) throw new Error("Expected a semantic separator.");
  for (const separator of separators) {
    const rect = separator.getBoundingClientRect();
    if (
      separator.dataset.orientation !== orientation ||
      separator.getAttribute("aria-orientation") !== orientation ||
      (orientation === "horizontal"
        ? Math.abs(rect.height - 1) > 0.1 || rect.width < 20
        : Math.abs(rect.width - 1) > 0.1 || rect.height < 20)
    ) throw new Error(`The ${orientation} separator must expose its orientation and a visible 1px rule.`);
  }
}

export const Horizontal: Story = {
  render: () => <div className="grid max-w-xl gap-3">
    <EmrRegistrationSection separated={false} title="보호자 정보"><p>합성 보호자 초안</p></EmrRegistrationSection>
    <EmrRegistrationSection title="연락처 및 주소"><p>합성 연락처 초안</p></EmrRegistrationSection>
  </div>,
  play: async ({ canvasElement }) => assertSeparatorGeometry(canvasElement, "horizontal"),
  parameters: {
    controls: { disable: true },
    docs: {
      description: {
        story:
          "실제 등록 폼 EmrRegistrationSection 사이의 수평 구분선입니다. section 구조와 색·방향은 원본이 소유하며 내용만 합성 문구입니다.",
      },
    },
  },
};

export const Vertical: Story = {
  args: {
    orientation: "vertical",
  },
  play: async ({ canvasElement, canvas }) => {
    assertSeparatorGeometry(canvasElement, "vertical");
    await userEvent.click(canvas.getByRole("button", { name: "보기" }));
    await expect(canvas.getByLabelText("합성 구분 영역 보기")).toHaveTextContent("보조 정보 선택");
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: toolbar나 metadata row 안의 짧은 그룹을 나눌 때. 쓰지 말아야 할 때: 좁은 화면에서 content가 눌리거나 wrapping되는 경우.",
      },
    },
  },
};
