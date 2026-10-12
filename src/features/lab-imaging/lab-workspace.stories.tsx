import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Button } from "@/components/ui/button";
import { useMockAuthStore } from "@/features/auth/session-store";
import { getModule } from "@/modules/registry";
import { WorkspaceDocumentLayout } from "@/shell/workspace-document-layout";
import { useLayoutStore } from "@/stores/layout-store";
import { LabContent, LabSidePanel, LabSlotAvailabilityProvider } from "./module";
import { useLabImagingStore } from "./store";
import { createLabWorkspaceFixture, type LabWorkspaceScenario } from "./lab-workspace.stories.fixture";

let fixture: ReturnType<typeof createLabWorkspaceFixture>;
type Args = { scenario: LabWorkspaceScenario; view: "workspace" | "content" | "queue" };
type Canvas = ReturnType<typeof within>;
async function waitForCanonical(root: HTMLElement, instance: typeof fixture) {
  await waitFor(() => {
    const finding = root.querySelector<HTMLTextAreaElement>("textarea[aria-label='검사결과 종합소견']");
    expect(finding).toBeInTheDocument();
    expect(finding).toHaveAttribute("id", `lab-overall-finding-${instance.result.id}`);
    expect(finding).toHaveAttribute("placeholder", "전체 검사 결과에 대한 종합소견을 입력하세요. 자동으로 저장됩니다.");
    expect(root.querySelector(`[data-testid='lab-result-row-${instance.result.rows[0].id}']`)).toBeInTheDocument();
  }, { timeout: 5000 });
}
function ActualDocument({ instance }: { instance: typeof fixture }) {
  const props = { workspaceId: instance.result.workspaceId, moduleId: "lab", moduleLabel: "검사", onNavigateWorkspaceSurface: (href: string) => {
    instance.copied.push(`route:${href}`);
    const resultId = new URL(href, window.location.origin).searchParams.get("labResultId");
    if (resultId) useLabImagingStore.getState().selectLabResult(resultId);
  } };
  return <LabSlotAvailabilityProvider {...props}>{availability => <WorkspaceDocumentLayout moduleDefinition={getModule("lab")} slotProps={{ ...props, ...availability }} />}</LabSlotAvailabilityProvider>;
}
async function settleAutosave(root: HTMLElement) {
  const status = (id: string) => root.querySelector(`[data-testid='${id}']`)?.textContent ?? "";
  if (["lab-result-save-status", "lab-overall-save-status"].some(id => status(id).includes("저장 대기 중"))) {
    const input = root.querySelector<HTMLTextAreaElement>("textarea[aria-label='검사결과 종합소견']");
    if (input) await userEvent.click(input);
    await userEvent.click(within(root).getByRole("button", { name: "합성 입력 완료" }));
  }
  for (const id of ["lab-result-save-status", "lab-overall-save-status"]) {
    await waitFor(() => { if (status(id).includes("저장 중")) throw new Error("Actual lab autosave still in progress"); }, { timeout: 5000 });
    const element = root.querySelector(`[data-testid='${id}']`);
    const retry = id === "lab-result-save-status" ? root.querySelector<HTMLButtonElement>("[data-testid='lab-result-save-retry-button']") : element?.parentElement?.querySelector<HTMLButtonElement>("button");
    if (retry) { await userEvent.click(retry); await waitFor(() => expect(status(id)).toBe("저장됨"), { timeout: 5000 }); }
    if (status(id) && status(id) !== "저장됨") throw new Error(`Actual lab queue must settle before restoration: ${id} ${status(id)}`);
  }
}
function ReopenedContent({ instance }: { instance: typeof fixture }) {
  return <div className="h-[850px] w-[1400px]"><Button>합성 입력 완료</Button><LabContent workspaceId={instance.result.workspaceId} moduleId="lab" moduleLabel="검사" /></div>;
}
async function settleDetached(instance: typeof fixture) {
  const host = document.createElement("div");
  host.dataset.testid = "lab-workspace-autosave-teardown";
  Object.assign(host.style, { position: "fixed", top: "8px", left: "8px", zIndex: "2147483647", background: "var(--emr-surface-panel)" });
  document.body.append(host);
  const root = createRoot(host);
  try {
    flushSync(() => root.render(<SearchParamsContext.Provider value={new URLSearchParams("date=2026-10-11")}><ReopenedContent instance={instance} /></SearchParamsContext.Provider>));
    await waitForCanonical(host, instance);
    await settleAutosave(host);
  } finally { flushSync(() => root.unmount()); host.remove(); }
}
function Example(args: Args) {
  const instance = fixture;
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(true);
  useEffect(() => {
    instance.setTeardown(async () => {
      instance.recoverQueue(); instance.recoverEntries();
      if (args.view === "queue" || ["empty", "queue-error", "queue-denied"].includes(args.scenario)) {
        if (ref.current) flushSync(() => setMounted(false));
        return;
      }
      useLabImagingStore.getState().selectLabResult(instance.selectedLabResultId);
      if (!ref.current || !ref.current.getClientRects().length) {
        if (ref.current) flushSync(() => setMounted(false));
        await settleDetached(instance);
        return;
      }
      const catalogRetry = ref.current.querySelector<HTMLButtonElement>("[data-testid='lab-result-catalog-retry-button']");
      if (catalogRetry) await userEvent.click(catalogRetry);
      await waitForCanonical(ref.current, instance);
      await settleAutosave(ref.current);
      flushSync(() => setMounted(false));
    });
  }, [args.scenario, args.view, instance]);
  const props = { workspaceId: instance.result.workspaceId, moduleId: "lab", moduleLabel: "검사" };
  return <div ref={ref} className="flex h-[920px] w-[1580px] max-w-full flex-col gap-2">
    {mounted ? <>
      <div className="flex items-center gap-2"><Button variant="outline">합성 입력 완료</Button><span className="text-xs text-muted-foreground">합성 기능 확인 값 · 임상 사용 금지</span></div>
      <div className="flex min-h-0 flex-1">
        {args.view !== "content" ? <aside className="h-full w-[300px] shrink-0 border-r"><LabSidePanel {...props} onNavigateWorkspaceSurface={href => { instance.copied.push(`route:${href}`); const resultId = new URL(href, window.location.origin).searchParams.get("labResultId"); if (resultId) useLabImagingStore.getState().selectLabResult(resultId); }} /></aside> : null}
        {args.view !== "queue" ? <main className="min-w-0 flex-1">{args.view === "workspace" ? <ActualDocument instance={instance} /> : <LabContent {...props} hasContentAside={false} hasRightPanel={false} />}</main> : null}
      </div>
    </> : null}
  </div>;
}
const meta = {
  title: "Features/Lab/Actual Workspace", component: Example, tags: ["autodocs"], args: { scenario: "ready" as Args["scenario"], view: "workspace" as Args["view"] }, argTypes: { scenario: { control: false }, view: { control: false } },
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: "/w/storybook-lab/lab", query: { date: "2026-10-11" } } }, layout: "fullscreen", docs: { story: { inline: false, height: "980px" }, description: { component: "실제 LabSidePanel, LabSlotAvailabilityProvider와 WorkspaceDocumentLayout을 연결해 LabContent 안의 결과 표, 종합소견, 이력, 수신함을 렌더합니다. 결과지는 실제 parser를 통과하는 합성 v2 프로필입니다. 큐·결과 항목·행 자동 저장·phase2·첨부 API를 정확한 경로에서 로컬로 가로챕니다. 결과값·소견·메타데이터는 합성 응답에 반영합니다. 기존 표 밀도 비교 예제는 그대로 유지합니다. 이동과 복사는 요청 URL을 기록하며 실제 앱 이동, 권한 검증, 검사·마스터·스토리지 저장은 하지 않습니다. 실제 수신함에 연결된 장비자료가 없는 상태입니다. 환자 컨텍스트 헤더와 전체 AppShell은 별도 범위입니다." } } },
  beforeEach: ({ args }) => {
    fixture = createLabWorkspaceFixture(args.scenario);
    const previousUrl = window.location.href;
    const previousAuth = useMockAuthStore.getState(); const previousLab = useLabImagingStore.getState(); const previousLayout = useLayoutStore.getState();
    const clipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    window.history.replaceState(window.history.state, "", `/w/${fixture.result.workspaceId}/lab?date=2026-10-11`);
    useMockAuthStore.setState({ hydrated: true, session: { id: "synthetic-lab-user", role: "nurse", roleLabel: "합성 간호사", storageMode: "session", issuedAt: "2026-10-11T00:00:00Z" }, hydrate: () => {} });
    useLabImagingStore.setState({ selectedLabResultId: args.scenario === "empty" ? "" : fixture.selectedLabResultId });
    useLayoutStore.setState({ contentAsideOpen: false, rightPanelOpen: false, modulePanelOpen: true, activeDrawer: null });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (text: string) => { fixture.copied.push(text); } } });
    const restore = fixture.install();
    return async () => { await restore(); useMockAuthStore.setState(previousAuth, true); useLabImagingStore.setState(previousLab, true); useLayoutStore.setState(previousLayout, true); if (clipboard) Object.defineProperty(navigator, "clipboard", clipboard); else Reflect.deleteProperty(navigator, "clipboard"); window.history.replaceState(window.history.state, "", previousUrl); };
  },
} satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
async function ready(canvas: Canvas) {
  await waitFor(() => expect(canvas.getByRole("textbox", { name: "검사결과 종합소견" })).toHaveValue("합성 종합소견"), { timeout: 5000 });
  await expect(canvas.getByRole("textbox", { name: "합성 수치 결과값" })).toHaveValue("2");
}
async function setNumeric(canvas: Canvas, value: string) {
  await ready(canvas); const input = canvas.getByRole("textbox", { name: "합성 수치 결과값" });
  await userEvent.click(input); await userEvent.clear(input); await userEvent.type(input, value); await userEvent.click(canvas.getByRole("button", { name: "합성 입력 완료" }));
}
export const ResultRowsAndDensity: Story = { play: async ({ canvas, canvasElement }) => {
  await ready(canvas); const table = canvas.getByRole("table", { name: "임상병리 검사 결과 입력" });
  for (const label of ["항목", "결과값", "측정 불가", "단위", "정상범위", "판정", "담당자"]) await expect(within(table).getByRole("columnheader", { name: label })).toBeVisible();
  const row = () => canvas.getByTestId(`lab-result-row-${fixture.result.rows[0].id}`);
  const standard = row().getBoundingClientRect().height;
  const density = canvas.getByRole("button", { name: "테이블 보기 밀도: 기본 간격" });
  await expect(Math.abs(density.getBoundingClientRect().width - 82)).toBeLessThan(1); await expect(Math.abs(density.getBoundingClientRect().height - 28)).toBeLessThan(1);
  await userEvent.click(density); const body = within(canvasElement.ownerDocument.body);
  await userEvent.click(await body.findByRole("menuitemradio", { name: "좁은 간격" }));
  await waitFor(() => expect(row().getBoundingClientRect().height).toBeLessThan(standard));
  await userEvent.click(canvas.getByRole("button", { name: "합성 수치 검사 소견 펼치기" }));
  await expect(canvas.getByRole("textbox", { name: "검사 소견" })).toHaveValue("합성 항목 소견");
  await userEvent.clear(canvas.getByRole("textbox", { name: "검사 소견" })); await userEvent.type(canvas.getByRole("textbox", { name: "검사 소견" }), "합성 행 소견 저장"); await userEvent.click(canvas.getByRole("button", { name: "합성 입력 완료" }));
  await waitFor(() => expect(canvas.getByTestId("lab-result-save-status")).toHaveTextContent("저장됨")); await expect(fixture.result.rows[0].note).toBe("합성 행 소견 저장");
  await userEvent.click(canvas.getByRole("button", { name: "합성 수치 검사 소견 접기" })); await expect(canvas.queryByRole("textbox", { name: "검사 소견" })).not.toBeInTheDocument();
} };
export const RowValueAutosave: Story = { play: async ({ canvas }) => {
  await setNumeric(canvas, "8"); await waitFor(() => expect(canvas.getByTestId("lab-result-save-status")).toHaveTextContent("저장됨"));
  await expect(fixture.writes[0]).toMatchObject({ expectedEntryWriteRevision: 3 });
  await expect((fixture.writes[0].rows as Array<Record<string, unknown>>)[0]).toMatchObject({ value: "8", qualifier: "exact", resultState: "value" });
  await expect(fixture.result.entryWriteRevision).toBe(4); await expect(fixture.result.rows[0]).toMatchObject({ value: "8", judgment: "high" });
  await expect(canvas.getByLabelText("합성 수치 정상범위 1 - 5 결과 8 초과")).toBeVisible();
} };
export const RowSaveFailureAndRetry: Story = { args: { scenario: "row-save-error" }, play: async ({ canvas }) => {
  await setNumeric(canvas, "4"); await waitFor(() => expect(canvas.getByTestId("lab-result-save-status")).toHaveTextContent("저장하지 못했습니다"));
  await expect(canvas.getByRole("textbox", { name: "합성 수치 결과값" })).toHaveValue("4");
  await userEvent.click(canvas.getByTestId("lab-result-save-retry-button")); await waitFor(() => expect(canvas.getByTestId("lab-result-save-status")).toHaveTextContent("저장됨"));
  await expect(fixture.writes).toHaveLength(2); await expect(fixture.writes[1]).toEqual(fixture.writes[0]);
} };
export const MeasurementUnavailable: Story = { play: async ({ canvas }) => {
  await ready(canvas); await userEvent.click(canvas.getByRole("checkbox", { name: "합성 수치 측정 불가" }));
  await expect(canvas.getByRole("textbox", { name: "합성 수치 결과값" })).toBeDisabled(); await expect(canvas.getByRole("textbox", { name: "합성 수치 결과값" })).toHaveValue("");
  await waitFor(() => expect(fixture.result.rows[0].resultPresence).toBe("instrument_no_result"));
  await userEvent.click(canvas.getByRole("checkbox", { name: "합성 수치 측정 불가" })); await expect(canvas.getByRole("textbox", { name: "합성 수치 결과값" })).toHaveValue("2");
  await userEvent.click(canvas.getByRole("button", { name: "합성 입력 완료" })); await waitFor(() => expect(fixture.result.rows[0]).toMatchObject({ value: "2", resultPresence: "value" }));
} };
export const ReadOnly: Story = { args: { scenario: "readonly" }, play: async ({ canvas }) => {
  await ready(canvas); for (const name of ["합성 수치 결과값", "합성 관찰 결과값", "검사결과 종합소견"]) await expect(canvas.getByRole("textbox", { name })).toBeDisabled();
  await expect(canvas.getByRole("combobox", { name: "합성 선택 결과값" })).toBeDisabled();
  const unavailable = canvas.getByRole("checkbox", { name: "합성 수치 측정 불가" });
  await expect(unavailable).toHaveAttribute("aria-disabled", "true"); await expect(unavailable).toHaveAttribute("tabindex", "-1");
  await userEvent.click(unavailable); await expect(unavailable).toHaveAttribute("aria-checked", "false"); await expect(fixture.writes).toHaveLength(0);
} };
export const AtomicRetestReadOnly: Story = { play: async ({ canvas, canvasElement }) => {
  await ready(canvas);
  const trigger = canvas.getByRole("button", { name: "합성 수치만 재검 요청" });
  await userEvent.click(trigger);
  const body = within(canvasElement.ownerDocument.body);
  const dialog = within(await body.findByRole("dialog", { name: "합성 수치 재검 요청" }));
  await waitFor(() => expect(dialog.getByRole("status")).toHaveTextContent("조회 전용 · 재검 요청 권한 없음"));
  await userEvent.type(dialog.getByRole("textbox", { name: "재검 사유" }), "합성 재검 사유");
  await userEvent.selectOptions(dialog.getByRole("combobox", { name: "재검 검체 결정" }), "reuse_specimen");
  await userEvent.type(dialog.getByRole("textbox", { name: "재검 검체 참조" }), "SYN-SPECIMEN-1");
  await userEvent.selectOptions(dialog.getByRole("combobox", { name: "재검 청구 정책" }), "no_charge");
  const create = dialog.getByRole("button", { name: "재검 오더 초안 만들기" });
  await expect(create).toBeDisabled();
  dialog.getByRole("combobox", { name: "재검 프로필" }).focus();
  await userEvent.keyboard("{Tab}"); await expect(create).not.toHaveFocus();
  await expect(fixture.commands.filter(command => command.path.endsWith("/retests"))).toHaveLength(0);
  await expect(fixture.writes).toHaveLength(0);
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(body.queryByRole("dialog", { name: "합성 수치 재검 요청" })).not.toBeInTheDocument());
  await expect(trigger).toHaveFocus();
  await expect(canvas.getByRole("textbox", { name: "합성 수치 결과값" })).toHaveValue("2");
} };
export const ResultReadErrorAndRetry: Story = { args: { scenario: "entries-error", view: "content" }, play: async ({ canvas }) => { await waitFor(() => expect(canvas.getByTestId("lab-result-catalog-status")).toHaveTextContent("결과지 항목을 불러오지 못했습니다")); const reads = fixture.entryReads; fixture.recoverEntries(); await userEvent.click(canvas.getByTestId("lab-result-catalog-retry-button")); await ready(canvas); await expect(fixture.entryReads).toBeGreaterThan(reads); } };
export const QueueSearchAndPatientGroups: Story = { args: { view: "queue" }, play: async ({ canvas }) => {
  await expect(await canvas.findByText("합성 환자 A")).toBeVisible(); await expect(canvas.getByText("합성 환자 B")).toBeVisible();
  await userEvent.click(canvas.getByRole("button", { name: "검색" })); await userEvent.type(canvas.getByRole("searchbox", { name: "검사 대기열 검색" }), "합성 환자 B");
  await waitFor(() => expect(canvas.queryByText("합성 환자 A")).not.toBeInTheDocument()); await expect(canvas.getByText("합성 환자 B")).toBeVisible();
  await userEvent.clear(canvas.getByRole("searchbox", { name: "검사 대기열 검색" })); await userEvent.type(canvas.getByRole("searchbox", { name: "검사 대기열 검색" }), "synthetic-no-match");
  await waitFor(() => expect(canvas.getByText(/검색 결과가 없습니다/)).toBeVisible()); await userEvent.clear(canvas.getByRole("searchbox", { name: "검사 대기열 검색" }));
  await userEvent.click(canvas.getByRole("button", { name: "검사 대기열 검색 닫기" }));
  await userEvent.click(canvas.getByRole("button", { name: "환자별 보기" }));
  const group = await canvas.findByRole("button", { name: "합성 환자 A · 합성 보호자 A 접기" });
  await expect(group).toHaveAttribute("aria-expanded", "true"); group.focus(); await userEvent.keyboard(" ");
  await waitFor(() => expect(canvas.getByRole("button", { name: "합성 환자 A · 합성 보호자 A 펼치기" })).toHaveAttribute("aria-expanded", "false"));
  await userEvent.click(canvas.getByRole("button", { name: "합성 환자 A · 합성 보호자 A 펼치기" }));
  await waitFor(() => expect(canvas.getByTestId(`lab-queue-item-live-lab-${fixture.workItems[0].id}`)).toBeVisible());
} };
export const QueueSelectionAndPendingResult: Story = { play: async ({ canvas, canvasElement }) => {
  await ready(canvas);
  const phaseReads = fixture.commands.filter(command => command.method === "GET" && command.path.endsWith("result-phase2")).length;
  const pending = fixture.workItems[1];
  const pendingCard = canvas.getByTestId(`lab-queue-card-live-lab-${pending.id}`);
  await userEvent.click(pendingCard);
  await waitFor(() => expect(canvas.getByTestId("lab-result-catalog-status")).toHaveTextContent("연결된 결과지 항목이 없습니다."));
  await expect(canvas.getByRole("textbox", { name: "검사결과 종합소견" })).toBeDisabled();
  await expect(canvas.queryByRole("textbox", { name: "합성 수치 결과값" })).not.toBeInTheDocument();
  await expect(fixture.commands.filter(command => command.method === "GET" && command.path.endsWith("result-phase2"))).toHaveLength(phaseReads);
  const originalCard = canvas.getByTestId(`lab-queue-card-live-lab-${fixture.workItems[0].id}`);
  originalCard.focus(); await userEvent.keyboard("{Enter}"); await waitForCanonical(canvasElement, fixture); await ready(canvas);
} };
export const QueueReadErrorAndRetry: Story = { args: { scenario: "queue-error", view: "content" }, play: async ({ canvas }) => { await waitFor(() => expect(canvas.getByText("검사 업무를 불러오지 못했습니다")).toBeVisible()); const reads = fixture.queueReads; fixture.recoverQueue(); await userEvent.click(canvas.getByRole("button", { name: "재시도" })); await ready(canvas); await expect(fixture.queueReads).toBeGreaterThan(reads); } };
export const QueuePermissionDenied: Story = { args: { scenario: "queue-denied", view: "content" }, play: async ({ canvas }) => { await waitFor(() => expect(canvas.getByText("검사 업무를 볼 권한이 없습니다")).toBeVisible()); await expect(canvas.queryByRole("button", { name: "재시도" })).not.toBeInTheDocument(); } };
export const EmptyQueue: Story = { args: { scenario: "empty", view: "content" }, play: async ({ canvas }) => { await waitFor(() => expect(canvas.getByText("검사 업무가 없습니다")).toBeVisible()); const reads = fixture.queueReads; await userEvent.click(canvas.getByRole("button", { name: "새로고침" })); await waitFor(() => expect(fixture.queueReads).toBeGreaterThan(reads)); } };
