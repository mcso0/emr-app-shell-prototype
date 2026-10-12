import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState, type ComponentProps } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import {
  CdsActionsRefreshCcwIcon,
  CdsActionsXIcon,
} from "@/components/cds-icons/actions-and-controls";
import { Button } from "@/components/ui/button";

import { EmrInlineAlert } from "./inline-alert";

const meta = {
  title: "Design System/EMR/EmrInlineAlert",
  component: EmrInlineAlert,
  tags: ["autodocs"],
  parameters: {
    docs: {
      story: { inline: false, height: "400px" },
      description: {
        component:
          "Use EmrInlineAlert for persistent workflow feedback such as read failures, degraded live/demo boundaries, permission blockers, preflight warnings, and in-context success. Do not use it for transient toast-only feedback or field-level validation.",
      },
    },
  },
  argTypes: {
    layout: {
      control: "radio",
      options: ["default", "actions", "icon-box"],
      description:
        "Controls the Figma-aligned content arrangement. Omit it to infer actions when action slots are present and default otherwise.",
    },
    severity: {
      control: "radio",
      options: ["neutral", "error", "warning", "info", "success"],
      description:
        "Controls default role, icon, and semantic tone. Error and warning default to alert; neutral, info, and success default to status.",
    },
    title: {
      control: "text",
      description: "Concise impact-oriented title. It must make the alert meaning clear without color alone.",
    },
    children: {
      control: "text",
      description: "Short contextual body copy. Use synthetic product-like data only.",
    },
    role: {
      control: "select",
      options: [undefined, "alert", "status"],
      description: "Override only when the consuming workflow has a specific accessibility need.",
    },
    icon: {
      table: {
        disable: true,
      },
    },
    action: {
      table: {
        disable: true,
      },
    },
    secondaryAction: {
      table: {
        disable: true,
      },
    },
    dismissAction: {
      table: {
        disable: true,
      },
    },
    testId: {
      control: "text",
      description: "Optional test hook for feature-level regression tests.",
    },
  },
  args: {
    children: "현재 화면은 마지막 로컬 데모 상태를 표시합니다.",
    severity: "warning",
    title: "서버 대기열을 불러오지 못했습니다",
  },
} satisfies Meta<typeof EmrInlineAlert>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Default warning alert for a degraded workflow state. Use it near the affected panel, not in global chrome.",
      },
    },
  },
};
export const Severities: Story = {
  render: () => (
    <div className="grid max-w-3xl gap-3">
      <EmrInlineAlert
        severity="neutral"
        title="예약 정보를 확인해 주세요"
      >
        진료 접수 전에 보호자 연락처와 방문 시간을 확인할 수 있습니다.
      </EmrInlineAlert>
      <EmrInlineAlert
        severity="error"
        title="저장하지 못했습니다"
      >
        입력 내용은 화면에 남아 있습니다. 다시 시도하거나 지원 로그를 확인해 주세요.
      </EmrInlineAlert>
      <EmrInlineAlert
        severity="warning"
        title="실시간 상태가 지연되고 있습니다"
      >
        현재 목록은 마지막으로 확인된 로컬 상태 기준입니다.
      </EmrInlineAlert>
      <EmrInlineAlert
        severity="info"
        title="데모 데이터 모드"
      >
        이 화면은 제품 흐름 검토를 위한 합성 데이터만 사용합니다.
      </EmrInlineAlert>
      <EmrInlineAlert
        severity="success"
        title="임시 저장되었습니다"
      >
        같은 화면에서 저장 상태를 다시 확인할 수 있습니다.
      </EmrInlineAlert>
    </div>
  ),
  parameters: {
    controls: { disable: true },
    docs: {
      story: { inline: false, height: "700px" },
      description: {
        story:
          "Severity changes role, icon, and token tone. Copy and available actions must still explain the state without relying on color alone.",
      },
    },
  },
};

function RecoveryActions({ onAction }: { onAction: (label: string) => void }) {
  return <><Button size="sm" variant="outline" onClick={() => onAction("다시 시도")}><CdsActionsRefreshCcwIcon data-icon="inline-start" />다시 시도</Button><Button size="sm" variant="outline" onClick={() => onAction("상세 보기")}><CdsActionsRefreshCcwIcon data-icon="inline-start" />상세 보기</Button></>;
}
function DismissButton({ onDismiss }: { onDismiss: () => void }) {
  return <Button aria-label="안내 닫기" size="icon-sm" variant="ghost" onClick={onDismiss}><CdsActionsXIcon /></Button>;
}

