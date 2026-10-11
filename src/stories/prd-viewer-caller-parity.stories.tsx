import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { getRouter } from "@storybook/nextjs-vite/navigation.mock";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { PrdViewerCallerExample, preparePrdViewerStory, PRD_RECENT_DOCS_STORAGE_KEY, PRD_THEME_STORAGE_KEY, syntheticEpicDetail, syntheticEpicIndex, syntheticPrdDocs, invalidSyntheticMermaidChart } from "./prd-viewer-caller-parity.stories.fixture";

const meta = {
  title: "Features/Docs/PRD Viewer Caller Parity",
  component: PrdViewerCallerExample,
  tags: ["autodocs"],
  args: { scenario: "header", invalid: false },
  argTypes: { scenario: { control: false, table: { disable: true } }, invalid: { control: false, table: { disable: true } } },
  parameters: {
    layout: "fullscreen", controls: { disable: true }, nextjs: { appDirectory: true, navigation: { pathname: "/docs", query: { doc: "product-prd" } } },
    docs: { story: { inline: false, height: "720px" }, description: { component: "실제 문서 뷰어 export를 합성 문서 값으로 렌더합니다. scenario/invalid는 예제 선택용이며 제품 prop이 아닙니다. Markdown은 원본을 Node에서 실행해 만든 합성 서버 HTML입니다. 클라이언트 Mermaid는 별도 원본 예제로 검증합니다. 링크는 로컬 관찰 또는 Storybook 이동 기록만 남깁니다. 원본을 먼저 해제한 뒤 테마·최근 문서·registry·스크롤 상태를 복원합니다. 실제 문서 파일이나 외부 서비스는 읽지 않습니다." } },
  },
  beforeEach: () => preparePrdViewerStory(),
} satisfies Meta<typeof PrdViewerCallerExample>;
export default meta;
type Story = StoryObj<typeof meta>;

export const HeaderSearchAndTheme: Story = {
  args: { scenario: "header" },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole("button", { name: "다크 모드로 전환" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "다크 모드로 전환" }));
    await waitFor(() => { expect(document.documentElement.classList.contains("dark")).toBe(true); expect(window.localStorage.getItem(PRD_THEME_STORAGE_KEY)).toBe("dark"); });
    await userEvent.click(canvas.getByRole("button", { name: "라이트 모드로 전환" }));
    await waitFor(() => expect(document.documentElement.classList.contains("dark")).toBe(false));
    await userEvent.keyboard("{Control>}k{/Control}");
    const body = within(canvasElement.ownerDocument.body);
    const dialog = within(await body.findByRole("dialog", { name: "문서 검색" }));
    const input = dialog.getByRole("combobox");
    await expect(input).toHaveFocus();
    await userEvent.type(input, "없는 합성 문서");
    await waitFor(() => expect(dialog.getByText("검색 결과가 없습니다.")).toBeVisible());
    await userEvent.clear(input);
    await userEvent.type(input, "합성 문서 B");
    const router = getRouter();
    const before = router.push.mock.calls.length;
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await waitFor(() => {
      expect(router.push.mock.calls[before]?.[0]).toBe(`/docs?doc=${syntheticPrdDocs[1]!.slug}`);
      expect(window.localStorage.getItem(PRD_RECENT_DOCS_STORAGE_KEY)).toBe(JSON.stringify([syntheticPrdDocs[1]!.slug]));
      expect(body.queryByRole("dialog", { name: "문서 검색" })).not.toBeInTheDocument();
    });
    await userEvent.click(canvas.getByTestId(window.matchMedia("(min-width: 640px)").matches ? "prd-search-trigger" : "prd-search-trigger-mobile"));
    const reopened = within(await body.findByRole("dialog", { name: "문서 검색" }));
    // cmdk's group heading is aria-hidden. Verify its actual selectable recent
    // entry as well as the default Pages entry for the same synthetic document.
    await waitFor(() => {
      const entries = reopened.getAllByRole("option", { name: /합성 문서 B/ });
      expect(entries).toHaveLength(2);
      expect(entries[1]).toBeVisible();
    });
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(body.queryByRole("dialog", { name: "문서 검색" })).not.toBeInTheDocument());
  },
};

export const NavigationGroups: Story = {
  args: { scenario: "navigation" },
  play: async ({ canvas }) => {
    const nav = within(canvas.getByRole("navigation", { name: "CLAiR Docs documents" }));
    await expect(nav.getByRole("link", { name: "합성 문서 A" })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByText("합성 상위 그룹")).toBeVisible();
    await expect(nav.getByText("합성 하위 그룹")).toBeVisible();
    const nested = nav.getByRole("link", { name: "합성 하위 문서" });
    await expect(nested).toHaveAttribute("href", "/docs?doc=synthetic-nested");
    await userEvent.click(nested);
    await waitFor(() => expect(canvas.getByLabelText("합성 문서 링크 관찰")).toHaveTextContent("/docs?doc=synthetic-nested"));
    await expect(nav.getByRole("link", { name: "합성 문서 A" })).toHaveAttribute("aria-current", "page");
  },
};

