import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { EmrSubpanel, EmrSubpanelBody } from "./subpanel";
import { PatientQueueContent } from "./patient-queue";
import type { PatientQueueRow } from "@/features/work-queue/patient-queue";
function row(n: number): PatientQueueRow {
  return { id: `synthetic-${n}`, workspaceId: "synthetic", patientId: `patient-${n}`, requestedAt: `2026-10-03T01:${String(n).padStart(2,"0")}:00Z`, status: "requested", priority: "normal", card: { patientName: `합성 환자 ${n}`, guardianName: "합성 보호자", receptionType: "외래", eventActorName: "합성 요청자", eventTime: "10:00", secondLineText: `합성 업무 ${n}`, actionAriaLabel: `합성 업무 ${n} 메뉴`, testId: `synthetic-card-${n}` } };
}
function ContinuityExample() {
  const [rows, setRows] = useState(() => Array.from({length: 20},(_,n) => row(n)));
  const [selectedId, setSelectedId] = useState("synthetic-10");
  const [readable, setReadable] = useState(true);
  const [filtered, setFiltered] = useState(false);
  return <div><div className="flex gap-2"><button onClick={() => setRows(current => [...current, row(21)])}>합성 새 업무</button><button onClick={() => setFiltered(true)}>합성 숨김</button><button onClick={() => setReadable(false)}>합성 권한 회수</button></div><output data-testid="synthetic-selection">{selectedId}</output><div className="h-[380px]"><EmrSubpanel><EmrSubpanelBody density="queue"><PatientQueueContent active allRows={rows} rows={filtered ? rows.filter(row => row.id !== selectedId) : rows} selectedId={selectedId} groupSort="latest" orderSort="request" onSelect={setSelectedId} onClearConditions={() => setFiltered(false)} ready readable={readable}><div>기존 업무 보기</div></PatientQueueContent></EmrSubpanelBody></EmrSubpanel></div></div>;
}
const meta = { title: "Design System/EMR/PatientQueue", component: ContinuityExample, render: () => <ContinuityExample /> } satisfies Meta<typeof ContinuityExample>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Continuity: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(async () => expect(canvas.getByTestId("synthetic-card-10")).toBeVisible());
    const area = canvasElement.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]')!;
    const card = canvas.getByTestId("synthetic-card-10");
    card.scrollIntoView({block:"center"});
    area.dispatchEvent(new Event("scroll"));
    const top = card.getBoundingClientRect().top;
    await userEvent.click(canvas.getByRole("button", {name:"합성 새 업무"}));
    await waitFor(async () => expect(canvas.getByText("새 업무 1건 추가")).toBeVisible());
    await expect(Math.abs(card.getBoundingClientRect().top - top)).toBeLessThan(3);
    await expect(canvas.getByTestId("synthetic-selection")).toHaveTextContent("synthetic-10");
    await userEvent.click(canvas.getByRole("button", {name:"목록에서 보기"}));
    await waitFor(async () => expect(canvas.queryByText("새 업무 1건 추가")).not.toBeInTheDocument());
    await userEvent.click(canvas.getByRole("button", {name:"합성 숨김"}));
    await expect(canvas.getByRole("button", {name:"조건 해제하고 보기"})).toBeVisible();
    await userEvent.click(canvas.getByRole("button", {name:"조건 해제하고 보기"}));
    await waitFor(async () => expect(canvas.getByTestId("synthetic-card-10")).toBeVisible());
    await userEvent.click(canvas.getByRole("button", {name:"합성 권한 회수"}));
    await expect(canvas.queryByText("합성 환자 10")).not.toBeInTheDocument();
    await waitFor(async () => expect(canvas.getByText("업무 대기열을 볼 권한이 없습니다")).toBeVisible());
  },
};
