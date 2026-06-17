"use client";

import { useState } from "react";

import { CdsActionsSearchIcon } from "@/components/cds-icons/actions-and-controls";
import { EmrRowActionMenu } from "@/components/emr/row-action-menu";
import { EmrStatusBadge } from "@/components/emr/status-badge";
import { EmrTableCheckbox } from "@/components/emr/table-checkbox";
import { EmrTableDensitySelector } from "@/components/emr/table-density-selector";
import {
  EmrTableCellText,
  EmrTableHeaderCell,
} from "@/components/emr/table-primitives";
import type { EmrTableDensity } from "@/components/emr/table-density";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type StorybookTableQueuePattern =
  | "status-cell"
  | "action-cell"
  | "filter-toolbar"
  | "empty-table"
  | "sortable-filterable-header"
  | "row-selection"
  | "density-selector"
  | "long-text-cell";

export type StorybookTableQueuePatternsProps = {
  pattern: StorybookTableQueuePattern;
};

const sampleRows = [
  {
    id: "sample-order-1",
    request: "샘플 혈액검사",
    status: "요청",
    assignee: "담당 미정",
  },
  {
    id: "sample-order-2",
    request: "샘플 영상 판독",
    status: "진행중",
    assignee: "샘플 스태프",
  },
  {
    id: "sample-order-3",
    request: "샘플 처치 확인",
    status: "완료",
    assignee: "샘플 스태프",
  },
];

const filterItems = [
  { value: "all", label: "전체", count: 12 },
  { value: "waiting", label: "대기", count: 5 },
  { value: "active", label: "진행", count: 4 },
  { value: "done", label: "완료", count: 3 },
];

function PatternShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-3xl rounded-[var(--clair-radius-md)] border border-border bg-card p-4">
      {children}
    </div>
  );
}

function TableFrame({ children }: { children: React.ReactNode }) {
  return (
    <Table density="standard" layout="fill" minWidth={560}>
      {children}
    </Table>
  );
}

function StatusCellPattern() {
  return (
    <PatternShell>
      <TableFrame>
        <TableHeader>
          <TableRow>
            <EmrTableHeaderCell>요청</EmrTableHeaderCell>
            <EmrTableHeaderCell>상태</EmrTableHeaderCell>
            <EmrTableHeaderCell>담당</EmrTableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sampleRows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <EmrTableCellText>{row.request}</EmrTableCellText>
              </TableCell>
              <TableCell>
                <EmrStatusBadge label={row.status} />
              </TableCell>
              <TableCell>
                <EmrTableCellText>{row.assignee}</EmrTableCellText>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </TableFrame>
    </PatternShell>
  );
}

function ActionCellPattern() {
  return (
    <PatternShell>
      <TableFrame>
        <TableHeader>
          <TableRow>
            <EmrTableHeaderCell>업무</EmrTableHeaderCell>
            <EmrTableHeaderCell>상태</EmrTableHeaderCell>
            <EmrTableHeaderCell align="right">작업</EmrTableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>
              <EmrTableCellText>샘플 재확인 요청</EmrTableCellText>
            </TableCell>
            <TableCell>
              <EmrStatusBadge label="재요청" />
            </TableCell>
            <TableCell className="text-right">
              <EmrRowActionMenu
                ariaLabel="샘플 재확인 요청 작업"
                items={[
                  {
                    key: "open",
                    label: "상세 보기",
                    description: "현재 행의 합성 상세 화면을 엽니다.",
                  },
                  {
                    key: "assign",
                    label: "담당 지정",
                    description: "담당자를 지정해야 할 때 사용합니다.",
                  },
                  {
                    key: "cancel",
                    label: "요청 취소",
                    description: "되돌리기 어려운 작업에는 확인 단계를 둡니다.",
                    variant: "destructive",
                  },
                ]}
              />
            </TableCell>
          </TableRow>
        </TableBody>
      </TableFrame>
    </PatternShell>
  );
}

function FilterToolbarPattern() {
  const [value, setValue] = useState("all");

  return (
    <PatternShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          aria-label="샘플 업무 상태 필터"
          items={filterItems}
          value={value}
          variant="pill"
          onValueChange={setValue}
        />
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm">
            필터
          </Button>
          <Button type="button" variant="outline" size="icon-sm" aria-label="샘플 업무 검색">
            <CdsActionsSearchIcon aria-hidden="true" />
          </Button>
        </div>
      </div>
    </PatternShell>
  );
}

function EmptyTablePattern() {
  return (
    <PatternShell>
      <TableFrame>
        <TableHeader>
          <TableRow>
            <EmrTableHeaderCell>업무</EmrTableHeaderCell>
            <EmrTableHeaderCell>상태</EmrTableHeaderCell>
            <EmrTableHeaderCell>담당</EmrTableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell colSpan={3} className="h-28 text-center">
              <div className="mx-auto flex max-w-md flex-col items-center gap-1">
                <p className="emr-text-body font-medium text-foreground">
                  현재 조건에 맞는 샘플 업무가 없습니다.
                </p>
                <p className="emr-text-dense text-muted-foreground">
                  필터를 초기화하거나 다른 상태를 선택해 다시 확인하세요.
                </p>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </TableFrame>
    </PatternShell>
  );
}

