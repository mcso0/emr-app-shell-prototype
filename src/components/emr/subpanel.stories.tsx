import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { ModuleSidePanelContext } from "./module-side-panel-context";

import {
  CdsActionsFilterIcon,
  CdsActionsSearchIcon,
} from "@/components/cds-icons/actions-and-controls";
import { Badge } from "@/components/ui/badge";
import { addDaysToIsoDate } from "@/lib/emr-domain/demo-date";

import {
  EmrDateNavigator,
  EmrListGroup,
  EmrListHeader,
  EmrListHeaderIconButton,
  EmrListItem,
  EmrSubpanel,
  EmrSubpanelBody,
  EmrSubpanelTitle,
} from "./subpanel";

type EmrSubpanelStoryArgs = {
  collapsed: boolean;
  title: string;
};

function EmrSubpanelExample({ collapsed, title }: EmrSubpanelStoryArgs) {
  const [groupCollapsed, setGroupCollapsed] = useState(collapsed);
  const [date, setDate] = useState("2026-06-15");
  const [selected, setSelected] = useState("A");
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filterSelected, setFilterSelected] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const visible = ["A", "B"].filter(id => (!filterSelected || id === selected) && `샘플 항목 ${id}`.includes(query));
  if (!panelOpen) return <button type="button" onClick={() => setPanelOpen(true)}>패널 다시 열기</button>;

  return (
    <div className="h-[420px]">
      <EmrSubpanel>
        <EmrSubpanelTitle title={title} onCollapse={() => setPanelOpen(false)} />
        <EmrDateNavigator dateLabel="26.06.15 (월)" selectedDate={date} todayDate="2026-06-15" todayLabel={date === "2026-06-15" ? "오늘" : undefined} onDateChange={setDate} onPrevious={() => setDate(value => addDaysToIsoDate(value, -1))} onNext={() => setDate(value => addDaysToIsoDate(value, 1))} />
        <EmrListHeader
          count={visible.length}
          search={{ active: searchOpen, query, resultCount: visible.length, inputLabel: "샘플 목록 검색", onQueryChange: setQuery, onClose: () => { setSearchOpen(false); setQuery(""); } }}
          headerActions={
            <>
              <EmrListHeaderIconButton ariaLabel="샘플 검색" onClick={() => setSearchOpen(true)}>
                <CdsActionsSearchIcon className="size-4" aria-hidden="true" />
              </EmrListHeaderIconButton>
              <EmrListHeaderIconButton ariaLabel="샘플 필터" aria-pressed={filterSelected} onClick={() => setFilterSelected(value => !value)}>
                <CdsActionsFilterIcon className="size-4" aria-hidden="true" />
              </EmrListHeaderIconButton>
            </>
          }
          label="샘플 목록"
        />
        <EmrSubpanelBody>
          <EmrListGroup
            collapsed={groupCollapsed}
            count={visible.length}
            label="진행"
            onToggle={() => setGroupCollapsed((current) => !current)}
          >
            {visible.includes("A") ? <EmrListItem
              selected={selected === "A"} onSelect={() => setSelected("A")}
              itemBadge={<Badge variant="secondary">요청</Badge>}
              meta="합성 메타 · 10:30"
              subtitle="샘플 설명 A"
              title="샘플 항목 A"
              variant="outline"
            /> : null}
            {visible.includes("B") ? <EmrListItem
              selected={selected === "B"} onSelect={() => setSelected("B")}
              footer={<><span>요청자 샘플</span><span>담당 미정</span></>}
              subtitle="샘플 설명 B"
              title="샘플 항목 B"
              variant="outline"
            /> : null}
          </EmrListGroup>
        </EmrSubpanelBody>
      </EmrSubpanel>
      <output aria-label="샘플 패널 상태">{date} · 선택 {selected} · 표시 {visible.length}건</output>
    </div>
  );
}

