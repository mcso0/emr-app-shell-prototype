"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
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
import {
  CdsActionsCheckIcon,
  CdsActionsTrashIcon,
} from "@/components/cds-icons/actions-and-controls";
import {
  CdsNavigationChevronDownIcon,
  CdsNavigationChevronLeftIcon,
  CdsNavigationChevronUpIcon,
} from "@/components/cds-icons/navigation";
import { EmrDialogShell } from "@/components/emr/dialog-shell";
import { EmrEmptyState } from "@/components/emr/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Radio, RadioGroup } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { DiagnosisType } from "@/types/emr-domain";
import styles from "./assessment-classification-search-dialog.module.css";

export type AssessmentClassificationCatalogItem = {
  id: string;
  code?: string;
  categoryId?: string;
  name: string;
  masterId?: string;
  masterRevision?: number;
  systemId?: string;
  systemLabel: string;
  categoryLabel: string;
  synonyms: string[];
  defaultType: DiagnosisType;
  hint?: string;
};

export type AssessmentClassificationSelection =
  AssessmentClassificationCatalogItem & {
    diagnosisType: DiagnosisType;
    isPrimary: boolean;
  };

type AssessmentClassificationSearchDialogProps = {
  catalog: AssessmentClassificationCatalogItem[];
  catalogErrorMessage?: string;
  catalogStatus?: AssessmentClassificationCatalogStatus;
  existingDiagnosisCatalogIds?: string[];
  existingDiagnosisNames: string[];
  hasExistingPrimary: boolean;
  open: boolean;
  writeDisabled: boolean;
  onComplete?: (items: AssessmentClassificationSelection[]) => void;
  onOpenChange: (open: boolean) => void;
};

export type AssessmentClassificationCatalogStatus =
  | "ready"
  | "loading"
  | "error"
  | "permission";

type ExplorerStep = "system" | "category" | "diagnosis";

const diagnosisTypeItems = [
  { value: "confirmed", label: "확진" },
  { value: "differential", label: "감별" },
  { value: "suspected", label: "의심" },
] satisfies Array<{ value: DiagnosisType; label: string }>;

const normalize = (value: string) => value.trim().toLocaleLowerCase("ko-KR");

