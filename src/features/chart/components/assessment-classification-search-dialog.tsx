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
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { EmrDialogShell } from "@/components/emr/dialog-shell";
import { EmrEmptyState } from "@/components/emr/empty-state";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  AssessmentClassificationCatalogFacet,
  AssessmentClassificationCatalogItem,
  DiagnosisCatalogClientQuery,
  DiagnosisCatalogClientResult,
} from "@/features/chart/diagnosis-catalog-client";
import type { DiagnosisType } from "@/types/emr-domain";
import {
  ClassificationExplorerColumn,
  ClassificationExplorerHeading,
  ClassificationExplorerList,
  ClassificationExplorerOption,
  ClassificationExplorerReviewHeading,
  ClassificationExplorerSearchHeader,
  ClassificationExplorerSortableRow,
} from "./classification-explorer-ui";
import styles from "./assessment-classification-search-dialog.module.css";

export type { AssessmentClassificationCatalogItem } from "@/features/chart/diagnosis-catalog-client";

export type AssessmentClassificationSelection =
  AssessmentClassificationCatalogItem & {
    diagnosisType: DiagnosisType;
    isPrimary: boolean;
  };

export type AssessmentClassificationCatalogStatus =
  "ready" | "loading" | "error" | "permission";

type AssessmentClassificationSearchDialogProps = {
  catalog: AssessmentClassificationCatalogItem[];
  catalogErrorMessage?: string;
  catalogStatus?: AssessmentClassificationCatalogStatus;
  diseaseGroups?: AssessmentClassificationCatalogFacet[];
  initialSelection: AssessmentClassificationSelection[];
  nextCursor?: string | null;
  open: boolean;
  systems?: AssessmentClassificationCatalogFacet[];
  writeDisabled: boolean;
  onComplete?: (items: AssessmentClassificationSelection[]) => void;
  onOpenChange: (open: boolean) => void;
  onSearchCatalog?: (
    query: DiagnosisCatalogClientQuery,
    signal: AbortSignal,
  ) => Promise<DiagnosisCatalogClientResult>;
};

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
  diseaseGroups: providedDiseaseGroups,
  initialSelection,
  nextCursor = null,
  open,
  systems: providedSystems,
  writeDisabled,
  onComplete,
  onOpenChange,
  onSearchCatalog,
}: AssessmentClassificationSearchDialogProps) {
  const [draft, setDraft] = useState<AssessmentClassificationSelection[]>([]);
  const [selectedSystemId, setSelectedSystemId] = useState("all");
  const [selectedDiseaseGroupId, setSelectedDiseaseGroupId] = useState("all");
  const [diagnosisQuery, setDiagnosisQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [remotePage, setRemotePage] = useState<{
    catalog: AssessmentClassificationCatalogItem[];
    nextCursor: string | null;
  } | null>(null);
  const [remoteSearchStatus, setRemoteSearchStatus] = useState<
    "idle" | "loading" | "error"
  >("idle");
  const [reorderMessage, setReorderMessage] = useState("");
  const requestSequenceRef = useRef(0);
  const wasOpenRef = useRef(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const catalogReady = catalogStatus === "ready";

  const derivedSystems = useMemo(
    () => deriveFacets(catalog, "system"),
    [catalog],
  );
  const systems = providedSystems?.length ? providedSystems : derivedSystems;
  const derivedDiseaseGroups = useMemo(
    () => deriveFacets(catalog, "diseaseGroup"),
    [catalog],
  );
  const diseaseGroups = providedDiseaseGroups?.length
    ? providedDiseaseGroups
    : derivedDiseaseGroups;
  const visibleDiseaseGroups = diseaseGroups.filter(
    (item) => selectedSystemId === "all" || item.systemId === selectedSystemId,
  );
  const totalCount =
    systems.reduce((sum, item) => sum + item.count, 0) || catalog.length;
  const localSnapshotComplete = nextCursor === null;

  useEffect(() => {
    if (open && !wasOpenRef.current) setDraft(initialSelection);
    wasOpenRef.current = open;
  }, [initialSelection, open]);

  useEffect(() => {
    if (
      !open ||
      !catalogReady ||
      localSnapshotComplete ||
      !onSearchCatalog ||
      (selectedSystemId === "all" &&
        selectedDiseaseGroupId === "all" &&
        !diagnosisQuery.trim())
    ) {
      return;
    }

    const sequence = ++requestSequenceRef.current;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setRemoteSearchStatus("loading");
      const result = await onSearchCatalog(
        {
          query: diagnosisQuery,
          systemId: selectedSystemId === "all" ? undefined : selectedSystemId,
          diseaseGroupId:
            selectedDiseaseGroupId === "all"
              ? undefined
              : selectedDiseaseGroupId,
        },
        controller.signal,
      ).catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError")
          return null;
        return {
          ok: false as const,
          status: 500,
          catalogStatus: "error" as const,
          error: "db_read_failed",
        };
      });
      if (!result || sequence !== requestSequenceRef.current) return;
      if (result.ok) {
        setRemotePage({
          catalog: result.page.catalog,
          nextCursor: result.page.nextCursor,
        });
        setRemoteSearchStatus("idle");
      } else {
        setRemoteSearchStatus("error");
      }
    }, 150);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    catalogReady,
    diagnosisQuery,
    localSnapshotComplete,
    onSearchCatalog,
    open,
    selectedDiseaseGroupId,
    selectedSystemId,
  ]);

  const resetDraft = () => {
    setDraft([]);
    setSelectedSystemId("all");
    setSelectedDiseaseGroupId("all");
    setDiagnosisQuery("");
    setSearchOpen(false);
    setRemotePage(null);
    setRemoteSearchStatus("idle");
    setReorderMessage("");
  };
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) resetDraft();
    onOpenChange(nextOpen);
  };

  const localVisibleDiagnoses = catalog.filter((item) => {
    const query = normalize(diagnosisQuery);
    return (
      (selectedSystemId === "all" || item.systemId === selectedSystemId) &&
      (selectedDiseaseGroupId === "all" ||
        item.categoryId === selectedDiseaseGroupId) &&
      (!query ||
        normalize(
          [item.name, item.code, ...item.synonyms].filter(Boolean).join(" "),
        ).includes(query))
    );
  });
  const visibleCatalog = remotePage?.catalog ?? catalog;
  const visibleNextCursor = remotePage?.nextCursor ?? nextCursor;
  const visibleDiagnoses = localSnapshotComplete
    ? localVisibleDiagnoses
    : visibleCatalog;
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
    setDraft((current) => current.filter((item) => item.id !== id));
  };
  const toggleDiagnosis = (item: AssessmentClassificationCatalogItem) => {
    if (writeDisabled || !catalogReady) {
      return;
    }
    setDraft((current) => {
      if (current.some((selected) => selected.id === item.id)) {
        return current.filter((selected) => selected.id !== item.id);
      }
      return [
        ...current,
        {
          ...item,
          diagnosisType: item.defaultType,
          isPrimary: current.length === 0,
        },
      ];
    });
  };

  const handleDragStart = ({ active }: DragStartEvent) => {
    const activeItem = draft.find((item) => item.id === active.id);
    if (activeItem)
      setReorderMessage(`${activeItem.name} 순서 변경을 시작했습니다.`);
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
      if (oldIndex < 0 || newIndex < 0 || newIndex >= current.length)
        return current;
      const movedItem = current[oldIndex];
      setReorderMessage(
        `${movedItem.name} 항목을 ${newIndex + 1}번째로 이동했습니다.`,
      );
      return arrayMove(current, oldIndex, newIndex);
    });
  };

  const loadMore = async () => {
    if (
      !visibleNextCursor ||
      !onSearchCatalog ||
      remoteSearchStatus === "loading"
    )
      return;
    const controller = new AbortController();
    setRemoteSearchStatus("loading");
    const result = await onSearchCatalog(
      {
        query: diagnosisQuery,
        systemId: selectedSystemId === "all" ? undefined : selectedSystemId,
        diseaseGroupId:
          selectedDiseaseGroupId === "all" ? undefined : selectedDiseaseGroupId,
        cursor: visibleNextCursor,
      },
      controller.signal,
    );
    if (result.ok) {
      setRemotePage((current) => {
        const currentCatalog = current?.catalog ?? catalog;
        return {
          catalog: [
            ...currentCatalog,
            ...result.page.catalog.filter(
              (item) =>
                !currentCatalog.some((candidate) => candidate.id === item.id),
            ),
          ],
          nextCursor: result.page.nextCursor,
        };
      });
      setRemoteSearchStatus("idle");
    } else {
      setRemoteSearchStatus("error");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <EmrDialogShell
        variant="wide-form"
        title="분류검색"
        closeAriaLabel="분류검색 닫기"
        className={styles.dialog}
        bodyClassName={styles.body}
        headerClassName={styles.header}
        footerClassName={styles.footer}
        footerMeta={
          <span aria-live="polite">
            {writeDisabled
              ? "읽기 전용 · 변경 권한이 없습니다"
              : `총 ${draft.length}건 선택`}
          </span>
        }
        secondaryAction={
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
          >
            취소
          </Button>
        }
        primaryAction={
          <Button
            type="button"
            disabled={
              (!draft.length && !initialSelection.length) ||
              writeDisabled ||
              !catalogReady
            }
            onClick={() => {
              onComplete?.(draft);
              handleOpenChange(false);
            }}
          >
            선택 완료
          </Button>
        }
      >
        <ClassificationExplorerColumn
          label="진단 계통"
          header={
            <ClassificationExplorerHeading
              count={systems.length}
              label="진단 계통"
            />
          }
          status={catalogStatus}
          statusMessage={catalogErrorMessage}
        >
          <ClassificationExplorerList ariaLabel="진단 계통 목록">
            <ClassificationExplorerOption
              count={totalCount}
              label="전체"
              selected={selectedSystemId === "all"}
              disabled={!catalogReady}
              onClick={() => {
                setSelectedSystemId("all");
                setSelectedDiseaseGroupId("all");
              }}
            />
            {systems.map((system) => (
              <ClassificationExplorerOption
                key={system.id}
                count={system.count}
                label={system.name}
                selected={selectedSystemId === system.id}
                disabled={!catalogReady}
                onClick={() => {
                  setSelectedSystemId(system.id);
                  setSelectedDiseaseGroupId("all");
                }}
              />
            ))}
          </ClassificationExplorerList>
        </ClassificationExplorerColumn>

        <ClassificationExplorerColumn
          label="질환 구분"
          header={
            <ClassificationExplorerHeading
              count={visibleDiseaseGroups.length}
              label="질환 구분"
            />
          }
          status={catalogStatus}
          statusMessage={catalogErrorMessage}
        >
          <ClassificationExplorerList ariaLabel="질환 구분 목록">
            <ClassificationExplorerOption
              count={
                selectedSystemId === "all"
                  ? totalCount
                  : (systems.find((item) => item.id === selectedSystemId)
                      ?.count ?? 0)
              }
              label="전체"
              selected={selectedDiseaseGroupId === "all"}
              disabled={!catalogReady}
              onClick={() => setSelectedDiseaseGroupId("all")}
            />
            {visibleDiseaseGroups.map((diseaseGroup) => (
              <ClassificationExplorerOption
                key={diseaseGroup.id}
                count={diseaseGroup.count}
                label={diseaseGroup.name}
                selected={selectedDiseaseGroupId === diseaseGroup.id}
                disabled={!catalogReady}
                onClick={() => setSelectedDiseaseGroupId(diseaseGroup.id)}
              />
            ))}
          </ClassificationExplorerList>
        </ClassificationExplorerColumn>

        <ClassificationExplorerColumn
          label="진단명"
          className={styles.diagnosisColumn}
          status={catalogStatus}
          statusMessage={catalogErrorMessage}
          header={
            <ClassificationExplorerSearchHeader
              count={totalCount}
              disabled={!catalogReady || writeDisabled}
              label="진단명"
              placeholder="진단명 검색"
              query={diagnosisQuery}
              searchOpen={searchOpen}
              searching={remoteSearchStatus === "loading"}
              onOpenSearch={() => setSearchOpen(true)}
              onQueryChange={setDiagnosisQuery}
              onCloseSearch={() => {
                setSearchOpen(false);
                setDiagnosisQuery("");
                setRemotePage(null);
                setRemoteSearchStatus("idle");
              }}
            />
          }
        >
          {remoteSearchStatus === "error" ? (
            <div className={styles.inlineError} role="alert">
              새 검색 결과를 불러오지 못했습니다. 이전 결과를 유지합니다.
            </div>
          ) : null}
          <DiagnosisOptionList
            catalogReady={catalogReady}
            disabled={writeDisabled}
            items={visibleDiagnoses}
            selectedIds={new Set(draft.map((item) => item.id))}
            onToggle={toggleDiagnosis}
          />
          {visibleNextCursor && onSearchCatalog ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={styles.loadMore}
              disabled={remoteSearchStatus === "loading"}
              onClick={() => void loadMore()}
            >
              {remoteSearchStatus === "loading"
                ? "불러오는 중"
                : "진단명 더 보기"}
            </Button>
          ) : null}
        </ClassificationExplorerColumn>

        <ClassificationExplorerColumn
          label="선택 항목 검토"
          className={styles.selectedColumn}
          header={
            <ClassificationExplorerReviewHeading
              count={draft.length}
              disabled={writeDisabled}
              onClear={() => setDraft([])}
            />
          }
          tone="muted"
        >
          {draft.length ? (
            <DndContext
              collisionDetection={closestCenter}
              sensors={sensors}
              onDragCancel={() =>
                setReorderMessage("순서 변경을 취소했습니다.")
              }
              onDragEnd={handleDragEnd}
              onDragStart={handleDragStart}
            >
              <SortableContext
                items={draft.map((item) => item.id)}
                strategy={verticalListSortingStrategy}
              >
                <ClassificationExplorerList ariaLabel="선택 진단 순서" selected>
                  {draft.map((item) => (
                    <ClassificationExplorerSortableRow
                      key={item.id}
                      id={item.id}
                      label={item.name}
                      disabled={writeDisabled}
                      onMove={(direction) => moveDraftItem(item.id, direction)}
                      onRemove={() => removeDraftItem(item.id)}
                      trailing={
                        <Select
                          value={item.diagnosisType}
                          disabled={writeDisabled}
                          onValueChange={(value) =>
                            value &&
                            updateDraft(item.id, (current) => ({
                              ...current,
                              diagnosisType: value as DiagnosisType,
                            }))
                          }
                        >
                          <SelectTrigger
                            aria-label={`${item.name} 진단 유형`}
                            size="sm"
                            className={styles.typeTrigger}
                          >
                            <SelectValue>
                              {diagnosisTypeItems.find(
                                (type) => type.value === item.diagnosisType,
                              )?.label ?? "의심"}
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
                      }
                    />
                  ))}
                </ClassificationExplorerList>
              </SortableContext>
            </DndContext>
          ) : (
            <EmrEmptyState
              kind="no-data"
              surface="content"
              size="md"
              priority="supporting"
              title="선택된 진단명이 없습니다"
              description="탐색 영역에서 진단명을 선택해 주세요."
              className={styles.emptyState}
            />
          )}
        </ClassificationExplorerColumn>
        <span className="sr-only" aria-live="polite">
          {reorderMessage}
        </span>
      </EmrDialogShell>
    </Dialog>
  );
}