function SortableFilterableHeaderPattern() {
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [filterActive, setFilterActive] = useState(true);

  return (
    <PatternShell>
      <TableFrame>
        <TableHeader>
          <TableRow>
            <EmrTableHeaderCell
              interaction="sortable-filterable"
              sortDirection={sortDirection}
              filterActive={filterActive}
              onSort={() =>
                setSortDirection((current) => (current === "asc" ? "desc" : "asc"))
              }
              onFilter={() => setFilterActive((current) => !current)}
            >
              요청 시간
            </EmrTableHeaderCell>
            <EmrTableHeaderCell interaction="menu" menuActive onMenu={() => undefined}>
              담당
            </EmrTableHeaderCell>
            <EmrTableHeaderCell>상태</EmrTableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sampleRows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <EmrTableCellText>09:{row.id.endsWith("1") ? "10" : row.id.endsWith("2") ? "25" : "40"}</EmrTableCellText>
              </TableCell>
              <TableCell>
                <EmrTableCellText>{row.assignee}</EmrTableCellText>
              </TableCell>
              <TableCell>
                <EmrStatusBadge label={row.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </TableFrame>
    </PatternShell>
  );
}

function RowSelectionPattern() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(["sample-order-2"])
  );
  const allSelected = sampleRows.every((row) => selectedIds.has(row.id));
  const toggleRow = (rowId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }

      return next;
    });
  };

  return (
    <PatternShell>
      <TableFrame>
        <TableHeader>
          <TableRow>
            <EmrTableHeaderCell className="w-10">
              <EmrTableCheckbox
                aria-label="샘플 행 전체 선택"
                checked={allSelected}
                onCheckedChange={() =>
                  setSelectedIds(() =>
                    allSelected ? new Set() : new Set(sampleRows.map((row) => row.id))
                  )
                }
              />
            </EmrTableHeaderCell>
            <EmrTableHeaderCell>업무</EmrTableHeaderCell>
            <EmrTableHeaderCell>상태</EmrTableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sampleRows.map((row) => (
            <TableRow key={row.id} data-state={selectedIds.has(row.id) ? "selected" : undefined}>
              <TableCell>
                <EmrTableCheckbox
                  aria-label={`${row.request} 선택`}
                  checked={selectedIds.has(row.id)}
                  onCheckedChange={() => toggleRow(row.id)}
                />
              </TableCell>
              <TableCell>
                <EmrTableCellText>{row.request}</EmrTableCellText>
              </TableCell>
              <TableCell>
                <EmrStatusBadge label={row.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </TableFrame>
    </PatternShell>
  );
}

function DensitySelectorPattern() {
  const [density, setDensity] = useState<EmrTableDensity>("standard");

  return (
    <PatternShell>
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="emr-text-dense font-medium text-foreground">
          샘플 표 밀도
        </span>
        <EmrTableDensitySelector value={density} onValueChange={setDensity} />
      </div>
      <Table density={density} layout="fill" minWidth={560}>
        <TableHeader>
          <TableRow>
            <EmrTableHeaderCell>업무</EmrTableHeaderCell>
            <EmrTableHeaderCell>상태</EmrTableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sampleRows.slice(0, 2).map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <EmrTableCellText>{row.request}</EmrTableCellText>
              </TableCell>
              <TableCell>
                <EmrStatusBadge label={row.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </PatternShell>
  );
}

function LongTextCellPattern() {
  return (
    <PatternShell>
      <TableFrame>
        <TableHeader>
          <TableRow>
            <EmrTableHeaderCell>메모</EmrTableHeaderCell>
            <EmrTableHeaderCell>표시 방식</EmrTableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell className="max-w-[260px]">
              <EmrTableCellText mode="one-line">
                샘플 요청 메모가 길어질 때 한 줄 말줄임으로 표 밀도를 유지합니다.
              </EmrTableCellText>
            </TableCell>
            <TableCell>one-line</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="max-w-[260px]">
              <EmrTableCellText mode="two-line-if-long">
                샘플 요청 메모가 두 줄까지 표시되어야 할 때 사용합니다. 실제 환자 또는 보호자 정보는 사용하지 않습니다.
              </EmrTableCellText>
            </TableCell>
            <TableCell>two-line-if-long</TableCell>
          </TableRow>
        </TableBody>
      </TableFrame>
    </PatternShell>
  );
}

/**
 * Storybook-only EMR table and queue pattern preview.
 *
 * Use this component to document repeated table/queue cell and toolbar
 * compositions without promoting a new shared runtime API.
 *
 * @summary Storybook-only EMR table/queue pattern preview
 */
export function StorybookTableQueuePatterns({
  pattern,
}: StorybookTableQueuePatternsProps) {
  if (pattern === "action-cell") return <ActionCellPattern />;
  if (pattern === "filter-toolbar") return <FilterToolbarPattern />;
  if (pattern === "empty-table") return <EmptyTablePattern />;
  if (pattern === "sortable-filterable-header") return <SortableFilterableHeaderPattern />;
  if (pattern === "row-selection") return <RowSelectionPattern />;
  if (pattern === "density-selector") return <DensitySelectorPattern />;
  if (pattern === "long-text-cell") return <LongTextCellPattern />;

  return <StatusCellPattern />;
}