const meta = {
  title: "Design System/EMR/EmrSubpanel",
  component: EmrSubpanelExample,
  tags: ["autodocs"],
  parameters: {
    docs: {
      story: { inline: false, height: "520px" },
      description: {
        component:
          "Use EmrSubpanel for fixed-width EMR side panels with shared title, date navigation, list header, list groups, and list items. 사용할 때: module queue/list navigation needs consistent panel chrome. 쓰지 말아야 할 때: freeform page sections, modal dialogs, or feature workflows without stable fixture data.",
      },
    },
  },
  argTypes: {
    collapsed: {
      control: "boolean",
      description: "Initial collapsed state for the sample group.",
    },
    title: {
      control: "text",
      description: "Subpanel title.",
    },
  },
  args: {
    collapsed: false,
    title: "샘플 패널",
  },
  render: (args) => <EmrSubpanelExample key={String(args.collapsed)} {...args} />,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    if (args.collapsed) await userEvent.click(canvas.getByRole("button", { name: /진행/ }));
    const row = canvas.getByRole("button", { name: /샘플 항목 B/ });
    row.focus(); await userEvent.keyboard(" ");
    await expect(row).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(canvas.getByRole("button", { name: "다음 날짜" }));
    await expect(canvas.getByLabelText("샘플 패널 상태")).toHaveTextContent("2026-06-16");
    await userEvent.click(canvas.getByRole("button", { name: "샘플 필터" }));
    await waitFor(() => expect(canvas.queryByRole("button", { name: /샘플 항목 A/ })).not.toBeInTheDocument());
    await userEvent.click(canvas.getByRole("button", { name: "샘플 필터" }));
    await userEvent.click(canvas.getByRole("button", { name: "샘플 검색" }));
    await userEvent.type(canvas.getByRole("searchbox", { name: "샘플 목록 검색" }), "없는 항목");
    await expect(canvas.getByLabelText("샘플 패널 상태")).toHaveTextContent("표시 0건");
    await userEvent.click(canvas.getByRole("button", { name: "검색 닫기" }));
    await userEvent.click(canvas.getByRole("button", { name: "사이드 패널 접기" }));
    await expect(canvas.getByRole("button", { name: "패널 다시 열기" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "패널 다시 열기" }));
    await expect(canvas.getByRole("button", { name: /샘플 항목 B/ })).toBeVisible();
  },
} satisfies Meta<EmrSubpanelStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: queue/list module의 좌측 보조 패널. 쓰지 말아야 할 때: 본문 content card나 one-off spacing wrapper.",
      },
    },
  },
};

export const CollapsedGroup: Story = {
  args: {
    collapsed: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 상태 그룹을 접어 queue를 빠르게 훑게 할 때. 쓰지 말아야 할 때: 핵심 경고나 validation 메시지를 숨길 때.",
      },
    },
  },
};

export const ScrollableQueue: Story = {
  parameters: {
    docs: {
      description: {
        story: "Shared module queues keep their 16px content inset and place the vertical scrollbar 4px from the right edge.",
      },
    },
  },
  render: () => (
    <div className="h-[420px]">
      <EmrSubpanel>
        <EmrSubpanelTitle title="합성 대기열" />
        <EmrDateNavigator dateLabel="26.10.12 (월)" />
        <EmrListHeader label="합성 대기열" count={12} />
        <EmrSubpanelBody density="queue">
          {Array.from({ length: 12 }, (_, index) => (
            <EmrListItem key={index} title={`합성 항목 ${index + 1}`} subtitle="대기중" variant="outline" />
          ))}
        </EmrSubpanelBody>
      </EmrSubpanel>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const viewport = canvasElement.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]')!;
    const scrollbar = canvasElement.querySelector<HTMLElement>('[data-slot="scroll-area-scrollbar"]')!;
    const content = viewport.firstElementChild!;
    await waitFor(() => {
      expect(viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight);
      expect(scrollbar.parentElement!.getBoundingClientRect().right - scrollbar.getBoundingClientRect().right).toBe(4);
    });
    await expect(getComputedStyle(content).paddingLeft).toBe("16px");
    await expect(getComputedStyle(content).paddingRight).toBe("16px");
    viewport.scrollTop = 80;
    await waitFor(() => expect(viewport.scrollTop).toBe(80));
  },
};

function FloatingPinExample() {
  const [floating, setFloating] = useState(true);
  return <ModuleSidePanelContext.Provider value={{ moduleId: "synthetic", ownerId: "synthetic-owner", isCurrentModule: true, visible: true, floating, pathname: "/synthetic", search: "", onToggle: () => setFloating(value => !value), onDateChange: () => undefined, onNavigate: () => undefined }}>
    <div className="h-[240px]"><EmrSubpanel><EmrSubpanelTitle title="합성 대기열" onCollapse={() => setFloating(false)} /><EmrSubpanelBody>기존 패널 내용</EmrSubpanelBody></EmrSubpanel></div>
  </ModuleSidePanelContext.Provider>;
}
export const FloatingPin: Story = {
  parameters: { controls: { disable: true } },
  render: () => <FloatingPinExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const pin = canvas.getByRole("button", { name: "사이드 패널 고정" });
    const before = pin.getBoundingClientRect();
    const icon = pin.querySelector("svg")!;
    await waitFor(() => expect(getComputedStyle(icon).rotate).toBe("-20deg"));
    await expect(getComputedStyle(icon).width).toBe("16px");
    const color = getComputedStyle(icon).color;
    await userEvent.click(pin);
    const collapse = canvas.getByRole("button", { name: "사이드 패널 접기" });
    await expect(collapse.getBoundingClientRect()).toEqual(before);
    await expect(getComputedStyle(collapse.querySelector("svg")!).color).toBe(color);
    await expect(getComputedStyle(collapse.querySelector("svg")!).rotate).toBe("none");
    await expect(canvas.getByText("기존 패널 내용")).toBeVisible();
  },
};
