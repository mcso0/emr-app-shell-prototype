import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { ChartRow } from "./result-card";
import { exampleChart } from "./search.stories.fixture";
import styles from "./workspace.module.css";
const meta = {
  title: "Features/Chart/차트 상세 검색/검색 결과",
  component: ChartRow,
  decorators: [
    (Story, context) => (
      <section className={styles.results} data-view={context.parameters.resultView ?? "list"}>
        <Story />
      </section>
    ),
  ],
  parameters: { layout: "fullscreen" },
  args: {
    chart: exampleChart("synthetic-chart"),
    active: false,
    checked: false,
    favorite: false,
    onCheck: fn(),
    onFavorite: fn(),
    onViewChart: fn(),
    query: "구토 초음파",
    onOpen: fn(),
    onOpenProfile: fn(),
    onCopy: fn(),
  },
} satisfies Meta<typeof ChartRow>;
export default meta;
type Story = StoryObj<typeof meta>;
export const TwoTerms: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("button", { name: "모카 차트 원본 열기" }),
    ).toBeVisible();
    await expect(canvas.getByText("첨부된 이미지가 없습니다")).toBeVisible();
    await expect(canvasElement.querySelectorAll("mark").length).toBeGreaterThan(
      1,
    );
  },
};
export const Draft: Story = {
  args: {
    chart: exampleChart("synthetic-draft", {
      status: "draft",
      editable: true,
      purpose: "재진",
    }),
    active: true,
    query: "초음파",
  },
};

export const DiagnosisWithChiefComplaint: Story = {
  args: {
    query: "외이염",
    chart: exampleChart("synthetic-ear", {
      purpose: "현장 접수",
      complaint: "오른쪽 귀 가려움",
      species: "rabbit",
      diagnoses: [
        {
          id: "dx",
          name: "외이염",
          catalogId: null,
          kind: "suspected",
          primary: false,
          system: "귀",
        },
      ],
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText("오른쪽 귀 가려움", { exact: false }),
    ).toBeVisible();
    await expect(canvas.getByText(/토끼/)).toBeVisible();
  },
};

export const Overflow: Story = {
  args: {
    query: "",
    chart: exampleChart("dense", {
      purpose: "식욕 변화와 검사 기록을 함께 검토하기 위한 재진",
      complaint: "식사 시간과 식후 행동을 보호자가 연속해서 기록함. ".repeat(
        12,
      ),
      additionalVets: [
        { id: "vet-c", name: "김수민" },
        { id: "vet-d", name: "한서윤" },
      ],
      diagnoses: Array.from({ length: 8 }, (_, i) => ({
        id: String(i),
        name: "예시 진단 " + (i + 1),
        kind: "suspected",
        catalogId: null,
        primary: i === 0,
        system: "내과",
      })),
      extraTags: [
        "입원 6일째",
        "임상 2건",
        "영상 1건",
        "원외 2건",
        "백신 1건",
      ].map((label) => ({ label, detail: label + " · 합성 기록" })),
      lastContentEditedAt: "2026-11-20T04:15:00Z",
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("button", { name: "진단명 외 5개" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "진료의 외 2명" }),
    ).toBeVisible();
    await expect(canvas.getByText("최근 수정", { exact: false })).toBeVisible();
  },
};


export const ProfileTargets: Story = {
  args: {
    query: "",
    chart: exampleChart("profile-targets", { guardianId: "synthetic-guardian" }),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const patient = canvas.getByRole("button", { name: "모카 환자 프로필" });
    await expect(patient).toHaveTextContent("모카 (6세)");
    await userEvent.click(patient);
    await expect(args.onOpenProfile).toHaveBeenCalledWith({type:"patient", id:"synthetic-patient-profile-targets"});
    await userEvent.click(canvas.getByRole("button", { name: "보호자 가 보호자 프로필" }));
    await expect(args.onOpenProfile).toHaveBeenCalledWith({type:"guardian", id:"synthetic-guardian"});
    await expect(args.onOpen).not.toHaveBeenCalled();
    await expect(canvas.queryByRole("button", {name:/즐겨찾기/})).not.toBeInTheDocument();
  },
};

export const OpenCopyMenu: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", {name:"모카 차트 복사"});
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    const menu = within(canvasElement.ownerDocument.body).getByRole("menuitem", {name:"기존 차트에 복사"});
    await userEvent.hover(menu);
    await expect(trigger).toBeVisible();
    await expect(canvas.queryByRole("button", {name:/즐겨찾기/})).not.toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};

export const CardOverflow: Story = {
  ...Overflow,
  parameters: { resultView: "card" },
};
