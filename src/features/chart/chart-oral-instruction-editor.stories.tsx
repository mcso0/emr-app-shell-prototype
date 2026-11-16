import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { ChartOralInstructionEditor } from "./chart-oral-instruction-editor";
const meta = {
  title: "Features/Chart/Oral instruction editor",
  component: ChartOralInstructionEditor,
  args: { workspaceId: "workspace-instruction-qa", chartId: "28130000-0000-4000-8000-000000000001", disabled: false },
} satisfies Meta<typeof ChartOralInstructionEditor>;
export default meta;
type Story = StoryObj<typeof meta>;
export const ReadAndSave: Story = {
  beforeEach: () => {
    const original = globalThis.fetch;
    let document = { chartId: meta.args.chartId, revision: 0, instruction: "", canEdit: true, history: [] as { revision: number; instruction: string; actorId: string; createdAt: string }[] };
    globalThis.fetch = async (input, init) => {
      if (!String(input).endsWith("/oral-instruction")) return original(input, init);
      if (init?.method === "PATCH") {
        const command = JSON.parse(String(init.body));
        if (command.expectedRevision !== document.revision) return Response.json({ ok: false, error: "revision_conflict" }, { status: 409 });
        document = { ...document, revision: document.revision + 1, instruction: command.instruction,
          history: [...document.history, { revision: document.revision + 1, instruction: command.instruction, actorId: "synthetic", createdAt: "2026-10-27" }] };
      }
      return Response.json({ ok: true, document });
    };
    return () => { globalThis.fetch = original; };
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement), body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "경구제 전체 지시" }));
    await userEvent.type(await body.findByRole("textbox", { name: "경구제 전체 지시사항" }), "합성 경구제 지시");
    await userEvent.click(body.getByRole("button", { name: /^저장$/ }));
    await userEvent.click(canvas.getByRole("button", { name: "경구제 전체 지시" }));
    await expect(await body.findByRole("textbox", { name: "경구제 전체 지시사항" })).toHaveValue("합성 경구제 지시");
  },
};
// The local DB browser harness supplies this endpoint; no demo fallback in app code.
export const ServerReadback: Story = {};
