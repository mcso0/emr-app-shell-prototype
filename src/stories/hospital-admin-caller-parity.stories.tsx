import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { getRouter } from "@storybook/nextjs-vite/navigation.mock";
import { SESSION_WORKSPACES_STORAGE_KEY } from "@/features/auth/workspace-session";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { HospitalCallerExample, getHospitalCommands, hospitalCallerParameters, hospitalWorkspaceId, prepareHospitalCaller, resolveHospitalPending } from "./hospital-admin-caller-parity.stories.fixture";

const meta = {
  title: "Features/Hospital Admin/Caller Parity", component: HospitalCallerExample, tags: ["autodocs"],
  args: { kind: "basic", scenario: "ready" }, argTypes: { kind: { control: false }, scenario: { control: false } },
  beforeEach: prepareHospitalCaller,
  parameters: { ...hospitalCallerParameters, layout: "fullscreen", controls: { disable: true }, docs: { story: { inline: false, height: "940px" }, description: { component: "실제 병원관리 화면과 props 기반 로고 편집기를 렌더링합니다. 합성 workspace/profile, 복원 가능한 store/storage, 로컬 API 응답·명령·SDK·clipboard receipt만 사용합니다. 화면의 검증과 상태 전환은 제품 소스가 수행합니다. 서버 권한·실제 저장·운영팀 전달·Supabase 업로드의 증거가 아닙니다." } } },
} satisfies Meta<typeof HospitalCallerExample>;
export default meta;
type Story = StoryObj<typeof meta>;
async function visibleDialog(canvasElement: HTMLElement, name: string) {
  const body = within(canvasElement.ownerDocument.body);
  const node = await body.findByRole("dialog", { name });
  await waitFor(() => expect(node).toBeVisible());
  return within(node);
}

export const BasicInformation: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(await canvas.findByText("합성 병원", { exact: true })).toBeVisible();
    canvas.getByRole("button", { name: "주소 복사" }).focus(); await userEvent.keyboard("{Enter}");
    await expect(canvas.getByLabelText("합성 주소 복사")).toHaveTextContent("합성 주소");
    await userEvent.click(canvas.getByRole("button", { name: "병원 정보 변경 요청" }));
    const body = within(canvasElement.ownerDocument.body), dialog = await visibleDialog(canvasElement, "병원 등록 정보 변경 요청");
    await userEvent.click(dialog.getByRole("button", { name: /요청/ }));
    await expect(dialog.getByLabelText("변경 내용 및 사유")).toHaveAttribute("aria-invalid", "true");
    await userEvent.click(dialog.getByRole("checkbox", { name: "주소" }));
    await userEvent.type(dialog.getByLabelText("변경 내용 및 사유"), "합성 주소 변경 요청");
    await userEvent.click(dialog.getByRole("button", { name: /요청/ }));
    await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());
    await expect(canvas.getByText("운영팀 확인 대기 중")).toBeVisible();
    await expect(getHospitalCommands().at(-1)?.body).toMatchObject({ fields: ["address"], detail: "합성 주소 변경 요청" });
  },
};

export const ContactSaveAndRevert: Story = {
  args: { kind: "contact" },
  play: async ({ canvas, canvasElement }) => {
    const phone = await canvas.findByRole("textbox", { name: "대표 번호" });
    await waitFor(() => expect(phone).toHaveValue("02-000-0000"));
    await userEvent.clear(phone); await userEvent.type(phone, "02-000-0001");
    await userEvent.click(canvas.getByRole("button", { name: "변경 전으로 되돌리기" }));
    const body = within(canvasElement.ownerDocument.body);
    let dialog = await visibleDialog(canvasElement, "저장하지 않은 변경사항을 되돌리시겠습니까?");
    await userEvent.click(dialog.getByRole("button", { name: "계속 편집" }));
    await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());
    await expect(phone).toHaveValue("02-000-0001");
    await userEvent.click(canvas.getByRole("button", { name: "변경 전으로 되돌리기" }));
    dialog = await visibleDialog(canvasElement, "저장하지 않은 변경사항을 되돌리시겠습니까?");
    await userEvent.click(dialog.getByRole("button", { name: "변경사항 되돌리기" }));
    await waitFor(() => expect(phone).toHaveValue("02-000-0000"));
    await userEvent.clear(phone); await userEvent.type(phone, "02-000-0002");
    await userEvent.click(canvas.getByRole("button", { name: "변경사항 저장" }));
    await waitFor(() => expect(canvas.queryByTestId("hospital-settings-change-bar")).not.toBeInTheDocument());
    await expect(phone).toHaveValue("02-000-0002");
    await expect(getHospitalCommands().at(-1)).toMatchObject({ method: "PATCH", body: { revision: 1, contact: { phone: "02-000-0002" } } });
  },
};

