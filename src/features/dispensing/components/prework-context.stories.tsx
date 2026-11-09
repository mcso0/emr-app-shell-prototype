import { useEffect, useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DispensingPreworkContext } from "./prework-context";
import { InstructionActions, InstructionBody } from "./instruction-workspace";
import { syntheticInstruction } from "../instruction-fixtures";
import { useFulfillmentInstruction } from "../use-fulfillment-instruction";
import { createDefaultWorkspaceVitalSettingsSnapshot } from "@/features/patient-vitals/workspace-vital-settings";
import type { InstructionDocument } from "@/features/fulfillment/instruction-contract";

const workspaceId = "synthetic-prework";
const id = "71000000-0000-4000-8000-000000000001";
const patientId = "71000000-0000-4000-8000-000000000002";
const guardianId = "71000000-0000-4000-8000-000000000003";
const longOrderName = "합성-조제-항목-긴-이름-말줄임과-전체-표시를-확인하는-테스트-오더";
type Args = {
  owner: "unassigned" | "mine" | "other";
  firstItemName?: string;
  treatment?: boolean;
  failOnce?: boolean;
  denied?: boolean;
  requester?: boolean;
  width?: number;
  loadingContext?: boolean;
  refreshDuringEntry?: boolean;
  denyEntryRefresh?: boolean;
};
const workItem = {
  id,
  workspaceId,
  encounterId: id,
  patientId,
  queueType: "dispensing" as const,
  createdAt: "2026-11-02T08:00:00Z",
  patientName: "합성 환자",
  guardianName: "합성 보호자",
  requesterName: "합성 수의사",
  sourceSnapshot: { encounterNo: "SYN-001" },
};
let commands: Record<string, unknown>[] = [];
let releaseEntry: (() => void) | undefined;
let releaseRead: (() => void) | undefined;
let entryResponseReturned = false;
let delayNextReview = false;
let releaseReview: (() => void) | undefined;
let instructionReads = 0;

