import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { EmrProfileIdentity, EmrProfilePanel, EmrProfilePanelBody, EmrProfileTabPanel } from "@/components/emr/profile-panel";
import { Button } from "./button";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Badge } from "./badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

type TabsStoryArgs = {
  defaultValue: string;
  orientation: "horizontal" | "vertical";
  variant: "default" | "line";
};

function TabsExample({ defaultValue, orientation, variant }: TabsStoryArgs) {
  return (
    <Tabs
      defaultValue={defaultValue}
      orientation={orientation}
      className={orientation === "vertical" ? "max-w-2xl flex-row" : "max-w-2xl"}
    >
      <TabsList variant={variant} aria-label="샘플 탭">
        <TabsTrigger value="summary">요약</TabsTrigger>
        <TabsTrigger value="details">상세</TabsTrigger>
        <TabsTrigger value="history">
          이력
          <Badge variant="secondary" className="ml-1">
            2
          </Badge>
        </TabsTrigger>
      </TabsList>
      <div className="min-w-0 rounded-md border border-border bg-card p-4">
        <TabsContent value="summary">
          <div className="font-medium">샘플 요약</div>
          <p className="mt-1 text-sm text-muted-foreground">
            현재 화면에서 먼저 스캔할 합성 요약 정보입니다.
          </p>
        </TabsContent>
        <TabsContent value="details">
          <div className="font-medium">샘플 상세</div>
          <p className="mt-1 text-sm text-muted-foreground">
            사용자가 탭을 전환했을 때만 필요한 보조 설명입니다.
          </p>
        </TabsContent>
        <TabsContent value="history">
          <div className="font-medium">샘플 이력</div>
          <p className="mt-1 text-sm text-muted-foreground">
            실제 환자, 보호자, 병원, 결제, 신원 정보 없이 만든 이력 예시입니다.
          </p>
        </TabsContent>
      </div>
    </Tabs>
  );
}

function ProfileTabsCaller() {
  const [open, setOpen] = useState(true);
  const [value, setValue] = useState("profile");
  return <div className="grid w-full max-w-md gap-3">
    <Button onClick={() => setOpen((current) => !current)}>{open ? "합성 프로필 닫기" : "합성 프로필 열기"}</Button>
    {open ? (
      <EmrProfilePanel className="h-[440px]" aria-label="합성 직원 운영 프로필" closeLabel="직원 운영 프로필 닫기" onClose={() => setOpen(false)}
        value={value} onTabChange={setValue} tabsLabel="직원 프로필 탭"
        tabs={[{ value: "profile", label: "프로필" }, { value: "work", label: "업무현황" }, { value: "schedule", label: "일정" }]}
        identity={<EmrProfileIdentity avatar={<span className="flex size-full items-center justify-center rounded-lg bg-muted" aria-hidden="true">합</span>} name="합성 직원" detail="합성 접수 직원" />}>
        {[["profile", "합성 프로필 내용"], ["work", "합성 배정 업무 내용"], ["schedule", "합성 일정 내용"]].map(([key, text]) => (
          <EmrProfileTabPanel key={key} value={key}><EmrProfilePanelBody className="p-4">{text}</EmrProfilePanelBody></EmrProfileTabPanel>
        ))}
      </EmrProfilePanel>
    ) : null}
    <output aria-label="합성 프로필 탭 선택">{value} · {open ? "열림" : "닫힘"}</output>
  </div>;
}

const meta = {
  title: "Design System/UI/Tabs",
  component: TabsExample,
  tags: ["autodocs"],
  parameters: {
    docs: {
      story: { inline: false, height: "260px" },
      description: {
        component:
          "Controls는 TabsExample 조합 설정입니다. defaultValue는 마운트 시 초기값이고 variant는 TabsList에 전달합니다. 호출자는 패널 내용과 상태를 소유합니다. Use Tabs to switch between related panels at the same hierarchy level. 사용할 때: content groups are peers and the user can choose one without leaving context. 쓰지 말아야 할 때: primary app navigation, binary filters, or steps that must be completed in order.",
      },
    },
  },
  argTypes: {
    defaultValue: {
      control: "radio",
      options: ["summary", "details", "history"],
      description: "Initially active tab value for the uncontrolled example.",
    },
    orientation: {
      control: "radio",
      options: ["horizontal", "vertical"],
      description: "Requested layout direction. Current main does not forward orientation to Base UI; vertical keyboard behavior is not supported by this wrapper yet.",
    },
    variant: {
      control: "radio",
      options: ["default", "line"],
      description: "Tab list visual style.",
    },
  },
  args: {
    defaultValue: "summary",
    orientation: "horizontal",
    variant: "default",
  },
  render: (args) => <TabsExample key={args.defaultValue} {...args} />,
} satisfies Meta<TabsStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

