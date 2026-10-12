import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { useMockAuthStore } from "@/features/auth/session-store";
import type { CustomerArchiveRecord } from "@/features/customer/server-customer-archive";
import { useCustomerStore } from "@/features/customer/store";
import { CustomerArchiveTable } from "./customer-archive-table";

type Scenario = "ready" | "empty" | "loading" | "denied" | "read-error" | "restore-denied";
const workspaceId = "synthetic-customer-archive";
function createFixture(scenario: Scenario) {
  const records: CustomerArchiveRecord[] = scenario === "empty" ? [] : [
    { id: "synthetic-patient", target: "patient", workspaceId, displayName: "합성 동물", status: "soft_deleted", deletedAt: "2026-10-10T00:00:00Z", deletedByUserId: "합성 관리자", auditEvent: null },
    { id: "synthetic-guardian", target: "guardian", workspaceId, displayName: "합성 보호자", status: "soft_deleted", deletedAt: "2026-10-09T00:00:00Z", auditEvent: null },
  ];
  const writes: Array<{ path: string; body: unknown }> = [];
  let reads = 0, activeReads = 0, expectedCount: number | null = null;
  let abortLoading: (() => void) | undefined;
  let unmount: (() => void) | undefined;
  const install = () => {
    const previousFetch = globalThis.fetch, previousAuth = useMockAuthStore.getState(), previousCustomer = useCustomerStore.getState();
    useMockAuthStore.setState({ hydrated: true, session: { id: "synthetic-archive-actor", role: "hospital_admin", roleLabel: "합성 관리자", storageMode: "session", issuedAt: "2026-10-11T00:00:00Z" } });
    useCustomerStore.setState({ query: "", archiveCount: 0, archiveCountLoading: false });
    // Read completion writes archiveCountLoading=false after all global count updates.
    // Restore completion writes the expected count after the awaited response body.
    const unsubscribe = useCustomerStore.subscribe(state => {
      if (!state.archiveCountLoading) activeReads = 0;
      if (expectedCount !== null && state.archiveCount === expectedCount) expectedCount = null;
    });
    const interceptor: typeof fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
      if (url.origin === window.location.origin && !url.pathname.startsWith("/api/")) return previousFetch(input, init);
      const method = init?.method ?? (input instanceof Request ? input.method : "GET");
      const base = `/api/workspaces/${workspaceId}/customer`;
      if (method === "GET" && url.pathname === `${base}/archive` && url.searchParams.get("status") === "soft_deleted") {
        reads++; activeReads++;
        if (scenario === "loading") return new Promise<Response>((_resolve, reject) => {
          const abort = () => { activeReads = 0; abortLoading = undefined; reject(new DOMException("Synthetic archive read aborted", "AbortError")); };
          abortLoading = abort;
          const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
          if (signal?.aborted) abort(); else signal?.addEventListener("abort", abort, { once: true });
        });
        if (scenario === "denied") return Response.json({ ok: false }, { status: 403 });
        if (scenario === "read-error" && reads === 1) return Response.json({ ok: false }, { status: 503 });
        return Response.json({ ok: true, records });
      }
      const record = records.find(item => url.pathname === `${base}/${item.target === "patient" ? "patients" : "guardians"}/${item.id}/archive`);
      if (method === "PATCH" && record) {
        const body: unknown = JSON.parse(String(init?.body));
        if (JSON.stringify(body) !== JSON.stringify({ action: "restore" })) throw new Error("Unexpected synthetic archive mutation");
        writes.push({ path: url.pathname, body });
        if (scenario === "restore-denied") return Response.json({ ok: false }, { status: 403 });
        records.splice(records.indexOf(record), 1);
        expectedCount = records.length;
        return Response.json({ ok: true, record: { ...record, status: "active" }, locks: [] });
      }
      throw new Error("Unexpected synthetic archive endpoint");
    };
    globalThis.fetch = interceptor;
    return async () => {
      try {
        if (scenario === "loading") { unmount?.(); abortLoading?.(); }
        // Keep the old fixture active until real caller continuations finish their shared-store writes.
        await waitFor(() => { expect(activeReads).toBe(0); expect(expectedCount).toBeNull(); });
        unmount?.();
      } finally {
        unsubscribe();
        if (globalThis.fetch === interceptor) globalThis.fetch = previousFetch;
        useMockAuthStore.setState(previousAuth, true);
        useCustomerStore.setState(previousCustomer, true);
      }
    };
  };
  return { writes, install, get reads() { return reads; }, setUnmount: (fn: () => void) => { unmount = fn; } };
}
let fixture: ReturnType<typeof createFixture>;
function Example(args: { scenario: Scenario }) {
  void args;
  const instance = fixture;
  const [mounted, setMounted] = useState(true);
  useEffect(() => { instance.setUnmount(() => flushSync(() => setMounted(false))); }, [instance]);
  return <div className="flex h-[620px] min-w-0 flex-col">{mounted ? <CustomerArchiveTable workspaceId={workspaceId} /> : null}</div>;
}
const meta = {
  title: "Features/Customer/Archive", component: Example, tags: ["autodocs"], args: { scenario: "ready" as Scenario }, argTypes: { scenario: { control: false } },
  parameters: { layout: "fullscreen", docs: { story: { inline: false, height: "660px" }, description: { component: "실제 CustomerArchiveTable의 고정 이름 열·동물/보호자 구분·삭제 정보·검색·복원 동작을 표시합니다. 합성 레코드와 정확한 workspace API 경로의 로컬 응답을 사용합니다. 실제 삭제 항목이나 DB는 변경하지 않습니다. 원본의 상태 반영을 기다린 뒤 화면을 해제하고 인증·고객 스토어와 fetch를 복원합니다. 서버 권한·감사·실제 복원 검증을 대신하지 않습니다." } } },
  beforeEach: ({ args }) => { fixture = createFixture(args.scenario); return fixture.install(); },
} satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
async function ready(canvas: ReturnType<typeof within>) {
  await expect(await canvas.findByRole("button", { name: "합성 동물 복원" })).toBeVisible();
}
export const SearchAndRestore: Story = { play: async ({ canvas }) => {
  await ready(canvas);
  const table = within(canvas.getByRole("table", { name: "삭제된 보호자/동물 고객관리 테이블" }));
  for (const name of ["이름", "구분", "삭제일시", "삭제한 사용자", "작업"]) await expect(table.getByRole("columnheader", { name })).toBeVisible();
  const search = canvas.getByRole("textbox", { name: "고객관리 검색" });
  await userEvent.type(search, "합성 보호자");
  await waitFor(() => expect(canvas.queryByRole("button", { name: "합성 동물 복원" })).not.toBeInTheDocument());
  await expect(canvas.getByRole("button", { name: "합성 보호자 복원" })).toBeVisible();
  await userEvent.clear(search); await userEvent.type(search, "synthetic-no-result");
  await waitFor(() => expect(canvas.getByText("조건에 맞는 삭제 항목이 없습니다")).toBeVisible());
  await userEvent.click(canvas.getByRole("button", { name: "조건 초기화" }));
  const restore = await canvas.findByRole("button", { name: "합성 동물 복원" });
  restore.focus(); await userEvent.keyboard("{Enter}");
  await waitFor(() => expect(canvas.queryByRole("button", { name: "합성 동물 복원" })).not.toBeInTheDocument());
  await expect(canvas.getByRole("button", { name: "합성 보호자 복원" })).toBeVisible();
  await expect(useCustomerStore.getState().archiveCount).toBe(1);
  await expect(fixture.writes).toEqual([{ path: `/api/workspaces/${workspaceId}/customer/patients/synthetic-patient/archive`, body: { action: "restore" } }]);
} };
export const RestoreDenied: Story = { args: { scenario: "restore-denied" }, play: async ({ canvas }) => {
  await ready(canvas); await userEvent.click(canvas.getByRole("button", { name: "합성 보호자 복원" }));
  await waitFor(() => expect(canvas.getByTestId("customer-archive-mutation-alert")).toHaveTextContent("삭제 항목을 복원할 권한이 없습니다."));
  await expect(canvas.getByRole("button", { name: "합성 보호자 복원" })).toBeEnabled();
  await expect(useCustomerStore.getState().archiveCount).toBe(2);
  await expect(fixture.writes).toHaveLength(1);
} };
export const ReadErrorAndRetry: Story = { args: { scenario: "read-error" }, play: async ({ canvas }) => {
  await waitFor(() => expect(canvas.getByText("삭제 이력을 불러오지 못했습니다")).toBeVisible());
  await userEvent.click(canvas.getByRole("button", { name: "다시 시도" }));
  await ready(canvas); await expect(fixture.reads).toBe(2); await expect(fixture.writes).toHaveLength(0);
} };
export const ReadDenied: Story = { args: { scenario: "denied" }, play: async ({ canvas }) => {
  await waitFor(() => expect(canvas.getByText("삭제 이력을 볼 권한이 없습니다")).toBeVisible());
  await expect(canvas.queryByRole("button", { name: /복원/ })).not.toBeInTheDocument();
  await expect(fixture.writes).toHaveLength(0);
} };
export const Empty: Story = { args: { scenario: "empty" }, play: async ({ canvas }) => {
  await waitFor(() => expect(canvas.getByText("삭제된 보호자/동물이 없습니다")).toBeVisible());
  await expect(useCustomerStore.getState().archiveCount).toBe(0);
} };
export const Loading: Story = { args: { scenario: "loading" }, play: async ({ canvas }) => {
  await expect(canvas.getByTestId("customer-page-header-count-skeleton")).toBeVisible();
  await expect(canvas.getByRole("table", { name: "삭제된 보호자/동물 고객관리 테이블" })).toBeVisible();
  await expect(canvas.queryByRole("button", { name: /복원/ })).not.toBeInTheDocument();
} };