function Example(args: Args) {
  const [queueRevision, setQueueRevision] = useState(0);
  const controller = useFulfillmentInstruction(workspaceId, id, String(queueRevision));
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const refresh = () => setQueueRevision(value => value + 1);
    window.addEventListener("storybook:queue-refresh", refresh);
    return () => window.removeEventListener("storybook:queue-refresh", refresh);
  }, []);
  return (
    <div
      style={{ width: args.width ?? 1100, maxWidth: "100%", height: 1000 }}
      className="flex min-w-0 flex-col bg-card"
    >
      {args.refreshDuringEntry && <output aria-label="업무 처리 상태">{controller.busy ? "처리 중" : "대기"}</output>}
      {entered ? (
        <>
          <div className="flex gap-3 p-4">
            <h1>지시서 작업 화면</h1>
            <InstructionActions
              controller={controller}
              workspaceId={workspaceId}
              onChanged={() => {}}
            />
          </div>
          <InstructionBody
            controller={controller}
            workspaceId={workspaceId}
            onChanged={() => {}}
          />
        </>
      ) : controller.document ? (
        <DispensingPreworkContext
          controller={controller}
          workItem={{
            ...workItem,
            queueType: args.treatment ? "treatment" : "dispensing",
          }}
          onChanged={() => {}}
          onEntered={() => setEntered(true)}
        />
      ) : controller.error ? <p role="alert">{controller.error}</p> : (
        <p role="status">업무를 불러오는 중이에요.</p>
      )}
    </div>
  );
}
const meta = {
  title: "Features/Dispensing/Prework Context",
  component: Example,
  tags: ["autodocs"],
  args: {
    owner: "unassigned",
    treatment: false,
    failOnce: false,
    denied: false,
    requester: false,
    width: 1100,
  },
  parameters: {
    docs: {
      description: {
        component:
          "실제 조제/처치 시작 전 컴포넌트와 instruction hook을 합성 API 응답으로 검증합니다. 담당 지정·시작·사유 입력·실패 재시도는 로컬 가상 응답이며 DB 권한/실제 알림은 별도 SQL 검증 대상입니다. 차트 호출 전 헤더, 메모, 바이탈 표현을 재사용합니다.",
      },
    },
  },
  beforeEach: ({ args }) => {
    commands = [];
    releaseEntry = undefined;
    releaseRead = undefined;
    entryResponseReturned = false;
    delayNextReview = false;
    releaseReview = undefined;
    instructionReads = 0;
    let entryPending = false;
    const original = globalThis.fetch;
    const pendingReads: Array<() => void> = [];
    let fail = args.failOnce;
    const document: InstructionDocument = {
      ...structuredClone(syntheticInstruction),
      encounterNo: "SYN-001",
      rootTaskId: id,
      rootOrderId: id,
      queueType: args.treatment ? "treatment" : "dispensing",
      revision: "1",
      finalized: false,
      mainAssigneeId:
        args.owner === "unassigned"
          ? null
          : args.owner === "mine"
            ? "synthetic-me"
            : "synthetic-other",
      mainAssigneeName:
        args.owner === "unassigned"
          ? null
          : args.owner === "mine"
            ? "합성 담당자 (나)"
            : "합성 기존 담당자",
      canClaim: args.owner === "unassigned",
      canTakeover: args.owner === "other",
      canStart: args.owner === "mine",
      canResume: false,
      canUnassign: args.owner === "mine",
      canCompleteAll: Boolean(args.requester),
      canEditInstruction: false,
      changes: [],
      instruction: "모든 항목의 안내문을 함께 준비해 주세요.",
      items: syntheticInstruction.items
        .slice(0, 2)
        .map((item, index) => ({
          ...structuredClone(item),
          id: index === 0 ? id : "71000000-0000-4000-8000-000000000004",
          taskId: index === 0 ? id : "71000000-0000-4000-8000-000000000004",
          status: "requested",
          resultRequired: false,
          hasResult: false,
          name: (index === 0 ? args.firstItemName : undefined) ?? (args.treatment
            ? `합성 처치 ${index + 1}`
            : `합성 약품 ${index + 1}`),
          instruction: `합성 개별 지시 ${index + 1}`,
          canAssign: false,
          canComplete: false,
          canReopen: false,
          assigneeId: args.owner === "unassigned" ? null : args.owner,
          assigneeName:
            args.owner === "unassigned"
              ? null
              : args.owner === "mine"
                ? "합성 담당자 (나)"
                : "합성 기존 담당자",
        })),
    };
    globalThis.fetch = async (input, init) => {
      const url = new URL(
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
        window.location.origin,
      );
      const method = init?.method ?? "GET";
      if (url.pathname.endsWith("/instruction")) {
        if (method !== "PATCH") instructionReads += 1;
        if (method === "PATCH") {
          const command = JSON.parse(String(init?.body));
          commands.push(command);
          entryPending = true;
          if (args.refreshDuringEntry) await new Promise<void>(resolve => { releaseEntry = resolve; });
          await new Promise((resolve) => setTimeout(resolve, 40));
          if (fail) {
            fail = false;
            return Response.json({ ok: false }, { status: 503 });
          }
          document.mainAssigneeId = "synthetic-me";
          document.mainAssigneeName = "합성 담당자 (나)";
          document.canClaim = false;
          document.canTakeover = false;
          document.canUnassign = true;
          document.canCompleteAll = true;
          const startsWork = command.action === "start" || command.startWork === true;
          document.canStart = !startsWork;
          document.items.forEach((item) => {
            item.assigneeId = "synthetic-me";
            item.assigneeName = "합성 담당자 (나)";
            item.canAssign = true;
            item.canComplete = true;
            if (startsWork) item.status = "in_progress";
          });
          document.revision = String(Number(document.revision) + 1);
          entryPending = false;
          entryResponseReturned = true;
        } else if (args.refreshDuringEntry && entryPending) {
          if (args.denyEntryRefresh) return Response.json({ ok: false, error: "permission_missing" }, { status: 403 });
          const stale = structuredClone(document);
          await new Promise<void>(resolve => { releaseRead = resolve; });
          return Response.json({ ok: true, document: stale });
        }
        return Response.json({ ok: true, document });
      }
      if (url.pathname.endsWith("/assignees"))
        return Response.json({ ok: true, assignees: [] });
      if (url.pathname.endsWith("/instruction-review")) {
        if (delayNextReview) {
          delayNextReview = false;
          await new Promise<void>(resolve => { releaseReview = resolve; });
        }
        return Response.json({
          ok: true,
          reviews: (url.searchParams.get("taskIds") ?? "")
            .split(",")
            .filter(Boolean)
            .map((taskId) => ({
              taskId,
              current: null,
              previous: null,
              requiresAcknowledgement: false,
              snapshots: [],
            })),
        });
      }
      if (url.pathname.endsWith("/vital-settings"))
        return Response.json(
          createDefaultWorkspaceVitalSettingsSnapshot(false),
        );
      if (url.pathname.endsWith("/patient-vitals/history"))
        return args.denied
          ? Response.json({ ok: false }, { status: 403 })
          : Response.json({ ok: true, measurements: [] });
      if (args.loadingContext && (url.pathname.endsWith("/profile-overview") || url.pathname.endsWith("/vitals"))) {
        return new Promise<Response>(resolve => pendingReads.push(() => resolve(Response.json({ ok: false }, { status: 500 }))));
      }
      if (url.pathname.endsWith("/profile-overview")) {
        if (args.denied) return Response.json({ ok: false }, { status: 403 });
        const isPatient = url.pathname.includes("/patient/");
        return Response.json({
          ok: true,
          overview: {
            subjectId: isPatient ? patientId : guardianId,
            subjectType: isPatient ? "patient" : "guardian",
            profile: isPatient
              ? {
                  id: patientId,
                  name: "합성 환자",
                  species: "dog",
                  breed: "Maltese",
                  sex: "male",
                  neutered: true,
                  birthDate: "2021-01-01",
                  handlingCautionNote: "천천히 접근해 주세요.",
                  allergyNote: "합성 알레르기 메모",
                }
              : {
                  id: guardianId,
                  name: "합성 보호자",
                  memo: "설명을 메모로 남겨 주세요.",
                },
            relationships: {
              guardians: isPatient
                ? [
                    {
                      id: guardianId,
                      name: "합성 보호자",
                      isPrimary: true,
                      workspaceId,
                    },
                  ]
                : [],
            },
            access: {
              information: {
                allowed: true,
                requiredPermission: "patient:view",
              },
            },
          },
        });
      }
      if (url.pathname.endsWith("/work-items"))
        return Response.json({ ok: true, workItems: [] });
      if (url.pathname.endsWith("/staff"))
        return Response.json({ ok: true, staff: [] });
      if (url.pathname.startsWith("/api/"))
        throw new Error(`Unmocked API: ${url.pathname}`);
      return original(input, init);
    };
    return () => {
      globalThis.fetch = original;
      releaseEntry?.();
      releaseRead?.();
      releaseReview?.();
      pendingReads.forEach(release => release());
    };
  },
} satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Overview: Story = {
  parameters: {
    docs: {
      description: {
        story: "담당 전 화면의 전체 구성을 검토하는 합성 예시입니다.",
      },
    },
  },
};
export const Unassigned: Story = {
  play: async ({ canvas, canvasElement }) => {
    await canvas.findByRole("heading", { name: "오더 정보" });
    await expect(
      canvas.getByRole("columnheader", { name: "항목" }),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "담당하기" }));
    const dialog = within(await within(canvasElement.ownerDocument.body).findByRole("dialog"));
    await waitFor(() => expect(dialog.getByText("미지정 → 나")).toBeVisible());
    await expect(within(dialog.getByRole("list", { name: "대상 오더" })).getAllByRole("listitem")).toHaveLength(2);
    await userEvent.click(dialog.getByRole("button", { name: "담당하기" }));
    await canvas.findByRole("heading", { name: "지시서 작업 화면" });
    await expect(
      canvas.queryByRole("button", { name: "조제 시작" }),
    ).not.toBeInTheDocument();
    await expect(commands).toEqual([expect.objectContaining({ action: "claim", startWork: true })]);
  },
};
export const DesignatedOwner: Story = {
  args: { owner: "mine" },
  play: async ({ canvas, canvasElement }) => {
    const start = await canvas.findByRole("button", { name: "업무 시작하기" });
    await waitFor(() => expect(start).toBeEnabled());
    await userEvent.click(start);
    await expect(within(canvasElement.ownerDocument.body).queryByRole("dialog")).not.toBeInTheDocument();
    await canvas.findByRole("heading", { name: "지시서 작업 화면" });
    await expect(commands.map((command) => command.action)).toEqual(["start"]);
    await expect(
      canvas.queryByRole("button", { name: "조제 시작" }),
    ).not.toBeInTheDocument();
  },
};

