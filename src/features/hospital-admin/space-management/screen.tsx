"use client";

import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { CdsActionsPlusIcon, CdsActionsTrashIcon } from "@/components/cds-icons/actions-and-controls";
import { CdsContentEdit2Icon, CdsContentScissorsIcon } from "@/components/cds-icons/content-and-editor";
import {
  CdsMedicalMicroscopeIcon,
  CdsMedicalStethoscopeIcon,
  CdsMedicalSyringeIcon,
} from "@/components/cds-icons/medical-and-domain";
import {
  CdsNavigationArrowLeftIcon,
  CdsNavigationChevronRightIcon,
} from "@/components/cds-icons/navigation";
import { EmrEmptyState } from "@/components/emr/empty-state";
import { BuildingIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type SpaceCategoryIconKey,
  type SpaceManagementMutationInput,
  type WorkspaceSpace,
  type WorkspaceSpaceCategory,
  type WorkspaceSpaceManagementSnapshot,
} from "@/features/hospital-admin/space-management/model";
import {
  sendSpaceManagementMutation,
  SpaceManagementRequestError,
  useWorkspaceSpaceManagement,
} from "@/features/hospital-admin/space-management/space-management-client";

type CategoryDraft =
  | { mode: "create"; value: string }
  | { mode: "rename"; categoryId: string; value: string }
  | null;

type SpaceDraft =
  | { mode: "create"; value: string }
  | { mode: "edit"; spaceId: string; categoryId: string; value: string }
  | null;

