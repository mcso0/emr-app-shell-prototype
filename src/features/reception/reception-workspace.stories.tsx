import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { useMockAuthStore } from "@/features/auth/session-store";
import { createInitialHospitalBasicSettingsDraft, resolveEffectiveOperatingHours } from "@/features/hospital-admin/settings/hospital-basic-settings-model";
import { mockStaffUsers } from "@/mocks/emr-domain";
import { useLayoutStore } from "@/stores/layout-store";
import type { Appointment, Guardian, Patient, PatientGuardian } from "@/types/emr-domain";
import type { ReceptionCalendarReadRecord, ReceptionCalendarReadResponse } from "./reception-calendar-read";
import type { ReceptionQueueReadRecord, ReceptionQueueReadResponse } from "./reception-queue-read";
import { ReceptionContent, ReceptionSidePanel } from "./module";
import { usePatientProfileStore } from "./patient-profile-store";
import { useReceptionStore } from "./store";

type Scenario = "live" | "empty" | "read-error" | "denied" | "queue-selection";
const workspaceId = "storybook-reception-workspace";
const operatingDate = "2026-10-06";
const id = (index: number) => "99500000-0000-4000-8000-" + String(index).padStart(12, "0");
const createdAt = operatingDate + "T00:00:00Z";
function createFixture(scenario: Scenario) {
  const veterinarian = mockStaffUsers.find(user => user.role === "veterinarian");
  if (!veterinarian) throw new Error("Actual local reception branch requires an existing synthetic veterinarian");
  const patient: Patient = { id: id(1), workspaceId, patientNo: "SYN-R-P01", name: "합성 캘린더 환자", species: "cat", sex: "unknown", handlingCautionLocked: false, status: "active", createdAt, updatedAt: createdAt };
  const guardian: Guardian = { id: id(2), workspaceId, name: "합성 캘린더 보호자", mobilePhone: "01000000000", createdAt, updatedAt: createdAt };
  const link: PatientGuardian = { id: id(3), patientId: patient.id, guardianId: guardian.id, isPrimary: true, canReceiveMessages: false, createdAt };
  const appointment: Appointment = { id: id(4), workspaceId, patientId: patient.id, guardianId: guardian.id, assignedVeterinarianId: veterinarian.id, assignedStaffUserIds: [veterinarian.id], scheduledStartAt: operatingDate + "T10:00:00+09:00", scheduledEndAt: operatingDate + "T11:00:00+09:00", visitPurpose: "합성 예약 진료", symptomNote: "합성 예약 메모", status: "confirmed", createdAt, updatedAt: createdAt };
  const calendarRecords: ReceptionCalendarReadRecord[] = [{ appointment, patient, primaryGuardian: guardian }];
  const queueRecords: ReceptionQueueReadRecord[] = [{ kind: "appointment", appointment, patient, primaryGuardian: guardian }];
  const requests: Array<{ path: string; date: string; method: string }> = [], unhandled: string[] = [];
  let healthy = scenario !== "read-error", pending = 0, activeReads = 0, unmount: (() => void) | undefined;
  const install = () => {
    const previousFetch = globalThis.fetch, previousAuth = useMockAuthStore.getState(), previousReception = useReceptionStore.getState(), previousProfile = usePatientProfileStore.getState(), previousLayout = useLayoutStore.getState();
    useMockAuthStore.setState({ hydrated: true, session: { id: "synthetic-reception-desk", role: "front_desk", roleLabel: "합성 접수", storageMode: "session", issuedAt: createdAt }, hydrate: () => {} });
    usePatientProfileStore.setState({ patients: [patient], guardians: [guardian], patientGuardians: [link], consents: [] });
    useLayoutStore.setState({ activeDrawer: null, retainedReceptionDrawer: null, rightPanelOpen: false, modulePanelOpen: true });
    const initial = useReceptionStore.getInitialState();
    useReceptionStore.setState({ ...initial, draftCheckIns: [], persistedCalendarAppointments: [], calendarViewByWorkspace: { [workspaceId]: "day" }, operatingDateByWorkspace: { [workspaceId]: operatingDate }, selectedPatientId: patient.id, selectedAppointmentId: undefined, selectedEncounterId: undefined, calendarDraftSelection: undefined, searchQuery: "", calendarReadStatus: "idle", queueReadStatus: "idle", calendarReadError: undefined, queueReadError: undefined, queueSummary: undefined, readRetryNonce: 0, messageDeliveries: [] }, true);
    const originalQueueApply = useReceptionStore.getState().applyPersistedReceptionQueue, originalQueueStatus = useReceptionStore.getState().setReceptionQueueReadStatus;
    useReceptionStore.setState({
      applyPersistedReceptionQueue: (...args) => { originalQueueApply(...args); if (activeReads) activeReads--; },
      setReceptionQueueReadStatus: (...args) => { originalQueueStatus(...args); if (args[0] === "error" && activeReads) activeReads--; },
    });
    if (scenario === "queue-selection") {
      useReceptionStore.getState().applyPersistedReceptionCalendar(calendarRecords);
      useReceptionStore.getState().applyPersistedReceptionQueue(queueRecords, { workspaceId, date: operatingDate, appointmentCount: 1, receptionCount: 0, totalCount: 1 });
    }
    const intercept: typeof fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
      if (!url.pathname.startsWith("/api/")) return previousFetch(input, init);
      const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
      const path = url.pathname.replace("/api/workspaces/" + workspaceId, ""), date = url.searchParams.get("date") ?? "";
      if (!url.pathname.startsWith("/api/workspaces/" + workspaceId + "/") || method !== "GET" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || (path !== "/reception/calendar/day" && path !== "/reception/queue")) { unhandled.push(method + " " + url.pathname); throw new Error("Unexpected synthetic reception read"); }
      pending++;
      if (path === "/reception/queue") activeReads++;
      try {
        requests.push({ path, date, method });
        let result: ReceptionCalendarReadResponse | ReceptionQueueReadResponse;
        if (scenario === "denied") result = { ok: false, status: 403, denialReason: "permission_missing" };
        else if (!healthy) result = { ok: false, status: 500, error: "db_read_failed" };
        else {
          const records = scenario === "empty" || date !== operatingDate ? [] : calendarRecords;
          const queue = scenario === "empty" || date !== operatingDate ? [] : queueRecords;
          result = path === "/reception/calendar/day"
            ? { ok: true, status: 200, enforcedBy: "reception-calendar-read", workspaceId, date, records, operatingSchedule: resolveEffectiveOperatingHours(createInitialHospitalBasicSettingsDraft(), date) }
            : { ok: true, status: 200, enforcedBy: "reception-queue-read", queue, summary: { workspaceId, date, appointmentCount: queue.length, receptionCount: 0, totalCount: queue.length } };
        }
        const response = Response.json(result, { status: result.status ?? 500 }), json = response.json.bind(response);
        response.json = async () => { pending++; try { return await json(); } finally { pending--; } };
        return response;
      } finally { pending--; }
    };
    globalThis.fetch = intercept;
    return async () => {
      try { unmount?.(); await waitFor(() => { if (pending || activeReads) throw new Error("Original reception read workflow is still settling"); }); }
      finally { if (globalThis.fetch === intercept) globalThis.fetch = previousFetch; useMockAuthStore.setState(previousAuth, true); useReceptionStore.setState(previousReception, true); usePatientProfileStore.setState(previousProfile, true); useLayoutStore.setState(previousLayout, true); }
    };
  };
  return { appointment, patient, requests, unhandled, install, recover: () => { healthy = true; }, setUnmount: (fn: () => void) => { unmount = fn; } };
}
let fixture: ReturnType<typeof createFixture>;
function Example({ scenario }: { scenario: Scenario }) {
  const instance = fixture, [mounted, setMounted] = useState(true), drawer = useLayoutStore(state => state.activeDrawer);
  useEffect(() => { instance.setUnmount(() => flushSync(() => setMounted(false))); }, [instance]);
  return <div className="grid h-[980px] min-w-[1180px] grid-cols-[320px_minmax(0,1fr)] bg-[var(--emr-surface-workspace)]">{mounted ? <><aside aria-label="실제 접수 예약 목록" className="min-h-0 border-r"><ReceptionSidePanel workspaceId={workspaceId} moduleId="reception" moduleLabel="접수/예약" /></aside><main aria-label="실제 접수 캘린더" className="min-h-0 min-w-0">{scenario === "queue-selection" ? <output aria-label="합성 접수 선택 결과">{drawer?.type ?? "미선택"} · {drawer && "id" in drawer ? drawer.id : ""}</output> : <ReceptionContent />}</main></> : null}</div>;
}
const meta = {
  title: "Features/Reception/Actual Workspace", component: Example, tags: ["autodocs"], args: { scenario: "live" as Scenario }, argTypes: { scenario: { control: false } },
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: "/w/" + workspaceId + "/reception", segments: [["workspaceId", workspaceId]], query: { date: operatingDate } } }, docs: { story: { inline: false, height: "1020px" }, description: { component: "실제 ReceptionContent/ReceptionSidePanel을 렌더링합니다. 준비된 빈 병원이 아닌 고유 합성 workspace의 실제 local staff 분기를 쓰며, 합성 예약·환자·보호자를 exact calendar/day와 queue GET 응답으로 제공합니다. 영업시간은 원본 설정 factory/해석 함수를 사용합니다. 실제 일·주·월 보기 전환, 빈 캘린더/목록, 조회 오류 복구, 권한 오류 표시를 확인합니다. 목록 선택 예제는 실제 SidePanel과 원본 선택·drawer callback까지 표시하며 상세 예약/접수 폼은 별도 경계입니다. DB 저장, 접수 생성/취소, 메시지 발송, staff live 조회·서버 권한 검증은 포함하지 않습니다. 종료 시 실제 화면을 unmount하고 원본 read coordinator의 queue 적용/오류 종료까지 기다린 뒤 fetch/auth/reception/profile/layout을 복원합니다." } } },
  beforeEach: ({ args }) => { fixture = createFixture(args.scenario); return fixture.install(); }, render: args => <Example {...args} />,
} satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
async function ready(canvasElement: HTMLElement) {
  const canvas = within(canvasElement), main = within(canvas.getByRole("main", { name: "실제 접수 캘린더" })), aside = within(canvas.getByRole("complementary", { name: "실제 접수 예약 목록" }));
  await waitFor(() => expect(useReceptionStore.getState().calendarReadStatus).toBe("ready"));
  await waitFor(() => expect(useReceptionStore.getState().queueReadStatus).toBe("ready"));
  await expect(fixture.unhandled).toHaveLength(0);
  return { canvas, main, aside };
}
export const DayWeekMonthActualCalendar: Story = {
  parameters: { docs: { description: { story: "실제 접수/예약 생성 버튼은 더하기 아이콘만 18px이며 펼침 화살표는 16px, 아이콘·라벨 간격은 4px을 유지합니다. 원본 SVG 여백은 유지합니다." } } },
  play: async ({ canvasElement }) => {
    const { main, aside } = await ready(canvasElement);
    await expect(main.getByTestId("reception-day-calendar")).toBeVisible();
    await expect(main.getByTestId("appointment-purpose-" + fixture.appointment.id)).toHaveTextContent("합성 캘린더 환자 · 합성 캘린더 보호자");
    await expect(main.getByTestId("appointment-card-" + fixture.appointment.id + "-description")).toHaveTextContent("합성 예약 진료");
    await expect(aside.getByTestId("appointment-queue-card-" + fixture.appointment.id)).toBeVisible();
    const modes = within(main.getByRole("group", { name: "접수 캘린더 보기" }));
    const week = modes.getByRole("button", { name: "주" });
    week.focus(); await userEvent.keyboard("{Enter}");
    await expect(useReceptionStore.getState().calendarViewByWorkspace[workspaceId]).toBe("week");
    await expect(main.getByTestId("reception-week-calendar")).toBeVisible();
    await expect(week).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(modes.getByRole("button", { name: "월" }));
    await expect(useReceptionStore.getState().calendarViewByWorkspace[workspaceId]).toBe("month");
    await expect(main.getByTestId("reception-month-calendar")).toBeVisible();
    await userEvent.click(modes.getByRole("button", { name: "일" }));
    await expect(main.getByTestId("reception-day-calendar")).toBeVisible();
    await expect(fixture.requests.every(request => request.method === "GET")).toBe(true);
  },
};
export const EmptyCalendarAndQueue: Story = {
  args: { scenario: "empty" },
  play: async ({ canvasElement }) => { const { main, aside } = await ready(canvasElement); await expect(main.getByTestId("reception-day-calendar")).toBeVisible(); await expect(aside.getByText("대기 중인 접수/예약이 없습니다")).toBeVisible(); await expect(main.queryByTestId("appointment-purpose-" + fixture.appointment.id)).not.toBeInTheDocument(); await expect(useReceptionStore.getState().queueSummary?.totalCount).toBe(0); },
};
export const ReadFailureAndActualRetry: Story = {
  args: { scenario: "read-error" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement), main = within(canvas.getByRole("main", { name: "실제 접수 캘린더" })), aside = within(canvas.getByRole("complementary", { name: "실제 접수 예약 목록" }));
    await waitFor(() => expect(main.getByTestId("reception-calendar-read-alert")).toBeVisible());
    await expect(aside.getByTestId("reception-queue-read-alert")).toBeVisible();
    fixture.recover(); await userEvent.click(main.getByRole("button", { name: "캘린더 다시 시도" }));
    await ready(canvasElement);
    await expect(main.queryByTestId("reception-calendar-read-alert")).not.toBeInTheDocument();
    await expect(aside.getByTestId("appointment-queue-card-" + fixture.appointment.id)).toBeVisible();
    await expect(fixture.requests.filter(request => request.path === "/reception/queue")).toHaveLength(2);
  },
};
export const PermissionDeniedUsesActualReadAlerts: Story = {
  args: { scenario: "denied" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByTestId("reception-calendar-read-alert")).toHaveTextContent("접수 보기 권한 또는 workspace membership을 확인해야 합니다."));
    await expect(canvas.getByTestId("reception-queue-read-alert")).toHaveTextContent("접수 보기 권한 또는 workspace membership을 확인해야 합니다.");
    await expect(canvas.queryByTestId("appointment-queue-card-" + fixture.appointment.id)).not.toBeInTheDocument();
    await expect(useReceptionStore.getState().calendarReadStatus).toBe("error");
    await expect(useReceptionStore.getState().queueReadStatus).toBe("error");
    await expect(fixture.requests.every(request => request.method === "GET")).toBe(true);
  },
};
export const QueueSearchAndKeyboardSelection: Story = {
  args: { scenario: "queue-selection" },
  play: async ({ canvasElement }) => {
    const { canvas, aside } = await ready(canvasElement);
    const cardId = "appointment-queue-card-" + fixture.appointment.id;
    await expect(aside.getByTestId(cardId)).toBeVisible();
    await userEvent.click(aside.getByRole("button", { name: "검색" }));
    const search = aside.getByRole("searchbox", { name: "대기열 검색" });
    await userEvent.type(search, "합성-찾지못함");
    await waitFor(() => expect(aside.queryByTestId(cardId)).not.toBeInTheDocument());
    await expect(aside.getByText("검색 결과가 없습니다")).toBeVisible();
    await userEvent.clear(search);
    const card = aside.getByTestId(cardId);
    card.focus(); await userEvent.keyboard("{Enter}");
    await expect(useReceptionStore.getState().selectedAppointmentId).toBe(fixture.appointment.id);
    await expect(useLayoutStore.getState().activeDrawer).toMatchObject({ type: "reception-appointment", id: fixture.appointment.id });
    await expect(useLayoutStore.getState().rightPanelOpen).toBe(true);
    await expect(canvas.getByRole("status", { name: "합성 접수 선택 결과" })).toHaveTextContent("reception-appointment · " + fixture.appointment.id);
    await expect(fixture.requests).toHaveLength(0);
  },
};
