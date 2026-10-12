import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { FulfillmentWorkLifecycleAction } from "@/features/fulfillment/components/work-lifecycle-action";

import { ButtonGroup, ButtonGroupDivider, ButtonGroupIconButton, ButtonGroupPrimaryButton, type ButtonGroupSize } from "./button-group";

type ButtonGroupExampleArgs = { size: ButtonGroupSize; disabled: boolean };

function FulfillmentGroupCaller() {
  const [status, setStatus] = useState<"requested" | "in_progress" | "completed">("requested");
  const [receipt, setReceipt] = useState("전환 없음");
  return <div className="grid justify-items-start gap-3">
    <FulfillmentWorkLifecycleAction activityLabel="검사" completeLabel="검사완료" assignedToUserId="synthetic-assignee" status={status} size="sm"
      loadEligibleAssignees={async () => []} onTransition={async (action) => {
        setReceipt(action);
        if (action === "start") setStatus("in_progress");
        else if (action === "complete") setStatus("completed");
        return true;
      }} />
    <output aria-label="합성 업무 전환">{receipt}</output>
  </div>;
}

function ButtonGroupExample({ size, disabled }: ButtonGroupExampleArgs) {
  const [message, setMessage] = useState("합성 작업을 선택하세요.");
  return (
    <div className="grid justify-items-start gap-3">
      <ButtonGroup aria-label="합성 작업 묶음">
        <ButtonGroupPrimaryButton size={size} disabled={disabled} onClick={() => setMessage("합성 적용 완료")}>적용</ButtonGroupPrimaryButton>
        <ButtonGroupDivider />
        <ButtonGroupIconButton size={size} disabled={disabled} aria-label="합성 보조 작업" onClick={() => setMessage("합성 보조 작업 선택")}><span aria-hidden="true">⌄</span></ButtonGroupIconButton>
      </ButtonGroup>
      <output role="status">{message}</output>
    </div>
  );
}

const meta = {
  title: "Design System/UI/ButtonGroup",
  component: ButtonGroupExample,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: "주 작업과 보조 작업을 붙여 보여줄 때 사용합니다. ButtonGroup은 묶음의 표시와 group 역할을 소유합니다. size와 disabled Controls는 자식 버튼에 적용하는 예제 설정입니다. 그룹과 아이콘 버튼에는 접근 가능한 이름을 지정하세요. 실제 메뉴·업무 상태·저장은 호출자가 소유하며 이 예제는 로컬 합성 상태만 바꿉니다.",
      },
    },
  },
  args: { size: "default", disabled: false },
  argTypes: {
    size: { control: "radio", options: ["xs", "sm", "default", "lg"], description: "자식 버튼의 크기를 함께 바꾸는 예제 설정입니다." },
    disabled: { control: "boolean", description: "자식 버튼의 비활성 상태를 바꾸는 예제 설정입니다." },
  },
  render: (args) => <ButtonGroupExample {...args} />,
} satisfies Meta<ButtonGroupExampleArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <FulfillmentGroupCaller />,
  parameters: { controls: { disable: true }, docs: { description: { story: "실제 배정된 업무의 요청/진행 ButtonGroup입니다. 원본 컴포넌트가 시작·진행 표시·메뉴·비활성을 렌더합니다. 담당자 조회와 전환 콜백만 합성 로컬 결과로 대체합니다." } } },
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(canvas.getByRole("button", { name: "검사 시작" }));
    await waitFor(() => expect(canvas.getByLabelText("합성 업무 전환")).toHaveTextContent("start"));
    await expect(canvas.getByRole("button", { name: "검사 중" })).toBeDisabled();
    await userEvent.click(canvas.getByRole("button", { name: "검사 상태 액션 열기" }));
    await userEvent.click(await within(canvasElement.ownerDocument.body).findByRole("menuitem", { name: "검사완료" }));
    await waitFor(() => expect(canvas.getByLabelText("합성 업무 전환")).toHaveTextContent("complete"));
    await expect(canvas.getByRole("button", { name: "검사완료" })).toBeDisabled();
  },
};

export const Sizes: Story = {
  parameters: { controls: { disable: true }, docs: { description: { story: "API 크기 비교입니다. 주 버튼과 아이콘 버튼에 같은 크기 계약과 각각의 로컬 콜백을 적용합니다." } } },
  render: () => <div className="grid gap-4">{(["xs", "sm", "default", "lg"] as const).map((size) => <ButtonGroupExample key={size} size={size} disabled={false} />)}</div>,
};
export const Disabled: Story = {
  parameters: { docs: { description: { story: "비활성 버튼은 콜백을 실행하지 않습니다. 권한 검증 예시는 아닙니다." } } },
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    const buttons = canvasElement.querySelectorAll<HTMLButtonElement>("button");
    if (buttons.length !== 2 || Array.from(buttons).some((button) => !button.disabled)) throw new Error("Disabled grouped actions must remain unavailable.");
    buttons[0].click();
    if (canvasElement.textContent?.includes("합성 적용 완료")) throw new Error("A disabled action must not run its callback.");
  },
};
