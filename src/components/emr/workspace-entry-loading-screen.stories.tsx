import { useEffect, useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "@/components/ui/button";
import { WorkspaceEntryLoadingScreen } from "./workspace-entry-loading-screen";

function CompletionPreview() {
  const [runId, setRunId] = useState(0);
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!visible) return;

    const timer = window.setTimeout(() => setReady(true), 2200);
    return () => window.clearTimeout(timer);
  }, [runId, visible]);

  function restart() {
    setReady(false);
    setVisible(true);
    setRunId((current) => current + 1);
  }

  return (
    <div className="grid min-h-svh place-items-center bg-[var(--emr-surface-app)]">
      <div className="grid justify-items-center gap-3 text-center">
        <p className="text-sm text-muted-foreground">
          메인 화면이 준비되어 스플래시가 종료되었습니다.
        </p>
        <Button onClick={restart}>애니메이션 다시 보기</Button>
      </div>
      {visible ? (
        <WorkspaceEntryLoadingScreen
          key={runId}
          ready={ready}
          onExitComplete={() => setVisible(false)}
        />
      ) : null}
    </div>
  );
}

const meta = {
  title: "Design System/EMR/WorkspaceEntryLoadingScreen",
  component: WorkspaceEntryLoadingScreen,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "로그인 성공 후 워크스페이스 셸이 준비될 때까지 표시하는 전체 화면 스플래시입니다. ready가 false인 동안 pulse를 반복하고, true가 되면 다음 opacity 1 / scale 1 경계에서 멈춘 뒤 180ms로 사라집니다."
      }
    }
  },
  args: {
    ready: false
  }
} satisfies Meta<typeof WorkspaceEntryLoadingScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const InfiniteLoading: Story = {
  parameters: {
    docs: {
      description: {
        story: "ready가 false인 동안 1.6초 full pulse cycle을 무한 반복합니다."
      }
    }
  }
};

export const CompleteAtFullState: Story = {
  render: () => <CompletionPreview />,
  parameters: {
    docs: {
      description: {
        story:
          "2.2초 뒤 로딩 완료를 전달합니다. 로고는 진행 중인 pulse를 끝내고 full 상태에서 정지한 다음 화면 전체가 fade out됩니다."
      }
    }
  }
};
