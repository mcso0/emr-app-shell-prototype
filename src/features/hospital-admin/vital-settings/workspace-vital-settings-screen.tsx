"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { IconReorderAlt } from "obra-icons-react";
import { toast } from "sonner";
import { CdsActionsPlusIcon, CdsActionsTrash2Icon } from "@/components/cds-icons/actions-and-controls";
import { CdsFilesMoreVerticalIcon } from "@/components/cds-icons/files-and-layout";
import { EmrEmptyState } from "@/components/emr/empty-state";
import { EmrMainContentHeader } from "@/components/emr/main-content-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HospitalSettingsPage } from "@/features/hospital-admin/settings/hospital-settings-page";
import { useHospitalAdminStore } from "@/features/hospital-admin/store";
import {
  cloneWorkspaceVitalSettingsSnapshot,
  getEnabledWorkspaceVitalSettings,
  type WorkspaceVitalKey,
  type WorkspaceVitalSetting,
  type WorkspaceVitalSettingsSnapshot,
  type WorkspaceVitalUnit,
} from "@/features/patient-vitals/workspace-vital-settings";
import {
  saveWorkspaceVitalSettings,
  useWorkspaceVitalSettings,
} from "@/features/patient-vitals/use-workspace-vital-settings";
import { cn } from "@/lib/utils";

