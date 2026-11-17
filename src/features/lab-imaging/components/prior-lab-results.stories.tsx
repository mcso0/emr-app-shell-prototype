import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor } from "storybook/test";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMockAuthStore } from "@/features/auth/session-store";
import type { LabResult } from "@/types/emr-domain";
import { useLabAutosave, type LabAutosaveOutcome } from "../lab-autosave";
import { PriorLabResults } from "./prior-lab-results";

const result: LabResult = { workspaceId: "synthetic-draft-recovery", id: "synthetic-new-result", orderId: "synthetic-order", encounterId: "synthetic-encounter", patientId: "synthetic-patient", resultName: "합성 검사", status: "pending", rows: [], priorResults: [{ resultId: "synthetic-old-result", taskId: "synthetic-old-task", taskAttemptNo: 1, createdAt: "2026-11-16T00:00:00Z" }] };
let writes: Array<{ value: string; resolve: (outcome: LabAutosaveOutcome) => void }>;
function DraftInput({ onRerequest }: { onRerequest: () => void }) {
  const autosave = useLabAutosave<string>(`${result.workspaceId}:synthetic-old-result:overall`, value => new Promise(resolve => writes.push({ value, resolve })), 0);
  return <div className="space-y-3">
    <Input aria-label="합성 이전 소견" value={autosave.state.draft ?? ""} onChange={event => autosave.change(event.target.value)} />
    <Button onClick={autosave.flush}>저장</Button>
    <Button onClick={onRerequest}>합성 재요청</Button>
    <Button onClick={() => useMockAuthStore.setState({ session: { id: "synthetic-actor-b", role: "nurse", roleLabel: "합성 담당 B", storageMode: "session", issuedAt: "2026-11-16T00:00:00Z" } })}>합성 사용자 전환</Button>
  </div>;
}
function Example() {
  const [replaced, setReplaced] = useState(false);
  return <div className="max-w-2xl space-y-4 p-6">{replaced ? <PriorLabResults result={result} /> : <DraftInput onRerequest={() => setReplaced(true)} />}</div>;
}
const meta = {
  title: "Features/Lab/Previous Result Draft Recovery", component: Example,
  beforeEach: () => {
    writes = []; const auth = useMockAuthStore.getState();
    useMockAuthStore.setState({ hydrated: true, session: { id: "synthetic-actor-a", role: "nurse", roleLabel: "합성 담당 A", storageMode: "session", issuedAt: "2026-11-16T00:00:00Z" } });
    return () => { for (const write of writes) write.resolve({ ok: false, reason: "held", message: "합성 중지", retryable: true }); useMockAuthStore.setState(auth, true); };
  },
} satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
export const SupersededInputStaysInPreviousResult: Story = { play: async ({ canvas }) => {
  await userEvent.type(canvas.getByRole("textbox", { name: "합성 이전 소견" }), "합성 미저장 소견");
  await userEvent.click(canvas.getByRole("button", { name: "합성 재요청" }));
  await canvas.findByText("1회차의 미저장 입력입니다. 재요청된 검사에는 반영되지 않습니다.");
  if (writes[0]) writes[0].resolve({ ok: false, reason: "superseded", message: "합성 재요청", retryable: false });
  await userEvent.click(canvas.getByText("미저장 입력 보기", { exact: true }));
  await expect(canvas.getByText("합성 미저장 소견", { exact: true })).toBeVisible();
  await waitFor(() => expect(canvas.getByRole("button", { name: "미저장 입력 버리기" })).toBeEnabled());
  await userEvent.click(canvas.getByRole("button", { name: "미저장 입력 버리기" }));
  await waitFor(() => expect(canvas.queryByText("합성 미저장 소견", { exact: true })).not.toBeInTheDocument());
  const unload = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(unload);
  await expect(unload.defaultPrevented).toBe(false);
} };
export const ActorChangeStopsPendingWrite: Story = { play: async ({ canvas }) => {
  const input = () => canvas.getByRole("textbox", { name: "합성 이전 소견" });
  await userEvent.type(input(), "첫 입력"); await userEvent.click(canvas.getByRole("button", { name: "저장" }));
  await waitFor(() => expect(writes).toHaveLength(1));
  await userEvent.type(input(), " 다음 입력");
  await userEvent.click(canvas.getByRole("button", { name: "합성 사용자 전환" }));
  await waitFor(() => expect(input()).toHaveValue(""));
  writes[0].resolve({ ok: true, revision: 1 });
  await new Promise(resolve => setTimeout(resolve, 900));
  await expect(writes).toHaveLength(1);
} };
