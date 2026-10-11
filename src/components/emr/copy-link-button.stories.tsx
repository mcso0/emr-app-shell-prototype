import { useState, type ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { EmrCopyLinkButton } from "./copy-link-button";

type Args = ComponentProps<typeof EmrCopyLinkButton> & { rejectClipboard: boolean };

function CopyLinkExample({ rejectClipboard, ...props }: Args) {
  const [captured, setCaptured] = useState("");
  return <div onClickCapture={() => {
    // The source calls writeText synchronously before its first await. Capture
    // only this activation, including manual clicks and native Enter/Space.
    const previous = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    const restore = () => {
      if (navigator.clipboard !== recorder) return;
      if (previous) Object.defineProperty(navigator, "clipboard", previous);
      else Reflect.deleteProperty(navigator, "clipboard");
    };
    const recorder = { writeText: async (value: string) => {
      setCaptured(value);
      restore();
      if (rejectClipboard) throw new Error("Synthetic clipboard rejection");
    } };
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: recorder });
    // Also restore if source exits before writeText. Never leave a global stub.
    queueMicrotask(restore);
  }}>
    <EmrCopyLinkButton {...props} />
    <output aria-label="합성 복사 링크" className="block break-all text-xs">{captured}</output>
    <Toaster />
  </div>;
}
const meta = {
  title: "Design System/EMR/EmrCopyLinkButton", component: CopyLinkExample, tags: ["autodocs"],
  parameters: { docs: {
      story: { inline: false, height: "280px" }, description: { component: "실제 EmrCopyLinkButton의 URL 생성과 toast를 그대로 사용합니다. 조제 호출자의 workspace·module·workItemId·encounterId·선택 날짜를 합성 값으로 전달합니다. 자동·수동 클릭과 Enter/Space 모두 activation capture에서 Clipboard API를 잠시 로컬 recorder로 대체합니다. writeText 또는 microtask에서 원래 descriptor를 복원하므로 시스템 클립보드를 변경하지 않습니다. rejectClipboard는 Storybook 전용 설정입니다." } } },
  argTypes: {
    ariaLabel: { control: "text" }, moduleId: { control: "text" }, workspaceId: { control: "text" },
    params: { control: "object" }, date: { control: "text" }, rejectClipboard: { control: "boolean" },
  },
  args: { ariaLabel: "합성 조제 화면 링크 복사", moduleId: "dispensing", workspaceId: "synthetic-workspace", params: { workItemId: "synthetic-work-item", encounterId: "synthetic-encounter" }, date: "2026-05-01", rejectClipboard: false },
  render: args => <CopyLinkExample {...args} />,
} satisfies Meta<Args>;
export default meta;
type Story = StoryObj<typeof meta>;
async function checkCopy(canvasElement: HTMLElement, args: Args) {
  const canvas = within(canvasElement);
  const previous = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  const previousToastIds = new Set(toast.getToasts().map(item => item.id));
  const message = args.rejectClipboard ? "링크를 복사하지 못했어요." : "링크를 복사했어요.";
  try {
    const button = canvas.getByRole("button", { name: args.ariaLabel });
    button.focus(); await userEvent.keyboard("{Enter}");
    await waitFor(() => {
      expect(canvas.getByLabelText("합성 복사 링크")).not.toBeEmptyDOMElement();
      expect(canvas.getByText(message)).toBeVisible();
    });
    const url = new URL(canvas.getByLabelText("합성 복사 링크").textContent!);
    await expect(url.pathname).toBe(`/w/${args.workspaceId}/${args.moduleId}`);
    await expect(url.searchParams.get("date")).toBe(args.date?.trim() ? args.date : null);
    for (const [key, value] of Object.entries(args.params)) {
      if (key !== "date") await expect(url.searchParams.get(key)).toBe(value?.trim() ? value : null);
    }
    for (const key of ["scenario", "patientId", "encounterId", "workItemId", "queueItemId", "labResultId", "imagingStudyId", "invoiceId", "orderId", "taskId", "historyEncounterId", "drawer", "context"]) {
      if (!(key in args.params)) await expect(url.searchParams.has(key)).toBe(false);
    }
    await expect(Object.getOwnPropertyDescriptor(navigator, "clipboard")).toEqual(previous);
  } finally {
    for (const item of toast.getToasts()) {
      if (!previousToastIds.has(item.id) && "title" in item && item.title === message) toast.dismiss(item.id);
    }
  }
}
export const Success: Story = { play: async ({ canvasElement, args }) => checkCopy(canvasElement, args) };
export const ClipboardRejected: Story = { args: { rejectClipboard: true }, play: async ({ canvasElement, args }) => checkCopy(canvasElement, args) };
