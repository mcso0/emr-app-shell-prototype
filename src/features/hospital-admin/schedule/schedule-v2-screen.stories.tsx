import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { getRouter } from "@storybook/nextjs-vite/navigation.mock";
import { toast } from "sonner";
import { HospitalScheduleV2Screen } from "./schedule-v2-screen";
import { addDaysToIsoDate } from "@/lib/emr-domain/demo-date";
import { parseHospitalScheduleRevisionCommand } from "./revision-api";

type Scenario = "draft" | "published" | "empty" | "error" | "blocked" | "save-error" | "pending-save" | "pending-save-error";
const workspaceId = "storybook-schedule";
const revisionId = "93000000-0000-4000-8000-000000000001";
const staffId = "93000000-0000-4000-8000-000000000002";
const shiftId = "93000000-0000-4000-8000-000000000003";
let commands: Array<Record<string, unknown>> = [];
let releasePendingSave: (() => void) | undefined;
function Example(_args: { scenario: Scenario }) { void _args; return <div className="h-[850px]"><HospitalScheduleV2Screen workspaceId={workspaceId} /></div>; }
const meta = {
  title: "Features/Hospital Admin/Schedule Screen", component: Example, tags: ["autodocs"], args: { scenario: "draft" as Scenario },
  argTypes: { scenario: { control: false, description: "합성 응답의 named scenario. 새 story에서 초기화합니다." } },
  parameters: { layout: "fullscreen", nextjs: { appDirectory: true, navigation: { pathname: `/w/${workspaceId}/hospital-admin`, query: { weekStart: "2026-10-05" } } }, docs: { story: { inline: false, height: "920px" }, description: { component: "실제 HospitalScheduleV2Screen과 근무표 헤더·주차 이동·grid/day list·shift sheet·게시 검토를 렌더링합니다. 실제 persistence-client의 GET/POST 응답만 복원 가능한 합성 fixture로 대체합니다. 응답 파싱과 화면 전환은 제품 소스가 수행합니다. POST는 로컬 명령 기록이며 서버 검증·게시·직원 프로필 반영의 증거가 아닙니다." } } },
  beforeEach: ({ args }) => {
    const original = globalThis.fetch;
    const previousToastIds = new Set(toast.getHistory().map((item) => item.id));
    commands = [];
    releasePendingSave = undefined;
    let readFailed = args.scenario === "error";
    let saveFailed = args.scenario === "save-error" || args.scenario === "pending-save-error";
    let holdSave = args.scenario === "pending-save" || args.scenario === "pending-save-error";
    const revision = { id: revisionId, revision_no: 1, state: "draft", lock_version: 1, based_on_revision_id: null as string | null, published_at: null as string | null };
    const snapshot = {
      week: { id: "synthetic-week", weekStart: "2026-10-05" },
      draftRevision: ["published", "empty"].includes(args.scenario) ? null : { ...revision },
      latestPublishedRevision: args.scenario === "published" ? { ...revision, state: "published" } : null,
      publishedRevisions: [] as Array<typeof revision>,
      staff: [{ id: staffId, membershipId: "93000000-0000-4000-8000-000000000004", name: "합성 수의사", initials: "합성", role: "veterinarian", availability: {}, jobPositionId: null }],
      workBlocks: args.scenario === "empty" ? [] : [{ id: shiftId, staff_profile_id: staffId as string | null, shift_date: "2026-10-05", start_minutes: 540, end_minutes: 1080, work_kind: "clinical", work_label_snapshot: "합성 진료", location_label_snapshot: "합성 진료실" as string | null, private_note: null as string | null }],
      nonWorkEntries: args.scenario === "empty" ? [] : [{ id: "93000000-0000-4000-8000-000000000005", staff_profile_id: staffId, entry_date: "2026-10-06", entry_kind: "off", leave_subtype: null as string | null, start_minutes: null as number | null, end_minutes: null as number | null, private_note: null as string | null }],
      issues: args.scenario === "blocked" ? [{ code: "missing_required_assignment", message: "합성 검토: 필수 배정이 없습니다.", severity: "blocker", entryId: null, staffProfileId: staffId, date: "2026-10-05" }] : [],
    };
    let inserted = 0;
    const nextId = () => `94000000-0000-4000-8000-${String(++inserted).padStart(12, "0")}`;
    const response = () => Response.json({ ok: true, modelVersion: "v2", canonicalWeekStart: snapshot.week.weekStart, snapshot, profileReadback: { status: "confirmed" } });
    globalThis.fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
      if (!url.pathname.startsWith("/api/")) return original(input, init);
      if (url.pathname !== `/api/workspaces/${workspaceId}/hospital-admin/schedule`) throw new Error(`Unexpected story API ${url.pathname}`);
      const method = init?.method ?? (input instanceof Request ? input.method : "GET");
      if (method === "GET") {
        if (readFailed) { readFailed = false; return Response.json({ ok: false }, { status: 503 }); }
        if (url.searchParams.get("weekStart") === "2026-09-28") {
          return Response.json({ ok: true, modelVersion: "v2", canonicalWeekStart: "2026-09-28", snapshot: { ...snapshot, week: { ...snapshot.week, weekStart: "2026-09-28" }, latestPublishedRevision: { ...revision, state: "published" } } });
        }
        return response();
      }
      if (method !== "POST") throw new Error(`Unexpected method ${method}`);
      const raw = JSON.parse(String(init?.body)) as Record<string, unknown>;commands.push(raw);
      if (holdSave) {
        holdSave = false;
        await new Promise<void>((resolve) => { releasePendingSave = resolve; });
        releasePendingSave = undefined;
      }
      if (saveFailed) { saveFailed = false; return Response.json({ ok: false, error: "db_write_failed" }, { status: 503 }); }
      const command = parseHospitalScheduleRevisionCommand(raw);
      if (!command) throw new Error("Invalid emitted schedule command");
      if (command.type === "create_draft") {
        snapshot.draftRevision = { ...revision, id: nextId(), revision_no: (snapshot.latestPublishedRevision?.revision_no ?? 0) + 1, based_on_revision_id: command.sourceRevisionId };
        snapshot.workBlocks = command.sourceRevisionId ? snapshot.workBlocks.map((block) => ({ ...block, id: nextId() })) : [];
        snapshot.nonWorkEntries = command.sourceRevisionId ? snapshot.nonWorkEntries.map((entry) => ({ ...entry, id: nextId() })) : [];
      }
      else if (command.type === "save_work_block") {
        const work = command.workBlock;
        const block = { id: work.id ?? nextId(), staff_profile_id: work.staffProfileId, shift_date: work.shiftDate, start_minutes: work.startMinutes, end_minutes: work.endMinutes, work_kind: work.workKind, work_label_snapshot: work.workLabelSnapshot, location_label_snapshot: work.locationLabelSnapshot, private_note: work.privateNote };
        snapshot.workBlocks = [...snapshot.workBlocks.filter((item) => item.id !== block.id), block];
      } else if (command.type === "save_non_work_entry") {
        const entry = command.nonWorkEntry;
        snapshot.nonWorkEntries = [...snapshot.nonWorkEntries.filter((item) => item.id !== entry.id), { id: entry.id ?? nextId(), staff_profile_id: entry.staffProfileId, entry_date: entry.entryDate, entry_kind: entry.entryKind, leave_subtype: entry.leaveSubtype, start_minutes: entry.startMinutes, end_minutes: entry.endMinutes, private_note: entry.privateNote }];
      } else if (command.type === "delete_entry") {
        if (command.entryKind === "work_block") snapshot.workBlocks = snapshot.workBlocks.filter((item) => item.id !== command.entryId);
        else snapshot.nonWorkEntries = snapshot.nonWorkEntries.filter((item) => item.id !== command.entryId);
      } else if (command.type === "apply_fixed_week") {
        for (const member of snapshot.staff.filter((item) => command.roles.includes(item.role as "veterinarian"))) for (const weekday of command.weekdays) {
          const date = addDaysToIsoDate(snapshot.week.weekStart, weekday - 1);
          if (snapshot.workBlocks.some((item) => item.staff_profile_id === member.id && item.shift_date === date) || snapshot.nonWorkEntries.some((item) => item.staff_profile_id === member.id && item.entry_date === date)) continue;
          snapshot.workBlocks.push({ id: nextId(), staff_profile_id: member.id, shift_date: date, start_minutes: command.startMinutes, end_minutes: command.endMinutes, work_kind: "clinical", work_label_snapshot: "진료", location_label_snapshot: null, private_note: null });
        }
      } else if (command.type === "discard_draft") snapshot.draftRevision = null;
      else if (command.type === "validate_revision") { /* Keep the server-provided synthetic issues. */
      } else if (command.type === "publish_revision") { snapshot.latestPublishedRevision = { ...snapshot.draftRevision!, state: "published", lock_version: snapshot.draftRevision!.lock_version + 1, published_at: "2026-10-11T01:00:00Z" };snapshot.publishedRevisions.push(snapshot.latestPublishedRevision);snapshot.draftRevision = null; }
      if (snapshot.draftRevision && command.type !== "create_draft" && command.type !== "validate_revision") snapshot.draftRevision.lock_version += 1;
      return response();
    };
    let cleanupPromise: Promise<void> | undefined;
    return () => cleanupPromise ??= (async () => {
      releasePendingSave?.();
      releasePendingSave = undefined;
      try {
        if ((args.scenario === "save-error" || args.scenario === "pending-save-error") && commands.length > 0) {
          // A released response can reach the caller's catch after play is interrupted.
          // Wait for that actual caller outcome before clearing its notification.
          await waitFor(() => expect(toast.getHistory().some((item) =>
            !previousToastIds.has(item.id) && "type" in item && item.type === "error",
          )).toBe(true));
        }
      } finally {
        globalThis.fetch = original;
        for (const item of toast.getHistory()) if (!previousToastIds.has(item.id)) toast.dismiss(item.id);
      }
    })();
  },
} satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
export const DraftEditAndSave: Story = {
  parameters: { docs: { description: { story: "실제 업무 수정 후 저장 성공 시 경고 없이 닫히고 저장된 grid label이 표시되는지 확인합니다. POST는 로컬 합성 응답입니다." } } },
  play: async ({ canvas, canvasElement }) => {
    const block = await canvas.findByRole("button", { name: /합성 진료.*09:00/ });await userEvent.click(block);
    const body = within(canvasElement.ownerDocument.body);const dialog = within(await body.findByRole("dialog", { name: "근무 수정" }));
    await userEvent.clear(dialog.getByLabelText("업무"));await userEvent.type(dialog.getByLabelText("업무"), "합성 변경 업무");
    await userEvent.click(dialog.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(body.queryByRole("dialog", { name: "근무 수정" })).not.toBeInTheDocument());
    await waitFor(() => expect(canvas.getByRole("button", { name: /합성 변경 업무/ })).toBeVisible());
    await waitFor(() => expect(body.queryByRole("dialog", { name: "저장하지 않은 변경이 있습니다" })).not.toBeInTheDocument());
    await expect(commands[0]).toMatchObject({ type: "save_work_block", revisionId, expectedLockVersion: 1, workBlock: { id: shiftId, workLabelSnapshot: "합성 변경 업무" } });
  },
};
async function verifyPendingSave(canvasElement: HTMLElement, failure: boolean) {
  const canvas = within(canvasElement);
  const body = within(canvasElement.ownerDocument.body);
  await userEvent.click(await canvas.findByRole("button", { name: /합성 진료.*09:00/ }));
  const sheet = await body.findByRole("dialog", { name: "근무 수정" });
  const dialog = within(sheet);
  const work = dialog.getByLabelText("업무");
  await userEvent.clear(work);
  await userEvent.type(work, "합성 저장 A");
  await userEvent.click(dialog.getByRole("button", { name: "저장" }));
  await waitFor(() => expect(typeof releasePendingSave).toBe("function"));
  try {
    for (const label of ["업무", "날짜", "시작", "종료"]) await expect(dialog.getByLabelText(label)).toBeDisabled();
    for (const label of ["근무 유형", "직원"]) await expect(dialog.getByRole("combobox", { name: label })).toBeDisabled();
    work.focus();
    await expect(work).not.toHaveFocus();
    await userEvent.keyboard("후속 B");
    await expect(work).toHaveValue("합성 저장 A");
    await userEvent.keyboard("{Escape}");
    await expect(sheet).toBeVisible();
    await expect(body.queryByRole("dialog", { name: "저장하지 않은 변경이 있습니다" })).not.toBeInTheDocument();
  } finally {
    releasePendingSave?.();
  }
  if (failure) {
    await waitFor(() => expect(work).toBeEnabled());
    await expect(work).toHaveValue("합성 저장 A");
    await userEvent.clear(work);
    await userEvent.type(work, "합성 재시도 B");
    await userEvent.click(dialog.getByRole("button", { name: "저장" }));
  }
  await waitFor(() => expect(body.queryByRole("dialog", { name: "근무 수정" })).not.toBeInTheDocument());
  await expect(canvas.getByRole("button", { name: failure ? /합성 재시도 B.*09:00/ : /합성 저장 A.*09:00/ })).toBeVisible();
  await expect(commands).toHaveLength(failure ? 2 : 1);
  await expect(commands[0]).toMatchObject({ type: "save_work_block", workBlock: { workLabelSnapshot: "합성 저장 A" } });
  if (failure) await expect(commands[1]).toMatchObject({ type: "save_work_block", workBlock: { workLabelSnapshot: "합성 재시도 B" } });
}
export const PendingSaveLocksDraft: Story = {
  args: { scenario: "pending-save" },
  play: ({ canvasElement }) => verifyPendingSave(canvasElement, false),
};
export const PendingSaveFailureUnlocksDraft: Story = {
  args: { scenario: "pending-save-error" },
  play: ({ canvasElement }) => verifyPendingSave(canvasElement, true),
};
export const PublishedAndCreateDraft: Story = {
  args: { scenario: "published" }, parameters: { docs: { description: { story: "게시된 주의 block은 읽기 전용입니다. 편집 시작은 현재 게시 revision에서 합성 초안을 만듭니다." } } },
  play: async ({ canvas }) => { await expect(await canvas.findByRole("button", { name: /합성 진료.*09:00/ })).toBeDisabled();await userEvent.click(canvas.getByRole("button", { name: "근무표 편집" }));await expect(await canvas.findByRole("button", { name: "+ 근무" })).toBeEnabled();await expect(commands[0]).toMatchObject({ type: "create_draft", weekStart: "2026-10-05", sourceRevisionId: revisionId }); },
};
export const PublishReview: Story = {
  parameters: { docs: { description: { story: "게시 확인 후 합성 응답에 따라 읽기 전용으로 전환합니다. 서버 게시와 readback은 로컬 응답입니다." } } },
  play: async ({ canvas, canvasElement }) => { await userEvent.click(await canvas.findByRole("button", { name: "게시 전 확인" }));await waitFor(() => expect(commands).toHaveLength(1));await userEvent.click(canvas.getByRole("button", { name: "게시하기" }));const body = within(canvasElement.ownerDocument.body);const dialog = within(await body.findByRole("dialog"));await userEvent.click(dialog.getByRole("button", { name: "게시하기" }));await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());await expect(canvas.getByRole("button", { name: /합성 진료.*09:00/ })).toBeDisabled();await expect(commands[0]).toMatchObject({ type: "validate_revision", expectedLockVersion: 1 });await expect(commands[1]).toMatchObject({ type: "publish_revision", expectedLockVersion: 1 }); },
};
export const BlockedPublish: Story = {
  args: { scenario: "blocked" }, parameters: { docs: { description: { story: "서버가 전달한 blocker는 실제 게시 검토에 표시되며 게시를 실행할 수 없습니다." } } },
  play: async ({ canvas, canvasElement }) => { await userEvent.click(await canvas.findByRole("button", { name: "게시하기" }));const dialog = within(await within(canvasElement.ownerDocument.body).findByRole("dialog"));await waitFor(() => expect(dialog.getByText("합성 검토: 필수 배정이 없습니다.")).toBeVisible());await expect(dialog.getByRole("button", { name: "게시하기" })).toBeDisabled();await userEvent.click(dialog.getByRole("button", { name: "취소" }));await expect(commands).toHaveLength(0); },
};
export const ReadErrorAndRetry: Story = {
  args: { scenario: "error" }, parameters: { docs: { description: { story: "최초 503 조회는 오류 안내를 표시합니다. 실제 다시 시도 버튼으로 합성 ready 상태를 복구합니다." } } },
  play: async ({ canvas }) => { await userEvent.click(await canvas.findByRole("button", { name: "다시 시도" }));await expect(await canvas.findByRole("button", { name: /합성 진료.*09:00/ })).toBeEnabled(); },
};
export const EmptyWeek: Story = { args: { scenario: "empty" }, parameters: { docs: { description: { story: "초안과 게시 revision이 모두 없는 주의 실제 편집 진입과 빈 안내를 표시합니다." } } }, play: async ({ canvas }) => { await canvas.findByText("이번 주 근무가 아직 없습니다");await waitFor(() => expect(canvas.getByText("이번 주 근무가 아직 없습니다")).toBeVisible()); } };
export const FixedWeekAndValidation: Story = {
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(await canvas.findByRole("button", { name: "기본 근무 입력" }));
    const body = within(canvasElement.ownerDocument.body);
    const dialog = within(await body.findByRole("dialog", { name: "기본 근무 일괄 입력" }));
    await userEvent.click(dialog.getByRole("button", { name: "현재 주에 입력" }));
    await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());
    await expect(canvas.getAllByRole("button", { name: /^진료.*09:00/ }).length).toBeGreaterThan(0);
    await userEvent.click(canvas.getByRole("button", { name: "게시 전 확인" }));
    await waitFor(() => expect(commands).toHaveLength(2));
    await expect(commands[1]).toMatchObject({ type: "validate_revision", expectedLockVersion: 2 });
  },
};
export const WeekNavigation: Story = {
  parameters: { docs: { description: { story: "주차 이동은 실제 caller의 Next router.replace 인수를 확인합니다. Storybook router는 로컬 spy이며 실제 URL 탐색은 하지 않습니다." } } },
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole("button", { name: "이전 주" }));
    await expect(getRouter().replace).toHaveBeenCalledWith(`/w/${workspaceId}/hospital-admin?weekStart=2026-09-28`);
    await userEvent.click(canvas.getByRole("button", { name: "다음 주" }));
    await expect(getRouter().replace).toHaveBeenCalledWith(`/w/${workspaceId}/hospital-admin?weekStart=2026-10-12`);
  },
};