export function WorkspaceSpaceManagementScreen({
  actorHeaders,
  workspaceId,
}: {
  actorHeaders?: HeadersInit;
  workspaceId: string;
}) {
  const {
    actorHeaders: stableActorHeaders,
    reload,
    setSnapshot,
    snapshot,
    status,
  } = useWorkspaceSpaceManagement({ actorHeaders, workspaceId });
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [categorySettingsOpen, setCategorySettingsOpen] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft>(null);
  const [categoryToDelete, setCategoryToDelete] =
    useState<WorkspaceSpaceCategory | null>(null);
  const [moveTargetCategoryId, setMoveTargetCategoryId] = useState("");
  const [spaceDraft, setSpaceDraft] = useState<SpaceDraft>(null);
  const [spaceToDelete, setSpaceToDelete] = useState<WorkspaceSpace | null>(null);
  const [pending, setPending] = useState(false);

  const selectedCategory = useMemo(
    () => snapshot.categories.find((category) => category.id === selectedCategoryId) ?? null,
    [selectedCategoryId, snapshot.categories],
  );

  const runMutation = async (
    command: SpaceManagementMutationInput,
    successMessage: string,
  ): Promise<WorkspaceSpaceManagementSnapshot | null> => {
    setPending(true);
    try {
      const next = await sendSpaceManagementMutation({
        actorHeaders: stableActorHeaders,
        command,
        workspaceId,
      });
      setSnapshot(next);
      toast.success(successMessage);
      return next;
    } catch (error) {
      toast.error(getMutationErrorMessage(error));
      return null;
    } finally {
      setPending(false);
    }
  };

  const submitCategoryDraft = async (event: FormEvent) => {
    event.preventDefault();
    if (!categoryDraft || !categoryDraft.value.trim()) return;
    const next = await runMutation(
      categoryDraft.mode === "create"
        ? { action: "category.create", name: categoryDraft.value }
        : {
            action: "category.rename",
            categoryId: categoryDraft.categoryId,
            name: categoryDraft.value,
          },
      categoryDraft.mode === "create"
        ? "카테고리를 추가했어요."
        : "카테고리 이름을 변경했어요.",
    );
    if (next) setCategoryDraft(null);
  };

  const confirmCategoryDelete = async () => {
    if (!categoryToDelete) return;
    const next = await runMutation(
      {
        action: "category.delete",
        categoryId: categoryToDelete.id,
        ...(categoryToDelete.spaces.length > 0
          ? { moveTargetCategoryId }
          : {}),
      },
      "카테고리를 삭제했어요.",
    );
    if (!next) return;
    if (selectedCategoryId === categoryToDelete.id) setSelectedCategoryId(null);
    setCategoryToDelete(null);
    setMoveTargetCategoryId("");
  };

  const submitSpaceDraft = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedCategory || !spaceDraft || !spaceDraft.value.trim()) return;
    const next = await runMutation(
      spaceDraft.mode === "create"
        ? {
            action: "space.create",
            categoryId: selectedCategory.id,
            name: spaceDraft.value,
          }
        : {
            action: "space.update",
            spaceId: spaceDraft.spaceId,
            categoryId: spaceDraft.categoryId,
            name: spaceDraft.value,
          },
      spaceDraft.mode === "create"
        ? "공간을 추가했어요."
        : "공간 정보를 변경했어요.",
    );
    if (next) setSpaceDraft(null);
  };

  const confirmSpaceDelete = async () => {
    if (!spaceToDelete) return;
    const next = await runMutation(
      { action: "space.delete", spaceId: spaceToDelete.id },
      "공간을 삭제했어요.",
    );
    if (!next) return;
    setSpaceToDelete(null);
  };

  return (
    <ScrollArea
      className="h-full"
      data-testid="hospital-admin-space-management-screen"
    >
      <main className="mx-auto flex w-full max-w-[920px] flex-col gap-6 px-6 py-8">
        {status === "loading" ? (
          <SpaceManagementLoading />
        ) : status === "denied" ? (
          <SpaceManagementState
            description="병원 설정 조회 권한이 있는 구성원에게 문의하세요."
            kind="no-permission"
            title="공간 관리를 볼 권한이 없습니다"
          />
        ) : status === "error" ? (
          <SpaceManagementState
            description="잠시 후 다시 시도해 주세요."
            kind="read-error"
            onRetry={() => void reload()}
            title="공간 정보를 불러오지 못했습니다"
          />
        ) : selectedCategory ? (
          <CategoryDetail
            canManage={snapshot.canManage}
            category={selectedCategory}
            categories={snapshot.categories}
            onBack={() => {
              setSelectedCategoryId(null);
              setSpaceDraft(null);
            }}
            onDeleteSpace={setSpaceToDelete}
            onSpaceDraftChange={setSpaceDraft}
            pending={pending}
            spaceDraft={spaceDraft}
            submitSpaceDraft={submitSpaceDraft}
          />
        ) : (
          <CategoryOverview
            canManage={snapshot.canManage}
            categories={snapshot.categories}
            onOpenCategorySettings={() => setCategorySettingsOpen(true)}
            onSelectCategory={setSelectedCategoryId}
          />
        )}
      </main>

      <CategorySettingsDialog
        canManage={snapshot.canManage}
        categories={snapshot.categories}
        categoryDraft={categoryDraft}
        onCategoryDraftChange={setCategoryDraft}
        onDeleteCategory={(category) => {
          setMoveTargetCategoryId("");
          setCategoryToDelete(category);
        }}
        onOpenChange={(open) => {
          if (pending) return;
          setCategorySettingsOpen(open);
          if (!open) setCategoryDraft(null);
        }}
        open={categorySettingsOpen}
        pending={pending}
        submitCategoryDraft={submitCategoryDraft}
      />

      <Dialog
        onOpenChange={(open) => {
          if (!open && !pending) {
            setCategoryToDelete(null);
            setMoveTargetCategoryId("");
          }
        }}
        open={Boolean(categoryToDelete)}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>카테고리를 삭제할까요?</DialogTitle>
            <DialogDescription>
              {categoryToDelete?.spaces.length
                ? "등록된 공간은 선택한 카테고리로 이동한 뒤 이 카테고리를 삭제합니다."
                : "삭제한 카테고리는 공간 관리 목록에서 더 이상 보이지 않습니다."}
            </DialogDescription>
          </DialogHeader>
          {categoryToDelete?.spaces.length ? (
            <Field>
              <FieldLabel htmlFor="space-category-move-target">공간 이동 대상</FieldLabel>
              <Select
                onValueChange={(value) => setMoveTargetCategoryId(value ?? "")}
                value={moveTargetCategoryId}
              >
                <SelectTrigger
                  aria-label="공간 이동 대상"
                  className="w-full"
                  id="space-category-move-target"
                >
                  <SelectValue placeholder="카테고리 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {snapshot.categories
                      .filter((category) => category.id !== categoryToDelete.id)
                      .map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          ) : null}
          <DialogFooter>
            <Button
              disabled={pending}
              onClick={() => {
                setCategoryToDelete(null);
                setMoveTargetCategoryId("");
              }}
              variant="outline"
            >
              취소
            </Button>
            <Button
              disabled={
                pending
                || Boolean(categoryToDelete?.spaces.length && !moveTargetCategoryId)
              }
              onClick={() => void confirmCategoryDelete()}
              variant="destructive"
            >
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => !open && !pending && setSpaceToDelete(null)}
        open={Boolean(spaceToDelete)}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>공간을 삭제할까요?</DialogTitle>
            <DialogDescription>
              {spaceToDelete?.name}을 공간 목록에서 삭제합니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              disabled={pending}
              onClick={() => setSpaceToDelete(null)}
              variant="outline"
            >
              취소
            </Button>
            <Button
              disabled={pending}
              onClick={() => void confirmSpaceDelete()}
              variant="destructive"
            >
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ScrollArea>
  );
}

