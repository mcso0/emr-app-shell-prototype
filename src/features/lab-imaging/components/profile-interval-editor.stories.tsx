import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { ProfileIntervalEditor } from "./profile-interval-editor";
import type { LabProfileRule } from "../result-profile-contract";

const workspaceId = "storybook-profile-interval";
const profileVersionId = "94000000-0000-4000-8000-000000000001";
const rules: LabProfileRule[] = [{ testMasterKey: "synthetic-test", code: "SYN-A", resultValueKind: "numeric", unit: "synthetic-unit", decimalScale: 1, supported: true, numericMin: null, numericMax: null, referenceInterval: { low: 1, high: 5, lowInclusive: true, highInclusive: true }, displayRange: null, codes: [], referenceStatus: "synthetic_functional_fixture", provenance: {} }];
let writes: Array<Record<string, unknown>> = [];
let configuration = { revision: 3, rules };
type Args = { disabled: boolean; scenario: "ready" | "save-error" | "conflict" };
function Example(args: Args) {
  const [saved, setSaved] = useState(0);
  const [binding, setBinding] = useState(() => structuredClone(configuration));
  return <div className="w-[600px] p-4"><ProfileIntervalEditor key={`${profileVersionId}:${binding.revision}`} workspaceId={workspaceId} catalogItemId="synthetic-catalog" profileVersionId={profileVersionId} expectedBindingRevision={binding.revision} rules={binding.rules} disabled={args.disabled} onSaved={() => { setSaved((count) => count + 1); setBinding(structuredClone(configuration)); }} /><output aria-label="합성 정상범위 저장 횟수">{saved}</output></div>;
}
const meta = {
  title: "Features/Lab/Profile Interval Editor", component: Example, tags: ["autodocs"], args: { disabled: false, scenario: "ready" as Args["scenario"] }, argTypes: { scenario: { control: false } },
  parameters: { docs: { story: { inline: false, height: "620px" }, description: { component: "검사 프로필 선택 영역의 실제 ProfileIntervalEditor입니다. 합성 숫자 규칙으로 상·하한 검증, 범위 해제, 저장 실패·재시도와 binding 충돌 안내를 확인합니다. 실제 프로필 버전이나 마스터를 쓰지 않습니다. 예제 값은 임상 정상범위가 아닙니다." } } },
  beforeEach: ({ args }) => {
    const original = globalThis.fetch;writes = [];configuration = { revision: 3, rules: structuredClone(rules) };let failed = args.scenario !== "ready";
    globalThis.fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
      if (!url.pathname.startsWith("/api/")) return original(input, init);
      if (url.pathname !== `/api/workspaces/${workspaceId}/lab-imaging/result-profiles` || init?.method !== "POST") throw new Error(`Unexpected API ${url.pathname}`);
      const command = JSON.parse(String(init.body));writes.push(command);
      if (command.profileVersionId !== profileVersionId || command.expectedBindingRevision !== configuration.revision) throw new Error("Synthetic profile binding contract mismatch");
      if (failed) { failed = false;return Response.json({ ok: false, error: args.scenario === "conflict" ? "lab_profile_binding_revision_conflict" : "synthetic_save_failed" }, { status: args.scenario === "conflict" ? 409 : 503 }); }
      configuration = { revision: configuration.revision + 1, rules: configuration.rules.map(rule => ({ ...rule, referenceInterval: command.intervals.find((interval: { testMasterKey: string }) => interval.testMasterKey === rule.testMasterKey).referenceInterval })) };
      return Response.json({ ok: true });
    };
    return () => { globalThis.fetch = original; };
  },
} satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
async function open(canvas: ReturnType<typeof within>) { await userEvent.click(canvas.getByText("병원 정상범위 수정")); }
export const SaveAndClearBounds: Story = { play: async ({ canvas }) => { await open(canvas);await userEvent.clear(canvas.getByRole("spinbutton", { name: "SYN-A 하한" }));await userEvent.type(canvas.getByRole("spinbutton", { name: "SYN-A 하한" }), "2");await userEvent.click(canvas.getByRole("button", { name: "새 병원 정상범위 버전 저장" }));await waitFor(() => expect(canvas.getByLabelText("합성 정상범위 저장 횟수")).toHaveTextContent("1"));await expect(writes[0]).toMatchObject({ action: "save_intervals", profileVersionId, expectedBindingRevision: 3, intervals: [{ testMasterKey: "synthetic-test", referenceInterval: { low: 2, high: 5 } }] });await open(canvas);await expect(canvas.getByRole("spinbutton", { name: "SYN-A 하한" })).toHaveValue(2);await userEvent.clear(canvas.getByRole("spinbutton", { name: "SYN-A 하한" }));await userEvent.clear(canvas.getByRole("spinbutton", { name: "SYN-A 상한" }));await userEvent.click(canvas.getByRole("button", { name: "새 병원 정상범위 버전 저장" }));await waitFor(() => expect(canvas.getByLabelText("합성 정상범위 저장 횟수")).toHaveTextContent("2"));await expect(writes[1]).toMatchObject({ expectedBindingRevision: 4, intervals: [{ referenceInterval: null }] }); } };
export const InvalidRange: Story = { play: async ({ canvas }) => { await open(canvas);await userEvent.clear(canvas.getByRole("spinbutton", { name: "SYN-A 하한" }));await userEvent.type(canvas.getByRole("spinbutton", { name: "SYN-A 하한" }), "9");await expect(canvas.getByRole("button", { name: "새 병원 정상범위 버전 저장" })).toBeDisabled();await expect(writes).toHaveLength(0); } };
export const SaveFailureAndRetry: Story = { args: { scenario: "save-error" }, play: async ({ canvas }) => { await open(canvas);await userEvent.click(canvas.getByRole("button", { name: "새 병원 정상범위 버전 저장" }));await expect(await canvas.findByRole("alert")).toHaveTextContent("입력값은 유지");await userEvent.click(canvas.getByRole("button", { name: "새 병원 정상범위 버전 저장" }));await waitFor(() => expect(writes).toHaveLength(2));await expect(writes[1].requestId).toBe(writes[0].requestId);await waitFor(() => expect(canvas.getByLabelText("합성 정상범위 저장 횟수")).toHaveTextContent("1")); } };
export const BindingConflict: Story = { args: { scenario: "conflict" }, play: async ({ canvas }) => { await open(canvas);await userEvent.click(canvas.getByRole("button", { name: "새 병원 정상범위 버전 저장" }));await expect(await canvas.findByRole("alert")).toHaveTextContent("최신 설정을 다시 불러와"); } };
export const ReadOnly: Story = { args: { disabled: true }, play: async ({ canvas }) => { await open(canvas);await expect(canvas.getByRole("spinbutton", { name: "SYN-A 하한" })).toBeDisabled();await expect(canvas.getByRole("button", { name: "새 병원 정상범위 버전 저장" })).toBeDisabled(); } };
