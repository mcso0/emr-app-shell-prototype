import { useId } from "react";
import type { ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent } from "storybook/test";

import { Switch } from "./switch";
import { Textarea } from "./textarea";
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel } from "./field";
import { RegistrationNameCallerExample } from "./caller-parity.stories.fixture";

type FieldArgs = ComponentProps<typeof Field> & { invalid: boolean };
const meta = {
  title: "Design System/UI/Field", component: Field, tags: ["autodocs"],
  parameters: { docs: { description: { component: "등록 행은 실제 EmrRegistrationFieldRow와 EmrRegistrationSection을 재사용합니다. 나머지는 Field의 레이아웃·오류·입력 연결 API 예제입니다. 필드의 값과 검증, 저장은 호출자가 소유합니다." } } },
  argTypes: { orientation: { control: "radio", options: ["vertical", "horizontal", "responsive"] }, invalid: { control: "boolean", description: "Field의 data-invalid와 입력의 aria-invalid, 오류 문구를 함께 바꿉니다." } },
  args: { invalid: false, orientation: "vertical" },
} satisfies Meta<FieldArgs>;
export default meta;
type Story = StoryObj<FieldArgs>;

export const TextInputField: Story = {
  render: () => <RegistrationNameCallerExample />,
  parameters: { controls: { disable: true }, docs: { description: { story: "실제 등록 행의 필수 이름 필드입니다. 표시·라벨·입력 연결은 원본 컴포넌트를 재사용하며 초안만 로컬에서 바꿉니다." } } },
  play: async ({ canvas }) => {
    const input = canvas.getByRole("textbox", { name: "보호자명" });
    await userEvent.clear(input); await userEvent.type(input, "합성 보호자 수정");
    await expect(canvas.getByLabelText("합성 보호자명 초안")).toHaveTextContent("합성 보호자 수정");
  },
};
function ErrorField({ invalid, ...args }: FieldArgs) {
  const id = useId();
  return <Field {...args} data-invalid={invalid}>
    <FieldLabel htmlFor={id}>필수 메모</FieldLabel>
    <Textarea id={id} aria-invalid={invalid} aria-describedby={invalid ? `${id}-error` : undefined} placeholder="샘플 메모" rows={3} />
    {invalid ? <FieldError id={`${id}-error`}>샘플 메모를 한 줄 이상 입력하세요.</FieldError> : null}
  </Field>;
}
export const WithError: Story = {
  args: { invalid: true }, render: (args) => <ErrorField {...args} />,
  parameters: { docs: { description: { story: "오류 API 조합입니다. invalid Control은 입력과 연결된 오류 문구를 함께 바꿉니다. 입력은 편집할 수 있으며 검증값은 Control에서 설정합니다." } } },
  play: async ({ canvas }) => {
    const input = canvas.getByRole("textbox", { name: "필수 메모" });
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(input).toHaveAccessibleDescription("샘플 메모를 한 줄 이상 입력하세요.");
    await userEvent.type(input, "합성 메모"); await expect(input).toHaveValue("합성 메모");
  },
};
function ToggleField({ invalid, ...args }: FieldArgs) {
  const id = useId();
  return <Field {...args} className="max-w-md rounded-[var(--clair-radius-md)] border border-border bg-card p-3" data-invalid={invalid}>
    <Switch id={id} aria-invalid={invalid} />
    <FieldContent><FieldLabel htmlFor={id}>운영 알림 받기</FieldLabel><FieldDescription>독립 설정 입력의 Field API 예제입니다.</FieldDescription></FieldContent>
  </Field>;
}
export const HorizontalToggle: Story = {
  args: { orientation: "horizontal" }, render: (args) => <ToggleField {...args} />,
  parameters: { docs: { description: { story: "FieldContent와 가로 Field 레이아웃 API입니다. 값은 예제 내부에서 바뀝니다." } } },
  play: async ({ canvas }) => {
    const control = canvas.getByRole("switch", { name: "운영 알림 받기" });
    await expect(control).not.toBeChecked(); await userEvent.click(control); await expect(control).toBeChecked();
    control.focus(); await userEvent.keyboard(" "); await expect(control).not.toBeChecked();
  },
};
export const FieldSetGroup: Story = {
  render: () => <RegistrationNameCallerExample error="보호자명을 확인해주세요." />,
  parameters: { controls: { disable: true }, docs: { description: { story: "실제 보호자 정보 FieldSet·Legend와 오류가 있는 등록 행입니다. 원본처럼 편집은 초안만 바꾸며 기존 오류는 다음 검증 전까지 유지합니다." } } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("group", { name: "보호자 정보" })).toBeInTheDocument();
    const input = canvas.getByRole("textbox", { name: "보호자명" });
    await expect(input).toHaveAccessibleDescription("보호자명을 확인해주세요.");
    await userEvent.clear(input); await userEvent.type(input, "합성 초안");
    await expect(canvas.getByRole("alert")).toHaveTextContent("보호자명을 확인해주세요.");
    await expect(canvas.getByLabelText("합성 보호자명 초안")).toHaveTextContent("합성 초안");
  },
};
