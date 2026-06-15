import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Textarea } from "./textarea";

const meta = {
  title: "Design System/UI/Textarea",
  component: Textarea,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Use Textarea for multi-line EMR notes, internal memos, and longer form comments. 사용할 때: visible label and supporting help text exist nearby. 쓰지 말아야 할 때: short single-line values, searchable filters, or structured coded data.",
      },
    },
  },
  argTypes: {
    placeholder: {
      control: "text",
      description: "Short hint for expected content. Do not use it as the only accessible label.",
    },
    disabled: {
      control: "boolean",
      description: "Visual disabled state for locked or unavailable note fields.",
    },
    "aria-invalid": {
      control: "boolean",
      description: "Marks the textarea as invalid. Pair it with visible field-level error copy.",
    },
    rows: {
      control: { type: "number", min: 2, max: 12 },
      description: "Initial visible row count. Keep dense EMR forms compact.",
    },
  },
  args: {
    disabled: false,
    placeholder: "샘플 상담 메모를 입력하세요.",
    rows: 4,
  },
} satisfies Meta<typeof Textarea>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 상담 메모처럼 여러 줄 설명이 필요한 입력. 쓰지 말아야 할 때: 이름, 전화번호, 상태값처럼 한 줄 또는 선택형 데이터.",
      },
    },
  },
};

export const WithContent: Story = {
  args: {
    defaultValue:
      "샘플 보호자가 방문 전 식욕 저하를 설명했습니다. 실제 환자 또는 보호자 정보는 사용하지 않습니다.",
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 기존 메모를 편집 가능한 상태로 보여줄 때. 쓰지 말아야 할 때: 감사 로그처럼 원문 보존이 필요한 읽기 전용 기록.",
      },
    },
  },
};

export const Invalid: Story = {
  args: {
    "aria-invalid": true,
    defaultValue: "",
    placeholder: "최소 한 줄 이상 입력",
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 필수 메모가 비어 있거나 형식 검증에 실패했을 때. 쓰지 말아야 할 때: 오류 문구 없이 색상만으로 실패 상태를 전달할 때.",
      },
    },
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    defaultValue: "완료된 샘플 기록은 현재 화면에서 수정할 수 없습니다.",
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 잠긴 컨텍스트를 명확히 보여줄 때. 쓰지 말아야 할 때: 권한 또는 서버 검증의 대체 수단.",
      },
    },
  },
};
