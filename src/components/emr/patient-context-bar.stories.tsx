import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor } from "storybook/test";

import { EmrMainContentHeader } from "./main-content-header";
import {
  EmrPatientContextBar,
  EmrPatientContextPatientSection,
} from "./patient-context-bar";

type ContextArgs = {
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
}: ContextArgs) {
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

const meta = {
  title: "Design System/EMR/EmrPatientContextBar",
  component: PatientContextExample,
  tags: ["autodocs"],
  args: {
    scenario: "billing",
    narrow: false,
    onGuardianActivate: fn(),
    onFirstPatientActivate: fn(),
    onSecondPatientActivate: fn(),
  },
  argTypes: {
    scenario: { control: false },
    onGuardianActivate: { control: false },
    onFirstPatientActivate: { control: false },
    onSecondPatientActivate: { control: false },
  },
  parameters: {
    docs: {
      description: {
        component: "공유 환자바의 보호자 우선 순서, 환자별 프로필 동작, 수납 요약 경고 색과 가로 스크롤을 합성 값으로 검증합니다. 데이터 조회·저장·결제는 실행하지 않습니다. 기본 환자 우선 순서는 유지합니다.",
      },
    },
  },
} satisfies Meta<typeof PatientContextExample>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BillingGuardianFirst: Story = {
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

export const LoadingToReady: Story = {
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
