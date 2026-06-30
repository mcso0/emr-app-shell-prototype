import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { EmrSidePanelMiniCalendar } from "./side-panel-mini-calendar";

type SidePanelMiniCalendarStoryArgs = {
  selectedDate: string;
  todayDate: string;
  rangeStartDate?: string;
  rangeEndDate?: string;
};

function SidePanelMiniCalendarStory({
  rangeEndDate,
  rangeStartDate,
  selectedDate,
  todayDate,
}: SidePanelMiniCalendarStoryArgs) {
  const [activeDate, setActiveDate] = useState(selectedDate);

  return (
    <div className="w-[288px] bg-[var(--emr-surface-sidepanel)]">
      <EmrSidePanelMiniCalendar
        selectedDate={activeDate}
        todayDate={todayDate}
        rangeStartDate={rangeStartDate}
        rangeEndDate={rangeEndDate}
        onDateSelect={setActiveDate}
      />
    </div>
  );
}

const meta = {
  title: "Design System/EMR/EmrSidePanelMiniCalendar",
  component: SidePanelMiniCalendarStory,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Use EmrSidePanelMiniCalendar under the reception side-panel title when the queue list needs a compact calendar synchronized with the main schedule date. 사용할 때: side panel date scanning and schedule synchronization. 쓰지 말아야 할 때: full date picking, range picking, or standalone scheduling pages.",
      },
    },
  },
  args: {
    selectedDate: "2026-05-01",
    todayDate: "2026-05-01",
  },
  render: (args) => <SidePanelMiniCalendarStory {...args} />,
} satisfies Meta<SidePanelMiniCalendarStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const DefaultMonth: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 접수/예약 사이드패널의 기본 월 표시. 오늘과 선택 날짜가 같은 상태를 확인한다.",
      },
    },
  },
};

export const TodayRedChip: Story = {
  args: {
    selectedDate: "2026-05-01",
    todayDate: "2026-05-01",
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: Figma의 red box today 상태를 확인한다. 오늘이 선택되어도 red chip이 우선이다.",
      },
    },
  },
};

export const SelectedDateNotToday: Story = {
  args: {
    selectedDate: "2026-05-14",
    todayDate: "2026-05-01",
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 오늘이 아닌 날짜를 선택했을 때 today red chip과 selected soft state가 분리되는지 확인한다.",
      },
    },
  },
};

export const OutsideMonthDates: Story = {
  args: {
    selectedDate: "2026-08-01",
    todayDate: "2026-08-14",
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 이전/다음 달 날짜가 6주 grid 안에서 muted 상태로 보이는지 확인한다.",
      },
    },
  },
};

export const WeekRange: Story = {
  args: {
    selectedDate: "2026-05-14",
    todayDate: "2026-05-01",
    rangeStartDate: "2026-05-10",
    rangeEndDate: "2026-05-16",
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 오른쪽 캘린더가 주 단위일 때 미니 캘린더에 같은 주 영역이 잡히는지 확인한다.",
      },
    },
  },
};
