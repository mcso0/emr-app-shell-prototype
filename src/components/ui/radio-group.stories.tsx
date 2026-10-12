import { useId, useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent } from "storybook/test";
import { cn } from "@/lib/utils";

import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "./field";
import { Radio, RadioGroup } from "./radio-group";

type RadioGroupStoryArgs = {
  defaultValue: string;
  disabled: boolean;
  invalid: boolean;
  orientation: "vertical" | "horizontal";
};

const options = [
  {
    description: "짧고 밀도 높은 합성 목록에 적합합니다.",
    label: "촘촘하게",
    value: "compact",
  },
  {
    description: "일반적인 업무 화면에서 읽기 좋습니다.",
    label: "기본",
    value: "default",
  },
  {
    description: "검토용 화면에서 행간을 더 확보합니다.",
    label: "여유 있게",
    value: "comfortable",
  },
];

// Bounded copy of the private RegistrationModeCard at profile-drawer.tsx:3104.
// The exported registration ancestor owns live store/registration effects; this specimen owns only mode.
const registrationModes = [
  { value: "new_guardian_patient", title: "환자/보호자 모두 신규 등록", description: "처음 내원한 보호자와 동물을 함께 등록합니다." },
  { value: "existing_guardian_patient", title: "기존 보호자에 신규 환자 등록", description: "이미 등록된 보호자에게 새 동물을 연결합니다." },
];
function RegistrationModeCaller() {
  const [mode, setMode] = useState("new_guardian_patient");
  return <div className="grid max-w-xl gap-3">
    <RadioGroup aria-label="등록 유형 선택" value={mode} onValueChange={(value) => setMode(String(value))}>
      {registrationModes.map(({ value, title, description }) => {
        const checked = mode === value;
        return <label key={value} className={cn("flex w-full cursor-pointer items-center gap-4 rounded-lg border bg-card p-4 text-left transition-colors hover:bg-[var(--emr-state-hover)] focus-within:ring-3 focus-within:ring-ring/50", checked && "border-[var(--emr-state-selected-border)] bg-[var(--emr-state-selected)]")}>
          <Radio value={value} aria-label={title} className={cn(checked && "border-[var(--emr-state-selected-border)] text-[var(--emr-state-selected-border)]")} />
          <span className="min-w-0"><span className="block text-[15px] font-bold text-foreground">{title}</span><span className="mt-1 block emr-text-dense leading-5 text-muted-foreground">{description}</span></span>
        </label>;
      })}
    </RadioGroup>
    <output aria-label="합성 등록 유형">{mode}</output>
  </div>;
}

function RadioGroupExample({
  defaultValue,
  disabled,
  invalid,
  orientation,
}: RadioGroupStoryArgs) {
  const id = useId();

  return (
    <div className="grid gap-2">
    <RadioGroup
      defaultValue={defaultValue}
      disabled={disabled}
      aria-invalid={invalid}
      className={orientation === "horizontal" ? "flex flex-wrap gap-4" : "max-w-md"}
      aria-label="샘플 밀도 선택"
      aria-describedby={invalid ? `${id}-error` : undefined}
    >
      {options.map((option) => (
        <Field
          key={option.value}
          orientation="horizontal"
          data-invalid={invalid || undefined}
          className="items-start"
        >
          <Radio value={option.value} id={`${id}-${option.value}`} />
          <FieldContent>
            <FieldLabel htmlFor={`${id}-${option.value}`}>
              {option.label}
            </FieldLabel>
            <FieldDescription>{option.description}</FieldDescription>
          </FieldContent>
        </Field>
      ))}
    </RadioGroup>
    {invalid ? <FieldError id={`${id}-error`}>선택값을 확인하세요.</FieldError> : null}
    </div>
  );
}