export const ContactValidationAndPending: Story = {
  args: { kind: "contact", scenario: "pending" },
  play: async ({ canvas }) => {
    const phone = await canvas.findByRole("textbox", { name: "대표 번호" });
    await userEvent.clear(phone); await userEvent.click(canvas.getByRole("button", { name: "변경사항 저장" }));
    await expect(phone).toHaveAttribute("aria-invalid", "true"); await expect(getHospitalCommands()).toHaveLength(0);
    await userEvent.type(phone, "02-000-0003"); await userEvent.click(canvas.getByRole("button", { name: "변경사항 저장" }));
    await expect(await canvas.findByRole("button", { name: "저장 중..." })).toBeDisabled();
    resolveHospitalPending();
    await waitFor(() => expect(canvas.queryByTestId("hospital-settings-change-bar")).not.toBeInTheDocument());
    await expect(phone).toHaveValue("02-000-0003");
  },
};

export const ProfileLoading: Story = { args: { scenario: "loading" }, play: async ({ canvas }) => { await expect(await canvas.findByLabelText("병원 정보 불러오는 중")).toBeVisible(); } };
export const ProfileDenied: Story = { args: { scenario: "denied" }, play: async ({ canvas }) => { await waitFor(() => expect(canvas.getByText("병원 정보를 볼 권한이 없습니다.")).toBeVisible()); await expect(canvas.queryByRole("button", { name: "병원 정보 변경 요청" })).not.toBeInTheDocument(); } };
export const ProfileErrorAndRetry: Story = { args: { scenario: "error" }, play: async ({ canvas }) => { await userEvent.click(await canvas.findByRole("button", { name: "다시 시도" })); await expect(await canvas.findByText("합성 병원", { exact: true })).toBeVisible(); } };

export const BasicLogoUpload: Story = {
  play: async ({ canvas, canvasElement }) => {
    await canvas.findByText("합성 병원", { exact: true });
    canvas.getByRole("button", { name: "병원 로고 편집" }).focus(); await userEvent.keyboard("{Enter}");
    const body = within(canvasElement.ownerDocument.body), dialog = await visibleDialog(canvasElement, "병원 로고 설정");
    const asset = await fetch("/avatars/patient-avatar-choco.png"); const file = new File([await asset.blob()], "storybook-logo.png", { type: "image/png" });
    await userEvent.upload(dialog.getByLabelText("로고 파일"), file);
    await expect(dialog.getByText("storybook-logo.png")).toBeVisible();
    await userEvent.click(dialog.getByRole("button", { name: "로고 적용" }));
    await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());
    await userEvent.click(canvas.getByRole("button", { name: "변경사항 저장" }));
    await waitFor(() => expect(canvas.queryByTestId("hospital-settings-change-bar")).not.toBeInTheDocument());
    await expect(getHospitalCommands().map(command => command.method)).toEqual(["POST", "LOCAL_SDK", "POST"]);
    await expect(getHospitalCommands().at(-1)?.body).toMatchObject({ action: "finalize", uploadId: "storybook-logo-upload", declaredMime: "image/png", revision: 1 });
  },
};

export const LogoValidationAndCancel: Story = {
  args: { kind: "logo" },
  play: async ({ canvas, canvasElement }) => {
    canvas.getByRole("button", { name: "병원 로고 편집" }).focus(); await userEvent.keyboard("{Enter}");
    const body = within(canvasElement.ownerDocument.body); let dialog = await visibleDialog(canvasElement, "병원 로고 설정");
    const upload = userEvent.setup({ applyAccept: false });
    await upload.upload(dialog.getByLabelText("로고 파일"), new File(["synthetic"], "story.pdf", { type: "application/pdf" }));
    await expect(dialog.getByText("PNG 또는 JPG 파일만 선택해 주세요.")).toBeVisible();
    await userEvent.click(dialog.getByRole("button", { name: "취소" })); await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument()); await expect(canvas.getByLabelText("로고 적용 결과")).toHaveTextContent("미적용");
    await userEvent.click(canvas.getByRole("button", { name: "병원 로고 편집" })); dialog = await visibleDialog(canvasElement, "병원 로고 설정");
    await userEvent.click(dialog.getByRole("button", { name: "기본 이미지 사용" })); await userEvent.click(dialog.getByRole("button", { name: "로고 적용" }));
    await expect(canvas.getByLabelText("로고 적용 결과")).toHaveTextContent("기본 로고 적용");
  },
};