export function AssessmentClassificationSearchDialog({
  catalog,
  catalogErrorMessage,
  catalogStatus = "ready",
  existingDiagnosisCatalogIds = [],
  existingDiagnosisNames,
  hasExistingPrimary,
  open,
  writeDisabled,
  onComplete,
  onOpenChange,
}: AssessmentClassificationSearchDialogProps) {
  const [draft, setDraft] = useState<AssessmentClassificationSelection[]>([]);
  const [selectedSystem, setSelectedSystem] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [systemQuery, setSystemQuery] = useState("");
  const [categoryQuery, setCategoryQuery] = useState("");
  const [diagnosisQuery, setDiagnosisQuery] = useState("");
  const [mobileStep, setMobileStep] = useState<ExplorerStep>("system");
  const [trayOpen, setTrayOpen] = useState(false);
  const [hoveredReviewId, setHoveredReviewId] = useState<string | null>(null);
  const [focusedReviewId, setFocusedReviewId] = useState<string | null>(null);
  const [reorderMessage, setReorderMessage] = useState("");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const catalogReady = catalogStatus === "ready";

  const resetDraft = () => {
    setDraft([]);
    setSelectedSystem("all");
    setSelectedCategory("all");
    setSystemQuery("");
    setCategoryQuery("");
    setDiagnosisQuery("");
    setMobileStep("system");
    setTrayOpen(false);
    setHoveredReviewId(null);
    setFocusedReviewId(null);
    setReorderMessage("");
  };
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) resetDraft();
    onOpenChange(nextOpen);
  };

  const existingNameSet = useMemo(
    () => new Set(existingDiagnosisNames.map(normalize)),
    [existingDiagnosisNames],
  );
  const existingIdSet = useMemo(
    () => new Set(existingDiagnosisCatalogIds),
    [existingDiagnosisCatalogIds],
  );
  const systems = useMemo(
    () => Array.from(new Set(catalog.map((item) => item.systemLabel))),
    [catalog],
  );
  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          catalog
            .filter(
              (item) =>
                selectedSystem === "all" || item.systemLabel === selectedSystem,
            )
            .map((item) => item.categoryLabel),
        ),
      ),
    [catalog, selectedSystem],
  );
  const visibleSystems = systems.filter((systemLabel) =>
    normalize(systemLabel).includes(normalize(systemQuery)),
  );
  const visibleCategories = categories.filter((categoryLabel) =>
    normalize(categoryLabel).includes(normalize(categoryQuery)),
  );
  const visibleDiagnoses = catalog.filter((item) => {
    const query = normalize(diagnosisQuery);
    return (
      (selectedSystem === "all" || item.systemLabel === selectedSystem) &&
      (selectedCategory === "all" || item.categoryLabel === selectedCategory) &&
      (!query ||
        normalize(
          [
            item.name,
            item.systemLabel,
            item.categoryLabel,
            item.hint,
            ...item.synonyms,
          ].join(" "),
        ).includes(query))
    );
  });

  const primaryId = draft.find((item) => item.isPrimary)?.id ?? "";
  const revealedDeleteId = hoveredReviewId ?? focusedReviewId;

  const updateDraft = (
    id: string,
    update: (
      item: AssessmentClassificationSelection,
    ) => AssessmentClassificationSelection,
  ) => {
    setDraft((current) =>
      current.map((item) => (item.id === id ? update(item) : item)),
    );
  };
  const removeDraftItem = (id: string) => {
    setDraft((current) => {
      const removed = current.find((item) => item.id === id);
      const next = current.filter((item) => item.id !== id);
      if (removed?.isPrimary && !hasExistingPrimary && next.length) {
        next[0] = { ...next[0], isPrimary: true };
      }
      return next;
    });
    setHoveredReviewId((current) => (current === id ? null : current));
    setFocusedReviewId((current) => (current === id ? null : current));
  };
  const toggleDiagnosis = (item: AssessmentClassificationCatalogItem) => {
    if (
      existingIdSet.has(item.id) ||
      existingNameSet.has(normalize(item.name)) ||
      writeDisabled ||
      !catalogReady
    )
      return;
    setDraft((current) => {
      if (current.some((selected) => selected.id === item.id)) {
        const removed = current.find((selected) => selected.id === item.id);
        const next = current.filter((selected) => selected.id !== item.id);
        if (removed?.isPrimary && !hasExistingPrimary && next.length) {
          next[0] = { ...next[0], isPrimary: true };
        }
        return next;
      }
      return [
        ...current,
        {
          ...item,
          diagnosisType: item.defaultType,
          isPrimary: !hasExistingPrimary && current.length === 0,
        },
      ];
    });
    setTrayOpen(true);
  };

  const handleDragStart = ({ active }: DragStartEvent) => {
    const activeItem = draft.find((item) => item.id === active.id);
    if (activeItem) setReorderMessage(`${activeItem.name} 순서 변경을 시작했습니다.`);
  };
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id || writeDisabled) {
      setReorderMessage("");
      return;
    }
    const oldIndex = draft.findIndex((item) => item.id === active.id);
    const newIndex = draft.findIndex((item) => item.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const movedItem = draft[oldIndex];
    setDraft((current) => arrayMove(current, oldIndex, newIndex));
    setReorderMessage(
      `${movedItem.name} 항목을 ${newIndex + 1}번째로 이동했습니다.`,
    );
  };
  const moveDraftItem = (id: string, direction: -1 | 1) => {
    setDraft((current) => {
      const oldIndex = current.findIndex((item) => item.id === id);
      const newIndex = oldIndex + direction;
      if (oldIndex < 0 || newIndex < 0 || newIndex >= current.length) {
        return current;
      }
      const movedItem = current[oldIndex];
      setReorderMessage(
        `${movedItem.name} 항목을 ${newIndex + 1}번째로 이동했습니다.`,
      );
      return arrayMove(current, oldIndex, newIndex);
    });
  };

  const systemList = (
    <div className="grid gap-1 p-1.5" role="listbox" aria-label="계통분류 목록">
      <ExplorerOption
        count={catalog.length}
        label="전체"
        selected={selectedSystem === "all"}
        onClick={() => {
          if (!catalogReady) return;
          setSelectedSystem("all");
          setSelectedCategory("all");
          setMobileStep("category");
        }}
      />
      {visibleSystems.map((systemLabel) => (
        <ExplorerOption
          key={systemLabel}
          count={catalog.filter((item) => item.systemLabel === systemLabel).length}
          label={systemLabel}
          selected={selectedSystem === systemLabel}
          onClick={() => {
            if (!catalogReady) return;
            setSelectedSystem(systemLabel);
            setSelectedCategory("all");
            setMobileStep("category");
          }}
        />
      ))}
    </div>
  );

  const categoryList = (
    <div className="grid gap-1 p-1.5" role="listbox" aria-label="질환 구분 목록">
      <ExplorerOption
        count={catalog.filter(
          (item) =>
            selectedSystem === "all" || item.systemLabel === selectedSystem,
        ).length}
        label="전체"
        selected={selectedCategory === "all"}
        onClick={() => {
          if (!catalogReady) return;
          setSelectedCategory("all");
          setMobileStep("diagnosis");
        }}
      />
      {visibleCategories.map((categoryLabel) => (
        <ExplorerOption
          key={categoryLabel}
          count={catalog.filter(
            (item) =>
              (selectedSystem === "all" || item.systemLabel === selectedSystem) &&
              item.categoryLabel === categoryLabel,
          ).length}
          label={categoryLabel}
          selected={selectedCategory === categoryLabel}
          onClick={() => {
            if (!catalogReady) return;
            setSelectedCategory(categoryLabel);
            setMobileStep("diagnosis");
          }}
        />
      ))}
    </div>
  );

  const diagnosisList = (
    <div className="grid gap-1 p-1.5" role="listbox" aria-label="분류 진단명 목록">
      {visibleDiagnoses.map((item) => {
        const selected = draft.some((draftItem) => draftItem.id === item.id);
        const alreadyAdded =
          existingIdSet.has(item.id) || existingNameSet.has(normalize(item.name));
        return (
          <div
            key={item.id}
            role="option"
            aria-selected={selected || alreadyAdded}
            aria-disabled={alreadyAdded || writeDisabled || !catalogReady}
            aria-label={alreadyAdded ? `${item.name}, 이미 추가됨` : undefined}
            tabIndex={alreadyAdded || writeDisabled || !catalogReady ? -1 : 0}
            className="grid min-h-[52px] cursor-pointer grid-cols-[minmax(0,1fr)_24px] items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-[var(--emr-state-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--clair-color-atomic-sky-500)] aria-selected:bg-[var(--emr-state-selected)] aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
            onClick={() => toggleDiagnosis(item)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                toggleDiagnosis(item);
              }
            }}
          >
            <span className="min-w-0">
              <strong className="block truncate emr-text-dense text-[var(--emr-text-primary)]">
                {item.name}
              </strong>
              <small className="mt-1 block truncate emr-text-micro text-[var(--emr-text-tertiary)]">
                {[item.systemLabel, item.categoryLabel, item.code]
                  .filter(Boolean)
                  .join(" · ")}
              </small>
            </span>
            <CdsActionsCheckIcon
              aria-hidden="true"
              className={cn(
                "size-4 justify-self-center transition-colors",
                selected || alreadyAdded
                  ? "text-[var(--clair-color-atomic-sky-500)]"
                  : "text-[var(--clair-color-atomic-neutral-400)]",
              )}
            />
          </div>
        );
      })}
      {!visibleDiagnoses.length && catalogReady ? (
        <EmrEmptyState
          kind="no-search-results"
          surface="content"
          priority="supporting"
          title="조건에 맞는 진단명이 없습니다"
          description="검색어를 지우거나 전체 분류에서 다시 찾아보세요."
          className="min-h-52"
        />
      ) : null}
    </div>
  );

  const reviewRows = (
    <RadioGroup
      aria-label="주진단 선택"
      value={primaryId}
      onValueChange={(id) =>
        setDraft((current) =>
          current.map((item) => ({ ...item, isPrimary: item.id === id })),
        )
      }
      className="gap-0"
    >
      <DndContext
        collisionDetection={closestCenter}
        sensors={sensors}
        onDragCancel={() => setReorderMessage("순서 변경을 취소했습니다.")}
        onDragEnd={handleDragEnd}
        onDragStart={handleDragStart}
      >
        <SortableContext
          items={draft.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          {draft.map((item) => (
            <SortableReviewRow
              key={item.id}
              item={item}
              deleteVisible={revealedDeleteId === item.id}
              disabled={writeDisabled}
              primaryDisabled={hasExistingPrimary}
              onDiagnosisTypeChange={(diagnosisType) =>
                updateDraft(item.id, (current) => ({
                  ...current,
                  diagnosisType,
                }))
              }
              onFocusChange={(focused) =>
                setFocusedReviewId(focused ? item.id : null)
              }
              onHoverChange={(hovered) =>
                setHoveredReviewId(hovered ? item.id : null)
              }
              onMove={(direction) => moveDraftItem(item.id, direction)}
              onRemove={() => removeDraftItem(item.id)}
            />
          ))}
        </SortableContext>
      </DndContext>
    </RadioGroup>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <EmrDialogShell
        variant="wide-form"
        title="분류 검색"
        closeAriaLabel="분류 검색 닫기"
        className={styles.dialog}
        bodyClassName="min-h-0 overflow-hidden p-0"
        headerClassName="min-h-[52px] justify-center px-5 py-0"
        footerClassName="min-h-[60px] px-4 py-3"
        footerMeta={
          <span aria-live="polite">
            {draft.length
              ? `${draft.length}건을 선택했습니다.`
              : "선택된 항목이 없습니다."}
          </span>
        }
        secondaryAction={
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            취소
          </Button>
        }
        primaryAction={
          <Button
            type="button"
            disabled={!draft.length || writeDisabled || !catalogReady}
            onClick={() => {
              onComplete?.(draft);
              handleOpenChange(false);
            }}
          >
            선택 완료{draft.length ? ` (${draft.length})` : ""}
          </Button>
        }
      >
        <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] min-[1280px]:grid-cols-[minmax(0,7fr)_minmax(280px,3fr)] min-[1280px]:grid-rows-1">
          <section className="min-h-0" aria-label="진단 분류 탐색">
            {catalogStatus !== "ready" ? (
              <CatalogStatusPanel
                message={catalogErrorMessage}
                status={catalogStatus}
              />
            ) : null}
            <div
              className={cn(
                "hidden h-full min-h-0 grid-cols-[minmax(160px,0.82fr)_minmax(180px,0.94fr)_minmax(300px,1.64fr)] min-[960px]:grid",
                catalogStatus !== "ready" && "!hidden",
              )}
            >
              <ExplorerColumn
                label="계통분류"
                searchLabel="계통분류 검색"
                query={systemQuery}
                onQueryChange={setSystemQuery}
                className="border-r border-[var(--emr-border-default)]"
              >
                {systemList}
              </ExplorerColumn>
              <ExplorerColumn
                label="질환 구분"
                searchLabel="질환 구분 검색"
                query={categoryQuery}
                onQueryChange={setCategoryQuery}
                className="border-r border-[var(--emr-border-default)]"
              >
                {categoryList}
              </ExplorerColumn>
              <ExplorerColumn
                label="진단명"
                searchLabel="현재 분류 내 진단명 검색"
                query={diagnosisQuery}
                onQueryChange={setDiagnosisQuery}
                count={visibleDiagnoses.length}
              >
                {diagnosisList}
              </ExplorerColumn>
            </div>

            <div
              className={cn(
                "grid h-full min-h-0 grid-rows-[44px_minmax(0,1fr)] min-[960px]:hidden",
                catalogStatus !== "ready" && "hidden",
              )}
            >
              <div className="grid grid-cols-3 border-b border-[var(--emr-border-default)] px-3">
                {[
                  { id: "system" as const, label: "계통분류" },
                  { id: "category" as const, label: "질환 구분" },
                  { id: "diagnosis" as const, label: "진단명" },
                ].map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-current={mobileStep === item.id ? "step" : undefined}
                    className={cn(
                      "flex items-center justify-center gap-1.5 emr-text-metadata font-semibold",
                      mobileStep === item.id
                        ? "text-[var(--emr-text-primary)]"
                        : "text-[var(--emr-text-tertiary)]",
                    )}
                    onClick={() => setMobileStep(item.id)}
                  >
                    <span
                      className={cn(
                        "grid size-5 place-items-center rounded-full border border-[var(--emr-border-default)] emr-text-micro",
                        mobileStep === item.id &&
                          "border-[var(--emr-text-primary)] bg-[var(--emr-text-primary)] text-white",
                      )}
                    >
                      {index + 1}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </button>
                ))}
              </div>
              {mobileStep === "system" ? (
                <MobileExplorerStep
                  label="계통분류"
                  searchLabel="계통분류 검색"
                  query={systemQuery}
                  onQueryChange={setSystemQuery}
                >
                  {systemList}
                </MobileExplorerStep>
              ) : mobileStep === "category" ? (
                <MobileExplorerStep
                  label="질환 구분"
                  searchLabel="질환 구분 검색"
                  query={categoryQuery}
                  onQueryChange={setCategoryQuery}
                  backLabel="계통 다시 선택"
                  onBack={() => setMobileStep("system")}
                >
                  {categoryList}
                </MobileExplorerStep>
              ) : (
                <MobileExplorerStep
                  label="진단명"
                  searchLabel="현재 분류 내 진단명 검색"
                  query={diagnosisQuery}
                  onQueryChange={setDiagnosisQuery}
                  backLabel="질환 구분 다시 선택"
                  onBack={() => setMobileStep("category")}
                >
                  {diagnosisList}
                </MobileExplorerStep>
              )}
            </div>
          </section>

          <section
            aria-label="선택 항목 검토"
            className={cn(
              "grid min-h-0 border-t border-[var(--emr-border-default)] bg-[var(--emr-surface-muted)] min-[1280px]:grid-rows-[44px_minmax(0,1fr)] min-[1280px]:border-l min-[1280px]:border-t-0",
              trayOpen
                ? "grid-rows-[44px_minmax(0,224px)]"
                : "grid-rows-[44px]",
            )}
          >
            <div className="hidden items-center justify-between border-b border-[var(--emr-border-default)] bg-[var(--emr-surface-panel)] px-3 min-[1280px]:flex">
              <ReviewHeading count={draft.length} onClear={() => setDraft([])} />
            </div>
            <button
              type="button"
              aria-expanded={trayOpen}
              className="flex h-11 w-full items-center justify-between bg-[var(--emr-surface-panel)] px-3 emr-text-dense font-semibold min-[1280px]:hidden"
              onClick={() => setTrayOpen((current) => !current)}
            >
              <span className="flex items-center gap-2">
                선택 항목 <Badge variant="secondary">{draft.length}</Badge>
              </span>
              {trayOpen ? (
                <CdsNavigationChevronDownIcon className="size-4" />
              ) : (
                <CdsNavigationChevronUpIcon className="size-4" />
              )}
            </button>
            <div
              className={cn(
                "min-h-0 overflow-hidden min-[1280px]:block",
                trayOpen ? "block" : "hidden",
              )}
            >
              <div className="grid h-9 grid-cols-[24px_minmax(80px,1fr)_84px_28px_28px] items-center gap-1 border-b border-[var(--emr-border-default)] bg-[var(--emr-surface-panel)] px-2 emr-text-micro font-semibold text-[var(--emr-text-tertiary)]">
                <span aria-hidden="true" />
                <span>진단명</span>
                <span>유형</span>
                <span className="text-center">주</span>
                <span aria-hidden="true" />
              </div>
              <ScrollArea className="h-[calc(100%-36px)] min-h-0">
                {draft.length ? (
                  reviewRows
                ) : (
                  <EmrEmptyState
                    kind="no-data"
                    surface="content"
                    priority="supporting"
                    title="선택한 진단이 없습니다"
                    description="탐색 영역에서 진단명을 선택해 주세요."
                    className="min-h-48"
                  />
                )}
              </ScrollArea>
            </div>
          </section>
          <span className="sr-only" aria-live="polite">
            {reorderMessage}
          </span>
        </div>
      </EmrDialogShell>
    </Dialog>
  );
}