export const UnsavedCloseGuard: Story = {
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(await canvas.findByRole("button", { name: /합성 진료.*09:00/ }));
    const body = within(canvasElement.ownerDocument.body);
    const dialog = within(await body.findByRole("dialog", { name: "근무 수정" }));
    await userEvent.type(dialog.getByLabelText("업무"), " 미저장");
    await userEvent.click(dialog.getByRole("button", { name: "취소" }));
    const guard = within(await body.findByRole("dialog", { name: "저장하지 않은 변경이 있습니다" }));
    await userEvent.click(guard.getByRole("button", { name: "계속 편집" }));
    await expect(dialog.getByLabelText("업무")).toHaveValue("합성 진료 미저장");
    await expect(commands).toHaveLength(0);
    await userEvent.click(dialog.getByRole("button", { name: "취소" }));
    await userEvent.click(within(await body.findByRole("dialog", { name: "저장하지 않은 변경이 있습니다" })).getByRole("button", { name: "저장하지 않고 이동" }));
    await waitFor(() => expect(body.queryByRole("dialog", { name: "근무 수정" })).not.toBeInTheDocument());
    await expect(canvas.getByRole("button", { name: /합성 진료.*09:00/ })).toBeVisible();
  },
};
export const FailedSavePreservesDraftAndRetry: Story = {
  args: { scenario: "save-error" },
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(await canvas.findByRole("button", { name: /합성 진료.*09:00/ }));
    const body = within(canvasElement.ownerDocument.body);
    const dialog = within(await body.findByRole("dialog", { name: "근무 수정" }));
    await userEvent.type(dialog.getByLabelText("업무"), " 재시도");
    await userEvent.click(dialog.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(commands).toHaveLength(1));
    await expect(dialog.getByLabelText("업무")).toHaveValue("합성 진료 재시도");
    await waitFor(() => expect(dialog.getByRole("button", { name: "저장" })).toBeEnabled());
    await userEvent.click(dialog.getByRole("button", { name: "취소" }));
    const guard = within(await body.findByRole("dialog", { name: "저장하지 않은 변경이 있습니다" }));
    await userEvent.click(guard.getByRole("button", { name: "계속 편집" }));
    await userEvent.click(dialog.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(body.queryByRole("dialog", { name: "근무 수정" })).not.toBeInTheDocument());
    await waitFor(() => expect(body.queryByRole("dialog", { name: "저장하지 않은 변경이 있습니다" })).not.toBeInTheDocument());
    await expect(canvas.getByRole("button", { name: /합성 진료 재시도/ })).toBeVisible();
    await expect(commands).toHaveLength(2);
  },
};
