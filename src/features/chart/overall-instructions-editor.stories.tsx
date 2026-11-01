import { useMemo } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { OverallInstructionsDialog, OverallInstructionsEditor } from "./overall-instructions-editor";
import { useChartStore } from "./store";
import { createSyntheticInstructionsClient, syntheticOverallInstructions } from "./overall-instructions-fixtures";

function Example({ saved = false, readOnly = false, legacy = false, mode = "normal" }: Parameters<typeof createSyntheticInstructionsClient>[0] & {}) {
  const client = useMemo(() => createSyntheticInstructionsClient({ saved, readOnly, legacy, mode }), [saved, readOnly, legacy, mode]);
  return <OverallInstructionsDialog client={client} />;
}
const meta = {
  title: "Features/Chart/Overall Instructions", component: Example, tags: ["autodocs"],
  args: { saved: false, readOnly: false, mode: "normal" },
  argTypes: { saved: { description: "Seed a synthetic current instruction and history." }, readOnly: { description: "Show a server-denied editing state." }, mode: { control: "select", options: ["normal", "failed-load", "failed-save", "lost-response", "conflict"], description: "In-memory response scenario; never calls Supabase." } },
  parameters: { docs: { description: { component: "Chart-owned overall-instructions editor for the chart adapter; used by the actual chart entry. Synthetic transport only; no DB, permissions, delivery or performer-state proof." } } },
} satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Empty: Story = { parameters: { docs: { description: { story: "Choose a scope, add/remove fields and keep the outer dialog size stable. History remains visible and disabled." } } } };
export const Saved: Story = { args: { saved: true }, parameters: { docs: { description: { story: "Edit, delete/undo, apply and reopen synthetic instructions; inspect before/after history." } } } };
export const ReadOnly: Story = { args: { saved: true, readOnly: true }, parameters: { docs: { description: { story: "Read current content/history without edit controls." } } } };
export const LoadFailure: Story = { args: { mode: "failed-load" }, parameters: { docs: { description: { story: "Load error is separate from empty instructions and offers retry." } } } };
export const SaveFailure: Story = { args: { saved: true, mode: "failed-save" }, parameters: { docs: { description: { story: "Definite save failure retains draft and pending deletions." } } } };
export const LostResponse: Story = { args: { saved: true, mode: "lost-response" }, parameters: { docs: { description: { story: "Unknown result retains the command identity; result confirmation replays once without duplicate history." } } } };
export const Conflict: Story = { args: { saved: true, mode: "conflict" }, parameters: { docs: { description: { story: "Concurrent edit requires explicit choice between local and latest text; draft is preserved." } } } };


