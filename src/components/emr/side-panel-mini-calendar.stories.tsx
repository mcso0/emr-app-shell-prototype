import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { EmrSidePanelMiniCalendar } from "./side-panel-mini-calendar";

type SidePanelMiniCalendarStoryArgs = {
  selectedDate: string;
  todayDate: string;
  rangeStartDate?: string;
  rangeEndDate?: string;
  previousDate?: string;
};

function SidePanelMiniCalendarStory({
  rangeEndDate,
  rangeStartDate,
  previousDate,
  selectedDate,
  todayDate,
}: SidePanelMiniCalendarStoryArgs) {
  const [activeDate, setActiveDate] = useState(selectedDate);
  const [previousActiveDate, setPreviousActiveDate] = useState(previousDate);

  const selectDate = (nextDate: string) => {
    if (nextDate === activeDate) return;

    setPreviousActiveDate(activeDate);
    setActiveDate(nextDate);
  };

  return (
    <div className="w-[288px] bg-[var(--emr-surface-sidepanel)]">
      <EmrSidePanelMiniCalendar
        selectedDate={activeDate}
        todayDate={todayDate}
        rangeStartDate={rangeStartDate}
        rangeEndDate={rangeEndDate}
        previousDate={previousActiveDate}
        onDateSelect={selectDate}
        onReturnToPreviousDate={() => {
          if (!previousActiveDate) return;

          setActiveDate(previousActiveDate);
          setPreviousActiveDate(undefined);
        }}
      />
      <output aria-label="선택 날짜">{activeDate}</output>
    </div>
  );
}

const meta = {
  title: "Design System/EMR/EmrSidePanelMiniCalendar",
  component: SidePanelMiniCalendarStory,
  tags: ["autodocs"],
  parameters: {
    docs: {
      story: { inline: false, height: "340px" },
      description: {
        component:
          "Use EmrSidePanelMiniCalendar under the reception side-panel title when the queue list needs a compact calendar synchronized with the main schedule date. 사용할 때: side panel date scanning and schedule synchronization. 쓰지 말아야 할 때: full date picking, range picking, or standalone scheduling pages.",
      },
    },
  },
  argTypes: {
    selectedDate: {
      control: "text",
      description: "YYYY-MM-DD 형식의 시작 선택 날짜입니다. Controls에서 바꾸면 로컬 날짜 선택 상태를 다시 시작합니다.",
    },
    previousDate: {
      control: "text",
      description: "YYYY-MM-DD 형식의 시작 이전 날짜입니다. Controls에서 바꾸면 돌아가기 상태를 다시 시작합니다.",
    },
    todayDate: {
      control: "text",
      description: "YYYY-MM-DD 형식의 오늘 날짜입니다. 숫자 타임스탬프를 전달하지 않습니다.",
    },
    rangeStartDate: {
      control: "text",
      description: "YYYY-MM-DD 형식의 선택 범위 시작 날짜입니다.",
    },
    rangeEndDate: {
      control: "text",
      description: "YYYY-MM-DD 형식의 선택 범위 끝 날짜입니다.",
    },
  },
  args: {
    selectedDate: "2026-05-01",
    todayDate: "2026-05-01",
  },
  render: (args) => (
    <SidePanelMiniCalendarStory
      key={`${args.selectedDate}:${args.previousDate ?? ""}`}
      {...args}
    />
  ),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement), initial = args.selectedDate;
    const next = `${initial.slice(0, 8)}${initial.endsWith("14") ? "15" : "14"}`;
    const header = canvas.getByTestId("side-panel-mini-calendar-header");
    const initialMonth = header.textContent;
    await userEvent.click(canvas.getByRole("button", { name: "다음 달" }));
    await waitFor(() => expect(header.textContent).not.toBe(initialMonth));
    await userEvent.click(canvas.getByRole("button", { name: "이전 달" }));
    await waitFor(() => expect(header.textContent).toBe(initialMonth));
    const day = canvas.getByTestId(`side-panel-mini-calendar-day-${next}`);
    day.focus(); await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(day).toHaveAttribute("aria-pressed", "true"));
    await expect(canvas.getByLabelText("선택 날짜")).toHaveTextContent(next);
    await userEvent.click(canvas.getByRole("button", { name: "이전에 보던 날짜로 돌아가기" }));
    await waitFor(() => expect(canvas.getByLabelText("선택 날짜")).toHaveTextContent(initial));
    await expect(canvas.queryByRole("button", { name: "이전에 보던 날짜로 돌아가기" })).not.toBeInTheDocument();
  },
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

export const PreviousDateAvailable: Story = {
  args: {
    selectedDate: "2026-05-14",
    previousDate: "2026-05-01",
    todayDate: "2026-05-01",
  },
};
