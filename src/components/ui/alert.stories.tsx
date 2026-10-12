import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor } from "storybook/test";
import { EmrInlineAlert } from "@/components/emr/inline-alert";

import { Alert, AlertAction, AlertDescription, AlertTitle } from "./alert";
import { Button } from "./button";

const meta = {
  title: "Design System/UI/Alert",
  component: Alert,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: "한 영역 안의 안내를 제목과 설명으로 묶습니다. 업무 오류·권한·재시도 안내에는 EmrInlineAlert를 먼저 사용하세요. Alert는 표시와 role=alert를 소유하며 업무 상태와 저장은 호출자가 소유합니다. 아래 동작은 합성 상태만 변경합니다.",
      },
    },
  },
  args: { variant: "default" },
  argTypes: { variant: { control: "radio", options: ["default", "destructive"], description: "Visual tone only; callers own the condition and recovery action." } },
  render: (args) => (
    <Alert {...args} className="max-w-md">
      <AlertTitle>합성 안내</AlertTitle>
      <AlertDescription>현재 화면 안에서 확인할 보조 설명입니다.</AlertDescription>
    </Alert>
  ),
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <EmrInlineAlert severity="info" title="합성 읽기 안내">합성 데이터로 표시한 실제 EmrInlineAlert 조합입니다.</EmrInlineAlert>,
  parameters: { controls: { disable: true }, docs: { description: { story: "제품의 Alert 호출자는 EmrInlineAlert입니다. 실제 아이콘·톤·status 역할과 제목·설명 구조를 렌더합니다. 문구만 합성입니다." } } },
  play: async ({ canvas }) => { await expect(canvas.getByRole("status")).toHaveTextContent("합성 읽기 안내"); },
};
export const Destructive: Story = {
  parameters: { docs: { description: { story: "오류 색상만 보여줍니다. 오류 원인과 복구 동작은 호출자가 제공합니다." } } }, args: { variant: "destructive" } };

function DismissibleAlertExample(args: React.ComponentProps<typeof Alert>) {
  const [visible, setVisible] = useState(true);
  return visible ? (
    <Alert {...args} className="max-w-md">
      <AlertTitle>닫을 수 있는 합성 안내</AlertTitle>
      <AlertDescription>이 버튼은 예제 안의 표시 상태만 변경합니다.</AlertDescription>
      <AlertAction>
        <Button size="xs" variant="ghost" aria-label="합성 안내 닫기" onClick={() => setVisible(false)}>닫기</Button>
      </AlertAction>
    </Alert>
  ) : <p role="status">합성 안내를 닫았습니다.</p>;
}

export const WithAction: Story = {
  parameters: { docs: { description: { story: "닫기 버튼이 예제 내부의 안내 표시 상태를 바꿉니다. 실제 업무 상태는 변경하지 않습니다." } } },
  render: (args) => <DismissibleAlertExample {...args} />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent("닫을 수 있는 합성 안내");
    await userEvent.click(canvas.getByRole("button", { name: "합성 안내 닫기" }));
    await waitFor(() => expect(canvas.queryByRole("alert")).not.toBeInTheDocument());
    await expect(canvas.getByRole("status")).toHaveTextContent("합성 안내를 닫았습니다.");
  },
};
