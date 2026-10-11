import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";

import { ChartSoapBlockEditor } from "./chart-soap-block-editor";

const meta = {
  title: "Features/Chart/SOAP/BlockNote prototype",
  component: ChartSoapBlockEditor,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "BlockNote 기본 UI와 CLAiR SOAP 명령을 비교하는 초기 시안입니다. ChartSoapBlockEditor는 예제 편집기이며 운영 편집기와 구분해 주세요. 기본 샘플, 문서 JSON, 초기화 동작은 로컬 상태만 사용합니다. 실제 임상 데이터나 저장 권한은 검증하지 않습니다.",
      },
    },
  },
  decorators: [
    (Story) => (
      <main className="min-h-screen bg-[var(--emr-surface-content-panel)] p-6">
        <Story />
      </main>
    ),
  ],
} satisfies Meta<typeof ChartSoapBlockEditor>;

export default meta;

type Story = StoryObj<typeof meta>;

export const RepresentativeReview: Story = {
  parameters: { docs: { description: { story: "문서 JSON을 열고 빈 문서로 초기화한 뒤 합성 샘플을 복원하는 동작을 확인합니다." } } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.getByRole("region", { name: "BlockNote SOAP 편집기 시안" }),
    ).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "문서 JSON 보기" }));
    await expect(
      canvas.getByRole("complementary", { name: "SOAP 문서 JSON" }),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "빈 문서" }));
    await expect(
      canvas.getByText("빈 문서로 초기화했습니다. / 또는 왼쪽 +로 템플릿을 추가해 보세요."),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "샘플 복원" }));
    await expect(canvas.getByText("기본 SOAP 샘플을 복원했습니다.")).toBeVisible();
  },
};