export const OperatingHoursSaveAndRevert: Story = {
  args: { kind: "hours" },
  play: async ({ canvas, canvasElement }) => {
    const monday = await canvas.findByRole("button", { name: "월요일 운영" });
    await expect(monday).toHaveAttribute("aria-pressed", "true"); await userEvent.click(monday);
    await userEvent.click(canvas.getByRole("button", { name: "변경사항 저장" }));
    await waitFor(() => expect(canvas.queryByTestId("hospital-settings-change-bar")).not.toBeInTheDocument());
    await expect(monday).toHaveAttribute("aria-pressed", "false");
    await expect(getHospitalCommands().at(-1)).toMatchObject({ method: "PUT", body: { weeklyHours: { monday: { isOpen: false } } } });
    await userEvent.click(monday); await userEvent.click(canvas.getByRole("button", { name: "변경 전으로 되돌리기" }));
    let dialog = await visibleDialog(canvasElement, "저장하지 않은 변경사항을 되돌리시겠습니까?");
    await userEvent.click(dialog.getByRole("button", { name: "계속 편집" })); await waitFor(() => expect(within(canvasElement.ownerDocument.body).queryByRole("dialog")).not.toBeInTheDocument()); await expect(monday).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(canvas.getByRole("button", { name: "변경 전으로 되돌리기" })); dialog = await visibleDialog(canvasElement, "저장하지 않은 변경사항을 되돌리시겠습니까?");
    await userEvent.click(dialog.getByRole("button", { name: "변경사항 되돌리기" })); await waitFor(() => expect(monday).toHaveAttribute("aria-pressed", "false"));
    await expect(getHospitalCommands().filter(command => command.method === "PUT")).toHaveLength(1);
  },
};

const roleSection = (roleSettings: string) => ({ nextjs: { ...hospitalCallerParameters.nextjs, navigation: { ...hospitalCallerParameters.nextjs.navigation, query: { section: "roles", roleSettings } } } });

