import { useMemo, useRef } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { ChartSearchWorkspace } from "./workspace";
import type { ChartSearchApi } from "./client";
import { exampleChart } from "./search.stories.fixture";

function WorkspaceExample({ fail = false, slow = false }: { fail?: boolean; slow?: boolean }) {
  const failed = useRef(false);
  const api = useMemo<ChartSearchApi>(() => {
    const rows = Array.from({ length: 61 }, (_, i) => exampleChart(`story-${i}`));
    const unavailable = async (): Promise<never> => { throw new Error("synthetic_read_only"); };
    return {
      search: async (input, signal) => {
        const offset = Number(input.cursor ?? 0);
        if (offset) {
          await new Promise(resolve => setTimeout(resolve, slow ? 1500 : 100));
          signal?.throwIfAborted();
          if (fail && !failed.current) { failed.current = true; throw new Error("request_failed"); }
        }
        return { items: rows.slice(offset, offset + 25), total: rows.length, doctors: [], nextCursor: offset + 25 < rows.length ? String(offset + 25) : null };
      },
      patientCharts: async () => ({ items: [], nextCursor: null }),
      history: async () => [], visits: async () => [], pending: async () => null,
      apply: unavailable, park: unavailable, discard: unavailable, exportSummaries: unavailable,
    };
  }, [fail, slow]);
  return <div style={{ height: 800 }}><ChartSearchWorkspace entry={{ workspaceId: "synthetic-story" }} api={api} independent onClose={() => {}} /></div>;
}
const meta = { title: "Features/Chart/차트 상세 검색/자동 추가 로딩", component: WorkspaceExample, parameters: { layout: "fullscreen" } } satisfies Meta<typeof WorkspaceExample>;
export default meta;
type Story = StoryObj<typeof meta>;
const count = (root: HTMLElement) => root.querySelectorAll("[data-chart-id]").length;
async function scrollBottom(root: HTMLElement) {
  await waitFor(() => expect(count(root)).toBe(25));
  const viewport = root.querySelector('[data-slot="scroll-area-viewport"]')!;
  viewport.scrollTop = viewport.scrollHeight;
}
export const Loading: Story = {
  args: { slow: true },
  play: async ({ canvasElement }) => {
    await scrollBottom(canvasElement);
    await expect(await within(canvasElement).findByText("차트 불러오는 중")).toBeVisible();
    await waitFor(() => expect(count(canvasElement)).toBe(50), { timeout: 4000 });
  },
};
export const FailureAndRetry: Story = {
  args: { fail: true },
  play: async ({ canvasElement }) => {
    await scrollBottom(canvasElement);
    const canvas = within(canvasElement);
    const retry = await canvas.findByRole("button", { name: "다시 시도" });
    await expect(count(canvasElement)).toBe(25);
    await expect(canvas.getByRole("alert")).toBeVisible();
    await userEvent.click(retry);
    await waitFor(() => expect(count(canvasElement)).toBe(50));
    await expect(canvas.queryByRole("alert")).not.toBeInTheDocument();
  },
};
