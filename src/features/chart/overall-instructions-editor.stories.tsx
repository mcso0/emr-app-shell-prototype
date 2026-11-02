import { useMemo, useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Button } from "@/components/ui/button";
import { InstructionRequestError, type OverallInstructionsClient } from "./overall-instructions-client";
import { instructionScopeSchema, instructionScopeLabels } from "./overall-instructions-contract";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { OverallInstructionsDialog, OverallInstructionsEditor } from "./overall-instructions-editor";
import { useChartStore } from "./store";
import { createSyntheticInstructionsClient, syntheticOverallInstructions } from "./overall-instructions-fixtures";

function Example({ saved = false, readOnly = false, legacy = false, mode = "normal", eligibleScopes, loadDelayMs }: Parameters<typeof createSyntheticInstructionsClient>[0] & {}) {
  const client = useMemo(() => createSyntheticInstructionsClient({ saved, readOnly, legacy, mode, eligibleScopes, loadDelayMs }), [saved, readOnly, legacy, mode, eligibleScopes, loadDelayMs]);
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
export const Empty: Story = { parameters: { docs: { description: { story: "Choose a scope, add/remove fields and keep the outer dialog size stable. The initial chooser has no footer or history control." } } } };
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
    if (root.querySelector('[data-slot="dialog-footer"]')) throw new Error("Chooser must not reserve a footer");
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
    await until(() => !root.querySelector("[role=status]"), "Revalidation did not finish");
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
  if (root.body.textContent?.includes("다시 조회")) throw new Error("Save failure must not expose destructive load retry");
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
    await until(() => !button(root, "적용").disabled, "Legacy revalidation did not finish");
    button(root, "적용").click();
    await until(() => !root.querySelector("[role=dialog]"), "Explicit promotion failed");
    button(canvasElement, "총괄 지시사항").click();
    await until(() => !!root.querySelector("textarea"), "Promoted reopen failed");
    await until(() => !root.querySelector("[role=status]"), "Promoted revalidation did not finish");
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

export const DispensingOnly: Story = {
  args: { eligibleScopes: ["overall", "dispensing"] },
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body);
    await userEvent.click(within(canvasElement).getByRole("button", { name: "총괄 지시사항" }));
    await screen.findByRole("heading", { name: "어디에 지시를 작성할까요?" });
    const dialog = screen.getByRole("dialog");
    const scopeNames = instructionScopeSchema.options.map(scope => instructionScopeLabels[scope].replace(/ 지시$/, ""));
    await expect(within(dialog).getAllByRole("button").filter(node => scopeNames.includes(node.textContent ?? "")).map(node => node.textContent)).toEqual(scopeNames);
    await expect(dialog.querySelector('[data-slot="dialog-footer"]')).toBeNull();
    const unavailable = screen.getByRole("button", { name: "진료" });
    await expect(unavailable).toHaveAttribute("aria-disabled", "true");
    await waitFor(() => expect(dialog.querySelector("h2 > span")).toHaveFocus());
    // Keyboard focus and attempted Enter must reveal why the scope cannot be selected.
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    await waitFor(() => expect(unavailable).toHaveFocus());
    await waitFor(() => expect(screen.getByText("해당 분류의 오더가 없습니다")).toBeVisible());
    await userEvent.keyboard("{Enter}");
    await expect(screen.queryByRole("textbox")).toBeNull();
    await waitFor(() => expect(screen.getByText("해당 분류의 오더가 없습니다")).toBeVisible());
    await userEvent.hover(unavailable);
    await waitFor(() => expect(screen.getByText("해당 분류의 오더가 없습니다")).toBeVisible());
    await userEvent.click(unavailable);
    await expect(screen.queryByRole("textbox")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "조제" }));
    await screen.findByRole("textbox", { name: "조제 지시" });
    await expect(screen.getByRole("button", { name: "변경 이력" })).toBeDisabled();
    await expect(screen.getByRole("button", { name: "취소" })).toBeVisible();
    await expect(screen.getByRole("button", { name: "적용" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "지시 추가" }));
    const items = await screen.findAllByRole("menuitem");
    await expect(items.map(node => node.textContent)).toEqual(instructionScopeSchema.options.filter(scope => scope !== "dispensing").map(scope => instructionScopeLabels[scope]));
    const unavailableItem = screen.getByRole("menuitem", { name: "진료 지시" });
    await expect(unavailableItem).toHaveAttribute("aria-disabled", "true");
    await waitFor(() => expect(screen.getByRole("menu")).toBeVisible());
    await userEvent.keyboard("{Home}");
    await waitFor(() => expect(items[0]).toHaveFocus());
    await userEvent.keyboard("{ArrowDown}");
    await waitFor(() => expect(unavailableItem).toHaveFocus());
    await waitFor(() => expect(screen.getByText("해당 분류의 오더가 없습니다")).toBeVisible());
    await userEvent.keyboard("{Enter}");
    await expect(screen.queryByRole("textbox", { name: "진료 지시" })).toBeNull();
    await expect(screen.getByRole("menu")).toBeVisible();
    await userEvent.keyboard("{Escape}");
    if (screen.queryByRole("menu")) await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    await userEvent.click(screen.getByRole("button", { name: "조제 지시 입력란 삭제" }));
    await screen.findByRole("heading", { name: "어디에 지시를 작성할까요?" });
    await expect(screen.getByRole("dialog").querySelector('[data-slot="dialog-footer"]')).toBeNull();
    await expect(screen.getByRole("button", { name: "진료" })).toHaveAttribute("aria-disabled", "true");
  },
};

