import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { EmrTaskQueueCard, type EmrTaskQueueCardItem } from "./task-queue-card";
type Args = { selected: boolean };
const baseItem: EmrTaskQueueCardItem = {
  actionAriaLabel: "샘플 작업 더보기", assigneeName: "샘플 담당", eventActorName: "샘플 요청자", eventKind: "request", eventTime: "10:30", guardianName: "샘플 보호자", patientName: "샘플 환자", receptionType: "예약", secondLineBadgeLabel: "조제", secondLineText: "합성 오더 항목",
};
function TaskCardExample({ selected }: Args) {
  const [selection, setSelection] = useState(selected), [action, setAction] = useState("");
  return <div className="w-[288px] rounded-lg bg-[var(--emr-surface-sidepanel)] p-3">
    <EmrTaskQueueCard selected={selection} onSelect={() => setSelection(true)} item={{ ...baseItem, actionItems: [
      { key: "open", label: "샘플 열기", onSelect: () => setAction("샘플 열기") }, { key: "assign", label: "담당 확인", onSelect: () => setAction("담당 확인") },
    ] }} />
    <output role="status">{selection ? "항목 선택됨" : "미선택"}{action ? ` · ${action}` : ""}</output>
  </div>;
}
function MenuOnlyExample() {
  const [action, setAction] = useState(false);
  return <div className="w-[288px] p-3"><EmrTaskQueueCard selected={false} item={{
    patientName: "합성 환자", guardianName: "합성 보호자", receptionType: "외래", secondLineText: "CBC 검사", assigneeName: "합성 담당자", eventActorName: "", eventTime: "", eventText: "20분 경과", actionAriaLabel: "합성 환자 업무 메뉴", actionItems: [{ key: "open", label: "임상병리 화면으로 이동", onSelect: () => setAction(true) }], testId: "menu-only-card",
  }} />{action ? <p role="status">임상병리 화면으로 이동 요청됨</p> : null}</div>;
}
function PatientViewExample({ urgent = false }: { urgent?: boolean }) {
  const [selection, setSelection] = useState(""), [action, setAction] = useState("");
  const firstId = urgent ? "urgent-patient-view-card" : "patient-view-card";
  return <div className="flex w-[232px] flex-col gap-1">
    <EmrTaskQueueCard selected={selection === firstId} onSelect={() => setSelection(firstId)} patientView={{ statusLabel: "대기", urgent }} item={{
      patientName: "합성 환자", guardianName: "합성 보호자", receptionType: "외래", eventActorName: "합성 요청자", eventTime: urgent ? "10:30" : "13:15", eventKind: urgent ? "reRequest" : "request", secondLineBadgeLabel: urgent ? "영상" : "혈청화학 칼슘 검사", secondLineText: urgent ? "합성 흉부 검사" : "혈청화학 칼슘 검사", actionAriaLabel: "환자별 업무 메뉴", actionItems: [{ key: "open", label: "업무 상세 확인", onSelect: () => setAction("업무 상세 확인") }], testId: firstId,
    }} />
    {!urgent ? <EmrTaskQueueCard selected={selection === "patient-imaging-card"} onSelect={() => setSelection("patient-imaging-card")} patientView={{ statusLabel: "진행중", urgent: false }} item={{
      patientName: "합성 환자", guardianName: "합성 보호자", receptionType: "외래", eventActorName: "합성 긴 요청자 이름", assigneeName: "합성 긴 담당자 이름", eventTime: "13:00", secondLineBadgeLabel: "X-ray", secondLineText: "흉부 방사선 검사", actionAriaLabel: "영상 업무 메뉴", actionItems: [{ key: "open", label: "영상 업무 확인", onSelect: () => setAction("영상 업무 확인") }], testId: "patient-imaging-card",
    }} /> : null}
    <output role="status">{selection ? "환자 업무 선택됨" : "미선택"}{action ? ` · ${action}` : ""}</output>
  </div>;
}
function EventMetadataExample() {
  const [action, setAction] = useState("");
  return <div className="grid w-[288px] gap-2">
    {(["request", "reRequest", "cancel"] as const).map(eventKind => <EmrTaskQueueCard key={eventKind} selected={false} item={{
      patientName: "합성 환자", guardianName: "합성 보호자", receptionType: "외래", eventActorName: "합성 요청자", eventTime: "10:30", eventKind, secondLineText: "합성 업무", actionAriaLabel: `합성 ${eventKind} 업무 메뉴`, actionItems: [{ key: "open", label: `${eventKind} 업무 확인`, onSelect: () => setAction(eventKind) }],
    }} />)}
    <EmrTaskQueueCard selected={false} item={{ patientName: "합성 환자", guardianName: "합성 보호자", receptionType: "예약", eventActorName: "합성 요청자", eventTime: "10:30", eventText: "20분 경과", assigneeName: "합성 담당", secondLineText: "합성 업무", actionAriaLabel: "합성 경과 업무 메뉴", actionItems: [{ key: "open", label: "경과 업무 확인", onSelect: () => setAction("경과") }] }} />
    {action ? <p role="status">{action} 업무 확인됨</p> : null}
  </div>;
}
const meta = {
  title: "Design System/EMR/EmrTaskQueueCard", component: TaskCardExample, tags: ["autodocs"],
  args: { selected: true }, argTypes: { selected: { control: "boolean" } },
  parameters: { docs: { description: { component: "Actual EmrTaskQueueCard owns identity/badges/status normalization/menu geometry. Source-backed API and PatientQueueContent patientView compositions use synthetic fields and local selection/action receipts. Fixed variants disable inherited selected Controls. No server work status, provider or persistence change occurs." } } },
  render: args => <TaskCardExample key={String(args.selected)} {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement), card = canvas.getByRole("button", { name: /샘플 환자/ });
    card.focus(); await userEvent.keyboard(" "); await expect(card).toHaveAttribute("aria-pressed", "true");
    await userEvent.hover(card); await userEvent.click(canvas.getByRole("button", { name: "샘플 작업 더보기" }));
    const menuItem = await within(canvasElement.ownerDocument.body).findByRole("menuitem", { name: "샘플 열기" });
    await waitFor(() => expect(menuItem).toBeVisible()); await userEvent.click(menuItem);
    await expect(canvas.getByRole("status")).toHaveTextContent("항목 선택됨 · 샘플 열기");
  },
} satisfies Meta<Args>;
export default meta;
type Story = StoryObj<typeof meta>;
const fixedControls = { selected: { control: false, table: { disable: true } } } as const;
export const Selected: Story = {};
export const Unselected: Story = { args: { selected: false } };
export const MenuOnly: Story = {
  argTypes: fixedControls, render: () => <MenuOnlyExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement), card = canvas.getByTestId("menu-only-card");
    await expect(card).not.toHaveAttribute("role", "button"); await userEvent.hover(card);
    await userEvent.click(canvas.getByRole("button", { name: "합성 환자 업무 메뉴" }));
    const menuItem = await within(canvasElement.ownerDocument.body).findByRole("menuitem", { name: "임상병리 화면으로 이동" });
    await waitFor(() => expect(menuItem).toBeVisible()); await userEvent.click(menuItem);
    await expect(canvas.getByRole("status")).toHaveTextContent("임상병리 화면으로 이동 요청됨");
  },
};
const patientPlay = (urgent: boolean): Story["play"] => async ({ canvasElement }) => {
  const canvas = within(canvasElement), card = canvas.getByTestId(urgent ? "urgent-patient-view-card" : "patient-view-card");
  await expect(within(card).getByLabelText("담당 미지정")).toBeVisible(); await expect(card).toHaveTextContent("대기중");
  if (urgent) { await expect(card).toHaveTextContent("긴급"); await expect(card).toHaveTextContent("재요청"); }
  else { await expect(within(card).getAllByText("혈청화학 칼슘 검사")).toHaveLength(1); await expect(canvas.getByText("X-ray")).toBeVisible(); }
  await userEvent.hover(card); await userEvent.click(canvas.getByRole("button", { name: "환자별 업무 메뉴" }));
  await expect(card).toHaveAttribute("aria-pressed", "false");
  const menuItem = await within(canvasElement.ownerDocument.body).findByRole("menuitem", { name: "업무 상세 확인" });
  await waitFor(() => expect(menuItem).toBeVisible()); await userEvent.click(menuItem);
  await expect(card).toHaveAttribute("aria-pressed", "false"); await expect(canvas.getByRole("status")).toHaveTextContent("미선택 · 업무 상세 확인");
  card.focus(); await userEvent.keyboard("{Enter}"); await expect(card).toHaveAttribute("aria-pressed", "true");
  await expect(canvas.getByRole("status")).toHaveTextContent("환자 업무 선택됨 · 업무 상세 확인");
};
export const PatientView: Story = { argTypes: fixedControls, render: () => <PatientViewExample />, play: patientPlay(false) };
export const UrgentPatientView: Story = { argTypes: fixedControls, render: () => <PatientViewExample urgent />, play: patientPlay(true) };
export const EventMetadata: Story = {
  argTypes: fixedControls, render: () => <EventMetadataExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement); await expect(canvas.getByText("20분 경과")).toBeVisible();
    for (const kind of ["request", "reRequest", "cancel"]) {
      await userEvent.click(canvas.getByRole("button", { name: `합성 ${kind} 업무 메뉴` }));
      const item = await within(canvasElement.ownerDocument.body).findByRole("menuitem", { name: `${kind} 업무 확인` });
      await waitFor(() => expect(item).toBeVisible()); await userEvent.click(item);
      await expect(canvas.getByRole("status")).toHaveTextContent(`${kind} 업무 확인됨`);
    }
  },
};