async function enterDuringQueueRefresh({ canvas, canvasElement }: Parameters<NonNullable<Story["play"]>>[0]) {
  await canvas.findByRole("heading", { name: "오더 정보" });
  const start = canvas.queryByRole("button", { name: "업무 시작하기" });
  const trigger = start ?? await canvas.findByRole("button", { name: "담당하기" });
  await waitFor(() => expect(trigger).toBeEnabled());
  await userEvent.click(trigger);
  let takeover = false;
  if (!start) {
    const dialog = within(await within(canvasElement.ownerDocument.body).findByRole("dialog"));
    const reason = dialog.queryByLabelText("담당 변경 사유");
    takeover = Boolean(reason);
    if (reason) await userEvent.type(reason, "합성 교대 사유");
    await userEvent.click(dialog.getByRole("button", { name: takeover ? "담당 변경" : "담당하기" }));
  }
  await waitFor(() => expect(releaseEntry).toBeDefined());
  canvasElement.ownerDocument.defaultView!.dispatchEvent(new Event("storybook:queue-refresh"));
  await waitFor(() => expect(releaseRead).toBeDefined());
  releaseEntry?.();
  // An older requested-state read must not replace the committed start response.
  await canvas.findByRole("heading", { name: "지시서 작업 화면" });
  releaseRead?.();
  await waitFor(() => expect(canvas.getByLabelText("업무 처리 상태")).toHaveTextContent("대기"));
  await expect(canvas.getByRole("heading", { name: "지시서 작업 화면" })).toBeVisible();
  await waitFor(() => expect(canvas.queryByRole("button", { name: /^(업무 시작하기|조제 시작|처치 시작)$/ })).not.toBeInTheDocument());
  await expect(commands).toEqual([expect.objectContaining(start ? { action: "start" } : takeover
    ? { action: "takeover", startWork: true, reason: "합성 교대 사유" }
    : { action: "claim", startWork: true })]);
}