function FigmaLayoutsExample() {
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  const [receipt, setReceipt] = useState("없음");
  return (
    <div className="grid w-[697px] max-w-full gap-3">
      {!hidden.has(0) ? <EmrInlineAlert
        dismissAction={<DismissButton onDismiss={() => setHidden(value => new Set([...value, 0]))} />}
        layout="default"
        severity="neutral"
        title="진료 정보를 확인해 주세요"
      >
        접수 전에 보호자 연락처와 방문 시간을 확인할 수 있습니다.
      </EmrInlineAlert> : null}
      {!hidden.has(1) ? <EmrInlineAlert
        dismissAction={<DismissButton onDismiss={() => setHidden(value => new Set([...value, 1]))} />}
        layout="default"
        severity="neutral"
        title="진료 정보를 확인해 주세요"
      /> : null}
      {!hidden.has(2) ? <EmrInlineAlert
        action={<RecoveryActions onAction={setReceipt} />}
        layout="actions"
        severity="neutral"
        title="검사 대기열을 불러오지 못했습니다"
      >
        마지막으로 확인한 검사 목록을 표시하고 있습니다.
      </EmrInlineAlert> : null}
      {!hidden.has(3) ? <EmrInlineAlert
        action={<RecoveryActions onAction={setReceipt} />}
        layout="actions"
        severity="neutral"
        title="검사 대기열을 불러오지 못했습니다"
      /> : null}
      {!hidden.has(4) ? <EmrInlineAlert
        action={<RecoveryActions onAction={setReceipt} />}
        layout="icon-box"
        severity="neutral"
        title="검사 결과를 확인해 주세요"
      >
        결과 검토가 필요한 항목이 2건 있습니다.
      </EmrInlineAlert> : null}
      {!hidden.has(5) ? <EmrInlineAlert
        dismissAction={<DismissButton onDismiss={() => setHidden(value => new Set([...value, 5]))} />}
        layout="icon-box"
        severity="neutral"
        title="검사 결과를 확인해 주세요"
      /> : null}
    <output aria-label="레이아웃 작업 결과">{receipt}</output>
      <Button variant="outline" onClick={() => setHidden(new Set())}>안내 복원</Button>
    </div>
  );
}

export const FigmaLayouts: Story = {
  render: () => <FigmaLayoutsExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole("status")).toHaveLength(7);
    await userEvent.click(canvas.getAllByRole("button", { name: "다시 시도" })[0]);
    await expect(canvas.getByLabelText("레이아웃 작업 결과")).toHaveTextContent("다시 시도");
    await userEvent.click(canvas.getAllByRole("button", { name: "상세 보기" })[0]);
    await expect(canvas.getByLabelText("레이아웃 작업 결과")).toHaveTextContent("상세 보기");
    await userEvent.click(canvas.getAllByRole("button", { name: "안내 닫기" })[0]);
    await waitFor(() => expect(canvas.getAllByRole("status")).toHaveLength(6));
    await userEvent.click(canvas.getByRole("button", { name: "안내 복원" }));
    await expect(canvas.getAllByRole("status")).toHaveLength(7);
  },
  parameters: {
    controls: { disable: true },
    docs: {
      story: { inline: false, height: "820px" },
      description: {
        story:
          "Figma reference matrix for default, actions, and icon-box layouts at the authored 697px width, including title-only and title-with-body cases.",
      },
    },
  },
};

export const SeverityIconBoxes: Story = {
  render: () => (
    <div className="grid max-w-3xl gap-3">
      {(["neutral", "info", "success", "warning", "error"] as const).map(
        (severity) => (
          <EmrInlineAlert
            key={severity}
            layout="icon-box"
            severity={severity}
            testId={`inline-alert-${severity}`}
            title={`${severity} 상태 안내`}
          >
            배경은 50 단계, 테두리와 아이콘 박스는 200 단계, 텍스트와 아이콘은
            {severity === "neutral" ? " Neutral 900" : " 의미 색상 700"} 단계를
            사용합니다.
          </EmrInlineAlert>
        )
      )}
    </div>
  ),
  parameters: {
    controls: { disable: true },
    docs: {
      story: { inline: false, height: "700px" },
      description: {
        story:
          "Verifies the icon-box treatment across neutral, info, success, warning, and error semantic states.",
      },
    },
  },
};

function RecoveryExample(args: ComponentProps<typeof EmrInlineAlert>) {
  const [receipt, setReceipt] = useState("없음");
  return <div><EmrInlineAlert {...args} action={<Button size="sm" onClick={() => setReceipt("다시 시도")}>다시 시도</Button>} secondaryAction={<Button size="sm" variant="outline" onClick={() => setReceipt("로컬 데모로 보기")}>로컬 데모로 보기</Button>} /><output aria-label="복구 작업 결과">{receipt}</output></div>;
}
export const WithRecoveryActions: Story = {
  args: { severity: "warning", title: "검사 대기열 동기화가 지연되고 있습니다", children: "현재 화면은 마지막 로컬 데모 상태를 표시합니다." },
  render: args => <RecoveryExample {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const name of ["다시 시도", "로컬 데모로 보기"]) { const button = canvas.getByRole("button", { name }); button.focus(); await userEvent.keyboard("{Enter}"); await expect(canvas.getByLabelText("복구 작업 결과")).toHaveTextContent(name); }
  },
  parameters: {
    docs: {
      description: {
        story:
          "Use action slots for recovery paths. The feature owns callbacks, retry logic, logging, and permission checks.",
      },
    },
  },
};

export const WithoutIcon: Story = {
  args: {
    icon: false,
    severity: "info",
    title: "읽기 전용 검토 상태",
    children: "이 문맥에서는 주변 헤더가 상태 의미를 이미 설명하고 있습니다.",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Hide the icon only when the surrounding layout already makes the alert role clear. Do not remove meaning from title or body copy.",
      },
    },
  },
};
