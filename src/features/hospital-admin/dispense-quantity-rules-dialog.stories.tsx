import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { DispenseQuantityRulesDialog } from "./dispense-quantity-rules-dialog";
import { isDispenseRuleMutation, type DispenseRuleRead } from "./dispense-quantity-rule-contract";

type Scenario = "ready" | "readonly" | "empty" | "read-error" | "conflict";
function Example(_props: { scenario: Scenario }) {
  void _props;
  const [open, setOpen] = useState(true);
  return <DispenseQuantityRulesDialog workspaceId="synthetic-rules" initialSelection={[]} open={open} onOpenChange={setOpen} />;
}
const meta = {
  title: "Features/Hospital Admin/Dispense Quantity Rules",
  component: Example, tags: ["autodocs"], args: { scenario: "ready" as Scenario },
  argTypes: { scenario: { control: false } },
  parameters: { docs: { story: { inline: false, height: "760px" }, description: { component: "병원 오더 관리에서 사용하는 실제 규칙 편집창입니다. 병원 공통 규칙과 약품 예외의 화면 상태를 합성 API로 확인합니다. DB 권한·실제 저장·환자 오더 계산은 이 스토리의 검증 범위가 아닙니다." } } },
  beforeEach: ({ args }) => {
    const original = globalThis.fetch;
    let readFailed = false;
    let settings: DispenseRuleRead = { revision: 0, defaultRules: {}, productRules: {}, canManage: args.scenario !== "readonly", products: args.scenario === "empty" ? [] : [{ catalogItemId: "synthetic-preset", productKey: "synthetic-product", name: "합성 약품 A", unit: "tablet" }] };
    globalThis.fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
      if (!url.pathname.startsWith("/api/")) return original(input, init);
      if (url.pathname !== "/api/workspaces/synthetic-rules/hospital-admin/dispense-quantity-rules") throw new Error(`Unexpected API ${url.pathname}`);
      if (!init?.method || init.method === "GET") {
        if (args.scenario === "read-error" && !readFailed) { readFailed = true; return Response.json({ ok: false }, { status: 503 }); }
        return Response.json({ ok: true, settings });
      }
      const command: unknown = JSON.parse(String(init.body));
      if (!isDispenseRuleMutation(command)) throw new Error("Invalid rule mutation");
      if (args.scenario === "conflict") return Response.json({ ok: false }, { status: 409 });
      settings = { ...settings, revision: settings.revision + 1, defaultRules: command.rule ? { [command.unit]: command.rule } : {} };
      return Response.json({ ok: true, settings });
    };
    return () => { globalThis.fetch = original; };
  },
} satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
export const SaveDefault: Story = {
  parameters: { docs: { description: { story: "기본값을 저장하고 저장 완료 상태와 적용 출처를 확인합니다." } } },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const save = await body.findByRole("button", { name: "공통 규칙 저장" });
    await waitFor(() => expect(save).toBeEnabled());
    await userEvent.click(save);
    await expect(await body.findByText("저장 완료")).toBeVisible();
    await expect(body.getByText("병원 기본값 · 이론값 유지")).toBeVisible();
  },
};
export const ReadOnly: Story = { args: { scenario: "readonly" }, parameters: { docs: { description: { story: "조회 권한만 있으면 규칙 입력과 저장을 비활성화합니다." } } }, play: async ({ canvasElement }) => { const body = within(canvasElement.ownerDocument.body); await body.findByText("합성 약품 A"); await expect(body.getByRole("button", { name: "공통 규칙 저장" })).toBeDisabled(); } };
export const Empty: Story = { args: { scenario: "empty" }, parameters: { docs: { description: { story: "등록 약품이 없으면 빈 상태를 표시합니다." } } }, play: async ({ canvasElement }) => { const body = within(canvasElement.ownerDocument.body); await waitFor(() => expect(body.getByText("등록된 조제 약품이 없습니다.")).toBeVisible()); } };
export const ReadErrorRetry: Story = { args: { scenario: "read-error" }, parameters: { docs: { description: { story: "조회 실패 후 다시 불러오기로 복구합니다." } } }, play: async ({ canvasElement }) => { const body = within(canvasElement.ownerDocument.body); await expect(await body.findByRole("alert")).toHaveTextContent("규칙을 불러오지 못했습니다."); await userEvent.click(body.getByRole("button", { name: "다시 불러오기" })); await waitFor(() => expect(body.getByText("합성 약품 A")).toBeVisible()); } };
export const Conflict: Story = { args: { scenario: "conflict" }, parameters: { docs: { description: { story: "버전 충돌이 나면 다시 불러오기 전까지 저장을 차단합니다." } } }, play: async ({ canvasElement }) => { const body = within(canvasElement.ownerDocument.body); const save = await body.findByRole("button", { name: "공통 규칙 저장" }); await waitFor(() => expect(save).toBeEnabled()); await userEvent.click(save); await expect(await body.findByRole("alert")).toHaveTextContent("다른 사용자가 규칙을 변경했습니다."); await expect(save).toBeDisabled(); } };