export function WorkspaceVitalSettingsScreen({
  actorHeaders,
  workspaceId,
}: {
  actorHeaders?: HeadersInit;
  workspaceId: string;
}) {
  const { reload, snapshot, status } = useWorkspaceVitalSettings({
    actorHeaders,
    workspaceId,
  });
  const [saved, setSaved] = useState<WorkspaceVitalSettingsSnapshot | null>(
    null,
  );
  const [draft, setDraft] = useState<WorkspaceVitalSettingsSnapshot | null>(
    null,
  );
  const [addOpen, setAddOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    key: WorkspaceVitalKey;
    kind: "delete" | "disable-required" | "enable-required";
  } | null>(null);
  const addButtonRef = useRef<HTMLButtonElement | null>(null);
  const actionReturnRef = useRef<HTMLElement | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const setSettingsDirty = useHospitalAdminStore(
    (state) => state.setSettingsDirty,
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    if (status !== "ready") return;
    const next = cloneWorkspaceVitalSettingsSnapshot(snapshot);
    // The fetched server snapshot becomes the editor's reset baseline.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaved(next);
    setDraft(cloneWorkspaceVitalSettingsSnapshot(next));
  }, [snapshot, status]);

  const isDirty = Boolean(
    saved &&
    draft &&
    serializeItems(saved.items) !== serializeItems(draft.items),
  );
  useEffect(() => {
    setSettingsDirty(isDirty);
    return () => setSettingsDirty(false);
  }, [isDirty, setSettingsDirty]);

  const availablePresets = useMemo(() => {
    if (!draft) return [];
    const configured = new Set(draft.items.map((item) => item.key));
    return draft.presets.filter((preset) => !configured.has(preset.key));
  }, [draft]);

  if (status === "loading" && !draft) {
    return <VitalSettingsState title="바이탈 설정을 불러오는 중입니다" />;
  }
  if (status === "denied") {
    return <VitalSettingsState title="바이탈 설정을 볼 권한이 없습니다" />;
  }
  if (status === "error" && !draft) {
    return (
      <VitalSettingsState
        title="바이탈 설정을 불러오지 못했습니다"
        onRetry={() => void reload()}
      />
    );
  }
  if (!draft || !saved) return null;

  const canManage = draft.canManage;
  const updateItems = (items: WorkspaceVitalSetting[]) => {
    setDraft({ ...draft, items: normalizeOrder(items) });
  };
  const updateItem = (
    key: WorkspaceVitalKey,
    patch: Partial<WorkspaceVitalSetting>,
  ) => {
    updateItems(
      draft.items.map((item) =>
        item.key === key ? { ...item, ...patch } : item,
      ),
    );
  };
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id || !canManage) return;
    const oldIndex = draft.items.findIndex((item) => item.key === active.id);
    const newIndex = draft.items.findIndex((item) => item.key === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    updateItems(arrayMove(draft.items, oldIndex, newIndex));
  };
  const addPreset = (key: WorkspaceVitalKey) => {
    const preset = draft.presets.find((item) => item.key === key);
    if (!preset) return;
    updateItems([
      ...draft.items,
      {
        key,
        enabled: true,
        inputRequired: false,
        displayUnit: preset.canonicalUnit,
        sortOrder: draft.items.length,
      },
    ]);
    setAddOpen(false);
  };
  const removeItem = (key: WorkspaceVitalKey) => {
    const removedIndex = draft.items.findIndex((item) => item.key === key);
    const removedItem = draft.items[removedIndex];
    const preset = draft.presets.find((item) => item.key === key);
    if (!removedItem || !preset) return;

    setDraft((current) =>
      current
        ? {
            ...current,
            items: normalizeOrder(
              current.items.filter((item) => item.key !== key),
            ),
          }
        : current,
    );

    toast.success(`${preset.label}을 목록에서 제거했어요.`, {
      action: {
        label: "되돌리기",
        onClick: () =>
          setDraft((current) => {
            if (!current || current.items.some((item) => item.key === key))
              return current;
            const items = [...current.items];
            items.splice(Math.min(removedIndex, items.length), 0, removedItem);
            return { ...current, items: normalizeOrder(items) };
          }),
      },
    });
  };
  const closePendingAction = () => {
    setPendingAction(null);
    window.requestAnimationFrame(() => actionReturnRef.current?.focus());
  };
  const confirmPendingAction = () => {
    if (!pendingAction) return;
    if (pendingAction.kind === "delete") {
      removeItem(pendingAction.key);
    } else if (pendingAction.kind === "disable-required") {
      updateItem(pendingAction.key, { enabled: false, inputRequired: false });
    } else {
      updateItem(pendingAction.key, { enabled: true, inputRequired: true });
    }
    closePendingAction();
  };
  const requestAction = (
    key: WorkspaceVitalKey,
    kind: "delete" | "disable-required" | "enable-required",
  ) => {
    actionReturnRef.current = kind === "delete"
      ? addButtonRef.current
      : document.querySelector<HTMLElement>(
          `[data-testid="vital-setting-${kind === "disable-required" ? "switch" : "more"}-${key}"]`,
        );
    setPendingAction({ key, kind });
  };
  const handleSave = async () => {
    setSaving(true);
    try {
      const next = await saveWorkspaceVitalSettings({
        actorHeaders,
        snapshot: draft,
        workspaceId,
      });
      setSaved(cloneWorkspaceVitalSettingsSnapshot(next));
      setDraft(cloneWorkspaceVitalSettingsSnapshot(next));
      setSaveOpen(false);
      toast.success("바이탈 설정을 저장했어요.");
    } catch (error) {
      toast.error(
        error instanceof Error && error.message === "denied"
          ? "바이탈 설정을 저장할 권한이 없습니다."
          : "바이탈 설정을 저장하지 못했습니다.",
      );
    } finally {
      setSaving(false);
    }
  };
  const enabledLabels = getEnabledWorkspaceVitalSettings(draft).map(
    (item) =>
      draft.presets.find((preset) => preset.key === item.key)?.label ??
      item.key,
  );
  const removedLabels = saved.items
    .filter(
      (item) => !draft.items.some((draftItem) => draftItem.key === item.key),
    )
    .map(
      (item) =>
        saved.presets.find((preset) => preset.key === item.key)?.label ??
        item.key,
    );

  return (
    <HospitalSettingsPage
      description="병원에서 기록할 바이탈과 표시 순서를 설정합니다"
      dirty={canManage && isDirty}
      isSaving={saving}
      layout="summary"
      onRevert={() => setDraft(cloneWorkspaceVitalSettingsSnapshot(saved))}
      onSave={() => setSaveOpen(true)}
      testId="hospital-admin-vitals-screen"
      title="바이탈 관리"
    >
      <section
        className="w-full pb-2"
        aria-labelledby="vital-settings-list-title"
      >
        <Card
          className="gap-0 border-0 py-0 shadow-[var(--clair-shadow-xs)] ring-1 ring-[var(--emr-border-default)]"
          data-testid="vital-settings-card"
        >
          <CardContent className="p-0">
            <div className="relative flex min-h-[85px] flex-col justify-center gap-1 px-4 py-5 after:absolute after:right-4 after:bottom-0 after:left-4 after:h-px after:bg-border md:px-6 md:after:right-6 md:after:left-6">
              <h2
                className="text-sm leading-5 font-medium tracking-[0.014em]"
                id="vital-settings-list-title"
              >
                사용할 바이탈 목록
              </h2>
              <p className="text-sm leading-5 font-medium tracking-[0.014em] text-muted-foreground">
                필수 입력으로 설정한 항목은 접수와 바이탈 기록 시 입력해야 합니다.
                그립을 잡아 표시 순서를 바꿀 수 있습니다.
              </p>
            </div>
            <DndContext
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
              sensors={sensors}
            >
              <SortableContext
                items={draft.items.map((item) => item.key)}
                strategy={verticalListSortingStrategy}
              >
                <div data-testid="vital-settings-list">
                  {draft.items.map((item) => {
                    const preset = draft.presets.find(
                      (candidate) => candidate.key === item.key,
                    );
                    if (!preset) return null;
                    return (
                      <SortableVitalRow
                        canManage={canManage}
                        item={item}
                        key={item.key}
                        label={preset.label}
                        onEnabledChange={(enabled) =>
                          item.inputRequired && !enabled
                            ? requestAction(item.key, "disable-required")
                            : updateItem(item.key, { enabled })
                        }
                        onRemove={() => requestAction(item.key, "delete")}
                        onRequiredChange={() =>
                          !item.inputRequired && !item.enabled
                            ? requestAction(item.key, "enable-required")
                            : updateItem(item.key, { inputRequired: !item.inputRequired })
                        }
                        onUnitChange={(displayUnit) =>
                          updateItem(item.key, { displayUnit })
                        }
                        units={preset.allowedDisplayUnits}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
            <div className="flex min-h-[72px] items-center px-4 py-5 md:px-6">
              <Button
                className="!h-8 disabled:opacity-50"
                data-testid="vital-settings-add"
                disabled={!canManage || availablePresets.length === 0}
                onClick={() => setAddOpen(true)}
                ref={addButtonRef}
                size="sm"
                variant="ghost"
              >
                <CdsActionsPlusIcon
                  data-icon="inline-start"
                  aria-hidden="true"
                />
                바이탈 추가
              </Button>
            </div>
          </CardContent>
        </Card>

        {!canManage ? (
          <p className="px-4 pt-4 text-sm text-muted-foreground">
            설정 관리 권한이 있는 사용자만 변경할 수 있습니다.
          </p>
        ) : null}
      </section>

      <Dialog onOpenChange={setAddOpen} open={addOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>바이탈 추가</DialogTitle>
            <DialogDescription>
              제거한 항목은 사용 켜짐·필수 입력 해제·기본 단위로 목록 맨 아래에 다시 추가됩니다. 기존 측정 기록은 유지됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {availablePresets.map((preset) => (
              <button
                className="rounded-lg border px-3 py-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                key={preset.key}
                onClick={() => addPreset(preset.key)}
                type="button"
              >
                <span className="block font-medium">{preset.label}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {preset.description}
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => { if (!open) closePendingAction(); }}
        open={pendingAction !== null}
      >
        <DialogContent data-testid="vital-settings-action-dialog">
          <DialogHeader>
            <DialogTitle>
              {pendingAction?.kind === "delete"
                ? `${draft.presets.find((preset) => preset.key === pendingAction.key)?.label ?? "바이탈"}을 목록에서 제거할까요?`
                : pendingAction?.kind === "disable-required"
                  ? "필수 입력 항목을 비활성화할까요?"
                  : "사용하지 않는 항목을 필수 입력으로 설정할까요?"}
            </DialogTitle>
            <DialogDescription>
              {pendingAction?.kind === "delete"
                ? "제거하면 필수 입력도 해제되고 새 입력 화면에서 숨겨집니다. 기존 측정 기록은 유지되며, + 바이탈 추가에서 기본값으로 다시 추가할 수 있습니다."
                : pendingAction?.kind === "disable-required"
                  ? "계속하면 필수 입력을 해제하고 사용도 끕니다. 기존 측정 기록은 유지됩니다."
                  : "계속하면 사용과 필수 입력을 함께 켭니다. 기존 기록은 그대로 조회되고, 수정 저장에는 현재 필수 규칙이 적용됩니다."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={closePendingAction} variant="outline">취소</Button>
            <Button
              onClick={confirmPendingAction}
              variant={pendingAction?.kind === "delete" ? "destructive" : "default"}
            >
              {pendingAction?.kind === "delete" ? "목록에서 제거" : pendingAction?.kind === "disable-required" ? "필수 입력 해제 후 비활성화" : "사용 켜고 필수 입력으로 설정"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => !saving && setSaveOpen(open)}
        open={saveOpen}
      >
        <DialogContent data-testid="vital-settings-save-dialog">
          <DialogHeader>
            <DialogTitle>바이탈 설정을 저장할까요?</DialogTitle>
            <DialogDescription>
              저장하면 워크스페이스의 접수와 진료 화면에 같은 설정이 적용됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-muted/60 p-3">
            <p className="text-xs font-medium text-muted-foreground">
              사용할 바이탈
            </p>
            <p className="mt-1 text-sm">
              {enabledLabels.length > 0 ? enabledLabels.join(" · ") : "없음"}
            </p>
          </div>
          {removedLabels.length > 0 ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
              <p className="text-sm">
                목록에서 제거: {removedLabels.join(" · ")}
              </p>
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">
            사용을 끈 항목은 신규 입력과 일반 화면에서 숨겨집니다. 기존 기록은
            삭제되지 않으며 다시 켜면 표시됩니다.
          </p>
          {removedLabels.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              목록에서 제거한 항목은 신규 입력과 일반 화면에서 숨겨집니다. 기존
              기록은 삭제되지 않으며, 바이탈 추가에서 다시 추가할 수 있습니다.
            </p>
          ) : null}
          <DialogFooter>
            <Button
              disabled={saving}
              onClick={() => setSaveOpen(false)}
              variant="outline"
            >
              취소
            </Button>
            <Button disabled={saving} onClick={() => void handleSave()}>
              {saving ? "저장 중…" : "저장"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </HospitalSettingsPage>
  );
}

function SortableVitalRow({
  canManage,
  item,
  label,
  onEnabledChange,
  onRemove,
  onRequiredChange,
  onUnitChange,
  units,
}: {
  canManage: boolean;
  item: WorkspaceVitalSetting;
  label: string;
  onEnabledChange(enabled: boolean): void;
  onRemove(): void;
  onRequiredChange(): void;
  onUnitChange(unit: WorkspaceVitalUnit): void;
  units: WorkspaceVitalUnit[];
}) {
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    disabled: !canManage,
    id: item.key,
  });
  return (
    <div
      className={cn(
        "relative flex min-h-[85px] flex-col gap-3 px-4 py-4 after:absolute after:right-4 after:bottom-0 after:left-4 after:h-px after:bg-border md:flex-row md:items-center md:justify-between md:gap-4 md:px-6 md:py-5 md:after:right-6 md:after:left-6",
        isDragging && "relative z-10 bg-card shadow-lg ring-1 ring-ring/30",
      )}
      data-testid={`vital-setting-row-${item.key}`}
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Button
          {...attributes}
          {...listeners}
          aria-label={`${label} 순서 변경`}
          className="!size-[18px] !rounded-none !p-0 cursor-grab touch-none text-muted-foreground hover:bg-transparent hover:text-muted-foreground active:cursor-grabbing disabled:cursor-default [&_svg]:!size-[18px]"
          disabled={!canManage}
          ref={setActivatorNodeRef}
          size="tiny"
          type="button"
          variant="ghost"
        >
          <IconReorderAlt />
        </Button>
        <span className="whitespace-nowrap text-[15px] leading-5 font-medium tracking-[0.014em]">
          {label}
        </span>
        {item.inputRequired ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  aria-label={`${label} 필수 입력 안내`}
                  className="shrink-0 rounded-md bg-black/[0.04] px-2 py-0.5 text-sm font-medium text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  type="button"
                >
                  필수 입력
                </button>
              }
            />
            <TooltipContent>
              {item.key === "blood_pressure"
                ? "접수·바이탈 기록 시 수축기와 이완기 값이 모두 필요합니다"
                : "환자 접수 시, 필수 입력 값입니다"}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      <div className="flex w-full items-center justify-between gap-3 md:w-[305px] md:justify-end md:gap-4">
        <Select
          disabled={!canManage || !item.enabled}
          onValueChange={(value) => onUnitChange(value as WorkspaceVitalUnit)}
          value={item.displayUnit}
        >
          <SelectTrigger
            aria-label={`${label} 표시 단위`}
            className="min-w-0 flex-1 md:w-[144px] md:flex-none"
            size="sm"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {units.map((unit) => (
              <SelectItem key={unit} value={unit}>
                {unit}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span aria-hidden="true" className="h-6 w-px shrink-0 bg-border" />
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-sm font-medium">활성</span>
          <Switch
            aria-label={`${label} 사용`}
            checked={item.enabled}
            data-testid={`vital-setting-switch-${item.key}`}
            disabled={!canManage}
            onCheckedChange={onEnabledChange}
            size="md"
          />
        </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  aria-label={`${label} 작업`}
                  className="size-8 text-muted-foreground"
                  data-testid={`vital-setting-more-${item.key}`}
                  disabled={!canManage}
                  size="icon"
                  type="button"
                  variant="ghost"
                />
              }
            >
              <CdsFilesMoreVerticalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={onRequiredChange}>
                  {item.inputRequired ? "필수 입력 해제" : "필수 입력으로 설정"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onRemove} variant="destructive">
                  <CdsActionsTrash2Icon />삭제하기
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
      </div>
    </div>
  );
}

function VitalSettingsState({
  title,
  onRetry,
}: {
  title: string;
  onRetry?: () => void;
}) {
  return (
    <div
      className="flex h-full flex-col"
      data-testid="hospital-admin-vitals-screen"
    >
      <EmrMainContentHeader aria-hidden="true" heightMode="adaptive" />
      <div className="flex min-h-0 flex-1 items-center justify-center p-6">
        <EmrEmptyState
          description="잠시 후 다시 시도하거나 관리자에게 문의하세요."
          kind={onRetry ? "read-error" : "no-permission"}
          primaryAction={
            onRetry ? (
              <Button onClick={onRetry} variant="outline">
                다시 시도
              </Button>
            ) : undefined
          }
          priority={onRetry ? "local-recovery" : "supporting"}
          size="lg"
          surface="content"
          title={title}
        />
      </div>
    </div>
  );
}

function normalizeOrder(items: WorkspaceVitalSetting[]) {
  return items.map((item, sortOrder) => ({ ...item, sortOrder }));
}

function serializeItems(items: WorkspaceVitalSetting[]) {
  return JSON.stringify(normalizeOrder(items));
}