function ExplorerOption({
  count,
  label,
  selected,
  onClick,
}: {
  count: number;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      className="flex min-h-9 items-center justify-between rounded-lg px-2.5 text-left emr-text-dense hover:bg-[var(--emr-state-hover)] aria-selected:bg-[var(--emr-state-selected)] aria-selected:font-semibold"
      onClick={onClick}
    >
      <span className="truncate">{label}</span>
      <span className="ml-2 emr-text-micro text-[var(--emr-text-tertiary)]">
        {count}
      </span>
    </button>
  );
}

function CatalogStatusPanel({
  message,
  status,
}: {
  message?: string;
  status: AssessmentClassificationCatalogStatus;
}) {
  if (status === "loading") {
    return (
      <div
        className="grid h-full min-h-52 place-items-center px-6 py-10 text-center"
        role="status"
        aria-live="polite"
      >
        <div className="grid gap-2">
          <strong className="emr-text-dense text-[var(--emr-text-primary)]">
            진단 분류를 불러오는 중입니다
          </strong>
          <span className="emr-text-metadata text-[var(--emr-text-tertiary)]">
            잠시만 기다려 주세요.
          </span>
        </div>
      </div>
    );
  }

  return (
    <EmrEmptyState
      kind={status === "permission" ? "no-permission" : "read-error"}
      surface="content"
      priority="local-recovery"
      title={
        status === "permission"
          ? "진단 분류를 볼 권한이 없습니다"
          : "진단 분류를 불러오지 못했습니다"
      }
      description={
        message ??
        (status === "permission"
          ? "차트 조회 권한을 확인해 주세요."
          : "잠시 후 다시 시도해 주세요.")
      }
      className="h-full min-h-52 px-6 py-10"
    />
  );
}