export const OrderListCreateAndSelection: Story = {
  args: { kind: "orders" },
  play: async ({ canvas, canvasElement }) => {
    await expect(await canvas.findByTestId("order-set-row-storybook-order-a")).toBeVisible();
    await userEvent.click(canvas.getByRole("checkbox", { name: "합성 기본 검사 선택" }));
    await expect(canvas.getByText("선택한 Order 세트 1개")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "선택 해제" }));
    await expect(canvas.queryByText("선택한 Order 세트 1개")).not.toBeInTheDocument();
    const search = canvas.getByRole("textbox", { name: "Order 세트 검색" });
    await userEvent.type(search, "건강"); await expect(canvas.queryByTestId("order-set-row-storybook-order-a")).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Order 세트 검색어 초기화" }));
    canvas.getByRole("button", { name: "+ Order 세트" }).focus(); await userEvent.keyboard("{Enter}");
    const dialog = await visibleDialog(canvasElement, "Order 세트 생성");
    await userEvent.click(dialog.getByRole("button", { name: "Order 세트 저장" }));
    await expect(getHospitalCommands()).toHaveLength(0);
    await userEvent.type(dialog.getByLabelText("Order 세트명"), "합성 신규 검사");
    await userEvent.type(dialog.getByLabelText("청구서명"), "합성 신규 청구");
    await userEvent.click(dialog.getByRole("button", { name: "합성 혈액검사 + 추가" }));
    await expect(dialog.getByRole("button", { name: "합성 혈액검사 추가됨" })).toBeDisabled();
    await userEvent.click(dialog.getByRole("button", { name: "Order 세트 저장" }));
    const savedDialog = await visibleDialog(canvasElement, "Order 세트 수정");
    await waitFor(() => expect(savedDialog.getByLabelText("Order 세트명")).toHaveValue("합성 신규 검사"));
    await userEvent.click(savedDialog.getByRole("button", { name: "닫기" }));
    await waitFor(() => expect(within(canvasElement.ownerDocument.body).queryByRole("dialog")).not.toBeInTheDocument());
    await expect(await canvas.findByTestId("order-set-row-storybook-created-order")).toHaveTextContent("합성 신규 검사");
    await expect(getHospitalCommands().at(-1)).toMatchObject({ method: "POST", headers: { "if-none-match": "*" }, body: { availabilityStatus: "inactive", definition: { setName: "합성 신규 검사", billingName: "합성 신규 청구", items: [{ childOrderCatalogItemId: "storybook-blood-test", defaultQuantity: 1 }] } } });
  },
};
export const OrderEditRevisionAndReview: Story = {
  args: { kind: "orders", scenario: "review" },
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(await canvas.findByTestId("order-set-row-storybook-order-a"));
    const dialog = await visibleDialog(canvasElement, "Order 세트 수정");
    await expect(await dialog.findByText("Revision 1")).toBeVisible();
    await userEvent.click(dialog.getByRole("button", { name: "보류" }));
    await waitFor(() => expect(getHospitalCommands().at(-1)?.body).toEqual({ action: "dismiss" }));
    await expect(await dialog.findByText("검토할 구성 변경이 없습니다.")).toBeVisible();
    await waitFor(() => expect(dialog.getByLabelText("Order 세트명")).toHaveValue("합성 기본 검사"));
    await userEvent.clear(dialog.getByLabelText("Order 세트명")); await userEvent.type(dialog.getByLabelText("Order 세트명"), "합성 수정 검사");
    await userEvent.click(dialog.getByRole("button", { name: "새 revision 저장" }));
    await expect(await dialog.findByText("Revision 2")).toBeVisible();
    await userEvent.click(dialog.getByRole("button", { name: "닫기" }));
    await waitFor(() => expect(within(canvasElement.ownerDocument.body).queryByRole("dialog")).not.toBeInTheDocument());
    await expect(await canvas.findByTestId("order-set-row-storybook-order-a")).toHaveTextContent("합성 수정 검사");
    await expect(getHospitalCommands().at(-1)).toMatchObject({ method: "POST", headers: { "if-match": '"order-set-revision-storybook-order-a-revision-1"' }, body: { definition: { setName: "합성 수정 검사" } } });
  },
};
export const OrderReadErrorAndRetry: Story = { args: { kind: "orders", scenario: "error" }, play: async ({ canvas }) => { await userEvent.click(await canvas.findByRole("button", { name: "다시 시도" })); await expect(await canvas.findByTestId("order-set-row-storybook-order-a")).toBeVisible(); } };
export const OrderDrawerReadErrorAndRetry: Story = { args: { kind: "orders", scenario: "detail-error" }, play: async ({ canvas, canvasElement }) => {
  await userEvent.click(await canvas.findByTestId("order-set-row-storybook-order-a")); const dialog = await visibleDialog(canvasElement, "Order 세트 수정");
  await userEvent.click(await dialog.findByRole("button", { name: "다시 시도" })); await expect(await dialog.findByLabelText("Order 세트명")).toHaveValue("합성 기본 검사");
  await userEvent.click(dialog.getByRole("button", { name: "닫기" })); await waitFor(() => expect(within(canvasElement.ownerDocument.body).queryByRole("dialog")).not.toBeInTheDocument());
} };
export const OrderDenied: Story = { args: { kind: "orders", scenario: "denied" }, play: async ({ canvas }) => { await waitFor(() => expect(canvas.getByText("Order 세트를 볼 권한이 없습니다")).toBeVisible()); } };
export const OrderLoading: Story = { args: { kind: "orders", scenario: "loading" }, play: async ({ canvas }) => { await expect(await canvas.findByTestId("order-set-header-count-skeleton")).toBeVisible(); } };
export const OrderEmpty: Story = { args: { kind: "orders", scenario: "empty" }, play: async ({ canvas }) => { await waitFor(() => expect(canvas.getByText("조건에 맞는 Order 세트가 없습니다")).toBeVisible()); await userEvent.click(canvas.getByRole("button", { name: "전체 보기" })); await waitFor(() => expect(canvas.getByText("등록된 Order 세트가 없습니다")).toBeVisible()); } };

