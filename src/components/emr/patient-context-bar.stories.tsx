import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { ChartPatientContextBar } from "@/features/chart/components/chart-figma-workspace";
import { ChartProfilePreviewCard } from "@/features/chart/components/chart-profile-preview-card";
import { formatPatientVitalDisplayItemsForSettings } from "@/features/patient-vitals/patient-vital-types";
import { createDefaultWorkspaceVitalSettingsSnapshot } from "@/features/patient-vitals/workspace-vital-settings";
import { EmrMainContentHeader } from "./main-content-header";
import { EmrPatientContextBar, EmrPatientContextPatientSection } from "./patient-context-bar";

type ChartContextArgs = {
  vitalState: "editable" | "encounter-inactive" | "historical";
  narrow: boolean;
  guardianMissing: boolean;
  longPatientName: boolean;
  emptyMemos: boolean;
};

type BillingContextArgs = {
  scenario: "billing" | "content-growth" | "patient-first";
  narrow: boolean;
  onGuardianActivate: () => void;
  onFirstPatientActivate: () => void;
  onSecondPatientActivate: () => void;
};

function PatientContextExample({
  scenario,
  narrow,
  onGuardianActivate,
  onFirstPatientActivate,
  onSecondPatientActivate,
}: BillingContextArgs) {
  const [contentExpanded, setContentExpanded] = useState(false);
  const multiplePatients = scenario === "billing" || contentExpanded;
  const firstPatientInteraction = {
    ariaLabel: "합성 환자 하나 환자 프로필 열기",
    preview: <p>합성 환자 하나 미리보기</p>,
    onActivate: onFirstPatientActivate,
  };

  return (
    <div style={{ width: narrow ? 420 : 640, maxWidth: "100%" }}>
      <EmrMainContentHeader heightMode="fixed">
        <EmrPatientContextBar
          identityOrder={scenario === "patient-first" ? undefined : "guardian-first"}
          informationAriaLabel="보호자 수납 컨텍스트 정보"
          guardianInteraction={{
            ariaLabel: "합성 보호자 보호자 프로필 열기",
            preview: <p>합성 보호자 미리보기</p>,
            onActivate: onGuardianActivate,
          }}
          guardianItems={[
            { label: "보호자", value: "합성 보호자" },
            { label: "관계", value: "주 보호자" },
            { label: "연락처", value: "010-****-0000" },
          ]}
          patientInteraction={firstPatientInteraction}
          patientItems={[{ label: "환자", value: "합성 환자 하나" }]}
          patientSections={multiplePatients ? <>
            <EmrPatientContextPatientSection
              interaction={firstPatientInteraction}
              items={[{ label: "환자", value: "합성 환자 하나" }]}
            />
            <EmrPatientContextPatientSection
              interaction={{
                ariaLabel: "합성 환자 둘 환자 프로필 열기",
                preview: <p>합성 환자 둘 미리보기</p>,
                onActivate: onSecondPatientActivate,
              }}
              items={[{ label: "환자", value: "합성 환자 둘" }]}
            />
          </> : undefined}
          trailingItems={multiplePatients ? [
            { label: "최근 수납", value: "26.10.11 09:00" },
            { label: "수납대기", value: "2건 · 50,000원" },
            { label: "미납", value: "1건 · 20,000원", tone: "warning" },
            { label: "보호자 메모", value: "합성 미납 주의 메모", tone: "warning" },
          ] : []}
        />
      </EmrMainContentHeader>
      {scenario === "content-growth" ? (
        <button type="button" onClick={() => setContentExpanded(true)}>
          수납 데이터 업데이트
        </button>
      ) : null}
    </div>
  );
}

type ContextArgs = ChartContextArgs & BillingContextArgs;

const disabledReasons = {
  "encounter-inactive": "진료 중인 접수에서만 바이탈을 입력할 수 있어요.",
  historical: "과거 차트 보기에서는 바이탈을 수정할 수 없어요.",
};