function ExplorerColumn({
  children,
  className,
  count,
  label,
  query,
  searchLabel,
  onQueryChange,
}: {
  children: ReactNode;
  className?: string;
  count?: number;
  label: string;
  query: string;
  searchLabel: string;
  onQueryChange: (value: string) => void;
}) {
  return (
    <section
      className={cn(
        "grid min-h-0 grid-rows-[72px_minmax(0,1fr)]",
        className,
      )}
      aria-label={label}
    >
      <div className="border-b border-[var(--emr-border-default)] p-2.5">
        <div className="flex items-center justify-between gap-2">
          <strong className="emr-text-dense">{label}</strong>
          {count !== undefined ? (
            <span className="emr-text-micro text-[var(--emr-text-tertiary)]">
              {count}건
            </span>
          ) : null}
        </div>
        <Input
          aria-label={searchLabel}
          value={query}
          placeholder={searchLabel}
          className="mt-1.5 h-8 emr-text-metadata"
          onValueChange={onQueryChange}
        />
      </div>
      <ScrollArea className="min-h-0">{children}</ScrollArea>
    </section>
  );
}

function MobileExplorerStep({
  backLabel,
  children,
  label,
  query,
  searchLabel,
  onBack,
  onQueryChange,
}: {
  backLabel?: string;
  children: ReactNode;
  label: string;
  query: string;
  searchLabel: string;
  onBack?: () => void;
  onQueryChange: (value: string) => void;
}) {
  return (
    <section
      className={cn(
        "grid min-h-0",
        onBack
          ? "grid-rows-[58px_minmax(0,1fr)_42px]"
          : "grid-rows-[58px_minmax(0,1fr)]",
      )}
      aria-label={`${label} 단계`}
    >
      <div className="border-b border-[var(--emr-border-default)] p-3">
        <Input
          aria-label={searchLabel}
          value={query}
          placeholder={searchLabel}
          className="h-8 emr-text-metadata"
          onValueChange={onQueryChange}
        />
      </div>
      <ScrollArea className="min-h-0">{children}</ScrollArea>
      {onBack ? (
        <div className="flex items-center border-t border-[var(--emr-border-default)] px-3">
          <Button type="button" variant="ghost" size="xs" onClick={onBack}>
            <CdsNavigationChevronLeftIcon className="size-3.5" />
            {backLabel}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function ReviewHeading({ count, onClear }: { count: number; onClear: () => void }) {
  return (
    <>
      <div className="flex items-center gap-2">
        <strong className="emr-text-dense">선택 항목</strong>
        <Badge variant="secondary">{count}</Badge>
      </div>
      {count ? (
        <Button type="button" variant="ghost" size="xs" onClick={onClear}>
          모두 지우기
        </Button>
      ) : null}
    </>
  );
}

function SortableReviewRow({
  deleteVisible,
  disabled,
  item,
  onDiagnosisTypeChange,
  onFocusChange,
  onHoverChange,
  onMove,
  onRemove,
  primaryDisabled,
}: {
  deleteVisible: boolean;
  disabled: boolean;
  item: AssessmentClassificationSelection;
  onDiagnosisTypeChange: (value: DiagnosisType) => void;
  onFocusChange: (focused: boolean) => void;
  onHoverChange: (hovered: boolean) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  primaryDisabled: boolean;
}) {
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ disabled, id: item.id });
  const sortableKeyDown = listeners?.onKeyDown;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "grid min-h-10 grid-cols-[24px_minmax(80px,1fr)_84px_28px_28px] items-center gap-1 border-b border-[var(--emr-border-default)] bg-[var(--emr-surface-panel)] px-2 transition-[background-color,box-shadow]",
        isDragging &&
          "relative z-10 bg-[var(--emr-state-selected)] shadow-md ring-1 ring-ring/30",
      )}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      onFocusCapture={() => onFocusChange(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          onFocusChange(false);
        }
      }}
    >
      <Button
        {...attributes}
        {...listeners}
        ref={setActivatorNodeRef}
        type="button"
        variant="ghost"
        size="tiny"
        disabled={disabled}
        aria-label={`${item.name} 순서 변경`}
        className="cursor-grab touch-none text-[var(--emr-text-tertiary)] hover:bg-transparent active:cursor-grabbing"
        onKeyDown={(event) => {
          if (event.altKey && event.key === "ArrowUp") {
            event.preventDefault();
            onMove(-1);
            return;
          }
          if (event.altKey && event.key === "ArrowDown") {
            event.preventDefault();
            onMove(1);
            return;
          }
          sortableKeyDown?.(event);
        }}
      >
        <IconReorderAlt aria-hidden="true" />
      </Button>
      <strong className="truncate emr-text-dense font-semibold text-[var(--emr-text-primary)]">
        {item.name}
      </strong>
      <Select
        value={item.diagnosisType}
        disabled={disabled}
        onValueChange={(value) =>
          value && onDiagnosisTypeChange(value as DiagnosisType)
        }
      >
        <SelectTrigger
          aria-label={`${item.name} 진단 유형`}
          size="sm"
          className="w-full px-2"
        >
          <SelectValue>
            {diagnosisTypeItems.find((type) => type.value === item.diagnosisType)
              ?.label ?? "의심"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent align="end">
          {diagnosisTypeItems.map((type) => (
            <SelectItem key={type.value} value={type.value}>
              {type.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <label className="grid size-7 cursor-pointer place-items-center">
        <Radio
          value={item.id}
          disabled={disabled || primaryDisabled}
          aria-label={`${item.name} 주진단 지정`}
        />
      </label>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        disabled={disabled}
        aria-label={`${item.name} 삭제`}
        className={cn(
          "text-[var(--emr-text-tertiary)] transition-opacity",
          deleteVisible
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
        onClick={onRemove}
      >
        <CdsActionsTrashIcon aria-hidden="true" className="size-3.5" />
      </Button>
    </div>
  );
}
