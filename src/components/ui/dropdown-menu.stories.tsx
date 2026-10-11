import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { EmrTableDensitySelector } from "@/components/emr/table-density-selector";
import { EmrInlineAlert } from "@/components/emr/inline-alert";
import { EmrRowActionMenu } from "@/components/emr/row-action-menu";
import type { EmrTableDensity } from "@/components/emr/table-density";

import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./dropdown-menu";

type DropdownMenuStoryArgs = {
  align: "start" | "center" | "end";
  checked: boolean;
  radioValue: string;
  side: "top" | "right" | "bottom" | "left";
  triggerLabel: string;
};

function DropdownMenuExample({
  align,
  checked,
  radioValue,
  side,
  triggerLabel,
}: DropdownMenuStoryArgs) {
  const [showDetails, setShowDetails] = useState(checked);
  const [density, setDensity] = useState(radioValue);
  const [command, setCommand] = useState("없음");

  return (
    <div className="flex min-h-56 items-start p-8">
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button type="button" variant="outline" />}>
          {triggerLabel}
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} side={side} className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel>샘플 작업</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setCommand("상세 보기")}>
              상세 보기
              <DropdownMenuShortcut>Enter</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setCommand("목록에 고정")}>목록에 고정</DropdownMenuItem>
            <DropdownMenuItem disabled>사용할 수 없음</DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem checked={showDetails} onCheckedChange={setShowDetails}>
            보조 정보 표시
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup value={density} onValueChange={setDensity}>
            <DropdownMenuRadioItem value="compact">촘촘하게</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="comfortable">여유 있게</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>추가 옵션</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => setCommand("샘플 복사")}>샘플 복사</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCommand("샘플 내보내기")}>샘플 내보내기</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setCommand("샘플 제거")}>샘플 제거</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <output aria-label="합성 메뉴 결과">명령: {command} · 보조 정보: {showDetails ? "표시" : "숨김"} · 밀도: {density}</output>
    </div>
  );
}

const meta = {
  title: "Design System/UI/DropdownMenu",
  component: DropdownMenuExample,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Controls는 DropdownMenuExample 조합 설정입니다. checked·radioValue는 로컬 선택 상태의 초기값이며 변경하면 예제를 다시 시작합니다. 메뉴는 열림·선택을, 호출자는 실제 명령을 소유합니다. 일반 명령도 로컬 결과에 기록합니다. Default는 실제 EmrTableDensitySelector, RowActions는 고객 행과 같은 EmrRowActionMenu 구성입니다. RightAligned만 원시 메뉴 API 조합입니다. Use DropdownMenu for compact contextual command sets attached to one trigger. 사용할 때: row actions, overflow actions, or small view options. 쓰지 말아야 할 때: primary navigation, long forms, or blocking confirmations.",
      },
    },
  },
  argTypes: {
    align: {
      control: "radio",
      options: ["start", "center", "end"],
      description: "Popup alignment relative to the trigger.",
    },
    checked: {
      control: "boolean",
      description: "Initial checkbox state in the local fixture. Changing the Control restarts the example.",
    },
    radioValue: {
      control: "radio",
      options: ["compact", "comfortable"],
      description: "Initial radio value in the local fixture. Changing the Control restarts the example.",
    },
    side: {
      control: "radio",
      options: ["top", "right", "bottom", "left"],
      description: "Preferred popup side relative to the trigger.",
    },
    triggerLabel: {
      control: "text",
      description: "Visible trigger label for opening the menu.",
    },
  },
  args: {
    align: "start",
    checked: true,
    radioValue: "comfortable",
    side: "bottom",
    triggerLabel: "작업 메뉴",
  },
  render: (args) => <DropdownMenuExample key={`${args.checked}:${args.radioValue}`} {...args} />,
} satisfies Meta<DropdownMenuStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

async function openMenu(canvasElement: HTMLElement, triggerLabel: string) {
  const trigger = within(canvasElement).getByRole("button", { name: triggerLabel });
  await userEvent.click(trigger);
  let popup: HTMLElement | null = null;
  await waitFor(() => {
    const id = trigger.getAttribute("aria-controls");
    popup = id ? canvasElement.ownerDocument.getElementById(id) : null;
    expect(popup).toBeVisible();
  });
  return popup!;
}
function DensityCallerExample() {
  const [density, setDensity] = useState<EmrTableDensity>("standard");
  return <div className="grid justify-items-start gap-3"><EmrTableDensitySelector value={density} onValueChange={setDensity} /><output aria-label="합성 표 밀도 결과">{density}</output></div>;
}
function CustomerRowActionsExample() {
  const [receipt, setReceipt] = useState("없음");
  const [feedback, setFeedback] = useState<{ title: string; body: string } | null>(null);
  return <div className="grid justify-items-start gap-3">
    <EmrRowActionMenu ariaLabel="합성 고객 행 작업" contentClassName="w-56"
      triggerClassName="size-6 shrink-0 rounded-md border-[var(--emr-border-default)] bg-[var(--clair-color-atomic-common-100)] p-0 text-[var(--clair-color-atomic-neutral-700)] shadow-[var(--clair-shadow-xs)] hover:bg-[var(--emr-state-hover)] [&_svg]:size-3.5"
      items={[
        { key: "open", label: "상세 보기", description: "프로필 drawer 열기", onSelect: () => setReceipt("합성 프로필 열기") },
        { key: "chart", label: "차트 보러가기", description: "진료/차트 화면 연결 전", onSelect: () => setFeedback({ title: "차트 보기는 아직 직접 연결되지 않았습니다", body: "합성 고객의 차트 이동은 진료/차트 화면의 환자 선택 흐름에서 확인해 주세요. 여기서는 프로필 drawer와 고객 정보만 열 수 있습니다." }) },
        { key: "kakao", label: "카카오톡 발송", description: "외부 발송 미연동", onSelect: () => setFeedback({ title: "카카오톡 발송은 아직 연결되지 않았습니다", body: "실제 카카오톡, 문자, 이메일 발송은 이번 MVP 범위에 포함되지 않습니다. 동의 상태와 연락처만 이 화면에서 확인해 주세요." }) },
      ]}
    />
    {feedback ? <EmrInlineAlert severity="info" title={feedback.title} action={<Button size="sm" variant="outline" onClick={() => setFeedback(null)}>확인</Button>} testId="customer-row-action-feedback">{feedback.body}</EmrInlineAlert> : null}
    <output aria-label="합성 고객 행 결과">{receipt}</output>
  </div>;
}