function DiagnosisOptionList({
  catalogReady,
  disabled,
  items,
  selectedIds,
  onToggle,
}: {
  catalogReady: boolean;
  disabled: boolean;
  items: AssessmentClassificationCatalogItem[];
  selectedIds: Set<string>;
  onToggle: (item: AssessmentClassificationCatalogItem) => void;
}) {
  if (!items.length) {
    return (
      <EmrEmptyState
        kind="no-search-results"
        surface="content"
        priority="supporting"
        title="검색 결과가 없습니다"
        description="검색어를 바꾸면 결과가 다시 표시됩니다."
        className={styles.emptyState}
      />
    );
  }

  return (
    <ClassificationExplorerList ariaLabel="진단명 목록">
      {items.map((item) => {
        const selected = selectedIds.has(item.id);
        const itemDisabled = disabled || !catalogReady;
        return (
          <ClassificationExplorerOption
            key={item.id}
            aria-disabled={itemDisabled}
            aria-label={item.name}
            disabled={itemDisabled}
            title={item.name}
            label={item.name}
            selected={selected}
            selectedIndicator
            onClick={() => onToggle(item)}
          />
        );
      })}
    </ClassificationExplorerList>
  );
}

function deriveFacets(
  catalog: AssessmentClassificationCatalogItem[],
  type: "system" | "diseaseGroup",
) {
  const facets = new Map<string, AssessmentClassificationCatalogFacet>();
  catalog.forEach((item) => {
    const id =
      type === "system"
        ? (item.systemId ?? item.systemLabel)
        : (item.categoryId ?? item.categoryLabel);
    const current = facets.get(id);
    facets.set(id, {
      id,
      name: type === "system" ? item.systemLabel : item.categoryLabel,
      count: (current?.count ?? 0) + 1,
      systemId: type === "diseaseGroup" ? item.systemId : undefined,
    });
  });
  return Array.from(facets.values());
}