const meta = {
  title: "Design System/UI/RadioGroup",
  component: RadioGroupExample,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Controls는 RadioGroupExample 조합 설정입니다. defaultValue는 마운트 시 초기값이며 orientation은 예제 CSS 배치만 바꿉니다. invalid는 aria-invalid로 전달합니다. 호출자는 선택값 사용·검증·저장을 소유합니다. Use RadioGroup for mutually exclusive choices where all options should be visible. 사용할 때: the user must choose one option from a small set. 쓰지 말아야 할 때: independent multi-select, compact toolbar filters, or hidden command menus.",
      },
    },
  },
  argTypes: {
    defaultValue: {
      control: "radio",
      options: ["compact", "default", "comfortable"],
      description: "Initially selected option for the uncontrolled example.",
    },
    disabled: {
      control: "boolean",
      description: "Disables the whole group visually and functionally. Not a security boundary.",
    },
    invalid: {
      control: "boolean",
      description: "Marks the group as invalid. Pair with visible error copy in app forms.",
    },
    orientation: {
      control: "radio",
      options: ["vertical", "horizontal"],
      description: "Demo layout direction for the visible options.",
    },
  },
  args: {
    defaultValue: "default",
    disabled: false,
    invalid: false,
    orientation: "vertical",
  },
  render: (args) => <RadioGroupExample key={args.defaultValue} {...args} />,
} satisfies Meta<RadioGroupStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <RegistrationModeCaller />,
  play: async ({ canvas }) => {
    const first = canvas.getByRole("radio", { name: /^환자\/보호자 모두 신규 등록/ });
    const second = canvas.getByRole("radio", { name: /^기존 보호자에 신규 환자 등록/ });
    await expect(first).toBeChecked(); await userEvent.click(second); await expect(second).toBeChecked();
    await expect(canvas.getByLabelText("합성 등록 유형")).toHaveTextContent("existing_guardian_patient");
    second.focus(); await userEvent.keyboard("{ArrowUp}"); await expect(first).toBeChecked();
    await expect(canvas.getByLabelText("합성 등록 유형")).toHaveTextContent("new_guardian_patient");
  },
  parameters: {
    controls: { disable: true },
    docs: {
      description: {
        story:
          "실제 등록 유형 RadioGroup 설정과 비공개 RegistrationModeCard의 작은 표시 구조를 유지합니다. 두 선택지의 문구·선택 색·라디오·콜백을 재현하며 등록이나 화면 이동은 하지 않습니다.",
      },
    },
  },
};

export const Horizontal: Story = {
  play: async ({ canvas }) => { const control = canvas.getByRole("radio", { name: "여유 있게" }); await userEvent.click(control); await expect(control).toBeChecked(); },
  args: {
    orientation: "horizontal",
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 짧은 label 선택지를 한 줄에서 비교할 때. 쓰지 말아야 할 때: 설명 copy가 길어져 wrap이 심한 경우.",
      },
    },
  },
};

export const Invalid: Story = {
  play: async ({ canvas }) => { await expect(canvas.getByRole("radiogroup")).toHaveAttribute("aria-invalid", "true"); await expect(canvas.getByRole("alert")).toHaveTextContent("선택값을 확인하세요."); },
  args: {
    invalid: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 필수 단일 선택이 누락된 form validation. 쓰지 말아야 할 때: 오류 문구 없이 색상만으로 실패를 전달할 때.",
      },
    },
  },
};

export const Disabled: Story = {
  play: async ({ canvas }) => {
    const controls = canvas.getAllByRole("radio");
    for (const control of controls) {
      await expect(control).toHaveAttribute("aria-disabled", "true"); await expect(control).toHaveAttribute("data-disabled");
      control.focus(); await userEvent.keyboard(" ");
    }
    await expect(canvas.getByRole("radio", { name: "여유 있게" })).toBeChecked();
    await expect(canvas.getByRole("radio", { name: "기본" })).not.toBeChecked();
    await expect(canvas.getByRole("radio", { name: "촘촘하게" })).not.toBeChecked();
  },
  args: {
    defaultValue: "comfortable",
    disabled: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 현재 화면에서 선택을 보여주되 변경은 막아야 할 때. 쓰지 말아야 할 때: 권한 또는 서버 검증의 대체 수단.",
      },
    },
  },
};
