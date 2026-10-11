import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  EmrProfileIdentity,
  EmrProfilePanel,
  EmrProfilePanelBody,
  EmrProfilePanelState,
  EmrProfileTabPanel,
} from "./profile-panel";

type SpecimenProps = {
  kind: "patient" | "guardian" | "user";
  state: "ready" | "loading" | "error" | "denied";
  longContent?: boolean;
};

function Specimen({ kind, state, longContent }: SpecimenProps) {
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState("profile");
  const [effectiveState, setEffectiveState] = useState(state);
  const label = { patient: "환자", guardian: "보호자", user: "유저" }[kind];
  return (
    <div className="flex items-start gap-4">
      <Button onClick={() => setOpen(true)}>프로필 열기</Button>
      {open ? (
        <EmrProfilePanel
          aria-label={`${label} 프로필 예시`}
          className="h-[650px] w-[380px] rounded-xl border"
          closeLabel="프로필 닫기"
          loading={effectiveState === "loading"}
          onClose={() => setOpen(false)}
          onTabChange={setTab}
          tabs={[
            { value: "profile", label: "정보" },
            {
              value: "disabled",
              label: "예약",
              disabledReason: "예약 조회 권한이 필요합니다",
            },
            { value: "activity", label: "활동" },
          ]}
          tabsLabel="프로필 탭"
          value={tab}
          identity={
            <EmrProfileIdentity
              avatar={
                <Avatar roundness="roundrect" className="size-full">
                  <AvatarFallback>예시</AvatarFallback>
                </Avatar>
              }
              name={`합성 ${label}`}
              badge={<Badge size="sm">{label}</Badge>}
              description="프로필별 데이터 설명"
              detail="추가 정보"
            />
          }
        >
          <EmrProfileTabPanel value={tab}>
            <EmrProfilePanelBody className="p-4">
              {effectiveState === "ready" ? (
                <div className="grid gap-4">
                  <label className="grid gap-2">
                    예시 편집기
                    <input
                      className="w-full rounded border p-2"
                      onKeyDown={(event) => {
                        if (event.key === "Escape") event.preventDefault();
                      }}
                    />
                  </label>
                  {Array.from({ length: longContent ? 40 : 1 }, (_, index) => (
                    <p key={index}>합성 프로필 내용 {index + 1}</p>
                  ))}
                </div>
              ) : (
                <EmrProfilePanelState
                  state={effectiveState}
                  label={
                    effectiveState === "loading"
                      ? "프로필을 불러오는 중입니다"
                      : effectiveState === "denied"
                        ? "프로필 조회 권한이 없습니다"
                        : "프로필을 불러오지 못했어요"
                  }
                  onRetry={() => setEffectiveState("ready")}
                />
              )}
            </EmrProfilePanelBody>
          </EmrProfileTabPanel>
        </EmrProfilePanel>
      ) : null}
    </div>
  );
}

const meta = {
  title: "Design System/EMR/Profile Panel",
  component: Specimen,
  tags: ["autodocs"],
  args: { kind: "patient", state: "ready" },
  render: (args) => <Specimen key={`${args.kind}:${args.state}:${args.longContent}`} {...args} />,
  parameters: {
    docs: {
      story: { inline: false, height: "740px" },
      description: {
        component:
          "역할: 프로필의 공통 틀·탭·상태 표시. 소유자: 공통 EMR UI. 환자·보호자 프로필과 직원 프로필이 사용합니다. 기능이 데이터·권한·편집·이동을 담당합니다. 환자·보호자 내용은 Features/Customer/Patient Guardian Profile Side Panel에서 확인합니다. 이 예제는 합성 데이터이며, 전체 v1 사용자 승인은 아직 기록되지 않았습니다. 기준: docs/design/system/component-ownership-rules.md.",
      },
    },
  },
} satisfies Meta<typeof Specimen>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Patient: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const close = canvas.getByRole("button", { name: "프로필 닫기" });
    expect(close).toHaveFocus();
    expect(close.getBoundingClientRect().width).toBe(28);
    const headerBox = canvasElement.querySelector("header")!.getBoundingClientRect();
    const closeBox = close.getBoundingClientRect();
    expect(closeBox.top - headerBox.top).toBe(14);
    expect(headerBox.right - closeBox.right).toBe(14);
    expect(close.querySelector("svg")!.getBoundingClientRect().width).toBe(16);
    expect(getComputedStyle(close).borderRadius).toBe("8px");
    expect(getComputedStyle(close).color).toBe("rgb(64, 64, 64)");
    expect(
      canvasElement.querySelector("header")!.getBoundingClientRect().height,
    ).toBe(150);
    expect(
      canvasElement
        .querySelector('[data-slot="avatar"]')!
        .getBoundingClientRect().width,
    ).toBe(84);
    await userEvent.click(canvas.getByRole("tab", { name: "정보" }));
    await userEvent.keyboard("{ArrowRight}");
    await waitFor(() =>
      expect(canvas.getByRole("tab", { name: "활동" })).toHaveAttribute(
        "aria-selected",
        "true",
      ),
    );
    await userEvent.click(close);
    const opener = canvas.getByRole("button", { name: "프로필 열기" });
    await userEvent.click(opener);
    const editor = canvas.getByRole("textbox");
    await userEvent.click(editor);
    await userEvent.keyboard("{Escape}");
    expect(canvas.getByRole("region")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "프로필 닫기" }));
    await waitFor(() => expect(opener).toHaveFocus());
  },
};
export const Guardian: Story = { args: { kind: "guardian" } };
export const User: Story = { args: { kind: "user" } };
export const Loading: Story = {
  args: { state: "loading" },
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-slot="emr-profile-loading"]'),
    ).toBeInTheDocument();
    expect(
      canvasElement.querySelectorAll('[data-slot="skeleton"]').length,
    ).toBe(12);
  },
};
export const Error: Story = {
  args: { state: "error" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole("alert")).toBeVisible();
    expect(canvas.getByRole("button", { name: "다시 시도" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "다시 시도" }));
    await waitFor(() => expect(canvas.getByRole("textbox")).toBeVisible());
    expect(canvas.queryByRole("alert")).not.toBeInTheDocument();
  },
};
export const Denied: Story = { args: { state: "denied" } };
export const LongContent: Story = {
  args: { longContent: true },
  play: async ({ canvasElement }) => {
    const viewport = canvasElement.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]',
    )!;
    expect(
      canvasElement.querySelectorAll('[data-slot="scroll-area-viewport"]')
        .length,
    ).toBe(1);
    expect(getComputedStyle(viewport).overflowX).toBe("hidden");
    expect(viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight);
    viewport.scrollTop = viewport.scrollHeight;
    expect(viewport.scrollTop).toBeGreaterThan(0);
  },
};
