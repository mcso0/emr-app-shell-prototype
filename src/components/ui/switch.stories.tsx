import { useState } from "react";
import type { ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { ChartActualCallerExample } from "./caller-parity.stories.fixture";

import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "./field";
import { Switch } from "./switch";

type SwitchArgs = ComponentProps<typeof Switch>;

function ControlledSwitch(args: SwitchArgs) {
  const [checked, setChecked] = useState(Boolean(args.checked ?? args.defaultChecked));

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
          "Default는 실제 차트 수행 확인 초안의 Switch입니다. 나머지는 크기·선택·읽기 전용·비활성 API 예제입니다. 선택은 로컬 값을 바꾸며 최종 저장이나 설정 적용은 호출자가 소유합니다.",
      },
    },
  },
  argTypes: {
    checked: {
      control: "boolean",
      description: "API 예제의 초기값입니다. Control 변경은 예제를 다시 시작하며 이후 조작은 로컬 값을 바꿉니다.",
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
  render: () => <ChartActualCallerExample />,
  play: async ({ canvas }) => {
    const control = canvas.getByRole("switch", { name: "현재 로그인한 내가 실제 수행했고 위 결과가 맞음을 확인" });
    await userEvent.click(control); await expect(control).toBeChecked();
    await expect(canvas.getByLabelText("합성 수행 초안")).toHaveTextContent("수행 확인");
    control.focus(); await userEvent.keyboard(" "); await expect(control).not.toBeChecked();
    await expect(canvas.getByLabelText("합성 수행 초안")).toHaveTextContent("미확인");
  },
  parameters: {
    controls: { disable: true },
    docs: {
      description: {
        story:
          "실제 ChartActualConfirmation의 수행 확인 입력입니다. 호출자처럼 초안을 바꾸며 실제 기록은 저장하지 않습니다. 이 컴포넌트의 Switch는 초안 필드에도 사용됩니다.",
      },
    },
  },
};

export const Checked: Story = {
  play: async ({ canvas }) => { const control = canvas.getByRole("switch"); await expect(control).toBeChecked(); await userEvent.click(control); await expect(control).not.toBeChecked(); },
  args: {
    defaultChecked: true,
  },
  render: (args) => (
    <Field orientation="horizontal" className="max-w-md rounded-[var(--clair-radius-md)] border border-border bg-card p-3">
      <ControlledSwitch key={`${args.checked}:${args.defaultChecked}`} id="sample-switch-checked" {...args} />
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
  play: async ({ canvas }) => { const control = canvas.getByRole("switch"); await expect(control).toHaveAttribute("data-size", "xs"); await userEvent.click(control); await expect(control).not.toBeChecked(); },
  args: {
    defaultChecked: true,
    size: "xs",
  },
  render: (args) => (
    <Field orientation="horizontal" className="max-w-sm">
      <ControlledSwitch key={`${args.checked}:${args.defaultChecked}`} id="sample-switch-small" {...args} />
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
  parameters: { controls: { disable: true }, docs: { description: { story: "고정된 세 크기의 Switch API 비교입니다. 각 입력은 로컬에서 조작할 수 있습니다." } } },
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

export const ChartOrderTableVisualContract: Story = {
  parameters: { controls: { disable: true }, docs: { description: { story: "sm Switch 자체의 크기·색·읽기 전용 API 계약입니다. 실제 차트 행 전체의 예제는 아닙니다." } } },
  render: () => (
    <div className="flex items-center gap-4">
      <Switch aria-label="시안 꺼짐" size="sm" />
      <Switch aria-label="시안 켜짐" defaultChecked size="sm" />
      <Switch aria-label="시안 읽기 전용" defaultChecked readOnly size="sm" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const off = canvas.getByRole("switch", { name: "시안 꺼짐" });
    const on = canvas.getByRole("switch", { name: "시안 켜짐" });
    const readonly = canvas.getByRole("switch", { name: "시안 읽기 전용" });
    await expect(readonly).toHaveAttribute("aria-readonly", "true");

    for (const control of [off, on]) {
      await expect(control).toHaveAttribute("data-size", "sm");
      const style = window.getComputedStyle(control);
      expect(style.width).toBe("32px");
      expect(style.height).toBe("18px");
      expect(style.borderWidth).toBe("0px");
      const track = control.getBoundingClientRect();
      const thumb = control.querySelector<HTMLElement>("[data-slot=\"switch-thumb\"]")?.getBoundingClientRect();
      expect(thumb).toBeDefined();
      expect(thumb!.width).toBe(16);
      expect(thumb!.height).toBe(16);
      expect(thumb!.top - track.top).toBe(1);
    }

    expect(
      off.querySelector<HTMLElement>("[data-slot=\"switch-thumb\"]")!.getBoundingClientRect().left -
        off.getBoundingClientRect().left,
    ).toBe(1);
    expect(
      on.querySelector<HTMLElement>("[data-slot=\"switch-thumb\"]")!.getBoundingClientRect().left -
        on.getBoundingClientRect().left,
    ).toBe(15);
    expect(window.getComputedStyle(off).backgroundColor).toBe("rgb(212, 212, 212)");
    expect(window.getComputedStyle(on).backgroundColor).toBe("rgb(23, 23, 23)");
  },
};

export const ControlledInteraction: Story = {
  args: {
    defaultChecked: false,
    size: "md",
  },
  render: (args) => (
    <Field orientation="horizontal">
      <ControlledSwitch key={`${args.checked}:${args.defaultChecked}`} id="sample-switch-controlled" {...args} />
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

    await userEvent.click(control);
    await waitFor(() => expect(control).toHaveAttribute("aria-checked", "true"));
    control.focus(); await userEvent.keyboard(" ");
    await waitFor(() => expect(control).toHaveAttribute("aria-checked", "false"));
  },
};

export const Disabled: Story = {
  play: async ({ canvas }) => {
    const control = canvas.getByRole("switch");
    await expect(control).toHaveAttribute("aria-disabled", "true"); await expect(control).toHaveAttribute("data-disabled");
    control.focus(); await userEvent.keyboard(" "); await expect(control).toBeChecked();
  },
  args: {
    checked: true,
    disabled: true,
  },
  render: (args) => (
    <Field orientation="horizontal" className="max-w-md rounded-[var(--clair-radius-md)] border border-border bg-card p-3">
      <ControlledSwitch key={`${args.checked}:${args.defaultChecked}`} id="sample-switch-disabled" {...args} />
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
