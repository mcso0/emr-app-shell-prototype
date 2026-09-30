import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Button } from "@/components/ui/button";
import { useLayoutStore } from "@/stores/layout-store";
import { WorkspaceProfileDrawer } from "./workspace-profile-drawer";

function BodyAlignmentExample({ kind }: { kind: "patient" | "guardian" }) {
  const [frameElement, setFrameElement] = useState<HTMLElement | null>(null);
  const [compact, setCompact] = useState(false);
  return (
    <div className="p-4">
      <div className="flex gap-2">
        <Button onClick={() => useLayoutStore.getState().setActiveProfileDrawer({
          type: kind, id: kind === "patient" ? "patient-coco" : "guardian-lee-jieun",
        })}>프로필 열기</Button>
        <Button onClick={() => setCompact(!compact)}>본문 높이 변경</Button>
      </div>
      <main ref={setFrameElement} data-testid="profile-story-body"
        className="relative mt-6 w-full rounded-[var(--emr-radius-panel)] border bg-muted p-4"
        style={{ height: compact ? 460 : 600 }}>
        업무 본문
        <WorkspaceProfileDrawer frameElement={frameElement} workspaceId="clair-demo"
          moduleId="customer" moduleLabel="고객 관리" />
      </main>
    </div>
  );
}

const meta = {
  title: "Shell/Workspace Profile Drawer",
  component: BodyAlignmentExample,
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true, navigation: {
      pathname: "/w/clair-demo/customer",
      segments: [["workspaceId", "clair-demo"]],
    } },
  },
  tags: ["autodocs"],
  beforeEach: () => {
    useLayoutStore.setState({ activeProfileDrawer: null });
    return () => useLayoutStore.setState({ activeProfileDrawer: null });
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const opener = canvas.getByRole("button", { name: "프로필 열기" });
    await userEvent.click(opener);
    const frame = canvas.getByTestId("profile-story-body");
    const assertAlignment = async () => {
      await waitFor(() => {
        const popup = document.querySelector<HTMLElement>('[data-testid="workspace-profile-drawer"]');
        expect(popup).not.toBeNull();
        const body = frame.getBoundingClientRect();
        const drawer = popup!.getBoundingClientRect();
        expect(drawer.top).toBeCloseTo(body.top + 1, 0);
        expect(drawer.bottom).toBeCloseTo(body.bottom - 1, 0);
        expect(drawer.right).toBeCloseTo(body.right - 1, 0);
        expect(drawer.width).toBeCloseTo(Math.min(380, body.width - 2), 0);
      });
    };
    await assertAlignment();
    await userEvent.click(canvas.getByRole("button", { name: "본문 높이 변경" }));
    await assertAlignment();
    const close = within(document.body).getByRole("button", { name: "상세 닫기" });
    await userEvent.click(close);
    await waitFor(() => expect(document.querySelector('[data-testid="workspace-profile-drawer"]')).toBeNull());
    await expect(opener).toHaveFocus();
  },
} satisfies Meta<typeof BodyAlignmentExample>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Patient: Story = { args: { kind: "patient" } };
export const Guardian: Story = { args: { kind: "guardian" } };