// All variants follow ChartPatientHeader in chart/module.tsx. Only synthetic
// data and local activation receipts replace the app's data and navigation.
function ChartContextExample({ vitalState, narrow, guardianMissing, longPatientName, emptyMemos }: ContextArgs) {
  const [lastAction, setLastAction] = useState("없음");
  const patientNotes = emptyMemos ? [] : ["합성 환자 주의사항"];
  const patientName = longPatientName ? "합성 긴 환자 이름으로 가로 스크롤 확인" : "합성 환자";
  return (
    <div className="grid min-w-0 grid-cols-1 gap-3" style={{ width: narrow ? 420 : "100%", maxWidth: "100%" }}>
      <EmrMainContentHeader heightMode="fixed">
        <ChartPatientContextBar
          patientName={patientName}
          patientMeta="말티즈 · 중성화 수컷 · 3세"
          patientInteraction={{
            ariaLabel: `${patientName} 환자 프로필 열기`,
            onActivate: () => setLastAction("환자 프로필"),
            preview: <ChartProfilePreviewCard onOpenProfile={() => setLastAction("환자 프로필")} kind="patient" title={patientName} items={[
              { label: "환자번호", value: "SYN-001" },
              { label: "축종·품종", value: "개 · 말티즈" },
              { label: "나이", value: "3세" },
              { label: "성별", value: "중성화 수컷" },
            ]} notes={patientNotes} />,
          }}
          guardianName={guardianMissing ? "보호자 미지정" : "합성 보호자(주보호자)"}
          guardianPhone={guardianMissing ? "연락처 미입력" : "010-0000-0000"}
          guardianInteraction={guardianMissing ? undefined : {
            ariaLabel: "합성 보호자 보호자 프로필 열기",
            onActivate: () => setLastAction("보호자 프로필"),
            preview: <ChartProfilePreviewCard onOpenProfile={() => setLastAction("보호자 프로필")} kind="guardian" title="합성 보호자" items={[
              { label: "대표 연락처", value: "010-0000-0000" },
              { label: "이메일", value: "synthetic@example.invalid" },
              { label: "환자 관계", value: `${patientName}의 주보호자` },
            ]} />,
          }}
          vitalItems={formatPatientVitalDisplayItemsForSettings({
            weightKg: 5, temperatureC: 38.5, heartRateBpm: 100,
            respiratoryRateRpm: 24, bloodPressureSystolicMmhg: 120,
            bloodPressureDiastolicMmhg: 80,
          }, createDefaultWorkspaceVitalSettingsSnapshot())}
          vitalAction={{
            ariaLabel: "오늘 바이탈 수정",
            onActivate: () => setLastAction("바이탈 수정"),
            disabled: vitalState !== "editable",
            disabledReason: vitalState === "editable" ? undefined : disabledReasons[vitalState],
          }}
          doctorName="합성 수의사"
          memoItems={[
            { label: "방문목적", summary: emptyMemos ? "방문 목적 기록 없음" : "합성 정기 검진" },
            { label: "보호자메모", summary: emptyMemos || guardianMissing ? "보호자 메모 없음" : "합성 보호자 메모" },
            { label: "환자메모", summary: patientNotes.join(" · ") || "환자 특이 메모 없음" },
            { label: "수납메모", disabled: true, summary: "수납 화면 연동 후 사용할 수 있습니다." },
          ]}
        />
      </EmrMainContentHeader>
      <output aria-label="차트 구성 검증 결과">실행: {lastAction}</output>
    </div>
  );
}

async function verifyChartComposition(canvasElement: HTMLElement, args: ContextArgs) {
  const canvas = within(canvasElement);
  const header = canvasElement.querySelector('[data-slot="chart-patient-context-bar"]');
  await expect(header).toBeInTheDocument();
  for (const text of ["말티즈 · 중성화 수컷 · 3세", "합성 수의사", "체중", "체온", "심박수", "호흡", "혈압", "방문목적", "보호자메모", "환자메모", "수납메모"]) {
    await expect(header).toHaveTextContent(text);
  }
  await expect(header).toHaveTextContent(args.guardianMissing ? "보호자 미지정" : "합성 보호자(주보호자)");
  await expect(header).toHaveTextContent(args.guardianMissing ? "연락처 미입력" : "010-0000-0000");
  await expect(canvas.queryByRole("button", { name: "이력" })).not.toBeInTheDocument();
  await expect(canvas.queryByRole("button", { name: /장비결과/ })).not.toBeInTheDocument();
  await expect(canvas.getByRole("button", { name: "수납메모 메모 보기" })).toBeDisabled();
}

