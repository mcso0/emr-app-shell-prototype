import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor } from "storybook/test";
import { useCustomerProfileOverview } from "./use-customer-profile-overview";
import { usePatientFulfillmentHistory } from "@/features/fulfillment/patient-history-aside";

type Pending = { url: URL; resolve: (response: Response) => void };
let pending: Pending[] = [];
function Example({ fulfillment = false }: { fulfillment?: boolean }) {
  const [subject, setSubject] = useState("synthetic-a");
  return <><button onClick={() => setSubject("synthetic-b")}>대상 전환</button>{fulfillment ? <Fulfillment subject={subject} /> : <Profile subject={subject} />}</>;
}
function Profile({ subject }: { subject: string }) {
  const state = useCustomerProfileOverview({ enabled: true, workspaceId: "synthetic", subjectType: "patient", subjectId: subject });
  const load = (append = false, months: 6 | 12 = 6) => state.loadSection("history", { months }, { append, force: !append });
  return <><output data-testid="overview">{state.overviewStatus}</output><output data-testid="state">{JSON.stringify(state.sectionStates.history)}</output><button onClick={() => load()}>첫 조회</button><button onClick={() => { load(true); load(true); }}>연속 더 보기</button><button onClick={() => load(false, 12)}>기간 변경</button></>;
}
function Fulfillment({ subject }: { subject: string }) {
  const state = usePatientFulfillmentHistory("synthetic", subject, ["lab"]);
  return <><output data-testid="state">{JSON.stringify(state)}</output><button onClick={state.refresh}>재조회</button></>;
}
const meta = {
  title: "Features/Customer/Profile Read Lifecycle", component: Example,
  parameters: { docs: { description: { component: "실제 조회 훅의 중복 요청, 실패 복구, 늦은 응답, 대상 전환을 합성 응답으로 검증합니다. 원격 조회·저장 없음." } } },
  beforeEach: () => {
    pending = [];
    const original = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
      if (url.pathname.endsWith("/profile-overview")) return Response.json({ ok: true, overview: { subjectId: url.pathname.split("/").at(-2), subjectType: "patient", profile: { id: url.pathname.split("/").at(-2), workspaceId: "synthetic" }, access: { history: { allowed: true }, information: { allowed: true } } } });
      if (url.pathname.endsWith("/staff")) return Response.json({ ok: true, staff: [] });
      if (url.pathname.includes("/profile-overview/history") || url.pathname.endsWith("/work-items")) return new Promise<Response>(resolve => pending.push({ url, resolve }));
      if (url.pathname.startsWith("/api/")) throw new Error(`Unmocked API ${url.pathname}`);
      return original(input, init);
    };
    return () => { pending.forEach(item => item.resolve(Response.json({ ok: false }, { status: 500 }))); globalThis.fetch = original; };
  },
} satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
function respond(index: number, items: unknown[], status = 200) {
  pending[index].resolve(Response.json({ ok: status === 200, items, workItems: items, nextCursor: "next" }, { status }));
}
export const ProfileAppendAndLateResponses: Story = {
  play: async ({ canvas }) => {
    const state = () => JSON.parse(canvas.getByTestId("state").textContent!);
    await waitFor(() => expect(canvas.getByTestId("overview")).toHaveTextContent("ready"));
    await userEvent.click(canvas.getByText("첫 조회"));
    await waitFor(() => expect(pending).toHaveLength(1));
    respond(0, [{ id: "first" }]);
    await waitFor(() => expect(state().items).toEqual([{ id: "first" }]));
    await userEvent.click(canvas.getByText("연속 더 보기"));
    await waitFor(() => expect(pending).toHaveLength(2));
    expect(state()).toMatchObject({ status: "ready", pending: "append", items: [{ id: "first" }] });
    respond(1, [], 500);
    await waitFor(() => expect(state()).toMatchObject({ status: "ready", readError: "append", items: [{ id: "first" }] }));
    await userEvent.click(canvas.getByText("연속 더 보기"));
    await waitFor(() => expect(pending).toHaveLength(3));
    respond(2, [{ id: "second" }]);
    await waitFor(() => expect(state().items).toHaveLength(2));
    await userEvent.click(canvas.getByText("첫 조회"));
    await waitFor(() => expect(pending).toHaveLength(4));
    expect(state()).toMatchObject({ status: "ready", pending: "refresh" });
    await userEvent.click(canvas.getByText("기간 변경"));
    await waitFor(() => expect(pending).toHaveLength(5));
    expect(state()).toMatchObject({ status: "loading", items: [] });
    respond(4, [{ id: "new-filter" }]);
    await waitFor(() => expect(state().items).toEqual([{ id: "new-filter" }]));
    respond(3, [{ id: "obsolete" }]);
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(state().items).toEqual([{ id: "new-filter" }]);
    await userEvent.click(canvas.getByText("첫 조회"));
    await waitFor(() => expect(pending).toHaveLength(6));
    await userEvent.click(canvas.getByText("대상 전환"));
    await waitFor(() => expect(canvas.getByTestId("overview")).toHaveTextContent("ready"));
    expect(state().items).toEqual([]);
    respond(5, [{ id: "previous-patient" }]);
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(state().items).toEqual([]);
    await userEvent.click(canvas.getByText("첫 조회"));
    await waitFor(() => expect(pending).toHaveLength(7));
    respond(6, [], 403);
    await waitFor(() => expect(state()).toMatchObject({ status: "denied", items: [] }));
  },
};
export const FulfillmentRefreshAndScope: Story = {
  args: { fulfillment: true },
  play: async ({ canvas }) => {
    const state = () => JSON.parse(canvas.getByTestId("state").textContent!);
    await waitFor(() => expect(pending).toHaveLength(1));
    respond(0, [{ id: "first" }]);
    await waitFor(() => expect(state().status).toBe("ready"));
    await userEvent.click(canvas.getByText("재조회"));
    await waitFor(() => expect(pending).toHaveLength(2));
    expect(state()).toMatchObject({ status: "ready", refreshing: true, workItems: [{ id: "first" }] });
    respond(1, [], 500);
    await waitFor(() => expect(state()).toMatchObject({ status: "ready", readError: true, workItems: [{ id: "first" }] }));
    await userEvent.click(canvas.getByText("재조회"));
    await waitFor(() => expect(pending).toHaveLength(3));
    await userEvent.click(canvas.getByText("대상 전환"));
    await waitFor(() => expect(pending).toHaveLength(4));
    expect(state()).toMatchObject({ status: "loading", workItems: [] });
    respond(3, [{ id: "new-patient" }]);
    await waitFor(() => expect(state().workItems).toEqual([{ id: "new-patient" }]));
    respond(2, [{ id: "obsolete" }]);
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(state().workItems).toEqual([{ id: "new-patient" }]);
    await userEvent.click(canvas.getByText("재조회"));
    await waitFor(() => expect(pending).toHaveLength(5));
    pending[4].resolve(new Response("Forbidden", { status: 403 }));
    await waitFor(() => expect(state()).toMatchObject({ status: "permission_denied", workItems: [] }));
  },
};
