import { StrictMode, useEffect, useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor } from "storybook/test";
import { Button } from "@/components/ui/button";
import { WorkspaceEntryLoadingScreen } from "./workspace-entry-loading-screen";

function CompletionPreview({ completeAfter = 2200 }: { completeAfter?: number }) {
  const [runId, setRunId] = useState(0);
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!visible) return;

    const timer = window.setTimeout(() => setReady(true), completeAfter);
    return () => window.clearTimeout(timer);
  }, [runId, visible, completeAfter]);

  function restart() {
    setReady(false);
    setVisible(true);
    setRunId((current) => current + 1);
  }

  return (
    <div
      className="grid min-h-svh place-items-center bg-[var(--emr-surface-app)]"
      data-preview-ready={ready}
    >
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
  decorators: [(Story) => <StrictMode><Story /></StrictMode>],
  parameters: {
    layout: "fullscreen",
    docs: {
      story: { inline: false, height: "520px" },
      description: {
        component:
          "로그인 성공 후 워크스페이스 셸이 준비될 때까지 표시합니다. 진한 회색 로고의 두 조각이 모인 뒤, 빛이 로고 위 바깥에서 25도 사선으로 내려옵니다. ready가 true이면 어느 단계에서든 180ms로 종료합니다."
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
        story: "640ms 조립과 220ms 정지 후 빛이 들어옵니다. 2초 이상 기다릴 때 기존 Pretendard/metadata 토큰으로 안내 문구를 표시합니다."
      }
    }
  },
  play: async ({ canvasElement, canvas }) => {
    const splash = canvas.getByTestId("workspace-entry-loading-screen");
    const logo = splash.querySelector("svg")!;
    await expect(logo.querySelectorAll("path")).toHaveLength(2);
    await expect(getComputedStyle(logo).color).toBe("rgb(199, 204, 209)");
    const message = splash.querySelector<HTMLElement>("[data-splash-message]")!;
    await waitFor(() => expect(getComputedStyle(message).opacity).toBe("1"), { timeout: 4000 });
    await canvasElement.ownerDocument.fonts.ready;
    const type = getComputedStyle(message);
    await expect(type.fontFamily).toContain("Pretendard Variable");
    await expect(type.fontSize).toBe("12px");
    await expect(type.fontWeight).toBe("500");
    await expect(type.letterSpacing).toBe("0.3px");
    await expect(Number.parseFloat(type.lineHeight)).toBeCloseTo(16, 2);
    const logoSlot = splash.querySelector<HTMLElement>("[data-splash-logo]")!;
    const gap = message.getBoundingClientRect().top - logoSlot.getBoundingClientRect().bottom;
    await expect(gap).toBe(10);
    await expect(type.color).toBe("rgb(115, 115, 115)");
    await expect(splash).toBeVisible();
  }
};

export const CompleteWhenReady: Story = {
  render: () => <CompletionPreview />,
  parameters: {
    controls: { disable: true },
    docs: {
      description: {
        story:
          "Storybook 전용 완료 타이머가 빛이 지나가는 중인 2.2초에 준비 완료를 전달합니다. 현재 프레임에서 바로 fade out하며, 다음 반복을 기다리지 않습니다."
      }
    }
  },
  play: async ({ canvasElement, canvas }) => {
    await waitFor(() => expect(canvasElement.querySelector("[data-preview-ready]")).toHaveAttribute("data-preview-ready", "true"), { timeout: 4000 });
    await waitFor(() => expect(canvas.queryByTestId("workspace-entry-loading-screen")).not.toBeInTheDocument(), { timeout: 600 });
    await userEvent.click(canvas.getByRole("button", { name: "애니메이션 다시 보기" }));
    await expect(canvas.getByTestId("workspace-entry-loading-screen")).toBeVisible();
    await waitFor(() => expect(canvas.queryByTestId("workspace-entry-loading-screen")).not.toBeInTheDocument(), { timeout: 4000 });
  }
};

export const ReadyDuringAssembly: Story = {
  render: () => <CompletionPreview completeAfter={100} />,
  parameters: {
    controls: { disable: true },
    docs: { description: { story: "Storybook 전용 100ms 완료 타이머로 조립 중 준비가 끝나면 빛이나 안내 문구를 기다리지 않고 종료합니다." } }
  },
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.queryByTestId("workspace-entry-loading-screen")).not.toBeInTheDocument(), { timeout: 600 });
    await expect(canvas.getByRole("button", { name: "애니메이션 다시 보기" })).toBeVisible();
  }
};