async function verifyMemoKeyboard(canvasElement: HTMLElement, args: ContextArgs) {
  await verifyChartComposition(canvasElement, args);
  const canvas = within(canvasElement);
  if (args.emptyMemos) {
    const patient = canvas.getByRole("button", { name: /환자 프로필 열기$/ });
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.hover(patient);
    await waitFor(() => expect(body.getByText("SYN-001")).toBeVisible());
    await expect(body.queryByText("합성 환자 주의사항")).not.toBeInTheDocument();
    await userEvent.unhover(patient);
    await waitFor(() => expect(body.queryByText("SYN-001")).not.toBeInTheDocument());
  }
  const trigger = canvas.getByRole("button", { name: "방문목적 메모 보기" });
  trigger.focus();
  await userEvent.keyboard("{Enter}");
  const doc = canvasElement.ownerDocument;
  await waitFor(() => expect(doc.querySelector('[data-slot="popover-content"][data-open]')).toBeInTheDocument());
  const popup = doc.querySelector<HTMLElement>('[data-slot="popover-content"][data-open]')!;
  const options = popup.querySelectorAll<HTMLButtonElement>('[data-slot="emr-popover-option"]');
  await expect(options).toHaveLength(4);
  for (const option of options) await expect(option).toBeDisabled();
  for (const text of args.emptyMemos
    ? ["방문 목적 기록 없음", "보호자 메모 없음", "환자 특이 메모 없음"]
    : ["합성 정기 검진", args.guardianMissing ? "보호자 메모 없음" : "합성 보호자 메모", "합성 환자 주의사항"]) {
    await expect(popup).toHaveTextContent(text);
  }
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(popup).not.toHaveAttribute("data-open"));
  // main's custom memo trigger does not forward its ref/ARIA props. This story
  // verifies open/close, not a repaired focus-return contract or memo editing.
  trigger.focus();
  await userEvent.keyboard(" ");
  await waitFor(() => expect(doc.querySelector('[data-slot="popover-content"][data-open]')).toBeInTheDocument());
  const close = within(doc.querySelector<HTMLElement>('[data-slot="popover-content"][data-open]')!).getByRole("button", { name: "닫기" });
  close.focus();
  await userEvent.keyboard("{Enter}");
  await waitFor(() => expect(doc.querySelector('[data-slot="popover-content"][data-open]')).not.toBeInTheDocument());
  await expect(canvas.getByLabelText("차트 구성 검증 결과")).toHaveTextContent("실행: 없음");
}

async function verifyNarrowScroll(canvasElement: HTMLElement, args: ContextArgs) {
  await verifyChartComposition(canvasElement, args);
  const canvas = within(canvasElement);
  const viewport = canvasElement.querySelector<HTMLElement>('[aria-label="환자 컨텍스트 정보"]')!;
  const start = canvas.getByRole("button", { name: "환자 정보 처음으로 이동" });
  const end = canvas.getByRole("button", { name: "환자 정보 끝으로 이동" });
  await expect(canvasElement.querySelector('[data-slot="patient-context-bar"]')!.getBoundingClientRect().width).toBeLessThanOrEqual(420);
  await expect(viewport.scrollWidth).toBeGreaterThan(viewport.clientWidth);
  await waitFor(() => expect(end).toBeEnabled());
  end.focus();
  await userEvent.keyboard("{Enter}");
  await waitFor(() => expect(end).toBeDisabled());
  await expect(Math.abs(viewport.scrollWidth - viewport.clientWidth - viewport.scrollLeft)).toBeLessThanOrEqual(2);
  await expect(start).toBeEnabled();
  const doctor = canvas.getByText("합성 수의사").getBoundingClientRect();
  const bounds = viewport.getBoundingClientRect();
  await expect(doctor.left).toBeGreaterThanOrEqual(bounds.left);
  await expect(doctor.right).toBeLessThanOrEqual(bounds.right);
  start.focus();
  await userEvent.keyboard(" ");
  await waitFor(() => expect(start).toBeDisabled());
  await expect(viewport.scrollLeft).toBeLessThanOrEqual(2);
  await expect(end).toBeEnabled();
}