export const RoleSettingsHubNavigation: Story = { args: { kind: "roles" }, play: async ({ canvas }) => {
  const hub = await canvas.findByTestId("role-permission-hub-roles"); hub.focus(); await userEvent.keyboard("{Enter}");
  await expect(getRouter().push).toHaveBeenCalledWith(`/w/${hospitalWorkspaceId}/hospital-admin?section=roles&roleSettings=roles`, { scroll: false });
} };
export const CustomRoleCreateAndValidation: Story = { args: { kind: "roles" }, parameters: roleSection("roles"), play: async ({ canvas, canvasElement }) => {
  await userEvent.click(await canvas.findByRole("button", { name: "새 커스텀 역할" })); const dialog = await visibleDialog(canvasElement, "새 커스텀 역할");
  await userEvent.click(dialog.getByRole("button", { name: "역할 저장" })); await expect(dialog.getByLabelText("커스텀 역할 이름")).toHaveAttribute("aria-invalid", "true");
  await userEvent.type(dialog.getByLabelText("커스텀 역할 이름"), "합성 검사 보조");
  const labPermission = dialog.getByRole("checkbox", { name: /^검사\/처치 결과 입력(?: 검사\/처치 결과 입력)?$/ });
  await expect(labPermission).toHaveAttribute("aria-label", "검사/처치 결과 입력"); await userEvent.click(labPermission); await expect(labPermission).toHaveAttribute("aria-checked", "true");
  await userEvent.click(dialog.getByRole("button", { name: "역할 저장" })); await waitFor(() => expect(within(canvasElement.ownerDocument.body).queryByRole("dialog")).not.toBeInTheDocument());
  await expect(canvas.getByText("합성 검사 보조", { exact: true })).toBeVisible();
  await expect(JSON.parse(sessionStorage.getItem(SESSION_WORKSPACES_STORAGE_KEY) ?? "{}").permissionRoles).toEqual(expect.arrayContaining([expect.objectContaining({ label: "합성 검사 보조", permissionIds: ["lab:complete"], isSystem: false })]));
} };
export const JobPositionCreateAndValidation: Story = { args: { kind: "roles" }, parameters: roleSection("positions"), play: async ({ canvas, canvasElement }) => {
  await userEvent.click(await canvas.findByRole("button", { name: "직무 추가" })); const dialog = await visibleDialog(canvasElement, "직무 추가");
  await userEvent.click(dialog.getByRole("button", { name: "직무 저장" })); await expect(dialog.getByLabelText("직무 이름")).toHaveAttribute("aria-invalid", "true");
  await userEvent.type(dialog.getByLabelText("직무 이름"), "합성 안내 담당"); await userEvent.click(dialog.getByRole("button", { name: "직무 저장" }));
  await waitFor(() => expect(within(canvasElement.ownerDocument.body).queryByRole("dialog")).not.toBeInTheDocument());
  await expect(canvas.getByText("합성 안내 담당", { exact: true })).toBeVisible();
  await expect(JSON.parse(sessionStorage.getItem(SESSION_WORKSPACES_STORAGE_KEY) ?? "{}").jobPositions).toEqual(expect.arrayContaining([expect.objectContaining({ label: "합성 안내 담당", isSystem: false })]));
} };
export const RoleWorkDefaultsSaveAndGuard: Story = { args: { kind: "roles" }, parameters: roleSection("work-defaults"), play: async ({ canvas, canvasElement }) => {
  const body = within(canvasElement.ownerDocument.body), reception = await canvas.findByRole("combobox", { name: "기본 접수 담당" });
  await userEvent.click(reception); await userEvent.click(await body.findByRole("option", { name: "수의사" }));
  await userEvent.click(canvas.getByRole("button", { name: "역할 및 권한" })); let dialog = await visibleDialog(canvasElement, "저장하지 않은 변경사항이 있습니다");
  await userEvent.click(dialog.getByRole("button", { name: "계속 편집" })); await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument()); await expect(reception).toHaveTextContent("수의사");
  await userEvent.click(canvas.getByRole("button", { name: "저장" })); await expect(canvas.getByText("이 브라우저의 업무 기본값을 저장했습니다.", { exact: true })).toHaveAttribute("role", "status");
  await expect(JSON.parse(localStorage.getItem(`clair.workspaceRoleWorkDefaults.v1:${hospitalWorkspaceId}`) ?? "{}").receptionPositionKey).toBe("veterinarian");
  await userEvent.click(reception); await userEvent.click(await body.findByRole("option", { name: "테크니션" })); await userEvent.click(canvas.getByRole("button", { name: "역할 및 권한" })); dialog = await visibleDialog(canvasElement, "저장하지 않은 변경사항이 있습니다");
  await userEvent.click(dialog.getByRole("button", { name: "변경사항 버리기" })); await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument()); await expect(reception).toHaveTextContent("수의사");
  await expect(getRouter().replace).toHaveBeenCalledWith(`/w/${hospitalWorkspaceId}/hospital-admin?section=roles`, { scroll: false });
} };
export const RoleDenied: Story = { args: { kind: "roles", scenario: "denied" }, parameters: roleSection("roles"), play: async ({ canvas }) => {
  await expect(await canvas.findByText("역할 정보를 볼 수 없습니다")).toBeVisible(); await expect(canvas.queryByRole("button", { name: "새 커스텀 역할" })).not.toBeInTheDocument();
} };

