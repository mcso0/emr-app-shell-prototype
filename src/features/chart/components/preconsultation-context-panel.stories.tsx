import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, waitFor } from "storybook/test";
import { ChartPreconsultationContextPanel } from "../preconsultation-context-panel";
import type { ChartPreconsultationContext } from "../preconsultation-context";
import { createDefaultWorkspaceVitalSettingsSnapshot } from "@/features/patient-vitals/workspace-vital-settings";

type ExampleArgs = { state: "ready" | "loading" | "error" | "denied" | "history"; primaryActionBusy: boolean };
const workspaceId = "storybook-preconsultation";
const encounterId = "synthetic-encounter";
const context: ChartPreconsultationContext = {
  encounter: { id: encounterId, encounterNo: "SYN-001", receptionType: "walk_in", checkedInAt: "2026-10-11T00:00:00Z", status: "waiting", visitPurpose: "합성 방문 목적", chiefComplaint: "합성 접수 내용" },
  queue: { id: "synthetic-queue", status: "waiting" },
  patient: { id: "synthetic-patient", patientNo: "SYN-P001", name: "합성 환자", species: "dog", sex: "unknown" },
  guardian: { id: "synthetic-guardian", name: "합성 보호자" }, priorEncounterCount: 0, vitals: [], history: [],
};
let contextRequests = 0;
function Example({ primaryActionBusy }: ExampleArgs) {
  const [action, setAction] = useState("없음");
  return <div className="flex h-[900px] min-w-0 flex-col"><ChartPreconsultationContextPanel workspaceId={workspaceId} encounterId={encounterId} primaryActionBusy={primaryActionBusy}
    onOpenGuardianProfile={() => setAction("guardian")} onOpenPatientProfile={() => setAction("patient")} onRequestCall={() => setAction("call")} onReturnToQueue={() => setAction("queue")} /><output aria-label="합성 패널 요청">{action}</output></div>;
}
const meta = {
  title: "Features/Chart/Preconsultation Context", component: Example, tags: ["autodocs"], args: { state: "ready", primaryActionBusy: false },
  argTypes: { state: { control: false, description: "실제 패널 prop이 아닌 조회 응답 fixture입니다. 각 named story를 선택해 새로 마운트합니다." }, primaryActionBusy: { control: "boolean" } },
  parameters: { docs: { story: { inline: false, height: "960px" }, description: { component: "진료 전 정보 패널의 조회 상태와 프로필·호출 진입점을 합성 응답으로 확인합니다. 실제 ChartPreconsultationContextPanel은 workspaceId, encounterId, 호출 기능의 콜백과 primaryActionBusy를 받습니다. Example의 state는 응답을 고르는 예제 설정입니다. 마운트 시 context와 vital-settings GET을 가로채며 다른 API 요청은 차단합니다. canWriteVitals는 false로 고정합니다. 바이탈 쓰기 대화상자, 실제 환자 조회, 저장, 호출 전달과 권한 검증은 범위 밖입니다." } } },
  beforeEach: ({ args }) => {
    contextRequests = 0;
    const original = globalThis.fetch;
    const releaseLoading: Array<() => void> = [];
    globalThis.fetch = async (input, init) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, window.location.origin);
      const method = init?.method ?? (input instanceof Request ? input.method : "GET");
      if (url.pathname === `/api/workspaces/${workspaceId}/vital-settings` && method === "GET") return Response.json(createDefaultWorkspaceVitalSettingsSnapshot(false));
      if (url.pathname === `/api/workspaces/${workspaceId}/chart/preconsultation-context` && url.searchParams.get("encounterId") === encounterId && method === "GET") {
        contextRequests += 1;
        if (args.state === "loading") return new Promise<Response>((resolve) => { releaseLoading.push(() => resolve(Response.json({ ok: false, error: "db_read_failed" }, { status: 500 }))); });
        if (args.state === "denied") return Response.json({ ok: false, denialReason: "permission_missing" }, { status: 403 });
        if (args.state === "error") return Response.json({ ok: false, error: "db_read_failed" }, { status: 500 });
        const history = args.state === "history" ? Array.from({ length: 4 }, (_, index) => ({ encounterId: `synthetic-history-${index}`, encounterNo: `SYN-H${index}`, checkedInAt: `2026-10-0${9 - index}T00:00:00Z`, status: "completed", visitPurpose: `합성 이전 방문 ${index + 1}` })) : [];
        return Response.json({ ok: true, status: 200, context: { ...context, history, priorEncounterCount: history.length }, canWriteVitals: false, enforcedBy: "chart-preconsultation-context-read" });
      }
      if (url.pathname.startsWith("/api/")) throw new Error(`Unmocked Storybook API request: ${url.pathname}`);
      return original(input, init);
    };
    return () => { globalThis.fetch = original; releaseLoading.forEach((release) => release()); };
  },
} satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
async function until(condition: () => boolean, message: string) { await waitFor(() => { if (!condition()) throw new Error(message); }); }
function button(root: ParentNode, text: string) { const result = Array.from(root.querySelectorAll<HTMLButtonElement>("button")).find((node) => node.textContent?.trim() === text); if (!result) throw new Error(`패널 버튼이 없습니다: ${text}`); return result; }
export const ReadyAndCallbacks: Story = {
  parameters: { docs: { description: { story: "첫 방문의 빈 이력과 환자·보호자·호출 콜백을 확인합니다. 실제 화면 이동이나 호출 전달은 수행하지 않습니다." } } },
  play: async ({ canvasElement }) => {
    await until(() => canvasElement.textContent?.includes("이전 진료이력이 없어요") === true, "합성 진료 전 정보가 준비되지 않았습니다.");
    for (const [label, action] of [["환자 정보", "patient"], ["보호자 정보", "guardian"], ["호출하기", "call"]]) { await userEvent.click(button(canvasElement, label)); await until(() => canvasElement.querySelector("output")?.textContent === action, `${label} 콜백이 없습니다.`); }
  },
};
export const HistoryExpansion: Story = { args: { state: "history" }, parameters: { docs: { description: { story: "이전 이력 4개 중 처음 3개를 표시한 뒤 전체 펼침과 접기를 확인합니다." } } }, play: async ({ canvasElement }) => { await until(() => canvasElement.textContent?.includes("전체 진료이력 보기") === true, "이력 펼치기가 없습니다."); if (canvasElement.textContent?.includes("합성 이전 방문 4")) throw new Error("접힌 이력에 네 번째 방문이 표시됩니다."); await userEvent.click(button(canvasElement, "전체 진료이력 보기")); await until(() => canvasElement.textContent?.includes("합성 이전 방문 4") === true, "네 번째 이력이 펼쳐지지 않았습니다."); await userEvent.click(button(canvasElement, "진료이력 접기")); await until(() => !canvasElement.textContent?.includes("합성 이전 방문 4"), "이력이 접히지 않았습니다."); } };
export const Loading: Story = { args: { state: "loading" }, parameters: { docs: { description: { story: "합성 응답을 보류해 로딩 상태를 유지합니다. 예제 종료 시 보류 응답을 정리합니다." } } }, play: async ({ canvasElement }) => { await until(() => Boolean(canvasElement.querySelector('[aria-label="환자 정보 불러오는 중"]')), "진료 전 정보 로딩 상태가 없습니다."); } };
export const Denied: Story = { args: { state: "denied" }, parameters: { docs: { description: { story: "합성 권한 거부 응답과 대기 목록 콜백을 확인합니다. 실제 권한 검증은 아닙니다." } } }, play: async ({ canvasElement }) => { await until(() => canvasElement.textContent?.includes("차트 정보를 볼 권한이 없어요") === true, "권한 거부 안내가 없습니다."); if (Array.from(canvasElement.querySelectorAll("button")).some((node) => node.textContent?.includes("다시 시도"))) throw new Error("권한 거부 상태에 재시도가 표시됩니다."); await userEvent.click(button(canvasElement, "대기 목록으로")); await until(() => canvasElement.querySelector("output")?.textContent === "queue", "대기 목록 콜백이 없습니다."); } };
export const ErrorRetry: Story = { args: { state: "error" }, parameters: { docs: { description: { story: "합성 조회 실패 후 다시 시도하면 같은 합성 조회 경로를 다시 호출하는지 확인합니다." } } }, play: async ({ canvasElement }) => { await until(() => canvasElement.textContent?.includes("접수 정보를 불러오지 못했어요") === true, "조회 실패 안내가 없습니다."); const count = contextRequests; await userEvent.click(button(canvasElement, "다시 시도")); await until(() => contextRequests > count && canvasElement.textContent?.includes("접수 정보를 불러오지 못했어요") === true, "다시 시도 조회가 없습니다."); } };
export const CallBusy: Story = { args: { primaryActionBusy: true }, parameters: { docs: { description: { story: "호출 요청 중 두 호출 버튼이 모두 비활성화됩니다." } } }, play: async ({ canvasElement }) => { await until(() => canvasElement.textContent?.includes("환자 정보") === true, "합성 패널이 준비되지 않았습니다."); const controls = Array.from(canvasElement.querySelectorAll<HTMLButtonElement>("button")).filter((node) => node.textContent?.trim() === "호출하기" || node.getAttribute("aria-label") === "호출하기"); if (controls.length !== 2 || controls.some((node) => !node.disabled)) throw new Error("호출 중 비활성 상태가 올바르지 않습니다."); } };