async function verifyUnavailable(canvasElement: HTMLElement, args: ContextArgs) {
  await verifyChartComposition(canvasElement, args);
  const canvas = within(canvasElement);
  const button = canvas.getByRole("button", { name: "오늘 바이탈 수정" });
  await expect(button).toHaveAttribute("aria-disabled", "true");
  await expect(button).toHaveAccessibleDescription(disabledReasons[args.vitalState as keyof typeof disabledReasons]);
  button.focus();
  await userEvent.keyboard("{Enter}");
  await userEvent.keyboard(" ");
  await userEvent.click(button);
  await expect(canvas.getByLabelText("차트 구성 검증 결과")).toHaveTextContent("실행: 없음");
}

const meta = {
  title: "Design System/EMR/EmrPatientContextBar",
  component: ChartContextExample,
  tags: ["autodocs"],
  parameters: { docs: { description: { component: "차트 예시는 실제 ChartPatientHeader 구성을 따릅니다. 수납 예시는 보호자 우선 순서·환자별 활성화·콘텐츠 증가와 기본 환자 우선 호환성을 별도로 검증합니다. 실제 ChartPatientContextBar·EmrMainContentHeader·프로필 미리보기·기본 바이탈 포맷터를 재사용합니다. 환자·보호자·바이탈 5종·메모 4종·주치의 순서를 유지하며 이력·장비결과 버튼을 추가하지 않습니다. 메모는 앱처럼 조회 전용이고 수납메모는 비활성입니다. Controls는 아래 합성 차트 시나리오만 바꾸는 Storybook 전용 설정이며 runtime props가 아닙니다. 프로필·바이탈 활성화는 로컬 결과만 남기고 실제 편집·저장·권한·원격 데이터를 실행하지 않습니다. 기존 앱의 메모 trigger ARIA/ref 누락은 유지되므로 접근성 전체 해결을 의미하지 않습니다." } } },
  args: { vitalState: "editable", narrow: false, guardianMissing: false, longPatientName: false, emptyMemos: false, scenario: "billing", onGuardianActivate: fn(), onFirstPatientActivate: fn(), onSecondPatientActivate: fn() },
  argTypes: {
    scenario: { control: false },
    onGuardianActivate: { control: false },
    onFirstPatientActivate: { control: false },
    onSecondPatientActivate: { control: false },
    vitalState: { control: "select", options: ["editable", "encounter-inactive", "historical"], description: "바이탈 수정 가능 / 진료 중이 아닌 접수 / 과거 차트 조회 상태와 실제 비활성 사유를 표시합니다." },
    narrow: { control: "boolean", description: "같은 차트 구성을 최대 420px 폭으로 표시하고 가로 스크롤을 확인합니다." },
    guardianMissing: { control: "boolean", description: "앱의 보호자 미지정·연락처 미입력 표시를 사용하고 보호자 프로필 버튼을 제거합니다." },
    longPatientName: { control: "boolean", description: "환자 이름만 긴 합성 이름으로 바꿉니다. 나머지 차트 정보는 유지합니다." },
    emptyMemos: { control: "boolean", description: "방문목적·보호자·환자 메모가 없는 경우의 실제 앱 안내를 표시합니다." },
  },
  render: (args) => <ChartContextExample {...args} />,
  play: async ({ canvasElement, args }) => verifyChartComposition(canvasElement, args),
} satisfies Meta<ContextArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ChartComposition: Story = {
  parameters: { docs: { description: { story: "실제 차트 기본 구성입니다. 메모의 Enter/Space 열기, Escape/닫기 버튼으로 닫기와 조회 전용 내용을 검사합니다." } } },
  play: async ({ canvasElement, args }) => verifyMemoKeyboard(canvasElement, args),
};

export const ChartReadOnly: Story = {
  args: { vitalState: "historical" },
  parameters: { docs: { description: { story: "과거 차트 조회의 바이탈 비활성 사유를 표시합니다. 프로필 조회와 차트 정보는 유지하며, 바이탈 클릭·Enter·Space는 작업을 실행하지 않습니다." } } },
  play: async ({ canvasElement, args }) => verifyUnavailable(canvasElement, args),
};

