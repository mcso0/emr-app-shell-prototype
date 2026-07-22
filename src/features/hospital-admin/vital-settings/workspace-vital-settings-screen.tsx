"use client";

import { useEffect, useMemo, useState } from "react";
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
import { CdsActionsRotateCcwIcon } from "@/components/cds-icons/actions-and-controls";
import { CdsFilesMoreVerticalIcon } from "@/components/cds-icons/files-and-layout";
import { EmrEmptyState } from "@/components/emr/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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
  const { reload, snapshot, status } = useWorkspaceVitalSettings({ actorHeaders, workspaceId });
  const [saved, setSaved] = useState<WorkspaceVitalSettingsSnapshot | null>(null);
  const [draft, setDraft] = useState<WorkspaceVitalSettingsSnapshot | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const setSettingsDirty = useHospitalAdminStore((state) => state.setSettingsDirty);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (status !== "ready") return;
    const next = cloneWorkspaceVitalSettingsSnapshot(snapshot);
    // The fetched server snapshot becomes the editor's reset baseline.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaved(next);
    setDraft(cloneWorkspaceVitalSettingsSnapshot(next));
  }, [snapshot, status]);

  const isDirty = Boolean(saved && draft && serializeItems(saved.items) !== serializeItems(draft.items));
  useEffect(() => {
    setSettingsDirty(isDirty);
    return () => setSettingsDirty(false);
  }, [isDirty, setSettingsDirty]);

  useEffect(() => {
    const preventUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", preventUnload);
    return () => window.removeEventListener("beforeunload", preventUnload);
  }, [isDirty]);

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
    return <VitalSettingsState title="바이탈 설정을 불러오지 못했습니다" onRetry={() => void reload()} />;
  }
  if (!draft || !saved) return null;

  const canManage = draft.canManage;
  const updateItems = (items: WorkspaceVitalSetting[]) => {
    setDraft({ ...draft, items: normalizeOrder(items) });
  };
  const updateItem = (key: WorkspaceVitalKey, patch: Partial<WorkspaceVitalSetting>) => {
    updateItems(draft.items.map((item) => item.key === key ? { ...item, ...patch } : item));
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
    updateItems([...draft.items, {
      key,
      enabled: true,
      displayUnit: preset.canonicalUnit,
      sortOrder: draft.items.length,
    }]);
    setAddOpen(false);
  };
  const removeItem = (key: WorkspaceVitalKey) => {
    const removedIndex = draft.items.findIndex((item) => item.key === key);
    const removedItem = draft.items[removedIndex];
    const preset = draft.presets.find((item) => item.key === key);
    if (!removedItem || !preset || preset.requiredInWorkspace) return;

    setDraft((current) => current ? {
      ...current,
      items: normalizeOrder(current.items.filter((item) => item.key !== key)),
    } : current);

    toast.success(`${preset.label}을 목록에서 제거했어요.`, {
      action: {
        label: "되돌리기",
        onClick: () => setDraft((current) => {
          if (!current || current.items.some((item) => item.key === key)) return current;
          const items = [...current.items];
          items.splice(Math.min(removedIndex, items.length), 0, removedItem);
          return { ...current, items: normalizeOrder(items) };
        }),
      },
    });
  };
  const handleSave = async () => {
    setSaving(true);
    try {
      const next = await saveWorkspaceVitalSettings({ actorHeaders, snapshot: draft, workspaceId });
      setSaved(cloneWorkspaceVitalSettingsSnapshot(next));
      setDraft(cloneWorkspaceVitalSettingsSnapshot(next));
      setSaveOpen(false);
      toast.success("바이탈 설정을 저장했어요.");
    } catch (error) {
      toast.error(error instanceof Error && error.message === "denied"
        ? "바이탈 설정을 저장할 권한이 없습니다."
        : "바이탈 설정을 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };
  const enabledLabels = getEnabledWorkspaceVitalSettings(draft).map((item) =>
    draft.presets.find((preset) => preset.key === item.key)?.label ?? item.key,
  );
  const removedLabels = saved.items
    .filter((item) => !draft.items.some((draftItem) => draftItem.key === item.key))
    .map((item) => saved.presets.find((preset) => preset.key === item.key)?.label ?? item.key);

  return (
    <ScrollArea className="h-full" data-testid="hospital-admin-vitals-screen">
      <main className="mx-auto flex w-full max-w-[920px] flex-col gap-6 px-6 py-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">바이탈 관리</h1>
            <p className="text-sm text-muted-foreground">
              병원에서 기록할 바이탈과 표시 순서를 설정합니다.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              data-testid="vital-settings-reset"
              disabled={!canManage || !isDirty || saving}
              onClick={() => setDraft(cloneWorkspaceVitalSettingsSnapshot(saved))}
              variant="outline"
            >
              <CdsActionsRotateCcwIcon data-icon="inline-start" />
              초기화
            </Button>
            <Button
              data-testid="vital-settings-save"
              disabled={!canManage || !isDirty || saving}
              onClick={() => setSaveOpen(true)}
            >
              변경사항 저장
            </Button>
          </div>
        </header>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>사용할 바이탈</CardTitle>
            <CardDescription>
              체중과 체온은 항상 사용되며, 실제 측정값 입력은 선택입니다. 그립을 잡아 표시 순서를 바꿀 수 있습니다.
            </CardDescription>
            <CardAction>
              <Button
                data-testid="vital-settings-add"
                disabled={!canManage || availablePresets.length === 0}
                onClick={() => setAddOpen(true)}
                size="sm"
                variant="outline"
              >
                바이탈 추가
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <div className="grid min-w-[520px] grid-cols-[40px_minmax(0,1fr)_112px_68px_40px] items-center gap-3 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground">
              <span />
              <span>항목</span>
              <span>표시 단위</span>
              <span className="text-center">사용</span>
              <span />
            </div>
            <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd} sensors={sensors}>
              <SortableContext items={draft.items.map((item) => item.key)} strategy={verticalListSortingStrategy}>
                <div data-testid="vital-settings-list">
                  {draft.items.map((item) => {
                    const preset = draft.presets.find((candidate) => candidate.key === item.key);
                    if (!preset) return null;
                    return (
                      <SortableVitalRow
                        canManage={canManage}
                        item={item}
                        key={item.key}
                        label={preset.label}
                        onEnabledChange={(enabled) => updateItem(item.key, { enabled })}
                        onRemove={() => removeItem(item.key)}
                        onUnitChange={(displayUnit) => updateItem(item.key, { displayUnit })}
                        requiredInWorkspace={preset.requiredInWorkspace}
                        units={preset.allowedDisplayUnits}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          </CardContent>
        </Card>

        {!canManage ? (
          <p className="text-sm text-muted-foreground">설정 관리 권한이 있는 사용자만 변경할 수 있습니다.</p>
        ) : null}
      </main>

      <Dialog onOpenChange={setAddOpen} open={addOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>바이탈 추가</DialogTitle>
            <DialogDescription>병원에서 추가로 기록할 항목을 선택하세요.</DialogDescription>
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
                <span className="mt-0.5 block text-xs text-muted-foreground">{preset.description}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={(open) => !saving && setSaveOpen(open)} open={saveOpen}>
        <DialogContent data-testid="vital-settings-save-dialog">
          <DialogHeader>
            <DialogTitle>바이탈 설정을 저장할까요?</DialogTitle>
            <DialogDescription>
              저장하면 워크스페이스의 접수와 진료 화면에 같은 설정이 적용됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-muted/60 p-3">
            <p className="text-xs font-medium text-muted-foreground">사용할 바이탈</p>
            <p className="mt-1 text-sm">{enabledLabels.length > 0 ? enabledLabels.join(" · ") : "없음"}</p>
          </div>
          {removedLabels.length > 0 ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
              <p className="text-sm">목록에서 제거: {removedLabels.join(" · ")}</p>
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">
            사용을 끈 항목은 신규 입력과 일반 화면에서 숨겨집니다. 기존 기록은 삭제되지 않으며 다시 켜면 표시됩니다.
          </p>
          {removedLabels.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              목록에서 제거한 항목은 신규 입력과 일반 화면에서 숨겨집니다. 기존 기록은 삭제되지 않으며, 바이탈 추가에서 다시 추가할 수 있습니다.
            </p>
          ) : null}
          <DialogFooter>
            <Button disabled={saving} onClick={() => setSaveOpen(false)} variant="outline">취소</Button>
            <Button disabled={saving} onClick={() => void handleSave()}>
              {saving ? "저장 중…" : "저장"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ScrollArea>
  );
}

function SortableVitalRow({
  canManage,
  item,
  label,
  onEnabledChange,
  onRemove,
  onUnitChange,
  requiredInWorkspace,
  units,
}: {
  canManage: boolean;
  item: WorkspaceVitalSetting;
  label: string;
  onEnabledChange(enabled: boolean): void;
  onRemove(): void;
  onUnitChange(unit: WorkspaceVitalUnit): void;
  requiredInWorkspace: boolean;
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
        "grid min-w-[520px] grid-cols-[40px_minmax(0,1fr)_112px_68px_40px] items-center gap-3 border-b px-4 py-3 last:border-b-0",
        !item.enabled && "bg-muted/20 text-muted-foreground",
        isDragging && "relative z-10 bg-card shadow-lg ring-1 ring-ring/30",
      )}
      data-testid={`vital-setting-row-${item.key}`}
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <Button
        {...attributes}
        {...listeners}
        aria-label={`${label} 순서 변경`}
        className="size-8 cursor-grab touch-none text-muted-foreground hover:bg-transparent hover:text-muted-foreground active:cursor-grabbing disabled:cursor-default"
        disabled={!canManage}
        ref={setActivatorNodeRef}
        size="icon"
        type="button"
        variant="ghost"
      >
        <IconReorderAlt />
      </Button>
      <span className="font-medium">{label}</span>
      <Select
        disabled={!canManage || units.length === 1}
        onValueChange={(value) => onUnitChange(value as WorkspaceVitalUnit)}
        value={item.displayUnit}
      >
        <SelectTrigger aria-label={`${label} 표시 단위`} className="w-full" size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {units.map((unit) => <SelectItem key={unit} value={unit}>{unit}</SelectItem>)}
        </SelectContent>
      </Select>
      <div className="flex justify-center">
        {requiredInWorkspace ? (
          <Badge aria-label={`${label} 항상 사용`} variant="secondary">필수</Badge>
        ) : (
          <Switch
            aria-label={`${label} 사용`}
            checked={item.enabled}
            disabled={!canManage}
            onCheckedChange={onEnabledChange}
          />
        )}
      </div>
      {requiredInWorkspace ? <span /> : (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                aria-label={`${label} 작업`}
                className="size-8 text-muted-foreground"
                disabled={!canManage}
                size="icon"
                type="button"
                variant="ghost"
              />
            }
          >
            <CdsFilesMoreVerticalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={onRemove} variant="destructive">
                목록에서 제거
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

function VitalSettingsState({ title, onRetry }: { title: string; onRetry?: () => void }) {
  return (
    <div className="flex h-full items-center justify-center p-6" data-testid="hospital-admin-vitals-screen">
      <EmrEmptyState
        description="잠시 후 다시 시도하거나 관리자에게 문의하세요."
        kind={onRetry ? "read-error" : "no-permission"}
        primaryAction={onRetry ? <Button onClick={onRetry} variant="outline">다시 시도</Button> : undefined}
        priority={onRetry ? "local-recovery" : "supporting"}
        size="lg"
        surface="content"
        title={title}
      />
    </div>
  );
}

function normalizeOrder(items: WorkspaceVitalSetting[]) {
  return items.map((item, sortOrder) => ({ ...item, sortOrder }));
}

function serializeItems(items: WorkspaceVitalSetting[]) {
  return JSON.stringify(normalizeOrder(items));
}