function CategoryOverview({
  canManage,
  categories,
  onOpenCategorySettings,
  onSelectCategory,
}: {
  canManage: boolean;
  categories: WorkspaceSpaceCategory[];
  onOpenCategorySettings: () => void;
  onSelectCategory: (categoryId: string) => void;
}) {
  return (
    <>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            공간 관리
          </h1>
          <p className="text-sm text-muted-foreground">
            병원에서 사용하는 공간을 카테고리별로 관리합니다.
          </p>
        </div>
        <Button
          disabled={!canManage}
          onClick={onOpenCategorySettings}
          size="sm"
        >
          카테고리 설정
        </Button>
      </header>

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-4">
          <CardTitle>공간 카테고리</CardTitle>
          <CardDescription>
            카테고리를 선택하면 등록된 공간을 확인하고 관리할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {categories.length ? (
            categories.map((category, index) => (
              <div key={category.id}>
                {index > 0 ? <Separator /> : null}
                <button
                  aria-label={`${category.name}, ${category.spaces.length}개 공간`}
                  className="group flex min-h-20 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
                  data-testid={`space-category-row-${categoryTestId(category)}`}
                  onClick={() => onSelectCategory(category.id)}
                  type="button"
                >
                  <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground"
                    data-icon-key={category.iconKey}
                    data-testid={`space-category-icon-${categoryTestId(category)}`}
                  >
                    <CategoryIcon iconKey={category.iconKey} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="font-medium">{category.name}</span>
                      <Badge variant="secondary">{category.spaces.length}</Badge>
                    </span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">
                      병원에서 사용하는 {category.name.replace(" 공간", "")} 공간을 묶어 관리합니다.
                    </span>
                  </span>
                  <CdsNavigationChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </button>
              </div>
            ))
          ) : (
            <div className="flex min-h-64 items-center justify-center p-6">
              <EmrEmptyState
                description="카테고리 설정에서 첫 공간 카테고리를 추가해 주세요."
                kind="no-data"
                priority="primary-decision"
                size="md"
                surface="content"
                title="등록된 공간 카테고리가 없습니다"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {!canManage ? (
        <p className="text-sm text-muted-foreground">
          설정 관리 권한이 있는 사용자만 카테고리와 공간을 변경할 수 있습니다.
        </p>
      ) : null}
    </>
  );
}

function CategoryDetail({
  canManage,
  categories,
  category,
  onBack,
  onDeleteSpace,
  onSpaceDraftChange,
  pending,
  spaceDraft,
  submitSpaceDraft,
}: {
  canManage: boolean;
  categories: WorkspaceSpaceCategory[];
  category: WorkspaceSpaceCategory;
  onBack: () => void;
  onDeleteSpace: (space: WorkspaceSpace) => void;
  onSpaceDraftChange: (draft: SpaceDraft) => void;
  pending: boolean;
  spaceDraft: SpaceDraft;
  submitSpaceDraft: (event: FormEvent) => void;
}) {
  return (
    <>
      <header className="space-y-3">
        <Button
          className="-ml-2 w-fit"
          onClick={onBack}
          size="sm"
          variant="ghost"
        >
          <CdsNavigationArrowLeftIcon data-icon="inline-start" />
          <span className="sr-only">공간 관리로 돌아가기</span>
          공간 관리
        </Button>
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {category.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            이 카테고리에 등록된 공간을 추가하거나 수정·삭제합니다.
          </p>
        </div>
      </header>

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-4">
          <CardTitle>공간 목록</CardTitle>
          <CardDescription>
            공간 이름과 소속 카테고리를 관리할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {category.spaces.length === 0 && spaceDraft?.mode !== "create" ? (
            <div className="flex min-h-48 items-center justify-center p-6">
              <EmrEmptyState
                description="아래 공간 추가 버튼으로 첫 공간을 등록해 주세요."
                kind="no-data"
                reserveActionSpace={false}
                size="md"
                surface="content"
                title="등록된 공간이 없습니다"
              />
            </div>
          ) : (
            category.spaces.map((space, index) => (
              <div key={space.id}>
                {index > 0 ? <Separator /> : null}
                {spaceDraft?.mode === "edit" && spaceDraft.spaceId === space.id ? (
                  <SpaceEditRow
                    categories={categories}
                    draft={spaceDraft}
                    onChange={onSpaceDraftChange}
                    onCancel={() => onSpaceDraftChange(null)}
                    pending={pending}
                    submit={submitSpaceDraft}
                  />
                ) : (
                  <div className="flex min-h-16 items-center gap-3 px-4 py-3">
                    <span className="min-w-0 flex-1 font-medium">{space.name}</span>
                    {canManage ? (
                      <div className="flex items-center gap-1">
                        <Button
                          aria-label={`${space.name} 수정`}
                          disabled={pending || Boolean(spaceDraft)}
                          onClick={() => onSpaceDraftChange({
                            mode: "edit",
                            spaceId: space.id,
                            categoryId: category.id,
                            value: space.name,
                          })}
                          size="icon-sm"
                          variant="ghost"
                        >
                          <CdsContentEdit2Icon />
                        </Button>
                        <Button
                          aria-label={`${space.name} 삭제`}
                          disabled={pending || Boolean(spaceDraft)}
                          onClick={() => onDeleteSpace(space)}
                          size="icon-sm"
                          variant="ghost"
                        >
                          <CdsActionsTrashIcon className="text-destructive" />
                        </Button>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            ))
          )}
          {spaceDraft?.mode === "create" ? (
            <>
              {category.spaces.length ? <Separator /> : null}
              <InlineNameForm
                inputLabel="공간 이름"
                onCancel={() => onSpaceDraftChange(null)}
                onChange={(value) => onSpaceDraftChange({ mode: "create", value })}
                pending={pending}
                placeholder="예: 진료실 3"
                submitLabel="추가"
                value={spaceDraft.value}
                onSubmit={submitSpaceDraft}
              />
            </>
          ) : null}
          {canManage && !spaceDraft ? (
            <>
              <Separator />
              <div className="p-2">
                <Button
                  className="w-full justify-start"
                  disabled={pending}
                  onClick={() => onSpaceDraftChange({ mode: "create", value: "" })}
                  size="sm"
                  variant="ghost"
                >
                  <CdsActionsPlusIcon data-icon="inline-start" />
                  공간 추가
                </Button>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </>
  );
}

function CategorySettingsDialog({
  canManage,
  categories,
  categoryDraft,
  onCategoryDraftChange,
  onDeleteCategory,
  onOpenChange,
  open,
  pending,
  submitCategoryDraft,
}: {
  canManage: boolean;
  categories: WorkspaceSpaceCategory[];
  categoryDraft: CategoryDraft;
  onCategoryDraftChange: (draft: CategoryDraft) => void;
  onDeleteCategory: (category: WorkspaceSpaceCategory) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  pending: boolean;
  submitCategoryDraft: (event: FormEvent) => void;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-lg" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>카테고리 설정</DialogTitle>
          <DialogDescription>
            공간 카테고리를 추가하거나 이름을 변경하고 삭제할 수 있습니다.
          </DialogDescription>
        </DialogHeader>
        <Card className="max-h-[420px] gap-0 overflow-y-auto py-0" size="sm">
          <CardContent className="p-0">
            {categories.map((category, index) => (
              <div key={category.id}>
                {index > 0 ? <Separator /> : null}
                {categoryDraft?.mode === "rename"
                  && categoryDraft.categoryId === category.id ? (
                    <InlineNameForm
                      inputLabel="카테고리 이름"
                      onCancel={() => onCategoryDraftChange(null)}
                      onChange={(value) => onCategoryDraftChange({
                        mode: "rename",
                        categoryId: category.id,
                        value,
                      })}
                      pending={pending}
                      placeholder="예: 진료 공간"
                      submitLabel="저장"
                      value={categoryDraft.value}
                      onSubmit={submitCategoryDraft}
                    />
                  ) : (
                    <div className="flex min-h-14 items-center gap-2 px-3 py-2">
                      <span className="min-w-0 flex-1 font-medium">{category.name}</span>
                      {canManage ? (
                        <>
                          <Button
                            aria-label={`${category.name} 이름 수정`}
                            disabled={pending || Boolean(categoryDraft)}
                            onClick={() => onCategoryDraftChange({
                              mode: "rename",
                              categoryId: category.id,
                              value: category.name,
                            })}
                            size="icon-sm"
                            variant="ghost"
                          >
                            <CdsContentEdit2Icon />
                          </Button>
                          <Button
                            aria-label={`${category.name} 삭제`}
                            disabled={pending || Boolean(categoryDraft)}
                            onClick={() => onDeleteCategory(category)}
                            size="icon-sm"
                            variant="ghost"
                          >
                            <CdsActionsTrashIcon className="text-destructive" />
                          </Button>
                        </>
                      ) : null}
                    </div>
                  )}
              </div>
            ))}
            {categoryDraft?.mode === "create" ? (
              <>
                {categories.length ? <Separator /> : null}
                <InlineNameForm
                  inputLabel="새 카테고리 이름"
                  onCancel={() => onCategoryDraftChange(null)}
                  onChange={(value) => onCategoryDraftChange({ mode: "create", value })}
                  pending={pending}
                  placeholder="예: 입원 공간"
                  submitLabel="추가"
                  value={categoryDraft.value}
                  onSubmit={submitCategoryDraft}
                />
              </>
            ) : null}
            {canManage && !categoryDraft ? (
              <>
                {categories.length ? <Separator /> : null}
                <div className="p-2">
                  <Button
                    className="w-full justify-start"
                    disabled={pending}
                    onClick={() => onCategoryDraftChange({ mode: "create", value: "" })}
                    size="sm"
                    variant="ghost"
                  >
                    <CdsActionsPlusIcon data-icon="inline-start" />
                    카테고리 추가
                  </Button>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
        <DialogFooter>
          <Button disabled={pending} onClick={() => onOpenChange(false)} variant="outline">
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InlineNameForm({
  inputLabel,
  onCancel,
  onChange,
  onSubmit,
  pending,
  placeholder,
  submitLabel,
  value,
}: {
  inputLabel: string;
  onCancel: () => void;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  pending: boolean;
  placeholder: string;
  submitLabel: "추가" | "저장";
  value: string;
}) {
  return (
    <form
      className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center"
      onSubmit={onSubmit}
    >
      <label className="min-w-0 flex-1">
        <span className="sr-only">{inputLabel}</span>
        <Input
          autoFocus
          disabled={pending}
          maxLength={50}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          value={value}
        />
      </label>
      <div className="flex shrink-0 justify-end gap-1">
        <Button disabled={pending} onClick={onCancel} size="sm" type="button" variant="ghost">
          취소
        </Button>
        <Button disabled={pending || !value.trim()} size="sm" type="submit">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

function SpaceEditRow({
  categories,
  draft,
  onCancel,
  onChange,
  pending,
  submit,
}: {
  categories: WorkspaceSpaceCategory[];
  draft: Extract<SpaceDraft, { mode: "edit" }>;
  onCancel: () => void;
  onChange: (draft: SpaceDraft) => void;
  pending: boolean;
  submit: (event: FormEvent) => void;
}) {
  return (
    <form
      className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-center"
      onSubmit={submit}
    >
      <label>
        <span className="sr-only">공간 이름</span>
        <Input
          autoFocus
          disabled={pending}
          maxLength={50}
          onChange={(event) => onChange({ ...draft, value: event.target.value })}
          value={draft.value}
        />
      </label>
      <Select
        onValueChange={(value) => value && onChange({ ...draft, categoryId: value })}
        value={draft.categoryId}
      >
        <SelectTrigger aria-label="공간 카테고리" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <div className="flex justify-end gap-1">
        <Button disabled={pending} onClick={onCancel} size="sm" type="button" variant="ghost">
          취소
        </Button>
        <Button disabled={pending || !draft.value.trim()} size="sm" type="submit">
          저장
        </Button>
      </div>
    </form>
  );
}

function CategoryIcon({ iconKey }: { iconKey: SpaceCategoryIconKey }) {
  switch (iconKey) {
    case "consult":
      return <CdsMedicalStethoscopeIcon className="size-5" />;
    case "treatment":
      return <CdsMedicalSyringeIcon className="size-5" />;
    case "exam":
      return <CdsMedicalMicroscopeIcon className="size-5" />;
    case "surgery":
      return <CdsContentScissorsIcon className="size-5" />;
    default:
      return <BuildingIcon className="size-5" />;
  }
}

function SpaceManagementLoading() {
  return (
    <>
      <header className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-5 w-72" />
        </div>
        <Skeleton className="h-8 w-24" />
      </header>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-80" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[0, 1, 2, 3].map((item) => (
            <Skeleton className="h-16 w-full" key={item} />
          ))}
        </CardContent>
      </Card>
    </>
  );
}

function SpaceManagementState({
  description,
  kind,
  onRetry,
  title,
}: {
  description: string;
  kind: "no-permission" | "read-error";
  onRetry?: () => void;
  title: string;
}) {
  return (
    <div className="flex min-h-[520px] items-center justify-center">
      <EmrEmptyState
        description={description}
        kind={kind}
        primaryAction={onRetry ? <Button onClick={onRetry}>다시 시도</Button> : undefined}
        priority={onRetry ? "local-recovery" : "supporting"}
        size="lg"
        surface="content"
        title={title}
      />
    </div>
  );
}

function categoryTestId(category: WorkspaceSpaceCategory) {
  return category.id.replace(/^category-/, "");
}

function getMutationErrorMessage(error: unknown) {
  if (!(error instanceof SpaceManagementRequestError)) {
    return "변경 내용을 저장하지 못했습니다.";
  }
  switch (error.code) {
    case "duplicate_category_name":
      return "같은 이름의 카테고리가 이미 있습니다.";
    case "duplicate_space_name":
      return "선택한 카테고리에 같은 이름의 공간이 이미 있습니다.";
    case "category_move_target_required":
      return "등록된 공간을 이동할 카테고리를 선택해 주세요.";
    case "invalid_move_target":
      return "공간을 이동할 카테고리를 다시 선택해 주세요.";
    case "category_not_found":
    case "space_not_found":
      return "대상을 찾지 못했습니다. 목록을 새로고침해 주세요.";
    case "permission_missing":
    case "workspace_membership_missing":
    case "unauthenticated":
      return "공간 설정을 변경할 권한이 없습니다.";
    case "invalid_input":
      return "이름을 확인한 뒤 다시 시도해 주세요.";
    default:
      return "변경 내용을 저장하지 못했습니다.";
  }
}