export const FirstLoadSpinner: Story = {
  args: { loadDelayMs: 700 },
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body);
    await userEvent.click(within(canvasElement).getByRole("button", { name: "총괄 지시사항" }));
    const status = screen.getByRole("status", { name: "지시사항을 불러오는 중입니다." });
    await waitFor(() => expect(status).toBeVisible());
    await expect(status.textContent).toBe("");
    await expect(status.querySelector("svg")).not.toBeNull();
    await expect(screen.getByRole("dialog").querySelector('[data-slot="dialog-footer"]')).toBeNull();
    await screen.findByRole("heading", { name: "어디에 지시를 작성할까요?" });
  },
};

type RefreshOutcome = "updated" | "failed" | "read-only" | "denied" | "unauthenticated";
function RefreshExample({ outcome = "updated" }: { outcome?: RefreshOutcome }) {
  const client = useMemo<OverallInstructionsClient>(() => {
    const base = createSyntheticInstructionsClient({ saved: true });
    let reads = 0;
    return {
      apply: base.apply,
      async load(signal) {
        const read = ++reads;
        if (read > 1) await new Promise(resolve => setTimeout(resolve, 700));
        if (read === 2 && outcome === "failed") throw new InstructionRequestError("instruction_unavailable");
        if (read > 1 && (outcome === "denied" || outcome === "unauthenticated")) throw new InstructionRequestError(outcome === "denied" ? "permission_missing" : "unauthenticated");
        if ((read === 2 && outcome === "updated") || (read === 3 && outcome === "failed")) {
          await base.apply({ commandId: "51000000-0000-4000-8000-000000000005", changes: [{ scope: "overall", expectedRevision: 1, operation: "set", instruction: "서버에서 갱신한 합성 최신 지시" }] }, signal);
        }
        const document = await base.load(signal);
        if (read > 1) document.eligibleScopes = ["overall", "treatment"];
        if (read > 1 && outcome === "read-only") { document.canEdit = false; document.readOnlyReason = "permission_missing"; }
        return document;
      },
    };
  }, [outcome]);
  return <OverallInstructionsDialog client={client} />;
}