export const MobileNavigation: Story = {
  args: { scenario: "mobile" },
  parameters: { docs: { description: { story: "실제 CSS 뷰포트 분기입니다. 1024px 이상에서는 원본 메뉴 버튼이 숨겨집니다. 420px 실행에서는 실제 Sheet 열기·링크 클릭 닫기·Escape를 검증합니다. 넓은 뷰포트 통과만으로 모바일 상호작용까지 검증했다고 처리하지 않습니다." } } },
  play: async ({ canvas, canvasElement }) => {
    const trigger = canvas.getByTestId("prd-mobile-nav-trigger");
    if (window.matchMedia("(min-width: 1024px)").matches) {
      await expect(trigger).not.toBeVisible();
      return;
    }
    await expect(trigger).toBeVisible();
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(trigger);
    const dialog = within(await body.findByRole("dialog", { name: "합성 Docs" }));
    await userEvent.click(dialog.getByRole("link", { name: "합성 하위 문서" }));
    await waitFor(() => { expect(body.queryByRole("dialog", { name: "합성 Docs" })).not.toBeInTheDocument(); expect(canvas.getByLabelText("합성 문서 링크 관찰")).toHaveTextContent("/docs?doc=synthetic-nested"); });
    await userEvent.click(trigger);
    await body.findByRole("dialog", { name: "합성 Docs" });
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(body.queryByRole("dialog", { name: "합성 Docs" })).not.toBeInTheDocument());
  },
};

export const PlanningEpicBranches: Story = {
  args: { scenario: "epics" },
  beforeEach: () => preparePrdViewerStory({ epics: true }),
  parameters: { docs: { description: { story: "원본의 공개 registry 키와 메타데이터 조회를 사용합니다. 표시되는 제목·설명·문서 경로는 합성 값입니다. 원본의 Epic Index 표·상세 문서의 상위 링크·일반 문서 null 분기를 검증합니다. 문서 파일 내용을 읽지 않습니다." } } },
  play: async ({ canvas }) => {
    const region = within(canvas.getByRole("region", { name: "원본 Epic 문서 영역" }));
    await expect(region.getByRole("table")).toBeVisible();
    await expect(region.getByRole("columnheader", { name: "상태" })).toBeVisible();
    await expect(region.getByRole("link", { name: /합성 Epic 상세/ })).toHaveAttribute("href", `/docs?doc=${syntheticEpicDetail.slug}`);
    await userEvent.click(canvas.getByRole("button", { name: "합성 Epic 상세 보기" }));
    await waitFor(() => { expect(region.queryByRole("table")).not.toBeInTheDocument(); expect(region.getByRole("link", { name: "Epic Index로 돌아가기" })).toHaveAttribute("href", `/docs?doc=${syntheticEpicIndex.slug}`); });
    await userEvent.click(canvas.getByRole("button", { name: "합성 일반 문서 보기" }));
    await waitFor(() => { expect(region.queryByRole("link")).not.toBeInTheDocument(); expect(region.queryByRole("table")).not.toBeInTheDocument(); });
    await userEvent.click(canvas.getByRole("button", { name: "합성 Epic Index 보기" }));
    await waitFor(() => expect(region.getByRole("table")).toBeVisible());
  },
};

export const MermaidRendered: Story = {
  args: { scenario: "mermaid", invalid: false },
  beforeEach: () => preparePrdViewerStory({ diagram: true }),
  play: async ({ canvas }) => {
    await waitFor(() => {
      const diagram = canvas.getByTestId("prd-mermaid-diagram");
      expect(diagram.querySelector("svg")).not.toBeNull();
      expect(diagram).toHaveTextContent("합성 입력");
      expect(diagram).toHaveTextContent("합성 출력");
    }, { timeout: 15000 });
  },
};

export const MermaidError: Story = {
  args: { scenario: "mermaid", invalid: true },
  beforeEach: () => preparePrdViewerStory({ diagram: true }),
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByText("Mermaid render error")).toBeVisible(), { timeout: 15000 });
    await expect(canvas.getByText(invalidSyntheticMermaidChart)).toBeVisible();
    await expect(canvas.queryByTestId("prd-mermaid-diagram")).not.toBeInTheDocument();
  },
};

export const MarkdownServerOutput: Story = {
  args: { scenario: "markdown" },
  parameters: { docs: { story: { height: "1100px" }, description: { story: "원본 MarkdownRenderer를 Node에서 실행해 얻은 합성 서버 HTML입니다. 실제 원본의 제목 ID·중복 제목·표·목록·인라인 코드·코드 이스케이프를 검증합니다. Mermaid는 원본의 서버 로딩 표시만 들어 있습니다. React hydration과 실제 Mermaid SVG는 이 정적 예제의 범위에 포함하지 않습니다. 링크 관찰은 저장된 원본 href를 로컬에 표시합니다." } } },
  play: async ({ canvas }) => {
    const article = within(canvas.getByRole("article", { name: "합성 서버 Markdown 출력" }));
    await expect(article.getByRole("heading", { name: "합성 문서" })).toHaveAttribute("id", "합성-문서");
    const repeated = article.getAllByRole("heading", { name: "반복 제목" });
    await expect(repeated).toHaveLength(2);
    await expect(repeated[0]).toHaveAttribute("id", "반복-제목");
    await expect(repeated[1]).toHaveAttribute("id", "반복-제목-2");
    await expect(article.getByRole("cell", { name: "합성 표" })).toBeVisible();
    await expect(article.getAllByRole("listitem")).toHaveLength(2);
    await expect(article.getByText("local-code")).toBeVisible();
    await expect(article.getByText("synthetic code <safe>")).toBeVisible();
    await expect(article.getByText("Rendering diagram...")).toBeVisible();
    const link = article.getByRole("link", { name: "합성 내부 경로" });
    await expect(link).toHaveAttribute("href", "/docs?doc=synthetic-reference");
    await userEvent.click(link);
    await waitFor(() => expect(canvas.getByLabelText("합성 서버 문서 링크")).toHaveTextContent("/docs?doc=synthetic-reference"));
  },
};
