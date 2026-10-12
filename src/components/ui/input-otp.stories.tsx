import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useId, useState } from "react";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { expect, userEvent, waitFor } from "storybook/test";
import { Field, FieldDescription, FieldError, FieldLabel } from "./field";

import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "./input-otp";

type InputOtpStoryArgs = {
  disabled: boolean;
  invalid: boolean;
  maxLength: number;
  value: string;
};

function InputOtpExample({ disabled, invalid, maxLength, value }: InputOtpStoryArgs) {
  const [code, setCode] = useState(value);
  const inputId = useId();
  return (
    <div className="grid max-w-sm gap-2">
      <label className="text-sm font-medium" htmlFor={inputId}>
        샘플 인증 코드
      </label>
      <InputOTP
        id={inputId}
        maxLength={maxLength}
        value={code}
        disabled={disabled}
        aria-invalid={invalid}
        aria-describedby={`${inputId}-description${invalid ? ` ${inputId}-error` : ""}`}
        containerClassName="max-w-xs"
        onChange={setCode}
      >
        <InputOTPGroup>
          {Array.from({ length: Math.min(maxLength, 3) }).map((_, index) => (
            <InputOTPSlot key={index} index={index} />
          ))}
        </InputOTPGroup>
        {maxLength > 3 ? (
          <>
            <InputOTPSeparator />
            <InputOTPGroup>
              {Array.from({ length: maxLength - 3 }).map((_, index) => (
                <InputOTPSlot key={index + 3} index={index + 3} />
              ))}
            </InputOTPGroup>
          </>
        ) : null}
      </InputOTP>
      {invalid ? <FieldError id={`${inputId}-error`}>합성 코드를 확인해주세요.</FieldError> : null}
      {disabled ? <p>이 API 예제는 입력을 비활성으로 설정했습니다.</p> : null}
      <p id={`${inputId}-description`} className="text-sm text-muted-foreground">
        합성 코드 예시입니다. 실제 초대, 인증, 신원 정보는 사용하지 않습니다.
      </p>
    </div>
  );
}

// Bounded private form section from LoginForm:639-679. No auth ancestor or submit effect.
function InviteOtpCaller() {
  const id = useId();
  const [code, setCode] = useState("");
  return <div className="grid max-w-sm gap-3">
    <Field className="gap-1.5">
      <FieldLabel htmlFor={id} className="text-[12px]">인증 코드</FieldLabel>
      <InputOTP id={id} name="otp-token" maxLength={8} pattern={REGEXP_ONLY_DIGITS} autoComplete="one-time-code"
        disabled={false} value={code} onChange={setCode}
        containerClassName="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]" aria-label="인증 코드">
        <InputOTPGroup className="grid grid-cols-4">{[0, 1, 2, 3].map((index) => <InputOTPSlot key={index} index={index} />)}</InputOTPGroup>
        <InputOTPSeparator />
        <InputOTPGroup className="grid grid-cols-4">{[4, 5, 6, 7].map((index) => <InputOTPSlot key={index} index={index} />)}</InputOTPGroup>
      </InputOTP>
      <FieldDescription className="text-[12px]">8자리 데모 인증 코드: 12345678</FieldDescription>
    </Field>
    <output aria-label="합성 인증 코드 초안">{code || "입력 없음"}</output>
  </div>;
}

const meta = {
  title: "Design System/UI/InputOTP",
  component: InputOtpExample,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Controls는 InputOtpExample 조합 설정입니다. value는 로컬 입력 상태의 초기값이며 Control 변경 시 예제를 다시 시작합니다. InputOTP는 문자 입력을, 호출자는 코드 검증·전송·인증을 소유합니다. 인증 요청은 실행하지 않습니다. Use InputOTP for short one-time codes where each character position should be visually separated. 사용할 때: invite, verification, or short confirmation codes in synthetic/demo-safe flows. 쓰지 말아야 할 때: passwords, long identifiers, payment data, or any real identity credential.",
      },
    },
  },
  argTypes: {
    disabled: {
      control: "boolean",
      description: "Disables OTP input interaction. Not a security boundary.",
    },
    invalid: {
      control: "boolean",
      description: "Marks the OTP input as invalid. Pair with visible error text in app forms.",
    },
    maxLength: {
      control: { type: "number", min: 3, max: 8 },
      description: "Maximum code length.",
    },
    value: {
      control: "text",
      description: "Initial synthetic code value. Changing this Control restarts the local input example.",
    },
  },
  args: {
    disabled: false,
    invalid: false,
    maxLength: 6,
    value: "",
  },
  render: (args) => <InputOtpExample key={`${args.value}:${args.maxLength}`} {...args} />,
} satisfies Meta<InputOtpStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <InviteOtpCaller />,
  play: async ({ canvas, canvasElement }) => {
    const input = canvas.getByLabelText("인증 코드");
    await userEvent.type(input, "a");
    await expect(input).toHaveValue("");
    await userEvent.type(input, "123456789");
    await waitFor(() => {
      expect(input).toHaveValue("12345678");
      expect(canvas.getByLabelText("합성 인증 코드 초안")).toHaveTextContent("12345678");
      expect(Array.from(canvasElement.querySelectorAll('[data-slot="input-otp-slot"]')).map((slot) => slot.textContent).join("")).toBe("12345678");
    });
    await expect(canvasElement.querySelectorAll('[data-slot="input-otp-group"]')).toHaveLength(2);
    await expect(input).toHaveAttribute("autocomplete", "one-time-code");
  },
  parameters: { controls: { disable: true }, docs: { description: { story: "LoginForm의 초대 인증 코드 구간과 같은 8자리·숫자만·4+4 배치입니다. 입력값과 슬롯만 로컬로 바꿉니다. 인증 전송·로그인 결과는 이 구간의 범위에 포함하지 않습니다." } } },
};

export const Filled: Story = {
  play: async ({ canvas }) => { const input = canvas.getByLabelText("샘플 인증 코드"); await expect(input).toHaveValue("123456"); await userEvent.clear(input); await userEvent.type(input, "654321"); await waitFor(() => expect(input).toHaveValue("654321")); },
  args: {
    value: "123456",
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 이미 입력된 합성 코드를 확인하는 표시 상태. 쓰지 말아야 할 때: 실제 초대 코드나 인증 값을 Storybook에 넣을 때.",
      },
    },
  },
};

export const Invalid: Story = {
  play: async ({ canvas }) => { const input = canvas.getByLabelText("샘플 인증 코드"); await expect(input).toHaveAttribute("aria-invalid", "true"); await expect(input).toHaveAccessibleDescription(/합성 코드를 확인해주세요/); await userEvent.clear(input); await userEvent.type(input, "456"); await waitFor(() => expect(input).toHaveValue("456")); },
  args: {
    invalid: true,
    value: "123",
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 코드 길이 또는 형식 검증에 실패했을 때. 쓰지 말아야 할 때: 오류 문구 없이 색상만으로 실패를 전달할 때.",
      },
    },
  },
};

export const Disabled: Story = {
  play: async ({ canvas }) => { const input = canvas.getByLabelText("샘플 인증 코드") as HTMLInputElement; await expect(input).toBeDisabled(); input.focus(); await expect(input).not.toHaveFocus(); await userEvent.keyboard("123456"); await expect(input).toHaveValue("654321"); },
  args: {
    disabled: true,
    value: "654321",
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 현재 화면에서 코드를 수정할 수 없는 상태. 쓰지 말아야 할 때: 서버 인증/만료 검증의 대체 수단.",
      },
    },
  },
};
