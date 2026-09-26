import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { EmrDateNavigator } from "@/components/emr/subpanel";

import styles from "./home-workspace-layout.module.css";

const meta = {
  title: "Features/Home/Home Date Navigator",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Home 원내 현황 날짜 버튼의 Figma label과 오늘 badge 정렬을 확인합니다. 날짜 이동 및 선택 동작은 공유 EmrDateNavigator를 사용합니다.",
      },
    },
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const HospitalDateNavigator: Story = {
  render: () => (
    <div className={styles.hospitalTitle}>
      <EmrDateNavigator
        className={styles.dateControl}
        dateLabel="2026-09-27"
        formatSelectedDateLabel={() => "26년 9월 27일"}
        selectedDate="2026-09-27"
        todayDate="2026-09-27"
        todayLabel="오늘"
        onDateChange={() => undefined}
        onPrevious={() => undefined}
        onNext={() => undefined}
      />
    </div>
  ),
};
