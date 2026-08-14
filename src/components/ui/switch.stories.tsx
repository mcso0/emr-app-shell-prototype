import { useState } from "react";
import type { ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "./field";
import { Switch } from "./switch";

type SwitchArgs = ComponentProps<typeof Switch>;

function ControlledSwitch(args: SwitchArgs) {
  const [checked, setChecked] = useState(Boolean(args.defaultChecked));

  return (
    <Switch
      {...args}
      checked={checked}
      defaultChecked={undefined}
      onCheckedChange={setChecked}
    />
  );
}

const meta = {
  title: "Design System/UI/Switch",
  component: Switch,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Use Switch for immediate on/off settings such as visibility, notification, or preference toggles. 사용할 때: the setting can change independently and has a clear binary state. 쓰지 말아야 할 때: form submission choices, multi-option selections, or permission enforcement.",
      },
    },
  },
  argTypes: {
    checked: {
      control: "boolean",
      description: "Controlled on/off state. Keep it synced with settings state in app code.",
    },
    defaultChecked: {
      control: "boolean",
      description: "Initial checked state for uncontrolled examples.",
    },
    disabled: {
      control: "boolean",
      description: "Visual unavailable state. Not a security boundary.",
    },
    size: {
      control: "radio",
      options: ["xs", "sm", "md", "default"],
      description:
        "xs preserves the legacy compact control; sm/md are the CDS.V2 32×18 and 44×24 controls. default remains the sm compatibility alias.",
    },
    "aria-invalid": {
      control: "boolean",
      description: "Marks the switch as invalid. Pair with visible field-level error text.",
    },
    onCheckedChange: {
      table: {
        disable: true,
      },
    },
  },
  args: {
    disabled: false,
    "aria-invalid": false,
    size: "default",
  },
} satisfies Meta<typeof Switch>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Field orientation="horizontal" className="max-w-md rounded-[var(--clair-radius-md)] border border-border bg-card p-3">
      <Switch id="sample-switch-default" {...args} />
      <FieldContent>
        <FieldLabel htmlFor="sample-switch-default">샘플 알림 받기</FieldLabel>
        <FieldDescription>합성 업무 변경 알림을 받는 설정입니다.</FieldDescription>
      </FieldContent>
    </Field>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 즉시 켜고 끄는 독립 설정. 쓰지 말아야 할 때: 저장 버튼을 눌러야 확정되는 form field.",
      },
    },
  },
};

export const Checked: Story = {
  args: {
    defaultChecked: true,
  },
  render: (args) => (
    <Field orientation="horizontal" className="max-w-md rounded-[var(--clair-radius-md)] border border-border bg-card p-3">
      <Switch id="sample-switch-checked" {...args} />
      <FieldContent>
        <FieldLabel htmlFor="sample-switch-checked">샘플 표시 켜짐</FieldLabel>
        <FieldDescription>현재 켜진 상태를 보여주는 합성 예시입니다.</FieldDescription>
      </FieldContent>
    </Field>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 설정이 이미 켜져 있음을 명확히 보여줄 때. 쓰지 말아야 할 때: 사용자가 선택지를 여러 개 중 하나로 골라야 할 때.",
      },
    },
  },
};

export const Small: Story = {
  args: {
    defaultChecked: true,
    size: "xs",
  },
  render: (args) => (
    <Field orientation="horizontal" className="max-w-sm">
      <Switch id="sample-switch-small" {...args} />
      <FieldLabel htmlFor="sample-switch-small">밀도 높은 행 설정</FieldLabel>
    </Field>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 표 행이나 compact panel의 작은 binary setting. 쓰지 말아야 할 때: 터치 면적이 충분하지 않은 주요 설정.",
      },
    },
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="grid gap-4">
      {(["xs", "sm", "md"] as const).map((size) => (
        <Field key={size} orientation="horizontal">
          <Switch
            id={`sample-switch-${size}`}
            defaultChecked
            size={size}
          />
          <FieldLabel htmlFor={`sample-switch-${size}`}>
            {size === "xs"
              ? "xs · 24×14"
              : size === "sm"
                ? "sm · 32×18"
                : "md · 44×24"}
          </FieldLabel>
        </Field>
      ))}
    </div>
  ),
};

export const ControlledInteraction: Story = {
  args: {
    defaultChecked: false,
    size: "md",
  },
  render: (args) => (
    <Field orientation="horizontal">
      <ControlledSwitch id="sample-switch-controlled" {...args} />
      <FieldLabel htmlFor="sample-switch-controlled">
        샘플 설정 사용
      </FieldLabel>
    </Field>
  ),
  play: async ({ canvasElement }) => {
    const control = canvasElement.querySelector<HTMLElement>(
      '[data-slot="switch"]'
    );

    if (!control || control.getAttribute("aria-checked") !== "false") {
      throw new Error("Switch should start unchecked.");
    }

    control.click();
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));

    if (control.getAttribute("aria-checked") !== "true") {
      throw new Error("Switch should expose checked state after activation.");
    }
  },
};

export const Disabled: Story = {
  args: {
    checked: true,
    disabled: true,
  },
  render: (args) => (
    <Field orientation="horizontal" className="max-w-md rounded-[var(--clair-radius-md)] border border-border bg-card p-3">
      <Switch id="sample-switch-disabled" {...args} />
      <FieldContent>
        <FieldLabel htmlFor="sample-switch-disabled">잠긴 샘플 설정</FieldLabel>
        <FieldDescription>현재 화면에서는 변경할 수 없는 상태입니다.</FieldDescription>
      </FieldContent>
    </Field>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 설정 상태는 보여주되 변경은 막아야 할 때. 쓰지 말아야 할 때: 서버 권한 검증의 대체 수단.",
      },
    },
  },
};
