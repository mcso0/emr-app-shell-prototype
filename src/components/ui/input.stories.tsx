import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent } from "storybook/test";

import { Input } from "./input";
import { Field, FieldError, FieldLabel } from "./field";
import { RegistrationNameCallerExample } from "./caller-parity.stories.fixture";

const meta = {
  title: "Design System/UI/Input",
  component: Input,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Use Input for compact text entry in EMR forms, filters, and dialogs. Preserve labels at the call site with Field components when the input appears in a form.",
      },
    },
  },
  argTypes: {
    type: {
      control: "select",
      options: ["text", "search", "email", "tel", "number", "file"],
      description: "Native input type. Use the narrowest type that matches the field.",
    },
    placeholder: {
      control: "text",
      description: "Short input hint. Do not use placeholders as the only accessible label.",
    },
    disabled: {
      control: "boolean",
      description: "Disabled inputs are read-only affordances, not security boundaries.",
    },
    "aria-invalid": {
      control: "boolean",
      description: "Use with visible error/help text at the call site when validation fails.",
    },
  },
  args: {
    "aria-label": "합성 입력 예시",
    disabled: false,
    placeholder: "보호자명 또는 환자명",
    type: "text",
  },
  render: (args) => <Field className="max-w-sm">
    <FieldLabel>합성 입력 예시</FieldLabel>
    <Input {...args} />
    {args["aria-invalid"] ? <FieldError>전화번호 형식을 확인하세요.</FieldError> : null}
  </Field>,
} satisfies Meta<typeof Input>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <RegistrationNameCallerExample />,
  play: async ({ canvas }) => {
    const field = canvas.getByRole("textbox", { name: "보호자명" });
    await expect(field).toBeEnabled();
    await expect(field).not.toHaveAttribute("readonly");
    await userEvent.clear(field);
    await userEvent.type(field, "합성 보호자 수정");
    await expect(field).toHaveValue("합성 보호자 수정");
    await expect(canvas.getByLabelText("합성 보호자명 초안")).toHaveTextContent("합성 보호자 수정");
  },
  parameters: {
    controls: { disable: true },
    docs: {
      description: {
        story: "환자/보호자 등록에서 사용하는 실제 EmrRegistrationFieldRow와 Input 설정입니다. 필수 표시·라벨·크기를 유지하며 초안만 로컬에서 바꿉니다.",
      },
    },
  },
};

export const Placeholder: Story = {
  play: async ({ canvas }) => {
    const input = canvas.getByRole("textbox");
    await expect(input).toHaveAttribute("placeholder", "예: 합성 보호자");
    await userEvent.type(input, "합성 입력");
    await expect(input).toHaveValue("합성 입력");
  },
  args: {
    placeholder: "예: 합성 보호자",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Placeholder text should help with format or example content. It should not replace a visible label.",
      },
    },
  },
};

export const Disabled: Story = {
  play: async ({ canvas }) => { await expect(canvas.getByRole("textbox")).toBeDisabled(); },
  args: {
    disabled: true,
    value: "합성 동물병원",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Use disabled for unavailable fields or locked context. Do not rely on disabled inputs as security enforcement.",
      },
    },
  },
};

export const Invalid: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
    await expect(canvas.getByRole("alert")).toHaveTextContent("전화번호 형식을 확인하세요.");
  },
  args: {
    "aria-invalid": true,
    defaultValue: "010-000",
    placeholder: "010-0000-0000",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Invalid styling must be paired with field-level error copy in the consuming form or dialog.",
      },
    },
  },
};

export const FileInput: Story = {
  play: async ({ canvas }) => {
    const input = canvas.getByLabelText("합성 입력 예시");
    const file = new File(["synthetic only"], "synthetic.txt", { type: "text/plain" });
    await userEvent.upload(input, file);
    await expect((input as HTMLInputElement).files?.[0]?.name).toBe("synthetic.txt");
  },
  args: {
    type: "file",
  },
  parameters: {
    docs: {
      description: {
        story:
          "File inputs use the same control sizing. Real upload behavior and provider side effects stay outside Storybook stories.",
      },
    },
  },
};