export const ChartNarrow: Story = {
  args: { narrow: true },
  parameters: { docs: { description: { story: "실제 차트 구성의 420px 예시입니다. 끝까지 이동하면 주치의가 보이고, 처음으로 돌아오면 스크롤 버튼의 상태가 바뀌는지 키보드로 검사합니다." } } },
  play: async ({ canvasElement, args }) => verifyNarrowScroll(canvasElement, args),
};

export const Callbacks: Story = {
  parameters: { docs: { description: { story: "실제 차트의 환자·보호자 카드 hover 미리보기와 로컬 활성화 콜백을 검사합니다. Tab 순서, Enter/Space 실행, hover만으로 콜백이 실행되지 않는 경계를 확인합니다." } } },
  play: async ({ canvasElement, args }) => {
    await verifyChartComposition(canvasElement, args);
    const canvas = within(canvasElement);
    const patient = canvas.getByRole("button", { name: /환자 프로필 열기$/ });
    const guardian = canvas.getByRole("button", { name: "합성 보호자 보호자 프로필 열기" });
    const output = canvas.getByLabelText("차트 구성 검증 결과");
    const body = within(canvasElement.ownerDocument.body);
    for (const [button, detail] of [[patient, "SYN-001"], [guardian, "synthetic@example.invalid"]] as const) {
      await userEvent.hover(button);
      await waitFor(() => expect(body.getByText(detail)).toBeVisible());
      await expect(output).toHaveTextContent("실행: 없음");
      await userEvent.unhover(button);
      await waitFor(() => expect(body.queryByText(detail)).not.toBeInTheDocument());
    }
    patient.focus();
    await userEvent.keyboard("{Enter}");
    await expect(output).toHaveTextContent("실행: 환자 프로필");
    await userEvent.tab();
    await expect(guardian).toHaveFocus();
    await userEvent.keyboard(" ");
    await expect(output).toHaveTextContent("실행: 보호자 프로필");
    await userEvent.tab();
    const vital = canvas.getByRole("button", { name: "오늘 바이탈 수정" });
    await expect(vital).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(output).toHaveTextContent("실행: 바이탈 수정");
    await userEvent.tab();
    await expect(canvas.getByRole("button", { name: "방문목적 메모 보기" })).toHaveFocus();
    await userEvent.tab({ shift: true });
    await expect(vital).toHaveFocus();
  },
};

export const UnavailableActions: Story = {
  args: { vitalState: "encounter-inactive" },
  parameters: { docs: { description: { story: "진료 중이 아닌 접수에서 바이탈만 비활성화한 실제 차트 구성입니다. 합성 장비결과 버튼이나 잠김 메모를 추가하지 않습니다." } } },
  play: async ({ canvasElement, args }) => verifyUnavailable(canvasElement, args),
};

export const MemoStates: Story = {
  args: { emptyMemos: true },
  parameters: { docs: { description: { story: "메모가 비어 있는 실제 차트 상태입니다. 앱의 기록 없음 문구와 메모 4종의 조회/비활성 상태를 유지합니다. 편집용 콜백은 추가하지 않습니다." } } },
  play: async ({ canvasElement, args }) => verifyMemoKeyboard(canvasElement, args),
};

export const NarrowOverflow: Story = {
  args: { narrow: true, longPatientName: true },
  parameters: { docs: { description: { story: "긴 환자 이름을 가진 실제 차트의 420px 예시입니다. 내부 바가 부모 폭을 넘지 않으며 키보드 끝/처음 이동과 주치의 노출을 검사합니다." } } },
  play: async ({ canvasElement, args }) => verifyNarrowScroll(canvasElement, args),
};

export const PatientOnly: Story = {
  args: { guardianMissing: true },
  parameters: { docs: { description: { story: "기존 story ID를 유지한 보호자 미지정 차트입니다. 앱처럼 보호자 미지정·연락처 미입력을 표시하고 보호자 프로필 동작만 제거합니다. 바이탈·메모·주치의는 생략하지 않습니다." } } },
  play: async ({ canvasElement, args }) => {
    await verifyChartComposition(canvasElement, args);
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("button", { name: /보호자 프로필 열기$/ })).not.toBeInTheDocument();
    canvas.getByRole("button", { name: /환자 프로필 열기$/ }).focus();
    await userEvent.tab();
    await expect(canvas.getByRole("button", { name: "오늘 바이탈 수정" })).toHaveFocus();
  },
};

