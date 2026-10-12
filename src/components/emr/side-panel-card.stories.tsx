import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
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
  const [selection, setSelection] = useState(selected);
  const [receipt, setReceipt] = useState(0);
  const [action, setAction] = useState(false);
  return (
    <div className="w-[288px] rounded-lg bg-[var(--emr-surface-sidepanel)] p-3">
      <EmrSidePanelCard
        selected={selection}
        selectionVariant={selectionVariant}
        onSelect={() => { setSelection(true); setReceipt(value => value + 1); }}
      >
        <div className="grid gap-2">
          <EmrSidePanelIdentityLine
            action={<EmrSidePanelCardAction ariaLabel="샘플 항목 더보기" items={[{ key: "example", label: "합성 항목 확인", onSelect: () => setAction(true) }]} />}
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
      <output role="status">선택 요청 {receipt}회{action ? " · 항목 확인됨" : ""}</output>
    </div>
  );
}

const meta = {
  title: "Design System/EMR/EmrSidePanelCard",
  component: EmrSidePanelCardExample,
  tags: ["autodocs"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement); const card = canvas.getByRole("button", { name: /샘플 환자/ });
    card.focus(); await userEvent.keyboard("{Enter}"); await expect(card).toHaveAttribute("aria-pressed", "true");
    await userEvent.hover(card); await userEvent.click(canvas.getByRole("button", { name: "샘플 항목 더보기" }));
    await userEvent.click(await within(canvasElement.ownerDocument.body).findByRole("menuitem", { name: "합성 항목 확인" }));
    await expect(canvas.getByRole("status")).toHaveTextContent("선택 요청 1회 · 항목 확인됨");
  },
  parameters: {
    docs: {
      description: {
        component:
          "EmrSidePanelCard는 children을 담는 공통 선택 surface입니다. selected와 선택 콜백은 호출자가 소유하고, onSelect가 있을 때만 button role·tabIndex·aria-pressed가 생깁니다. 이 예시는 IdentityLine, TypeBadge, StatusBadge, MetaBadge, CardAction을 직접 조합해 보여줍니다. 실제 업무 카드의 오더명·요청 정보·담당자 배치는 EmrTaskQueueCard가 소유합니다. 환자별 배치는 PatientQueueContent가 patientView를 전달합니다. 일반 page card나 업무 상태 모델로 사용하지 않습니다.",
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
  render: (args) => <EmrSidePanelCardExample key={`${args.selected}-${args.selectionVariant}`} {...args} />,
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

export const Unselected: Story = {
  args: { selected: false },
  parameters: { docs: { description: { story: "선택 가능한 미선택 surface입니다. 초기 선택 상태는 Controls로 조절합니다. 클릭·Enter는 실제 호출자처럼 선택을 유지하고 선택 요청 결과를 표시합니다." } } },
};

export const NonSelectable: Story = {
  play: async ({ canvas }) => { await expect(canvas.queryByRole("button")).not.toBeInTheDocument(); },
  render: () => (
    <div className="w-[288px] p-3">
      <EmrSidePanelCard selected={false} selectionVariant="modulePanel">
        <EmrSidePanelIdentityLine patientName="합성 환자" guardianName="합성 보호자" />
      </EmrSidePanelCard>
    </div>
  ),
  parameters: { controls: { disable: true }, docs: { description: { story: "onSelect를 생략하면 선택 버튼 역할과 키보드 포커스가 없는 표시용 surface가 됩니다. 메뉴만 필요한 업무 카드는 EmrTaskQueueCard의 MenuOnly 예시를 사용합니다." } } },
};