async function openSaved(canvasElement: HTMLElement) {
  const screen = within(canvasElement.ownerDocument.body);
  await userEvent.click(within(canvasElement).getByRole("button", { name: "총괄 지시사항" }));
  const input = await screen.findByRole("textbox", { name: "전체 오더 지시" });
  await waitFor(() => expect(input).not.toHaveAttribute("readonly"));
  return { screen, input };
}
async function closeAndReopen(canvasElement: HTMLElement) {
  const screen = within(canvasElement.ownerDocument.body);
  await userEvent.click(screen.getByRole("button", { name: "취소" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await userEvent.click(within(canvasElement).getByRole("button", { name: "총괄 지시사항" }));
  return screen;
}
async function expectRefreshLocked(screen: ReturnType<typeof within>) {
  await expect(screen.getByRole("textbox")).toHaveAttribute("readonly");
  await expect(screen.getByRole("button", { name: "지시 추가" })).toBeDisabled();
  await expect(screen.getByRole("button", { name: "전체 오더 지시 입력란 삭제" })).toBeDisabled();
  await expect(screen.getByRole("button", { name: "적용" })).toBeDisabled();
}

export const CachedReopenRefresh: Story = {
  render: () => <RefreshExample />,
  play: async ({ canvasElement }) => {
    const { screen, input } = await openSaved(canvasElement);
    // Cancelled drafts must never become the cached document.
    enter(input as HTMLTextAreaElement, "버릴 합성 초안");
    await userEvent.click(screen.getByRole("button", { name: "취소" }));
    await userEvent.click(await screen.findByRole("button", { name: "변경 버리기" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await userEvent.click(within(canvasElement).getByRole("button", { name: "총괄 지시사항" }));
    await expect(screen.getByRole("textbox")).toHaveValue("합성 검증용 공통 지시입니다.");
    await waitFor(() => expect(screen.getByRole("status", { name: "지시사항을 새로 불러오는 중입니다." })).toBeVisible());
    await expectRefreshLocked(screen);
    await waitFor(() => expect(screen.getByRole("textbox")).not.toHaveAttribute("readonly"), { timeout: 2000 });
    await expect(screen.getByRole("textbox")).toHaveValue("서버에서 갱신한 합성 최신 지시");
    await userEvent.click(screen.getByRole("button", { name: "지시 추가" }));
    await expect(await screen.findByRole("menuitem", { name: "조제 지시" })).toHaveAttribute("aria-disabled", "true");
    await expect(screen.getByRole("menuitem", { name: "처치 지시" })).not.toHaveAttribute("aria-disabled", "true");
    await userEvent.keyboard("{Escape}");
    enter(screen.getByRole("textbox") as HTMLTextAreaElement, "다시 저장한 합성 지시");
    await waitFor(() => expect(screen.getByRole("button", { name: "적용" })).toBeEnabled());
    // Duplicate requests must be blocked synchronously, including on a successful save.
    button(canvasElement.ownerDocument, "적용").click();
    button(canvasElement.ownerDocument, "적용").click();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await userEvent.click(within(canvasElement).getByRole("button", { name: "총괄 지시사항" }));
    await expect(screen.getByRole("textbox")).toHaveValue("다시 저장한 합성 지시");
    await expectRefreshLocked(screen);
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull(), { timeout: 2000 });
    await expect(screen.getByRole("textbox")).toHaveValue("다시 저장한 합성 지시");
    await userEvent.click(screen.getByRole("button", { name: "변경 이력" }));
    // Initial + one simulated remote edit + one save, despite two clicks.
    const history = await screen.findByRole("dialog", { name: "변경 이력" });
    await expect(within(history).getAllByRole("heading", { level: 3 })).toHaveLength(3);
  },
};

export const RefreshFailureRetry: Story = {
  render: () => <RefreshExample outcome="failed" />,
  play: async ({ canvasElement }) => {
    await openSaved(canvasElement);
    const screen = await closeAndReopen(canvasElement);
    await expectRefreshLocked(screen);
    await screen.findByRole("alert");
    await expect(screen.getByRole("textbox")).toHaveValue("합성 검증용 공통 지시입니다.");
    await expectRefreshLocked(screen);
    await userEvent.click(screen.getByRole("button", { name: "다시 조회" }));
    await expectRefreshLocked(screen);
    await waitFor(() => expect(screen.getByRole("textbox")).not.toHaveAttribute("readonly"), { timeout: 2000 });
    await expect(screen.getByRole("textbox")).toHaveValue("서버에서 갱신한 합성 최신 지시");
    await expect(screen.queryByRole("alert")).toBeNull();
  },
};
export const RefreshedReadOnly: Story = {
  render: () => <RefreshExample outcome="read-only" />,
  play: async ({ canvasElement }) => {
    await openSaved(canvasElement);
    const screen = await closeAndReopen(canvasElement);
    await expectRefreshLocked(screen);
    await screen.findByText("지시사항을 수정할 권한이 없습니다.");
    await expect(screen.getByRole("textbox")).toHaveAttribute("readonly");
    await expect(screen.queryByRole("button", { name: "적용" })).toBeNull();
    await expect(screen.queryByRole("button", { name: "지시 추가" })).toBeNull();
    await expect(screen.getByRole("button", { name: "변경 이력" })).toBeEnabled();
  },
};
async function assertReadAccessRevoked(canvasElement: HTMLElement) {
  await openSaved(canvasElement);
  const screen = await closeAndReopen(canvasElement);
  await expectRefreshLocked(screen);
  await screen.findByRole("alert");
  await expect(screen.queryByRole("textbox")).toBeNull();
  await expect(screen.queryByRole("button", { name: "변경 이력" })).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "총괄 지시사항 닫기" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await userEvent.click(within(canvasElement).getByRole("button", { name: "총괄 지시사항" }));
  await expect(screen.queryByRole("textbox")).toBeNull();
  await waitFor(() => expect(screen.getByRole("status", { name: "지시사항을 불러오는 중입니다." })).toBeVisible());
  await screen.findByRole("alert");
}
export const ReadAccessRevoked: Story = { render: () => <RefreshExample outcome="denied" />, play: async ({ canvasElement }) => assertReadAccessRevoked(canvasElement) };
export const SessionExpired: Story = { render: () => <RefreshExample outcome="unauthenticated" />, play: async ({ canvasElement }) => assertReadAccessRevoked(canvasElement) };

function ClientSwitchExample() {
  const [second, setSecond] = useState(false);
  const clients = useMemo(() => [false, true].map(other => {
    const base = createSyntheticInstructionsClient({ saved: true, loadDelayMs: other ? 900 : 500 });
    return { ...base, async load(signal: AbortSignal) {
      const document = await base.load(signal);
      if (other) { document.chartId = "51000000-0000-4000-8000-000000000006"; document.current[0].instruction = "다른 클라이언트의 합성 지시"; }
      return document;
    } };
  }), []);
  return <><Button onClick={() => setSecond(true)}>합성 클라이언트 전환</Button><OverallInstructionsDialog client={clients[second ? 1 : 0]} /></>;
}
export const ClientIdentitySwitch: Story = {
  render: () => <ClientSwitchExample />,
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body);
    await userEvent.click(within(canvasElement).getByRole("button", { name: "총괄 지시사항" }));
    await waitFor(() => expect(screen.getByRole("status")).toBeVisible());
    // External context switches can occur while the modal is open.
    button(canvasElement, "합성 클라이언트 전환").click();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await userEvent.click(within(canvasElement).getByRole("button", { name: "총괄 지시사항" }));
    await expect(screen.queryByRole("textbox")).toBeNull();
    await screen.findByDisplayValue("다른 클라이언트의 합성 지시", {}, { timeout: 2000 });
    await expect(screen.queryByDisplayValue("합성 검증용 공통 지시입니다.")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "취소" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await userEvent.click(within(canvasElement).getByRole("button", { name: "총괄 지시사항" }));
    await expect(screen.getByRole("textbox")).toHaveValue("다른 클라이언트의 합성 지시");
    await expectRefreshLocked(screen);
  },
};
export const ClosedLateLoad: Story = {
  args: { saved: true, loadDelayMs: 500 },
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body);
    await userEvent.click(within(canvasElement).getByRole("button", { name: "총괄 지시사항" }));
    await waitFor(() => expect(screen.getByRole("status")).toBeVisible());
    await userEvent.click(screen.getByRole("button", { name: "총괄 지시사항 닫기" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await new Promise(resolve => setTimeout(resolve, 600));
    await expect(screen.queryByRole("dialog")).toBeNull();
    await userEvent.click(within(canvasElement).getByRole("button", { name: "총괄 지시사항" }));
    await expect(screen.queryByRole("textbox")).toBeNull();
    await waitFor(() => expect(screen.getByRole("status", { name: "지시사항을 불러오는 중입니다." })).toBeVisible());
    await screen.findByRole("textbox");
  },
};