// Dialog content is portaled; scope queries to this canvas owner document.
async function until(check: () => boolean, message: string) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (check()) return;
    await new Promise(resolve => window.setTimeout(resolve, 20));
  }
  throw new Error(message);
}
function button(root: ParentNode, text: string) {
  const result = [...root.querySelectorAll<HTMLButtonElement>("button")].find(node => node.textContent?.trim() === text);
  if (!result) throw new Error(`Missing button: ${text}`);
  return result;
}
function enter(node: HTMLTextAreaElement, text: string) {
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(node, text);
  node.dispatchEvent(new Event("input", { bubbles: true }));
}
export const AuthoringFlow: Story = {
  parameters: { docs: { description: { story: "Interaction: choose scope, save, reopen and preserve history. Uses the new editor with a synthetic transport." } } },
  play: async ({ canvasElement }) => {
    const root = canvasElement.ownerDocument;
    button(canvasElement, "총괄 지시사항").click();
    await until(() => !!root.querySelector("[role=dialog] h3"), "Scope chooser did not open");
    await until(() => !root.querySelector("[role=dialog]")!.getAnimations().some(animation => animation.playState === "running"), "Dialog animation did not settle");
    const before = root.querySelector("[role=dialog]")!.getBoundingClientRect();
    if (!button(root, "변경 이력").disabled) throw new Error("Empty history must be disabled");
    button(root, "전체 오더").click();
    await until(() => !!root.querySelector("textarea"), "Input did not appear");
    const input = root.querySelector<HTMLTextAreaElement>("textarea")!;
    enter(input, "합성 지시 저장 검증");
    await until(() => !button(root, "적용").disabled, "Apply stayed disabled");
    const after = root.querySelector("[role=dialog]")!.getBoundingClientRect();
    if (Math.abs(before.height - after.height) > 1 || Math.abs(before.width - after.width) > 1) throw new Error("Dialog resized after adding input");
    button(root, "적용").click();
    await until(() => !root.querySelector("[role=dialog]"), "Successful apply did not close dialog");
    button(canvasElement, "총괄 지시사항").click();
    await until(() => root.querySelector<HTMLTextAreaElement>("textarea")?.value === "합성 지시 저장 검증", "Applied text did not survive reopening");
    if (button(root, "변경 이력").disabled || !button(root, "적용").disabled) throw new Error("Reopened history/no-op state is incorrect");
  },
};
export const LostResponseRecovery: Story = {
  args: { saved: true, mode: "lost-response" },
  parameters: { docs: { description: { story: "Interaction: preserve draft on unknown save outcome, then reconcile the same command without duplicate history." } } },
  play: async ({ canvasElement }) => {
    const root = canvasElement.ownerDocument;
    button(canvasElement, "총괄 지시사항").click();
    await until(() => !!root.querySelector("textarea"), "Saved instruction did not load");
    enter(root.querySelector<HTMLTextAreaElement>("textarea")!, "응답 유실 합성 검증");
    await until(() => !button(root, "적용").disabled, "Apply stayed disabled");
    button(root, "적용").click();
    await until(() => root.body.textContent?.includes("적용 결과를 확인하지 못했습니다.") ?? false, "Unknown outcome message missing");
    if (root.querySelector<HTMLTextAreaElement>("textarea")?.value !== "응답 유실 합성 검증") throw new Error("Unknown outcome lost draft");
    button(root, "결과 확인").click();
    await until(() => !root.querySelector("[role=dialog]"), "Result reconciliation failed");
  },
};


SaveFailure.play = async ({ canvasElement }) => {
  const root = canvasElement.ownerDocument;
  button(canvasElement, "총괄 지시사항").click();
  await until(() => !!root.querySelector("textarea"), "Input missing");
  enter(root.querySelector<HTMLTextAreaElement>("textarea")!, "실패 후 보존할 합성 초안");
  await until(() => !button(root, "적용").disabled, "Apply stayed disabled");
  button(root, "적용").click();
  await until(() => !!root.querySelector("[role=alert]"), "Failure message missing");
  if (root.querySelector<HTMLTextAreaElement>("textarea")?.value !== "실패 후 보존할 합성 초안") throw new Error("Failure lost draft");
};
Conflict.play = async ({ canvasElement }) => {
  const root = canvasElement.ownerDocument;
  button(canvasElement, "총괄 지시사항").click();
  await until(() => !!root.querySelector("textarea"), "Input missing");
  enter(root.querySelector<HTMLTextAreaElement>("textarea")!, "충돌 후 유지할 합성 초안");
  await until(() => !button(root, "적용").disabled, "Apply stayed disabled");
  button(root, "적용").click();
  await until(() => root.body.textContent?.includes("내 변경 유지") ?? false, "Conflict comparison missing");
  if (!button(root, "적용").disabled) throw new Error("Unresolved conflict permits save");
  button(root, "내 변경 유지").click();
  await until(() => !button(root, "적용").disabled, "Resolved draft did not unlock");
  if (root.querySelector<HTMLTextAreaElement>("textarea")?.value !== "충돌 후 유지할 합성 초안") throw new Error("Conflict lost draft");
  button(root, "적용").click();
  await until(() => !root.querySelector("[role=dialog]"), "Rebased save failed");
};
ReadOnly.play = async ({ canvasElement }) => {
  const root = canvasElement.ownerDocument;
  button(canvasElement, "총괄 지시사항").click();
  await until(() => !!root.querySelector("textarea"), "Read-only content missing");
  if (!root.querySelector<HTMLTextAreaElement>("textarea")!.readOnly) throw new Error("Read-only input editable");
  if ([...root.querySelectorAll("button")].some(node => node.textContent?.trim() === "적용")) throw new Error("Read-only surface exposes apply");
};