async function activateDetailsTab(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole("tab", { name: "상세" }));
  await waitFor(() => expect(canvas.getByRole("tabpanel")).toHaveTextContent("샘플 상세"));
}
export const Default: Story = {
  render: () => <ProfileTabsCaller />,
  parameters: { controls: { disable: true }, docs: { story: { height: "580px" }, description: { story: "실제 EmrProfilePanel·EmrProfileTabPanel·본문을 사용합니다. 직원 운영 프로필의 프로필/업무현황/일정 탭 구성과 원본 focus·ArrowRight·Escape·닫기 동작을 유지합니다. identity와 패널 내용만 합성입니다. 직원 조회·업무 읽기는 실행하지 않습니다." } } },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("tab", { name: "업무현황" }));
    await waitFor(() => expect(canvas.getByRole("tabpanel")).toHaveTextContent("합성 배정 업무 내용"));
    await userEvent.keyboard("{ArrowRight}");
    await waitFor(() => { expect(canvas.getByRole("tab", { name: "일정" })).toHaveFocus(); expect(canvas.getByRole("tabpanel")).toHaveTextContent("합성 일정 내용"); });
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(canvas.getByRole("button", { name: "합성 프로필 열기" })).toBeVisible());
    const opener = canvas.getByRole("button", { name: "합성 프로필 열기" });
    await userEvent.click(opener);
    await waitFor(() => expect(canvas.getByRole("button", { name: "직원 운영 프로필 닫기" })).toHaveFocus());
    await userEvent.click(canvas.getByRole("button", { name: "직원 운영 프로필 닫기" }));
    await waitFor(() => expect(canvas.getByRole("button", { name: "합성 프로필 열기" })).toHaveFocus());
  },
};

export const LineVariant: Story = {
  play: async ({ canvasElement }) => activateDetailsTab(canvasElement),
  args: {
    variant: "line",
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: panel chrome보다 content hierarchy를 가볍게 유지해야 할 때. 쓰지 말아야 할 때: 활성 상태가 충분히 눈에 띄어야 하는 dense toolbar.",
      },
    },
  },
};

export const Vertical: Story = {
  play: async ({ canvas }) => { await expect(canvas.getByRole("tablist")).not.toHaveAttribute("aria-orientation"); const summary = canvas.getByRole("tab", { name: "요약" }); await userEvent.click(summary); await userEvent.keyboard("{ArrowDown}"); await expect(summary).toHaveFocus(); await userEvent.keyboard("{ArrowRight}"); await expect(canvas.getByRole("tab", { name: "상세" })).toHaveFocus(); await userEvent.keyboard("{Enter}"); await waitFor(() => expect(canvas.getByRole("tabpanel")).toHaveTextContent("샘플 상세")); },
  tags: ["depends_on_unmerged_product_change"],
  args: {
    orientation: "vertical",
  },
  parameters: {
    docs: {
      description: {
        story:
          "현재 main의 수직 요청 예제입니다. Tabs가 orientation을 Base UI Root에 전달하지 않으므로 수직 키보드 탐색을 보장하지 않습니다. 수직 동작 검증은 미병합 제품 수정에 의존합니다. 이 스토리는 기존 ID를 유지하며 현재 상태를 보여줍니다.",
      },
    },
  },
};

export const DisabledPlaceholders: Story = {
  render: () => (
    <Tabs defaultValue="profile" className="max-w-sm">
      <TabsList variant="line" aria-label="직원 프로필 탭">
        <TabsTrigger value="profile">프로필</TabsTrigger>
        <TabsTrigger value="tab2" disabled>
          tab2
        </TabsTrigger>
        <TabsTrigger value="tab3" disabled>
          tab3
        </TabsTrigger>
      </TabsList>
      <TabsContent value="profile">프로필 내용 · tab2와 tab3는 이 API 예제에 패널이 없어 비활성입니다.</TabsContent>
    </Tabs>
  ),
  parameters: {
    controls: { disable: true },
    docs: {
      description: {
        story:
          "순수 Tabs API의 비활성 placeholder 예제입니다. 실제 직원 프로필의 업무현황·일정 탭은 구현되어 있으므로 이 placeholder를 실제 직원 상태로 해석하지 마세요. 화살표 키 탐색은 비활성 탭을 건너뜁니다.",
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const profile = canvas.getByRole("tab", { name: "프로필" });
    const tab2 = canvas.getByRole("tab", { name: "tab2" });
    const tab3 = canvas.getByRole("tab", { name: "tab3" });

    expect(tab2).toHaveAttribute("aria-disabled", "true");
    expect(tab3).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(profile);
    await userEvent.keyboard("{ArrowRight}");
    expect(profile).toHaveAttribute("aria-selected", "true");
    expect(canvas.getByRole("tabpanel")).toHaveTextContent("프로필 내용");
  },
};