export const Default: Story = {
  render: () => <DensityCallerExample />,
  parameters: { controls: { disable: true }, docs: { description: { story: "공유 표의 실제 EmrTableDensitySelector 호출자입니다. 원본의 크기·이름·세 밀도 옵션을 유지합니다. 선택은 로컬 value와 버튼 이름을 바꾸며 표 자체의 레이아웃 검증은 EMR 표 스토리가 소유합니다." } } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const popup = await openMenu(canvasElement, "테이블 보기 밀도: 기본 간격");
    await expect(within(popup).getAllByRole("menuitemradio")).toHaveLength(3);
    await userEvent.click(within(popup).getByRole("menuitemradio", { name: "좁은 간격" }));
    await waitFor(() => expect(canvas.getByLabelText("합성 표 밀도 결과")).toHaveTextContent("compact"));
    await expect(canvas.getByRole("button", { name: "테이블 보기 밀도: 좁은 간격" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(popup).not.toBeVisible());
  },
};

export const RowActions: Story = {
  render: () => <CustomerRowActionsExample />,
  parameters: { controls: { disable: true }, docs: { description: { story: "고객 테이블의 실제 행 메뉴와 같은 EmrRowActionMenu 속성·크기·항목·설명을 사용합니다. 상세는 로컬 열기 결과로, 미연동 차트·카카오 항목은 실제 안내 문구로 연결합니다. 전체 고객 표와 등록 동작은 feature 스토리가 소유합니다." } } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    let popup = await openMenu(canvasElement, "합성 고객 행 작업");
    await userEvent.click(within(popup).getByRole("menuitem", { name: /상세 보기/ }));
    await waitFor(() => expect(canvas.getByLabelText("합성 고객 행 결과")).toHaveTextContent("합성 프로필 열기"));
    popup = await openMenu(canvasElement, "합성 고객 행 작업");
    await userEvent.click(within(popup).getByRole("menuitem", { name: /카카오톡 발송/ }));
    await waitFor(() => expect(canvas.getByTestId("customer-row-action-feedback")).toHaveTextContent("카카오톡 발송은 아직 연결되지 않았습니다"));
    await expect(canvas.getByTestId("customer-row-action-feedback")).toHaveTextContent("실제 카카오톡, 문자, 이메일 발송은 이번 MVP 범위에 포함되지 않습니다.");
    await userEvent.click(canvas.getByRole("button", { name: "확인" }));
    await expect(canvas.queryByTestId("customer-row-action-feedback")).not.toBeInTheDocument();
  },
};

export const RightAligned: Story = {
  play: async ({ canvasElement, args }) => {
    const popup = await openMenu(canvasElement, args.triggerLabel);
    const menu = within(popup), canvas = within(canvasElement);
    const checkbox = menu.getByRole("menuitemcheckbox");
    await expect(checkbox).toHaveAttribute("aria-checked", String(args.checked));
    await userEvent.click(checkbox);
    await waitFor(() => expect(checkbox).toHaveAttribute("aria-checked", String(!args.checked)));
    const radio = menu.getByRole("menuitemradio", { name: args.radioValue === "compact" ? "여유 있게" : "촘촘하게" });
    await userEvent.click(radio);
    await waitFor(() => expect(radio).toHaveAttribute("aria-checked", "true"));
    await expect(menu.getByRole("menuitem", { name: "사용할 수 없음" })).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(menu.getByRole("menuitem", { name: /상세 보기/ }));
    await waitFor(() => expect(canvas.getByLabelText("합성 메뉴 결과")).toHaveTextContent("명령: 상세 보기"));
    await waitFor(() => expect(popup).not.toBeVisible());
    const reopened = await openMenu(canvasElement, args.triggerLabel);
    await userEvent.click(within(reopened).getByRole("menuitem", { name: "추가 옵션" }));
    const copy = await within(canvasElement.ownerDocument.body).findByRole("menuitem", { name: "샘플 복사" });
    await userEvent.click(copy);
    await waitFor(() => expect(canvas.getByLabelText("합성 메뉴 결과")).toHaveTextContent("명령: 샘플 복사"));
  },
  args: {
    align: "end",
    triggerLabel: "우측 정렬 메뉴",
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 우측 toolbar 끝에서 메뉴가 viewport 안쪽으로 열려야 할 때. 쓰지 말아야 할 때: 좁은 공간에서 submenu가 잘릴 수 있을 때.",
      },
    },
  },
};
