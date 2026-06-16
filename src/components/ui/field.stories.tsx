import type { ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Input } from "./input";
import { Switch } from "./switch";
import { Textarea } from "./textarea";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "./field";

type FieldArgs = ComponentProps<typeof Field> & {
  invalid: boolean;
};

const meta = {
  title: "Design System/UI/Field",
  component: Field,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Use Field primitives to bind labels, descriptions, controls, and validation copy in EMR forms. 사용할 때: a form control needs consistent spacing and accessible context. 쓰지 말아야 할 때: free-floating layout boxes, table cells, or security enforcement.",
      },
    },
  },
  argTypes: {
    orientation: {
      control: "radio",
      options: ["vertical", "horizontal", "responsive"],
      description: "Field layout direction. Use vertical for most forms and horizontal for compact toggles.",
    },
    invalid: {
      control: "boolean",
      description: "Sets invalid text color on the field group. Pair with FieldError and control aria-invalid.",
    },
  },
  args: {
    invalid: false,
    orientation: "vertical",
  },
} satisfies Meta<FieldArgs>;

export default meta;

type Story = StoryObj<FieldArgs>;

export const TextInputField: Story = {
  render: ({ invalid, ...args }) => (
    <Field {...args} data-invalid={invalid}>
      <FieldLabel htmlFor="sample-field-summary">상담 요약</FieldLabel>
      <Input
        id="sample-field-summary"
        placeholder="샘플 상담 요약"
      />
      <FieldDescription>
        실제 환자, 보호자, 병원, 결제, 신원 정보 없이 합성 예시만 사용합니다.
      </FieldDescription>
    </Field>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: label, input, help text가 한 묶음으로 움직여야 할 때. 쓰지 말아야 할 때: label 없이 placeholder만으로 의미를 전달할 때.",
      },
    },
  },
};

export const WithError: Story = {
  args: {
    invalid: true,
  },
  render: ({ invalid, ...args }) => (
    <Field {...args} data-invalid={invalid}>
      <FieldLabel htmlFor="sample-field-required-note">필수 메모</FieldLabel>
      <Textarea
        id="sample-field-required-note"
        aria-invalid
        placeholder="샘플 메모"
        rows={3}
      />
      <FieldError>샘플 메모를 한 줄 이상 입력하세요.</FieldError>
    </Field>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: control의 invalid 상태와 오류 문구를 함께 보여줄 때. 쓰지 말아야 할 때: 서버/API 검증 없이 클라이언트 표시만으로 저장을 허용할 때.",
      },
    },
  },
};

export const HorizontalToggle: Story = {
  args: {
    orientation: "horizontal",
  },
  render: ({ invalid, ...args }) => (
    <Field
      {...args}
      className="max-w-md rounded-[var(--clair-radius-md)] border border-border bg-card p-3"
      data-invalid={invalid}
    >
      <Switch id="sample-field-notification" />
      <FieldContent>
        <FieldLabel htmlFor="sample-field-notification">운영 알림 받기</FieldLabel>
        <FieldDescription>
          샘플 워크스페이스의 업무 변경 알림만 표현합니다.
        </FieldDescription>
      </FieldContent>
    </Field>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: switch나 checkbox 옆에 제목과 설명이 붙는 compact setting. 쓰지 말아야 할 때: 긴 본문 입력이나 복잡한 form section.",
      },
    },
  },
};

export const FieldSetGroup: Story = {
  render: () => (
    <FieldSet>
      <FieldLegend>샘플 연락 기본값</FieldLegend>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="sample-contact-channel">연락 채널</FieldLabel>
          <Input
            id="sample-contact-channel"
            defaultValue="앱 알림"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="sample-contact-note">내부 메모</FieldLabel>
          <Textarea
            id="sample-contact-note"
            defaultValue="합성 데이터로만 작성된 샘플 메모입니다."
            rows={3}
          />
        </Field>
      </FieldGroup>
    </FieldSet>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 관련 form controls를 fieldset/legend로 묶어야 할 때. 쓰지 말아야 할 때: 서로 독립적인 화면 영역을 시각적으로만 묶으려는 경우.",
      },
    },
  },
};