const billingArgTypes = {
  vitalState: { control: false, table: { disable: true } },
  guardianMissing: { control: false, table: { disable: true } },
  longPatientName: { control: false, table: { disable: true } },
  emptyMemos: { control: false, table: { disable: true } },
  narrow: { control: "boolean", description: "수납 컨텍스트를 최대 420px 폭으로 표시합니다." },
} satisfies Story["argTypes"];

export const BillingGuardianFirst: Story = {
  argTypes: billingArgTypes,
  render: (args) => <PatientContextExample {...args} />,
  play: async ({ canvas, canvasElement, args }) => {
    const identities = canvasElement.querySelectorAll('[data-slot="patient-context-guardian"], [data-slot="patient-context-patient"]');
    await expect(identities).toHaveLength(3);
    await expect(identities[0]).toHaveTextContent("합성 보호자");
    await expect(identities[1]).toHaveTextContent("합성 환자 하나");
    await expect(identities[2]).toHaveTextContent("합성 환자 둘");
    for (const identity of identities) {
      await expect(identity.querySelector('[data-slot="badge"]')).not.toBeInTheDocument();
    }
    await expect(canvas.getByText("010-****-0000")).toBeInTheDocument();
    const guardian = canvas.getByRole("button", { name: "합성 보호자 보호자 프로필 열기" });
    guardian.focus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onGuardianActivate).toHaveBeenCalledOnce();
    const firstPatient = canvas.getByRole("button", { name: "합성 환자 하나 환자 프로필 열기" });
    firstPatient.focus();
    await userEvent.keyboard(" ");
    await expect(args.onFirstPatientActivate).toHaveBeenCalledOnce();
    await expect(args.onSecondPatientActivate).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole("button", { name: "합성 환자 둘 환자 프로필 열기" }));
    await expect(args.onSecondPatientActivate).toHaveBeenCalledOnce();
  },
};

export const BillingNarrowOverflow: Story = {
  argTypes: billingArgTypes,
  render: (args) => <PatientContextExample {...args} />,
  args: { narrow: true },
  play: async ({ canvas, canvasElement }) => {
    const viewport = canvas.getByLabelText("보호자 수납 컨텍스트 정보");
    const start = canvas.getByRole("button", { name: "환자 정보 처음으로 이동" });
    const end = canvas.getByRole("button", { name: "환자 정보 끝으로 이동" });
    await waitFor(() => expect(end).toBeEnabled());
    await expect(viewport.scrollWidth).toBeGreaterThan(viewport.clientWidth);
    await expect(canvasElement.querySelector('[data-slot="patient-context-bar"]')!.getBoundingClientRect().height).toBe(56);
    const controlsLeft = end.getBoundingClientRect().left;
    await userEvent.click(end);
    await waitFor(() => expect(end).toBeDisabled());
    await expect(start).toBeEnabled();
    await expect(end.getBoundingClientRect().left).toBe(controlsLeft);
    start.focus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(start).toBeDisabled());
    await expect(viewport.scrollLeft).toBeLessThanOrEqual(2);
  },
};

export const ContentGrowthUpdatesOverflow: Story = {
  argTypes: billingArgTypes,
  render: (args) => <PatientContextExample {...args} />,
  args: { scenario: "content-growth" },
  play: async ({ canvas }) => {
    const viewport = canvas.getByLabelText("보호자 수납 컨텍스트 정보");
    const end = canvas.getByRole("button", { name: "환자 정보 끝으로 이동" });
    await expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth);
    await expect(end).toBeDisabled();
    const initialWidth = viewport.clientWidth;
    await userEvent.click(canvas.getByRole("button", { name: "수납 데이터 업데이트" }));
    await expect(canvas.getByText("1건 · 20,000원")).toBeInTheDocument();
    await expect(viewport.clientWidth).toBe(initialWidth);
    await waitFor(() => expect(end).toBeEnabled());
    await userEvent.click(end);
    await waitFor(() => expect(end).toBeDisabled());
  },
};

