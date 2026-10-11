import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import {
  StorybookEmptyInfoFeedbackPatterns,
  type StorybookEmptyInfoFeedbackPatternsProps,
} from "./storybook-empty-info-feedback-patterns";

function FeedbackExample(args: StorybookEmptyInfoFeedbackPatternsProps) {
  const [receipt, setReceipt] = useState({ count: 0, label: "" });
  return <div onClickCapture={event => {
    const button = event.target instanceof Element ? event.target.closest("button") : null;
    if (button && event.currentTarget.contains(button)) setReceipt(value => ({ count: value.count + 1, label: button.textContent?.trim() || "샘플 작업" }));
  }}>
    <StorybookEmptyInfoFeedbackPatterns {...args} />
    <output aria-label="합성 안내 작업" className="mt-2 block">{receipt.count ? `실행 ${receipt.count}: ${receipt.label}` : ""}</output>
  </div>;
}

const meta = {
  title: "Design System/EMR/Empty Info Feedback Patterns",
  component: StorybookEmptyInfoFeedbackPatterns,
  tags: ["autodocs"],
  parameters: {
    docs: {
      story: { inline: false, height: "400px" },
      description: {
        component:
          "Storybook-only examples; this helper has no frozen-main app caller or onAction API. The outer story owner captures native activation from its actual helper buttons and displays a local receipt. It preserves the exported helper markup and never performs reset, guide navigation or API retry outside this fixture. Empty/info/alert remain separate authored patterns.",
      },
    },
  },
  argTypes: {
    actionLabel: {
      control: "text",
      description: "Optional synthetic action label for the example surface.",
    },
    body: {
      control: "text",
      description: "Short body copy that explains the missing object, guidance, or recovery boundary.",
    },
    pattern: {
      control: "radio",
      options: ["empty", "info", "alert-boundary"],
      description: "Pattern category from the empty/info state contract.",
    },
    title: {
      control: "text",
      description: "Short title naming the missing object or boundary.",
    },
  },
  args: {
    actionLabel: "조건 초기화",
    body: "선택한 조건에 맞는 샘플 업무가 없습니다. 조건을 초기화하거나 범위를 넓혀 다시 확인합니다.",
    pattern: "empty",
    title: "조건에 맞는 샘플 업무가 없습니다",
  },
  render: (args) => <FeedbackExample key={args.pattern} {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement), button = canvas.getByRole("button");
    const label = button.textContent!.trim() || "샘플 작업";
    button.focus(); await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(canvas.getByLabelText("합성 안내 작업")).toHaveTextContent(`실행 1: ${label}`));
    await userEvent.click(button);
    await expect(canvas.getByLabelText("합성 안내 작업")).toHaveTextContent(`실행 2: ${label}`);
  },
} satisfies Meta<StorybookEmptyInfoFeedbackPatternsProps>;

export default meta;

type Story = StoryObj<typeof meta>;

export const EmptyState: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 유효한 화면이나 섹션에 아직 생성되거나 표시될 항목이 없을 때. 쓰지 말아야 할 때: 읽기 실패, 권한 차단, degraded state를 빈 상태처럼 보이게 할 때.",
      },
    },
  },
};

export const InfoBox: Story = {
  args: {
    actionLabel: "가이드 확인",
    body: "이 샘플 영역은 먼저 다른 workflow에서 준비된 항목이 있을 때 더 유용합니다. 현재 작업은 계속 진행할 수 있습니다.",
    pattern: "info",
    title: "샘플 전제 조건 안내",
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: workflow는 계속 가능하지만 전제 조건이나 해석 기준을 알려야 할 때. 쓰지 말아야 할 때: 사용자가 즉시 복구해야 하는 오류나 권한 문제.",
      },
    },
  },
};

export const AlertBoundary: Story = {
  args: {
    actionLabel: "다시 시도",
    body: "샘플 live read가 실패해 일부 정보가 최신 상태가 아닐 수 있습니다. 영향을 받는 패널 가까이에 복구 action을 둡니다.",
    pattern: "alert-boundary",
    title: "샘플 정보를 확인할 수 없습니다",
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 실패, degraded read/write, permission blocker, recovery path가 있어 persistent feedback이 필요할 때. 쓰지 말아야 할 때: passive guidance나 단순 빈 목록 설명.",
      },
    },
  },
};
