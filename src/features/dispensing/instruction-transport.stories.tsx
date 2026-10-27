import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor } from "storybook/test";
import { useFulfillmentInstruction } from "./use-fulfillment-instruction";
import { syntheticInstruction } from "./instruction-fixtures";
import type { InstructionCommand } from "@/features/fulfillment/instruction-contract";

type Scenario = "retry" | "conflict" | "late-read" | "late-write";
let requests: InstructionCommand[] = [];
let release: (() => void) | undefined;
const workspace = "synthetic-instruction-transport";

function TransportExample({ scenario: _scenario }: { scenario: Scenario }) {
  void _scenario;
  const [selected, setSelected] = useState("first");
  const controller = useFulfillmentInstruction(workspace, selected);
  return (
    <div>
      <output aria-label="지시서">
        {controller.document?.name ?? "조회 중"}
      </output>
      <output aria-label="저장 상태">
        {controller.busy ? "저장 중" : "대기"}
      </output>
      <output aria-label="조회 상태">
        {controller.loading ? "조회 중" : "조회 완료"}
      </output>
      {controller.error ? <p role="alert">{controller.error}</p> : null}
      <button
        disabled={controller.loading}
        onClick={() => {
          void controller.mutate({ action: "claim" });
          void controller.mutate({ action: "claim" });
        }}
      >
        연속 저장
      </button>
      <button onClick={() => setSelected("second")}>다른 지시서</button>
      <button onClick={controller.refresh}>다시 조회</button>
    </div>
  );
}

const meta = {
  title: "Features/Dispensing/Instruction transport",
  component: TransportExample,
  args: { scenario: "retry" as Scenario },
  beforeEach: ({ args }: { args: { scenario: Scenario } }) => {
    const original = globalThis.fetch;
    requests = [];
    release = undefined;
    let failed = false;
    const intercept: typeof fetch = async (input, init) => {
      const url = new URL(
        input instanceof Request ? input.url : String(input),
        window.location.origin,
      );
      if (!url.pathname.startsWith(`/api/workspaces/${workspace}/`))
        return original(input, init);
      if (url.pathname.endsWith("/assignees"))
        return Response.json({ ok: true, assignees: [] });
      const second = url.pathname.includes("/second/");
      const document = {
        ...structuredClone(syntheticInstruction),
        name: second ? "두 번째 지시서" : "첫 번째 지시서",
      };
      if (init?.method === "PATCH") {
        requests.push(JSON.parse(String(init.body)) as InstructionCommand);
        if (args.scenario === "late-write")
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        if (args.scenario === "conflict")
          return Response.json(
            { ok: false, error: "revision_conflict" },
            { status: 409 },
          );
        if (args.scenario === "retry" && !failed) {
          failed = true;
          throw new Error("Synthetic lost response");
        }
        document.name = "저장된 첫 번째 지시서";
      } else if (args.scenario === "late-read" && !second) {
        // Intentionally ignore AbortSignal to verify the generation guard itself.
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      }
      return Response.json({ ok: true, document });
    };
    globalThis.fetch = intercept;
    return () => {
      release?.();
      if (globalThis.fetch === intercept) globalThis.fetch = original;
    };
  },
} satisfies Meta<typeof TransportExample>;
export default meta;
type Story = StoryObj<typeof meta>;

export const LostResponseRetry: Story = {
  play: async ({ canvas }) => {
    await waitFor(() =>
      expect(canvas.getByLabelText("조회 상태")).toHaveTextContent("조회 완료"),
    );
    await userEvent.click(canvas.getByRole("button", { name: "연속 저장" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "변경 결과를 확인하지 못했어요",
    );
    await expect(requests).toHaveLength(1);
    await userEvent.click(canvas.getByRole("button", { name: "연속 저장" }));
    await waitFor(() =>
      expect(canvas.getByLabelText("지시서")).toHaveTextContent(
        "저장된 첫 번째 지시서",
      ),
    );
    await expect(requests).toHaveLength(2);
    await expect(requests[1]).toEqual(requests[0]);
  },
};

export const ConflictKeepsCurrentDocument: Story = {
  args: { scenario: "conflict" },
  play: async ({ canvas }) => {
    await waitFor(() =>
      expect(canvas.getByLabelText("조회 상태")).toHaveTextContent("조회 완료"),
    );
    await userEvent.click(canvas.getByRole("button", { name: "연속 저장" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "다른 사용자가 오더를 변경했어요",
    );
    await expect(canvas.getByLabelText("지시서")).toHaveTextContent(
      "첫 번째 지시서",
    );
  },
};

export const OldReadCannotReplaceSelection: Story = {
  args: { scenario: "late-read" },
  play: async ({ canvas }) => {
    await waitFor(() => expect(release).toBeDefined());
    await userEvent.click(canvas.getByRole("button", { name: "다른 지시서" }));
    await waitFor(() =>
      expect(canvas.getByLabelText("지시서")).toHaveTextContent(
        "두 번째 지시서",
      ),
    );
    release?.();
    await waitFor(() =>
      expect(canvas.getByLabelText("조회 상태")).toHaveTextContent("조회 완료"),
    );
    await expect(canvas.getByLabelText("지시서")).toHaveTextContent(
      "두 번째 지시서",
    );
  },
};

export const OldSaveCannotReplaceSelection: Story = {
  args: { scenario: "late-write" },
  play: async ({ canvas }) => {
    await waitFor(() =>
      expect(canvas.getByLabelText("조회 상태")).toHaveTextContent("조회 완료"),
    );
    await userEvent.click(canvas.getByRole("button", { name: "연속 저장" }));
    await waitFor(() => expect(release).toBeDefined());
    await userEvent.click(canvas.getByRole("button", { name: "다른 지시서" }));
    await waitFor(() =>
      expect(canvas.getByLabelText("지시서")).toHaveTextContent(
        "두 번째 지시서",
      ),
    );
    release?.();
    await waitFor(() =>
      expect(canvas.getByLabelText("저장 상태")).toHaveTextContent("대기"),
    );
    await expect(canvas.getByLabelText("지시서")).toHaveTextContent(
      "두 번째 지시서",
    );
    await expect(requests).toHaveLength(1);
  },
};