export const SpaceCategoryCreateRenameAndDelete: Story = { args: { kind: "spaces" }, play: async ({ canvas, canvasElement }) => {
  await userEvent.click(await canvas.findByRole("button", { name: "카테고리 설정" }));
  const settings = await visibleDialog(canvasElement, "카테고리 설정"); await userEvent.click(settings.getByRole("button", { name: "카테고리 추가" }));
  await expect(settings.getByRole("button", { name: "추가" })).toBeDisabled(); await userEvent.type(settings.getByRole("textbox", { name: "새 카테고리 이름" }), "합성 입원 공간");
  await userEvent.click(settings.getByRole("button", { name: "추가" })); await expect(await settings.findByText("합성 입원 공간", { exact: true })).toBeVisible();
  await userEvent.click(settings.getByRole("button", { name: "합성 입원 공간 이름 수정" })); const name = settings.getByRole("textbox", { name: "카테고리 이름" });
  await userEvent.clear(name); await userEvent.type(name, "합성 회복 공간"); await userEvent.click(settings.getByRole("button", { name: "저장" }));
  await userEvent.click(await settings.findByRole("button", { name: "합성 회복 공간 삭제" })); const confirmation = await visibleDialog(canvasElement, "카테고리를 삭제할까요?");
  await userEvent.click(confirmation.getByRole("button", { name: "삭제" })); await waitFor(() => expect(settings.queryByText("합성 회복 공간", { exact: true })).not.toBeInTheDocument());
  await userEvent.click(settings.getByRole("button", { name: "닫기" })); await waitFor(() => expect(within(canvasElement.ownerDocument.body).queryByRole("dialog")).not.toBeInTheDocument());
  await expect(getHospitalCommands().map(command => (command.body as { action: string }).action)).toEqual(["category.create", "category.rename", "category.delete"]);
} };
export const SpaceCreateEditAndDelete: Story = { args: { kind: "spaces" }, play: async ({ canvas, canvasElement }) => {
  await userEvent.click(await canvas.findByRole("button", { name: "진료 공간, 2개 공간" })); await userEvent.click(canvas.getByRole("button", { name: "공간 추가" }));
  const name = canvas.getByRole("textbox", { name: "공간 이름" }); await userEvent.type(name, "합성 진료실"); await userEvent.click(canvas.getByRole("button", { name: "추가" }));
  await userEvent.click(await canvas.findByRole("button", { name: "합성 진료실 수정" })); const edit = canvas.getByRole("textbox", { name: "공간 이름" });
  await userEvent.clear(edit); await userEvent.type(edit, "합성 격리실"); await userEvent.click(canvas.getByRole("button", { name: "저장" }));
  await userEvent.click(await canvas.findByRole("button", { name: "합성 격리실 삭제" })); let dialog = await visibleDialog(canvasElement, "공간을 삭제할까요?");
  await userEvent.click(dialog.getByRole("button", { name: "취소" })); const body = within(canvasElement.ownerDocument.body); await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());
  await expect(canvas.getByText("합성 격리실", { exact: true })).toBeVisible(); await userEvent.click(canvas.getByRole("button", { name: "합성 격리실 삭제" })); dialog = await visibleDialog(canvasElement, "공간을 삭제할까요?");
  await userEvent.click(dialog.getByRole("button", { name: "삭제" })); await waitFor(() => expect(canvas.queryByText("합성 격리실", { exact: true })).not.toBeInTheDocument());
  await userEvent.click(canvas.getByRole("button", { name: "공간 관리로 돌아가기" })); await expect(canvas.getByRole("button", { name: "진료 공간, 2개 공간" })).toBeVisible();
  await expect(getHospitalCommands().map(command => (command.body as { action: string }).action)).toEqual(["space.create", "space.update", "space.delete"]);
} };
export const SpaceReadOnly: Story = { args: { kind: "spaces", scenario: "read-only" }, play: async ({ canvas }) => {
  const settings = await canvas.findByRole("button", { name: "카테고리 설정" }); await expect(settings).toBeDisabled(); await userEvent.click(canvas.getByRole("button", { name: "진료 공간, 2개 공간" }));
  await expect(canvas.queryByRole("button", { name: "공간 추가" })).not.toBeInTheDocument(); await expect(canvas.queryByRole("button", { name: "진료실 1 수정" })).not.toBeInTheDocument(); await expect(getHospitalCommands()).toHaveLength(0);
} };
export const SpaceDenied: Story = { args: { kind: "spaces", scenario: "denied" }, play: async ({ canvas }) => { await waitFor(() => expect(canvas.getByText("공간 관리를 볼 권한이 없습니다")).toBeVisible()); } };
export const SpaceErrorAndRetry: Story = { args: { kind: "spaces", scenario: "error" }, play: async ({ canvas }) => { await userEvent.click(await canvas.findByRole("button", { name: "다시 시도" })); await expect(await canvas.findByRole("button", { name: "진료 공간, 2개 공간" })).toBeVisible(); } };
export const SpaceLoading: Story = { args: { kind: "spaces", scenario: "loading" }, play: async ({ canvasElement, canvas }) => { await expect(canvas.getByRole("heading", { name: "공간 관리" })).toBeVisible(); await waitFor(() => expect(canvasElement.querySelectorAll('[data-slot="skeleton"]').length).toBe(15)); } };
export const SpaceEmpty: Story = { args: { kind: "spaces", scenario: "empty" }, play: async ({ canvas, canvasElement }) => {
  await expect(await canvas.findByTestId("space-category-empty")).toHaveTextContent("등록된 공간이 없습니다"); await userEvent.click(canvas.getByRole("button", { name: "카테고리 추가" }));
  const dialog = await visibleDialog(canvasElement, "카테고리 설정"); await expect(dialog.getByRole("textbox", { name: "새 카테고리 이름" })).toHaveValue(""); await userEvent.click(dialog.getByRole("button", { name: "취소" })); await userEvent.click(dialog.getByRole("button", { name: "닫기" }));
} };