export const ClaimDuringQueueRefresh: Story = { args: { refreshDuringEntry: true }, play: enterDuringQueueRefresh };
export const StartDuringQueueRefresh: Story = { args: { owner: "mine", refreshDuringEntry: true }, play: enterDuringQueueRefresh };
export const TreatmentClaimDuringQueueRefresh: Story = { args: { treatment: true, refreshDuringEntry: true }, play: enterDuringQueueRefresh };
export const TreatmentStartDuringQueueRefresh: Story = { args: { treatment: true, owner: "mine", refreshDuringEntry: true }, play: enterDuringQueueRefresh };
export const TakeoverDuringQueueRefresh: Story = { args: { owner: "other", refreshDuringEntry: true }, play: enterDuringQueueRefresh };
export const TreatmentTakeoverDuringQueueRefresh: Story = { args: { treatment: true, owner: "other", refreshDuringEntry: true }, play: enterDuringQueueRefresh };
export const DeniedRefreshDuringEntry: Story = {
  args: { owner: "mine", refreshDuringEntry: true, denyEntryRefresh: true },
  play: async ({ canvas, canvasElement }) => {
    const start = await canvas.findByRole("button", { name: "업무 시작하기" });
    await waitFor(() => expect(start).toBeEnabled());
    await userEvent.click(start);
    await waitFor(() => expect(releaseEntry).toBeDefined());
    canvasElement.ownerDocument.defaultView!.dispatchEvent(new Event("storybook:queue-refresh"));
    await canvas.findByRole("alert");
    releaseEntry?.();
    await waitFor(() => expect(entryResponseReturned).toBe(true));
    await expect(canvas.getByRole("alert")).toHaveTextContent("권한");
    await expect(canvas.queryByRole("heading", { name: "지시서 작업 화면" })).not.toBeInTheDocument();
    await expect(canvas.queryByRole("heading", { name: "오더 정보" })).not.toBeInTheDocument();
    await expect(commands).toHaveLength(1);
  },
};

async function startDuringReviewRefresh({ canvas, canvasElement }: Parameters<NonNullable<Story["play"]>>[0]) {
  const start = await canvas.findByRole("button", { name: "업무 시작하기" });
  await waitFor(() => expect(start).toBeEnabled());
  delayNextReview = true;
  await userEvent.click(start);
  await waitFor(() => expect(releaseReview).toBeDefined());
  canvasElement.ownerDocument.defaultView!.dispatchEvent(new Event("storybook:queue-refresh"));
  await waitFor(() => expect(instructionReads).toBe(2));
  releaseReview?.();
  await canvas.findByRole("heading", { name: "지시서 작업 화면" });
  await expect(commands).toEqual([expect.objectContaining({ action: "start" })]);
}