export const PatientFirstCompatibility: Story = {
  argTypes: billingArgTypes,
  render: (args) => <PatientContextExample {...args} />,
  args: { scenario: "patient-first" },
  play: async ({ canvasElement }) => {
    const identities = canvasElement.querySelectorAll('[data-slot="patient-context-guardian"], [data-slot="patient-context-patient"]');
    await expect(identities).toHaveLength(2);
    await expect(identities[0]).toHaveAttribute("data-slot", "patient-context-patient");
    await expect(identities[1]).toHaveAttribute("data-slot", "patient-context-guardian");
  },
};


function LoadingContextExample(args: ContextArgs) {
  const [identityReady, setIdentityReady] = useState(false);
  const [memoReady, setMemoReady] = useState(false);
  return (
    <div style={{ width: 1000, maxWidth: "100%" }}>
      <EmrMainContentHeader heightMode="fixed">
        <EmrPatientContextBar
          identityOrder={args.scenario === "billing" ? "guardian-first" : "patient-first"}
          patientItems={[
            { label: "환자", value: "합성 환자" },
            { label: "품종", value: "푸들" },
            { label: "성별", value: "중성화·수컷" },
            { label: "나이", value: "4세" },
          ].map((item) => ({ ...item, loading: !identityReady }))}
          guardianItems={[
            { label: "보호자", value: "합성 보호자" },
            { label: "연락처", value: "010-****-0000" },
          ].map((item) => ({ ...item, loading: !identityReady }))}
          patientInteraction={{ ariaLabel: "합성 환자 프로필 열기", preview: <p>환자 미리보기</p>, onActivate: args.onFirstPatientActivate }}
          guardianInteraction={{ ariaLabel: "합성 보호자 프로필 열기", preview: <p>보호자 미리보기</p>, onActivate: args.onGuardianActivate }}
          vitalItems={[{ label: "체중", value: "5 kg", loading: !identityReady }]}
          memoActions={[{ label: "환자메모", summary: "합성 메모", loading: !memoReady }]}
        />
      </EmrMainContentHeader>
      <button onClick={() => setIdentityReady(true)}>환자 정보 도착</button>
      <button onClick={() => setMemoReady(true)}>메모 도착</button>
    </div>
  );
}

const loadingArgTypes = {
  ...billingArgTypes,
  narrow: { control: false, table: { disable: true } },
} satisfies Story["argTypes"];

export const LoadingToReady: Story = {
  argTypes: loadingArgTypes,
  args: { scenario: "patient-first" },
  render: (args) => <LoadingContextExample {...args} />,
  play: async ({ canvas, canvasElement, args }) => {
    const bar = canvasElement.querySelector('[data-slot="patient-context-bar"]')!;
    const height = bar.getBoundingClientRect().height;
    await expect(bar.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(8);
    await expect(canvas.queryByRole("button", { name: "합성 환자 프로필 열기" })).not.toBeInTheDocument();
    await expect(canvas.queryByText("합성 환자", { exact: true })).not.toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "환자메모 메모 보기" })).toBeDisabled();
    await userEvent.click(canvas.getByRole("button", { name: "환자 정보 도착" }));
    await expect(canvas.getByText("합성 환자", { exact: true })).toBeVisible();
    await expect(bar.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(1);
    await expect(canvas.getByRole("button", { name: "환자메모 메모 보기" })).toBeDisabled();
    await userEvent.click(canvas.getByRole("button", { name: "메모 도착" }));
    await expect(bar.querySelector('[data-slot="skeleton"]')).not.toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "환자메모 메모 보기" })).toBeEnabled();
    await expect(bar.getBoundingClientRect().height).toBe(height);
    const patient = canvas.getByRole("button", { name: "합성 환자 프로필 열기" });
    patient.focus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onFirstPatientActivate).toHaveBeenCalledOnce();
  },
};

export const LoadingSkeleton: Story = {
  argTypes: loadingArgTypes,
  args: { scenario: "patient-first" },
  render: (args) => <LoadingContextExample {...args} />,
  play: async ({ canvasElement }) => {
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    await expect(skeletons).toHaveLength(8);
    for (const skeleton of skeletons) {
      await expect(skeleton).toHaveAttribute("aria-hidden", "true");
      await expect(skeleton).toHaveClass("motion-reduce:animate-none");
    }
  },
};

export const GuardianFirstLoading: Story = {
  ...LoadingToReady,
  args: { scenario: "billing" },
};