export const VitalToggleSaveAndCancel: Story = { args: { kind: "vitals" }, play: async ({ canvas, canvasElement }) => {
  const toggle = await canvas.findByRole("switch", { name: "체온 사용" }); await expect(toggle).toHaveAttribute("aria-checked", "true"); toggle.focus(); await userEvent.keyboard(" ");
  await expect(toggle).toHaveAttribute("aria-checked", "false"); await expect(canvas.getByRole("combobox", { name: "체온 표시 단위" })).toBeDisabled();
  await userEvent.click(canvas.getByRole("button", { name: "변경사항 저장" })); let dialog = await visibleDialog(canvasElement, "바이탈 설정을 저장할까요?");
  await userEvent.click(dialog.getByRole("button", { name: "취소" })); const body = within(canvasElement.ownerDocument.body); await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument()); await expect(getHospitalCommands()).toHaveLength(0);
  await userEvent.click(canvas.getByRole("button", { name: "변경사항 저장" })); dialog = await visibleDialog(canvasElement, "바이탈 설정을 저장할까요?"); await userEvent.click(dialog.getByRole("button", { name: "저장" }));
  await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument()); await expect(canvas.queryByTestId("hospital-settings-change-bar")).not.toBeInTheDocument(); await expect(toggle).toHaveAttribute("aria-checked", "false");
  await expect(getHospitalCommands().at(-1)).toMatchObject({ method: "PUT", body: { items: expect.arrayContaining([expect.objectContaining({ key: "temperature", enabled: false, inputRequired: false, displayUnit: "°C" })]) } });
} };
export const VitalRequiredConfirmation: Story = { args: { kind: "vitals" }, play: async ({ canvas, canvasElement }) => {
  const action = await canvas.findByRole("button", { name: "체중 작업" }); action.focus(); await userEvent.keyboard("{Enter}");
  const body = within(canvasElement.ownerDocument.body); const required = await body.findByRole("menuitem", { name: "필수 입력으로 설정" }); await waitFor(() => expect(required).toBeVisible()); await userEvent.click(required);
  await expect(canvas.getByRole("button", { name: "체중 필수 입력 안내" })).toBeVisible(); await userEvent.click(canvas.getByRole("switch", { name: "체중 사용" }));
  const dialog = await visibleDialog(canvasElement, "필수 입력 항목을 비활성화할까요?"); await userEvent.click(dialog.getByRole("button", { name: "필수 입력 해제 후 비활성화" }));
  await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument()); await expect(canvas.getByRole("switch", { name: "체중 사용" })).toHaveAttribute("aria-checked", "false"); await expect(canvas.queryByRole("button", { name: "체중 필수 입력 안내" })).not.toBeInTheDocument();
} };
export const VitalDeleteUndoAndAdd: Story = { args: { kind: "vitals" }, play: async ({ canvas, canvasElement }) => {
  const body = within(canvasElement.ownerDocument.body);
  const removeWeight = async () => {
    await userEvent.click(canvas.getByRole("button", { name: "체중 작업" })); const item = await body.findByRole("menuitem", { name: "삭제하기" }); await waitFor(() => expect(item).toBeVisible()); await userEvent.click(item);
    const dialog = await visibleDialog(canvasElement, "체중을 목록에서 제거할까요?"); await userEvent.click(dialog.getByRole("button", { name: "목록에서 제거" }));
    await waitFor(() => expect(canvas.queryByTestId("vital-setting-row-weight")).not.toBeInTheDocument()); await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());
  };
  await canvas.findByRole("button", { name: "체중 작업" }); await removeWeight(); await userEvent.click(await body.findByRole("button", { name: "되돌리기" })); await expect(canvas.getByTestId("vital-setting-row-weight")).toBeVisible();
  await removeWeight(); await userEvent.click(canvas.getByRole("button", { name: "바이탈 추가" })); const dialog = await visibleDialog(canvasElement, "바이탈 추가"); await userEvent.click(dialog.getByRole("button", { name: /^체중/ }));
  await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument()); const row = within(canvas.getByTestId("vital-setting-row-weight")); await expect(row.getByRole("switch", { name: "체중 사용" })).toHaveAttribute("aria-checked", "true"); await expect(row.queryByRole("button", { name: "체중 필수 입력 안내" })).not.toBeInTheDocument();
  await expect(canvas.getByTestId("vital-settings-list").lastElementChild).toHaveAttribute("data-testid", "vital-setting-row-weight");
} };
export const VitalKeyboardReorder: Story = { args: { kind: "vitals" }, play: async ({ canvas }) => {
  const grip = await canvas.findByRole("button", { name: "체중 순서 변경" }); grip.focus(); await userEvent.keyboard("[Space]"); await userEvent.keyboard("{ArrowDown}"); await userEvent.keyboard("[Space]");
  await waitFor(() => expect(canvas.getByTestId("vital-settings-list").children[1]).toHaveAttribute("data-testid", "vital-setting-row-weight")); await expect(canvas.getByTestId("hospital-settings-change-bar")).toBeVisible();
} };
export const VitalReadOnly: Story = { args: { kind: "vitals", scenario: "read-only" }, play: async ({ canvas }) => {
  const toggle = await canvas.findByRole("switch", { name: "체중 사용" });
  await expect(toggle).toHaveAttribute("aria-disabled", "true"); await expect(toggle).toHaveAttribute("data-disabled");
  await userEvent.click(toggle); toggle.focus(); await userEvent.keyboard(" "); await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect(canvas.getByRole("button", { name: "체중 작업" })).toBeDisabled(); await expect(canvas.getByRole("button", { name: "체중 순서 변경" })).toBeDisabled(); await expect(canvas.getByRole("button", { name: "바이탈 추가" })).toBeDisabled(); await expect(getHospitalCommands()).toHaveLength(0);
} };
export const VitalDenied: Story = { args: { kind: "vitals", scenario: "denied" }, play: async ({ canvas }) => { await waitFor(() => expect(canvas.getByText("바이탈 설정을 볼 권한이 없습니다")).toBeVisible()); } };
export const VitalLoading: Story = { args: { kind: "vitals", scenario: "loading" }, play: async ({ canvas }) => { await waitFor(() => expect(canvas.getByText("바이탈 설정을 불러오는 중입니다")).toBeVisible()); } };
export const VitalErrorAndRetry: Story = { args: { kind: "vitals", scenario: "error" }, play: async ({ canvas }) => { await userEvent.click(await canvas.findByRole("button", { name: "다시 시도" })); await expect(await canvas.findByRole("switch", { name: "체중 사용" })).toBeVisible(); } };
