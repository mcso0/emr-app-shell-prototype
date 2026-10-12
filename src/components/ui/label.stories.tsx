import { useId } from "react";
import type { ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent } from "storybook/test";

import { Input } from "./input";
import { Label } from "./label";
import { RegistrationNameCallerExample } from "./caller-parity.stories.fixture";

type LabelExampleArgs = ComponentProps<typeof Label> & { inputDisabled: boolean };
function LabelExample({ inputDisabled, ...args }: LabelExampleArgs) {
  const id = useId();
  return (
    <div className="group grid max-w-sm gap-2" data-disabled={inputDisabled}>
      <Label {...args} htmlFor={id} />
      <Input id={id} disabled={inputDisabled} className="peer" placeholder="합성 값" />
    </div>
  );
}

const meta = {
  title: "Design System/UI/Label",
  component: LabelExample,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: "입력의 이름을 화면에 표시하고 htmlFor와 입력 id로 연결합니다. 폼 전체의 설명·오류 구조에는 Field를 사용하세요. inputDisabled는 연결된 입력의 상태를 보여주는 예제 설정이며 Label의 prop이 아닙니다. 이름과 비활성 상태는 호출자가 소유합니다.",
      },
    },
  },
  args: { children: "합성 항목 이름", inputDisabled: false },
  argTypes: { inputDisabled: { control: "boolean", description: "연결된 입력의 비활성 예제 상태입니다." } },
  render: (args) => <LabelExample {...args} />,
} satisfies Meta<LabelExampleArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

function assertLabelAssociation(canvasElement: HTMLElement) {
  const label = canvasElement.querySelector<HTMLLabelElement>("label");
  const input = canvasElement.querySelector<HTMLInputElement>("input");
  if (!label?.textContent?.trim() || !input || label.control !== input || !Array.from(input.labels ?? []).includes(label)) throw new Error("The visible label must name its associated input.");
}

export const Default: Story = {
  render: () => <RegistrationNameCallerExample />,
  parameters: { controls: { disable: true }, docs: { description: { story: "실제 등록 행의 FieldLabel은 Label을 재사용합니다. 필수 표시·아이콘·입력 연결은 실제 컴포넌트가 렌더합니다." } } },
  play: async ({ canvas, canvasElement }) => {
    assertLabelAssociation(canvasElement);
    const label = canvasElement.querySelector("label");
    if (!label) throw new Error("Registration label must exist.");
    await userEvent.click(label);
    await expect(canvas.getByRole("textbox", { name: "보호자명" })).toHaveFocus();
  },
};
export const DisabledInput: Story = {
  parameters: { docs: { description: { story: "연결된 입력이 비활성일 때의 이름표와 입력 상태입니다." } } },
  args: { inputDisabled: true },
  play: async ({ canvasElement }) => {
    assertLabelAssociation(canvasElement);
    if (!canvasElement.querySelector<HTMLInputElement>("input")?.disabled) throw new Error("The disabled input example must retain its native unavailable state.");
  },
};