export const LegacyPromotion: Story = {
  args: { legacy: true },
  play: async ({ canvasElement }) => {
    const root = canvasElement.ownerDocument;
    button(canvasElement, "총괄 지시사항").click();
    await until(() => !!root.querySelector("textarea"), "Legacy input missing");
    if (!root.body.textContent?.includes("적용하면 이 경구제 지시가 모든 조제 오더에 전달됩니다.")) throw new Error("Legacy applicability disclosure missing");
    button(root, "취소").click();
    await until(() => !root.querySelector("[role=dialog]"), "Viewing legacy falsely prompted unsaved changes");
    button(canvasElement, "총괄 지시사항").click();
    await until(() => !!root.querySelector("textarea"), "Legacy reopen failed");
    button(root, "적용").click();
    await until(() => !root.querySelector("[role=dialog]"), "Explicit promotion failed");
    button(canvasElement, "총괄 지시사항").click();
    await until(() => !!root.querySelector("textarea"), "Promoted reopen failed");
    if (root.body.textContent?.includes("적용하면 이 경구제 지시가 모든 조제 오더에 전달됩니다.")) throw new Error("Promotion still marked legacy");
  },
};
export const ChartNavigationGuard: Story = {
  render: () => <OverallInstructionsEditor workspaceId="synthetic-overall-navigation" chartId={syntheticOverallInstructions.chartId} disabled={false} />,
  beforeEach: () => {
    const original = globalThis.fetch;
    const client = createSyntheticInstructionsClient({ saved: true });
    globalThis.fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
      if (url.pathname !== `/api/workspaces/synthetic-overall-navigation/chart/charts/${syntheticOverallInstructions.chartId}/overall-instructions`) return original(input, init);
      const signal = new AbortController().signal;
      return Response.json({ ok: true, document: init?.method === "PATCH" ? await client.apply(JSON.parse(String(init.body)), signal) : await client.load(signal) });
    };
    return () => { globalThis.fetch = original; useChartStore.setState({ flushOverallInstructions: undefined }); };
  },
  play: async ({ canvasElement }) => {
    const root = canvasElement.ownerDocument;
    button(canvasElement, "총괄 지시사항").click();
    await until(() => !!root.querySelector("textarea"), "Chart adapter load failed");
    enter(root.querySelector<HTMLTextAreaElement>("textarea")!, "화면 이동 전에 보존할 합성 지시");
    await until(() => !button(root, "적용").disabled, "Draft did not become dirty");
    const first = useChartStore.getState().flushEditors();
    await until(() => root.body.textContent?.includes("변경 버리기") ?? false, "Navigation did not ask about dirty instructions");
    button(root, "계속 작성").click();
    if (await first) throw new Error("Cancelled discard allowed navigation");
    if (root.querySelector<HTMLTextAreaElement>("textarea")?.value !== "화면 이동 전에 보존할 합성 지시") throw new Error("Cancelled navigation lost draft");
    const second = useChartStore.getState().flushEditors();
    await until(() => root.body.textContent?.includes("변경 버리기") ?? false, "Second navigation did not ask");
    button(root, "변경 버리기").click();
    if (!await second) throw new Error("Confirmed discard blocked navigation");
    await until(() => !root.querySelector("[role=dialog]"), "Discard did not close editor");
  },
};
