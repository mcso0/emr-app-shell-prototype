import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
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
type Args = {
  owner: "unassigned" | "mine" | "other";
  treatment?: boolean;
  failOnce?: boolean;
  denied?: boolean;
  requester?: boolean;
  width?: number;
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

function Example(args: Args) {
  const controller = useFulfillmentInstruction(workspaceId, id);
  const [entered, setEntered] = useState(false);
  return (
    <div
      style={{ width: args.width ?? 1100, maxWidth: "100%", height: 1000 }}
      className="flex min-w-0 flex-col bg-card"
    >
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
      ) : (
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
    const original = globalThis.fetch;
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
          name: args.treatment
            ? `합성 처치 ${index + 1}`
            : `합성 약품 ${index + 1}`,
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
        if (method === "PATCH") {
          const command = JSON.parse(String(init?.body));
          commands.push(command);
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
          document.canStart = command.action !== "start";
          document.items.forEach((item) => {
            item.assigneeId = "synthetic-me";
            item.assigneeName = "합성 담당자 (나)";
            item.canAssign = true;
            item.canComplete = true;
            if (command.action === "start") item.status = "in_progress";
          });
          document.revision = String(Number(document.revision) + 1);
        }
        return Response.json({ ok: true, document });
      }
      if (url.pathname.endsWith("/assignees"))
        return Response.json({ ok: true, assignees: [] });
      if (url.pathname.endsWith("/instruction-review"))
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
      if (url.pathname.endsWith("/vital-settings"))
        return Response.json(
          createDefaultWorkspaceVitalSettingsSnapshot(false),
        );
      if (url.pathname.endsWith("/patient-vitals/history"))
        return args.denied
          ? Response.json({ ok: false }, { status: 403 })
          : Response.json({ ok: true, measurements: [] });
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
    await canvas.findByRole("columnheader", { name: "담당자" });
    await expect(
      canvas.getByRole("columnheader", { name: "오더명" }),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "담당하기" }));
    await userEvent.click(within(await within(canvasElement.ownerDocument.body).findByRole("dialog")).getByRole("button", { name: "담당하기" }));
    await canvas.findByRole("heading", { name: "지시서 작업 화면" });
    await expect(
      canvas.getByRole("button", { name: "조제 시작" }),
    ).toBeVisible();
    await expect(commands.map((command) => command.action)).toEqual(["claim"]);
  },
};
export const DesignatedOwner: Story = {
  args: { owner: "mine" },
  play: async ({ canvas, canvasElement }) => {
    const start = await canvas.findByRole("button", { name: "업무 시작하기" });
    await waitFor(() => expect(start).toBeEnabled());
    await userEvent.click(start);
    await userEvent.click(within(await within(canvasElement.ownerDocument.body).findByRole("dialog")).getByRole("button", { name: "업무 시작하기" }));
    await canvas.findByRole("heading", { name: "지시서 작업 화면" });
    await expect(commands.map((command) => command.action)).toEqual(["start"]);
    await expect(
      canvas.queryByRole("button", { name: "조제 시작" }),
    ).not.toBeInTheDocument();
  },
};
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
    await expect(
      dialog.getByRole("button", { name: "담당하기" }),
    ).toBeDisabled();
    await userEvent.type(
      dialog.getByLabelText("담당 변경 사유"),
      "교대 근무로 인계합니다.",
    );
    await userEvent.dblClick(dialog.getByRole("button", { name: "담당하기" }));
    await dialog.findByRole("alert");
    await expect(dialog.getByLabelText("담당 변경 사유")).toHaveValue(
      "교대 근무로 인계합니다.",
    );
    await expect(commands).toHaveLength(1);
    await userEvent.click(dialog.getByRole("button", { name: "담당하기" }));
    await canvas.findByRole("heading", { name: "지시서 작업 화면" });
    await expect(commands).toHaveLength(2);
    await expect(commands[0].commandId).toBe(commands[1].commandId);
    await expect(
      canvas.getByRole("button", { name: "조제 시작" }),
    ).toBeVisible();
  },
};
export const Treatment: Story = {
  args: { owner: "other", treatment: true },
  play: async ({ canvas }) => {
    await canvas.findByRole("columnheader", { name: "처치 지시" });
    await expect(
      canvas.getByRole("columnheader", { name: "담당자" }),
    ).toBeVisible();
  },
};
export const RequesterCompletion: Story = {
  args: { requester: true },
  play: async ({ canvas }) => {
    const complete = await canvas.findByRole("button", { name: "조제 완료" });
    await waitFor(() => expect(complete).toBeEnabled());
  },
};
export const Narrow: Story = {
  args: { width: 390 },
  play: async ({ canvas, canvasElement }) => {
    await canvas.findByRole("columnheader", { name: "담당자" });
    await waitFor(() =>
      expect(canvasElement.scrollWidth).toBeLessThanOrEqual(
        canvasElement.clientWidth,
      ),
    );
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
