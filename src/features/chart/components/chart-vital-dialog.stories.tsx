import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Button } from "@/components/ui/button";
import { createDefaultWorkspaceVitalSettingsSnapshot } from "@/features/patient-vitals/workspace-vital-settings";
import type { PatientVitalMeasurement, PatientVitalWriteInput } from "@/features/patient-vitals/patient-vital-types";
import { ChartVitalDialog } from "./chart-vital-dialog";

type Scenario = "readonly" | "empty" | "record" | "save-error" | "read-error" | "dirty-cancel" | "historical-edit";
const id = (index: number) => `99200000-0000-4000-8000-${String(index).padStart(12, "0")}`;
type WriteReceipt = { encounterId: string; measurementId: string; vitals: PatientVitalWriteInput; expectedUpdatedAt?: string; measuredAt?: string };
function createFixture(scenario: Scenario) {
  const workspaceId = `storybook-vitals-${crypto.randomUUID()}`;
  const settings = createDefaultWorkspaceVitalSettingsSnapshot(false);
  const canWrite = ["record", "save-error", "dirty-cancel", "historical-edit"].includes(scenario);
  const records: PatientVitalMeasurement[] = ["empty", "record", "save-error"].includes(scenario) ? [] : [
    { id: id(1), encounterId: id(10), patientId: id(11), measuredAt: "2026-10-11T00:00:00Z", createdAt: "2026-10-11T00:00:00Z", updatedAt: "2026-10-11T00:00:00Z", recordedByName: "합성 바이탈 작성자 A", weightKg: 4.5, temperatureC: 38.2, heartRateBpm: 120, respiratoryRateRpm: 24, bloodPressureSystolicMmhg: 120, bloodPressureDiastolicMmhg: 80 },
    { id: id(2), encounterId: id(12), patientId: id(11), measuredAt: "2026-10-10T00:00:00Z", createdAt: "2026-10-10T00:00:00Z", updatedAt: "2026-10-10T00:00:00Z", recordedByName: "합성 바이탈 작성자 B", weightKg: 4 },
  ];
  const requests: Array<{ method: string; body?: WriteReceipt }> = [];
  const saved: PatientVitalMeasurement[] = [];
  let readHealthy = scenario !== "read-error", saveHealthy = scenario !== "save-error", pending = 0;
  let unmount: (() => void) | undefined;
  const install = () => {
    const previous = globalThis.fetch;
    const intercept: typeof fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
      if (!url.pathname.startsWith("/api/")) return previous(input, init);
      const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
      if (url.pathname !== `/api/workspaces/${workspaceId}/patient-vitals/history`) throw new Error("Unexpected synthetic vital path");
      pending++;
      try {
        let response: Response;
        if (method === "GET") {
          if (url.searchParams.get("encounterId") !== id(10) || url.searchParams.has("beforeId")) throw new Error("Unexpected synthetic vital history query");
          requests.push({ method });
          response = readHealthy ? Response.json({ ok: true, measurements: records, nextCursor: null, canWriteVitals: canWrite, patient: { species: "cat", weightKg: 4.5 } }) : Response.json({ ok: false, error: "synthetic_history_unavailable" }, { status: 503 });
        } else if (method === "POST" || method === "PATCH") {
          const body = JSON.parse(String(init?.body)) as WriteReceipt;
          const current = records.find(record => record.id === body.measurementId);
          if (!canWrite || body.encounterId !== id(10) || !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(body.measurementId) || !body.vitals || Object.keys(body.vitals).length !== 6 || (method === "PATCH" && (!current || body.expectedUpdatedAt !== current.updatedAt)) || (method === "POST" && (current || typeof body.measuredAt !== "string" || !Number.isFinite(Date.parse(body.measuredAt))))) throw new Error("Invalid synthetic vital write contract");
          requests.push({ method, body: structuredClone(body) });
          if (!saveHealthy) response = Response.json({ ok: false, error: "synthetic_save_failed" }, { status: 503 });
          else {
            const values = Object.fromEntries(Object.entries(body.vitals).map(([key, value]) => [key, value ?? undefined]));
            const measuredAt = current?.measuredAt ?? body.measuredAt!;
            const vital: PatientVitalMeasurement = { ...current, ...values, id: body.measurementId, encounterId: current?.encounterId ?? id(10), patientId: current?.patientId ?? id(11), measuredAt, createdAt: current?.createdAt ?? measuredAt, updatedAt: new Date().toISOString(), recordedByName: current?.recordedByName ?? "합성 바이탈 작성자 A" };
            const index = records.findIndex(record => record.id === vital.id);
            if (index < 0) records.unshift(vital); else records[index] = vital;
            response = Response.json({ ok: true, vital });
          }
        } else throw new Error("Unexpected synthetic vital method");
        const json = response.json.bind(response);
        response.json = async () => { pending++; try { return await json(); } finally { pending--; } };
        return response;
      } finally { pending--; }
    };
    globalThis.fetch = intercept;
    return async () => { try { unmount?.(); await waitFor(() => { if (pending) throw new Error("Vital transport is still settling"); }); } finally { if (globalThis.fetch === intercept) globalThis.fetch = previous; } };
  };
  return { workspaceId, settings, records, requests, saved, install, get writes() { return requests.filter(request => request.method !== "GET"); }, recoverRead: () => { readHealthy = true; }, recoverSave: () => { saveHealthy = true; }, setUnmount: (fn: () => void) => { unmount = fn; } };
}
let fixture: ReturnType<typeof createFixture>;
function Example(args: { scenario: Scenario }) {
  void args;
  const instance = fixture;
  const [mounted, setMounted] = useState(true), [open, setOpen] = useState(true), [saved, setSaved] = useState<PatientVitalMeasurement | null>(null);
  useEffect(() => { instance.setUnmount(() => flushSync(() => setMounted(false))); }, [instance]);
  return <div className="p-6"><Button onClick={() => setOpen(true)}>합성 바이탈 열기</Button><output aria-label="합성 바이탈 저장 결과">{saved ? `${saved.weightKg ?? "—"} kg` : "미저장"}</output>{mounted ? <ChartVitalDialog workspaceId={instance.workspaceId} encounterId={id(10)} vitalSettings={instance.settings} mode="in_consultation" open={open} onOpenChange={setOpen} onSaved={vital => { instance.saved.push(structuredClone(vital)); setSaved(vital); }} /> : null}</div>;
}
const meta = {
  title: "Features/Chart/Vital Dialog", component: Example, tags: ["autodocs"], args: { scenario: "readonly" as Scenario }, argTypes: { scenario: { control: false } },
  parameters: { docs: { story: { inline: false, height: "820px" }, description: { component: "현재 차트와 환자 컨텍스트가 사용하는 ChartVitalDialog를 그대로 표시합니다. 실제 설정 factory의 6개 수치, 측정 날짜 그룹, 조회 전용·빈 상태·입력·변경 취소·저장 실패를 확인합니다. 고유 합성 workspace/encounter의 history GET/POST/PATCH만 로컬 응답으로 처리하고 실제 measurementId·expectedUpdatedAt·저장 callback을 유지합니다. 과거 합성 기록은 고정 시각이고 새 측정은 실제 컴포넌트가 예제 생성 시각을 기록합니다. 조회 종료 후 실제 컴포넌트를 unmount하고 interceptor를 복원합니다. 실제 임상 측정·DB 저장·서버 권한 검증은 포함하지 않습니다." } } },
  beforeEach: ({ args }) => { fixture = createFixture(args.scenario); return fixture.install(); }, render: args => <Example {...args} />,
} satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
async function dialog(canvasElement: HTMLElement) {
  const body = within(canvasElement.ownerDocument.body);
  const element = await body.findByRole("dialog", { name: "바이탈 이력" });
  await waitFor(() => expect(element).toBeVisible());
  return { body, element, content: within(element) };
}
async function newMeasurement(canvasElement: HTMLElement) {
  const result = await dialog(canvasElement);
  await waitFor(() => expect(result.content.getByTestId("chart-vital-history-empty")).toBeVisible());
  await userEvent.click(result.content.getByRole("button", { name: "바이탈" }));
  const weight = result.content.getByRole("textbox", { name: "체중" });
  await waitFor(() => expect(weight).toHaveFocus());
  await userEvent.type(weight, "4.8");
  await userEvent.type(result.content.getByRole("textbox", { name: "체온" }), "38.2");
  await expect(result.content.getByRole("button", { name: "저장" })).toBeEnabled();
  return result;
}
export const ReadOnlyHistoryAndKeyboard: Story = {
  play: async ({ canvasElement }) => {
    const { content, element, body } = await dialog(canvasElement);
    await waitFor(() => expect(content.getByRole("textbox", { name: "체중" })).toHaveValue("4.5"));
    for (const input of content.getAllByRole("textbox")) await expect(input).toBeDisabled();
    await expect(content.getByRole("button", { name: "저장" })).toBeDisabled();
    await expect(content.getByRole("button", { name: "바이탈" })).toBeDisabled();
    const expanded = element.querySelector<HTMLButtonElement>('button[aria-expanded="true"]');
    if (!expanded) throw new Error("Actual vital history must expand the selected day");
    expanded.focus(); await userEvent.keyboard("{Enter}");
    await expect(expanded).toHaveAttribute("aria-expanded", "false");
    await userEvent.keyboard("{Enter}"); await expect(expanded).toHaveAttribute("aria-expanded", "true");
    const secondDay = content.getByText("26.10.10").closest("button");
    if (!secondDay) throw new Error("The second actual day group must be a button");
    await userEvent.click(secondDay);
    const second = content.getByText("합성 바이탈 작성자 B").closest("button");
    if (!second) throw new Error("Actual historical measurement must be selectable");
    second.focus(); await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(content.getByRole("textbox", { name: "체중" })).toHaveValue("4"));
    await expect(fixture.writes).toHaveLength(0);
    await userEvent.keyboard("{Escape}"); await waitFor(() => expect(body.queryByRole("dialog", { name: "바이탈 이력" })).not.toBeInTheDocument());
  },
};
export const NewMeasurementAndSave: Story = {
  args: { scenario: "record" },
  play: async ({ canvasElement }) => {
    const { content } = await newMeasurement(canvasElement);
    await userEvent.click(content.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(fixture.saved).toHaveLength(1));
    await expect(fixture.saved[0].weightKg).toBe(4.8);
    await expect(fixture.writes).toHaveLength(1);
    await expect(fixture.writes[0].method).toBe("POST");
    await expect(fixture.writes[0].body?.vitals).toMatchObject({ weightKg: 4.8, temperatureC: 38.2 });
    await expect(fixture.records[0].id).toBe(fixture.writes[0].body?.measurementId);
    await expect(content.getByRole("button", { name: "저장" })).toBeDisabled();
    await userEvent.click(content.getByRole("button", { name: "취소" }));
    await waitFor(() => expect(within(canvasElement.ownerDocument.body).queryByRole("dialog", { name: "바이탈 이력" })).not.toBeInTheDocument());
    await expect(within(canvasElement).getByRole("status", { name: "합성 바이탈 저장 결과" })).toHaveTextContent("4.8 kg");
  },
};
export const SaveErrorAndRetry: Story = {
  args: { scenario: "save-error" },
  play: async ({ canvasElement }) => {
    const { content } = await newMeasurement(canvasElement);
    await userEvent.click(content.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(content.getByText("바이탈을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.")).toBeVisible());
    await expect(fixture.records).toHaveLength(0); await expect(content.getByRole("textbox", { name: "체중" })).toHaveValue("4.8");
    fixture.recoverSave(); await userEvent.click(content.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(fixture.records).toHaveLength(1));
    await expect(fixture.writes).toHaveLength(2);
    await expect(fixture.writes[1].body).toEqual(fixture.writes[0].body);
    await waitFor(() => expect(fixture.saved).toHaveLength(1));
    await expect(fixture.saved[0].weightKg).toBe(4.8);
    await expect(content.getByRole("button", { name: "저장" })).toBeDisabled();
    await userEvent.click(content.getByRole("button", { name: "취소" }));
    await waitFor(() => expect(within(canvasElement.ownerDocument.body).queryByRole("dialog", { name: "바이탈 이력" })).not.toBeInTheDocument());
    await expect(within(canvasElement).getByRole("status", { name: "합성 바이탈 저장 결과" })).toHaveTextContent("4.8 kg");
  },
};
export const DirtyCancelConfirmation: Story = {
  args: { scenario: "dirty-cancel" },
  play: async ({ canvasElement }) => {
    const { content, body } = await dialog(canvasElement);
    const weight = content.getByRole("textbox", { name: "체중" });
    await waitFor(() => expect(weight).toHaveValue("4.5"));
    await userEvent.clear(weight); await userEvent.type(weight, "4.8");
    await userEvent.click(content.getByRole("button", { name: "취소" }));
    const confirm = within(await body.findByRole("dialog", { name: "작성 중인 내용을 취소할까요?" }));
    await userEvent.click(confirm.getByRole("button", { name: "돌아가기" }));
    await waitFor(() => expect(body.queryByRole("dialog", { name: "작성 중인 내용을 취소할까요?" })).not.toBeInTheDocument());
    await expect(weight).toHaveValue("4.8");
    await userEvent.keyboard("{Escape}");
    await userEvent.click(within(await body.findByRole("dialog", { name: "작성 중인 내용을 취소할까요?" })).getByRole("button", { name: "취소하기" }));
    await waitFor(() => expect(body.queryByRole("dialog", { name: "바이탈 이력" })).not.toBeInTheDocument());
    await expect(fixture.records[0].weightKg).toBe(4.5); await expect(fixture.writes).toHaveLength(0);
  },
};
export const EmptyReadOnlyHistory: Story = {
  args: { scenario: "empty" },
  play: async ({ canvasElement }) => { const { content } = await dialog(canvasElement); await waitFor(() => expect(content.getByTestId("chart-vital-history-empty")).toBeVisible()); await expect(content.getByRole("button", { name: "바이탈" })).toBeDisabled(); await expect(content.getByRole("button", { name: "저장" })).toBeDisabled(); await expect(fixture.writes).toHaveLength(0); },
};
export const ReadErrorAndRetry: Story = {
  args: { scenario: "read-error" },
  play: async ({ canvasElement }) => { const { content } = await dialog(canvasElement); await waitFor(() => expect(content.getByTestId("chart-vital-history-error")).toBeVisible()); fixture.recoverRead(); await userEvent.click(content.getByRole("button", { name: "다시 시도" })); await waitFor(() => expect(content.getByRole("textbox", { name: "체중" })).toHaveValue("4.5")); await expect(fixture.requests.filter(request => request.method === "GET")).toHaveLength(2); await expect(fixture.writes).toHaveLength(0); },
};
export const ClearHistoricalMeasurementPreservesOrigin: Story = {
  args: { scenario: "historical-edit" },
  play: async ({ canvasElement }) => {
    const { content, body } = await dialog(canvasElement);
    await waitFor(() => expect(content.getByRole("textbox", { name: "체중" })).toHaveValue("4.5"));
    const original = structuredClone(fixture.records[1]);
    const secondDay = content.getByText("26.10.10").closest("button");
    if (!secondDay) throw new Error("The historical day group must be a button");
    await userEvent.click(secondDay);
    const historical = content.getByText("합성 바이탈 작성자 B").closest("button");
    if (!historical) throw new Error("The historical measurement must be selectable");
    historical.focus(); await userEvent.keyboard("{Enter}");
    const weight = content.getByRole("textbox", { name: "체중" });
    await waitFor(() => expect(weight).toHaveValue("4"));
    await userEvent.clear(weight);
    await userEvent.click(content.getByRole("button", { name: "저장" }));
    const confirmation = within(await body.findByRole("dialog", { name: "과거 바이탈 이력을 수정할까요?" }));
    // The portal mounts before its fade-in becomes visible.
    await waitFor(() => expect(confirmation.getByText(/측정 기록은 유지되고 입력값만 비워집니다/)).toBeVisible());
    await expect(fixture.writes).toHaveLength(0);
    await userEvent.click(confirmation.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(fixture.saved).toHaveLength(1));
    await expect(fixture.writes[0]).toMatchObject({ method: "PATCH", body: { encounterId: id(10), measurementId: original.id, expectedUpdatedAt: original.updatedAt } });
    for (const value of Object.values(fixture.writes[0].body!.vitals)) await expect(value).toBeNull();
    const saved = fixture.saved[0];
    await expect(saved).toMatchObject({ id: original.id, encounterId: original.encounterId, patientId: original.patientId, recordedByName: original.recordedByName, measuredAt: original.measuredAt, createdAt: original.createdAt });
    for (const key of Object.keys(fixture.writes[0].body!.vitals) as Array<keyof PatientVitalWriteInput>) await expect(saved[key]).toBeUndefined();
    await expect(weight).toHaveValue("");
    await expect(content.getByRole("button", { name: "저장" })).toBeDisabled();
    await expect(fixture.records).toHaveLength(2);
    await expect(fixture.records[0].weightKg).toBe(4.5);
    await userEvent.click(content.getByRole("button", { name: "취소" }));
    await waitFor(() => expect(body.queryByRole("dialog", { name: "바이탈 이력" })).not.toBeInTheDocument());
    await expect(within(canvasElement).getByRole("status", { name: "합성 바이탈 저장 결과" })).toHaveTextContent("— kg");
  },
};
