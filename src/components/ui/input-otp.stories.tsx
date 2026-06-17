import type { Meta, StoryObj } from "@storybook/nextjs-vite";

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
  return (
    <div className="grid max-w-sm gap-2">
      <label className="text-sm font-medium" htmlFor="sample-otp">
        샘플 인증 코드
      </label>
      <InputOTP
        id="sample-otp"
        maxLength={maxLength}
        value={value}
        disabled={disabled}
        aria-invalid={invalid}
        containerClassName="max-w-xs"
        onChange={() => undefined}
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
      <p className="text-sm text-muted-foreground">
        합성 코드 예시입니다. 실제 초대, 인증, 신원 정보는 사용하지 않습니다.
      </p>
    </div>
  );
}

const meta = {
  title: "Design System/UI/InputOTP",
  component: InputOtpExample,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Use InputOTP for short one-time codes where each character position should be visually separated. 사용할 때: invite, verification, or short confirmation codes in synthetic/demo-safe flows. 쓰지 말아야 할 때: passwords, long identifiers, payment data, or any real identity credential.",
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
      description: "Controlled synthetic code value for display examples.",
    },
  },
  args: {
    disabled: false,
    invalid: false,
    maxLength: 6,
    value: "",
  },
  render: (args) => <InputOtpExample {...args} />,
} satisfies Meta<InputOtpStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 짧은 인증/초대 코드를 자리별로 입력해야 할 때. 쓰지 말아야 할 때: 실제 비밀번호나 민감 식별자를 입력받을 때.",
      },
    },
  },
};

export const Filled: Story = {
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