export const StartWithQueueRefreshDuringReview: Story = { args: { owner: "mine" }, play: startDuringReviewRefresh };
export const TreatmentStartWithQueueRefreshDuringReview: Story = { args: { owner: "mine", treatment: true }, play: startDuringReviewRefresh };
export const TakeoverRetry: Story = {
  args: { owner: "other", failOnce: true },
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(
      await canvas.findByRole("button", { name: "담당하기" }),
    );
    const body = within(canvasElement.ownerDocument.body);
    const dialog = within(
      await body.findByRole("dialog", { name: "담당자를 변경할까요?" }),
    );
    await waitFor(() => expect(dialog.getByText("합성 기존 담당자 → 나")).toBeVisible());
    const confirm = dialog.getByRole("button", { name: "담당 변경" });
    await expect(confirm).toBeDisabled();
    await userEvent.type(
      dialog.getByLabelText("담당 변경 사유"),
      "교대 근무로 인계합니다.",
    );
    await userEvent.dblClick(confirm);
    await dialog.findByRole("alert");
    await expect(dialog.getByLabelText("담당 변경 사유")).toHaveValue(
      "교대 근무로 인계합니다.",
    );
    await expect(commands).toHaveLength(1);
    await userEvent.click(confirm);
    await canvas.findByRole("heading", { name: "지시서 작업 화면" });
    await expect(commands).toHaveLength(2);
    await expect(commands[0].commandId).toBe(commands[1].commandId);
    await expect(commands[1]).toMatchObject({ action: "takeover", startWork: true, reason: "교대 근무로 인계합니다." });
    await expect(
      canvas.queryByRole("button", { name: "조제 시작" }),
    ).not.toBeInTheDocument();
  },
};
export const Treatment: Story = {
  args: { owner: "other", treatment: true },
  play: async ({ canvas }) => {
    await canvas.findByRole("columnheader", { name: "처치 계획" });
    await expect(
      canvas.getByText("담당자", { exact: true }),
    ).toBeVisible();
  },
};
export const RequesterCompletion: Story = {
  args: { requester: true },
  play: async ({ canvas, canvasElement }) => {
    const menu = await canvas.findByRole("button", { name: "완료 메뉴 열기" });
    await waitFor(() => expect(menu).toBeEnabled());
    menu.focus();
    await userEvent.keyboard("{ArrowDown}");
    const body = within(canvasElement.ownerDocument.body);
    const complete = await body.findByRole("menuitem", { name: "조제 완료" });
    await expect(complete).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(await body.findByRole("dialog", { name: "오더를 완료할까요?" })).toBeInTheDocument();
  },
};
export const Narrow: Story = {
  args: { width: 390 },
  play: async ({ canvas, canvasElement }) => {
    await canvas.findByRole("heading", { name: "오더 정보" });
    await waitFor(() =>
      expect(canvasElement.scrollWidth).toBeLessThanOrEqual(
        canvasElement.clientWidth,
      ),
    );
  },
};
export const LongOrderName: Story = {
  args: { firstItemName: longOrderName },
  decorators: [Story => <TooltipProvider><Story /></TooltipProvider>],
  play: async ({ canvas, canvasElement }) => {
    const summaryName = await canvas.findByText(longOrderName, { selector: "dd span" });
    await waitFor(() => expect(summaryName.tabIndex).toBe(0));
    await expect(summaryName.scrollWidth).toBeGreaterThan(summaryName.clientWidth);
    await expect(canvas.getByText("외 1건", { exact: true })).toBeVisible();

    const itemName = canvas.getByRole("rowheader", { name: longOrderName });
    await expect(itemName).toBeVisible();
    await expect(getComputedStyle(itemName).whiteSpace).toBe("normal");

    summaryName.focus();
    const tooltip = () => canvasElement.ownerDocument.querySelector('[data-slot="tooltip-content"]');
    await waitFor(() => expect(tooltip()).toHaveTextContent(longOrderName));
    summaryName.blur();
    await waitFor(() => expect(tooltip()).not.toBeInTheDocument());
  },
};
export const ReadDenied: Story = {
  args: { denied: true },
  play: async ({ canvas }) => {
    await canvas.findByText("바이탈 조회 권한이 없어요.");
    await expect(
      canvas.getByRole("button", { name: "환자 정보" }),
    ).toBeDisabled();
  },
};


export const LoadingContextRetainsRequest: Story = {
  args: { owner: "mine", loadingContext: true },
  play: async ({ canvas, canvasElement }) => {
    await canvas.findByRole("heading", { name: "오더 정보" });
    await expect(canvas.getByText("합성 환자", { exact: true })).toBeVisible();
    await expect(canvas.getByRole("rowheader", { name: /^합성 약품 1$/ })).toBeVisible();
    await waitFor(() => expect(canvasElement.querySelectorAll('[skullet-loading]').length).toBeGreaterThanOrEqual(2));
    await expect(commands).toHaveLength(0);
  },
};
