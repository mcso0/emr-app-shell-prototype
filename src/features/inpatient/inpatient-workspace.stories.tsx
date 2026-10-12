import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { InpatientContent, InpatientDrawer } from "./module";
import { mockInpatientAdmissions } from "./data";
import { useInpatientStore } from "./store";
import { useLayoutStore } from "@/stores/layout-store";
import { PREPARED_EMPTY_CLINIC_WORKSPACE_ID } from "@/lib/emr-domain/demo-workspaces";

function Example({ empty = false }: { empty?: boolean }) {
  const drawer = useLayoutStore(state => state.activeDrawer);
  const props = { workspaceId: empty ? PREPARED_EMPTY_CLINIC_WORKSPACE_ID : "synthetic-inpatient", moduleId: "inpatient", moduleLabel: "입원" };
  return <div className="flex h-[850px] min-w-0"><div className="min-w-0 flex-1"><InpatientContent {...props} /></div>{drawer?.type === "inpatient-admission" ? <aside aria-label="입원 상세" className="flex w-[360px] shrink-0 border-l"><InpatientDrawer {...props} /></aside> : null}</div>;
}
const meta = {
  title: "Features/Inpatient/Actual Workspace", component: Example, tags: ["autodocs"], args: { empty: false },
  parameters: { layout: "fullscreen", docs: { story: { inline: false, height: "880px" }, description: { component: "실제 InpatientContent와 InpatientDrawer를 사용합니다. 원본에 포함된 mockInpatientAdmissions 데모 자료와 실제 필터·검색·행 선택·밀도를 그대로 사용합니다. 빈 병원은 원본의 준비된 빈 workspace 분기입니다. 네트워크나 실데이터를 사용하지 않습니다. 기준일은 화면 표시만 바꾸며, 입실 추가·입원실 관리·차트·퇴실은 준비 중으로 비활성화됩니다. 상세 체크리스트에는 저장 동작이 연결되어 있지 않습니다. 예제가 그 동작을 추가하지 않습니다. 각 예제 종료 뒤 입원·레이아웃 스토어를 복원합니다." } } },
  beforeEach: () => {
    const inpatient = useInpatientStore.getState(), layout = useLayoutStore.getState();
    useInpatientStore.setState({ filter: "all", searchField: "all", searchQuery: "", selectedAdmissionId: "adm-kong-icu" });
    useLayoutStore.setState({ activeDrawer: null });
    return () => { useInpatientStore.setState(inpatient, true); useLayoutStore.setState(layout, true); };
  },
} satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
export const RowsSelectionAndDetails: Story = { play: async ({ canvas }) => {
  await expect(canvas.getAllByRole("table")).toHaveLength(3);
  for (const button of canvas.getAllByRole("button", { name: /준비 중/ })) await expect(button).toBeDisabled();
  const target = mockInpatientAdmissions.find(item => item.id === "adm-dubu-203")!;
  const row = canvas.getByTestId(`inpatient-row-${target.id}`);
  const previousSelection = useInpatientStore.getState().selectedAdmissionId;
  for (const name of ["차트 (준비 중)", "퇴실 (준비 중)"]) {
    const button = within(row).getByRole("button", { name });
    button.scrollIntoView({ block: "nearest", inline: "center" });
    const rect = button.getBoundingClientRect();
    const hit = button.ownerDocument.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    await expect(hit).not.toBeNull();
    await userEvent.click(hit!);
    await expect(useInpatientStore.getState().selectedAdmissionId).toBe(previousSelection);
    await expect(canvas.queryByRole("complementary", { name: "입원 상세" })).not.toBeInTheDocument();
  }
  await userEvent.click(within(row).getByText(target.room));
  await expect(row).toHaveAttribute("data-selected", "true");
  await expect(useInpatientStore.getState().selectedAdmissionId).toBe(target.id);
  const detail = within(canvas.getByRole("complementary", { name: "입원 상세" }));
  await expect(detail.getByText(target.patientName)).toBeVisible();
  await expect(detail.getByText(target.carePoint)).toBeVisible();
  for (const item of target.dischargeChecklist) {
    const checkbox = detail.getByRole("checkbox", { name: `${item.label} ${item.label}` });
    await expect(checkbox).toHaveAttribute("aria-checked", String(item.done));
  }
} };
export const FilterSearchAndRecovery: Story = { play: async ({ canvas }) => {
  const group = canvas.getByRole("group", { name: "입원실 그룹 필터" });
  const cat = within(group).getByRole("button", { name: /고양이/ });
  cat.focus(); await userEvent.keyboard(" ");
  await waitFor(() => expect(useInpatientStore.getState().filter).toBe("cat"));
  await expect(canvas.getAllByRole("table")).toHaveLength(1);
  await expect(canvas.getByRole("table", { name: "고양이 입원실 입원 목록" })).toBeVisible();
  const search = canvas.getByRole("textbox", { name: "입원 검색" });
  await userEvent.type(search, "synthetic-no-match");
  await expect(canvas.getByText("검색 조건에 맞는 입원 환자가 없습니다.")).toBeVisible();
  await userEvent.clear(search);
  await userEvent.click(within(group).getByRole("button", { name: /전체/ }));
  await expect(canvas.getAllByRole("table")).toHaveLength(3);
} };
export const DensityAndDateDisplay: Story = { play: async ({ canvas, canvasElement }) => {
  const body = within(canvasElement.ownerDocument.body);
  await userEvent.click(canvas.getByRole("button", { name: "테이블 보기 밀도: 좁은 간격" }));
  await userEvent.click(await body.findByRole("menuitemradio", { name: "넓은 간격" }));
  await expect(canvas.getByRole("button", { name: "테이블 보기 밀도: 넓은 간격" })).toBeVisible();
  for (const table of canvas.getAllByRole("table")) await expect(table.closest("[data-emr-density]")).toHaveAttribute("data-emr-density", "comfortable");
  const initialRows = canvas.getAllByTestId(/^inpatient-row-/).length;
  await userEvent.click(canvas.getByRole("button", { name: "26.05.06 (수) 입원 기준일 선택" }));
  const date = await body.findByLabelText("입원 기준일");
  await userEvent.clear(date); await userEvent.type(date, "2026-05-07");
  await userEvent.click(body.getByRole("button", { name: "적용" }));
  await expect(canvas.getByRole("button", { name: "26.05.07 (목) 입원 기준일 선택" })).toBeVisible();
  await expect(canvas.getAllByTestId(/^inpatient-row-/)).toHaveLength(initialRows);
} };
export const PreparedEmptyWorkspace: Story = { args: { empty: true }, play: async ({ canvas }) => {
  await expect(canvas.getByText("아직 입원 중인 환자가 없습니다.")).toBeVisible();
  await expect(canvas.queryAllByRole("table")).toHaveLength(0);
  await expect(useLayoutStore.getState().activeDrawer).toBeNull();
} };
