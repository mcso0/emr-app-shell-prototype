"use client";

import { useMemo, useState, type ReactNode } from "react";

import { CdsActionsTrash2Icon } from "@/components/cds-icons/actions-and-controls";
import { EmrIconButton } from "@/components/emr/icon-button";
import { EmrTableCheckbox } from "@/components/emr/table-checkbox";
import {
  EmrTableCellText,
  EmrTableHeaderCell,
} from "@/components/emr/table-primitives";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Diagnosis } from "@/types/emr-domain";

import styles from "./chart-assessment-table.module.css";

export type ChartAssessmentDiagnosis = Diagnosis & {
  catalogMatched: boolean;
  isPrimary: boolean;
  systemLabel: string;
};

type AssessmentSortKey = "diagnosisText" | "systemLabel";
type AssessmentSortState = {
  direction: "asc" | "desc";
  key: AssessmentSortKey;
};

type ChartAssessmentTableProps = {
  diagnoses: ChartAssessmentDiagnosis[];
  emptyState: ReactNode;
  getVeterinarianName: (userId: string) => string;
  loading: boolean;
  loadingState: ReactNode;
  onClosedChange: (diagnosisId: string, checked: boolean) => void;
  onConfirmedChange: (diagnosisId: string, checked: boolean) => void;
  onPrimaryChange: (diagnosisId: string, checked: boolean) => void;
  onRemove: (diagnosisId: string) => void;
  writeDisabled: boolean;
};

const compareDiagnosisRows = (
  left: ChartAssessmentDiagnosis,
  right: ChartAssessmentDiagnosis,
  sort: AssessmentSortState,
) => {
  const comparison = left[sort.key].localeCompare(right[sort.key], "ko-KR", {
    numeric: true,
    sensitivity: "base",
  });

  if (comparison !== 0) return sort.direction === "asc" ? comparison : -comparison;

  return (left.sortOrder ?? 0) - (right.sortOrder ?? 0);
};

export function ChartAssessmentTable({
  diagnoses,
  emptyState,
  getVeterinarianName,
  loading,
  loadingState,
  onClosedChange,
  onConfirmedChange,
  onPrimaryChange,
  onRemove,
  writeDisabled,
}: ChartAssessmentTableProps) {
  const [sort, setSort] = useState<AssessmentSortState | null>(null);
  const sortedDiagnoses = useMemo(
    () => (sort ? [...diagnoses].sort((left, right) => compareDiagnosisRows(left, right, sort)) : diagnoses),
    [diagnoses, sort],
  );
  const empty = !loading && sortedDiagnoses.length === 0;

  const toggleSort = (key: AssessmentSortKey) => {
    setSort((current) => ({
      direction:
        current?.key === key && current.direction === "asc" ? "desc" : "asc",
      key,
    }));
  };

  return (
    <div className={styles.viewportRoot} data-emr-data-table="true">
      <Table
        aria-label="진단명 목록"
        density="standard"
        layout="fill"
        className={styles.table}
        containerClassName={`${styles.tableViewport} min-w-0 bg-[var(--emr-surface-panel)]`}
      >
        <colgroup>
          <col className={styles.systemColumn} />
          <col className={styles.diagnosisColumn} />
          <col className={styles.primaryColumn} />
          <col className={styles.confirmedColumn} />
          <col className={styles.closedColumn} />
          <col className={styles.veterinarianColumn} />
        </colgroup>
        <TableHeader data-slot="chart-assessment-table-header">
          <TableRow className="hover:bg-[var(--clair-color-atomic-neutral-50)]">
            <EmrTableHeaderCell
              interaction="sortable"
              className={`${styles.headerCell} ${styles.firstHeaderCell}`}
              onSort={() => toggleSort("systemLabel")}
              sortDirection={sort?.key === "systemLabel" ? sort.direction : undefined}
              sortLabel="진단계통 정렬"
            >
              진단계통
            </EmrTableHeaderCell>
            <EmrTableHeaderCell
              interaction="sortable"
              className={styles.headerCell}
              onSort={() => toggleSort("diagnosisText")}
              sortDirection={sort?.key === "diagnosisText" ? sort.direction : undefined}
              sortLabel="진단명 정렬"
            >
              진단명
            </EmrTableHeaderCell>
            <EmrTableHeaderCell
              align="center"
              interaction="static"
              className={`${styles.headerCell} ${styles.statusHeaderCell}`}
            >
              주진단
            </EmrTableHeaderCell>
            <EmrTableHeaderCell
              align="center"
              interaction="static"
              className={`${styles.headerCell} ${styles.statusHeaderCell}`}
            >
              확진
            </EmrTableHeaderCell>
            <EmrTableHeaderCell
              align="center"
              interaction="static"
              className={`${styles.headerCell} ${styles.statusHeaderCell}`}
            >
              종결
            </EmrTableHeaderCell>
            <EmrTableHeaderCell
              interaction="static"
              className={`${styles.headerCell} ${styles.veterinarianHeaderCell}`}
            >
              수의사
            </EmrTableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow className="hover:bg-[var(--emr-surface-muted)]">
              <TableCell colSpan={6} className={`${styles.bodyCell} ${styles.feedbackCell}`}>
                {loadingState}
              </TableCell>
            </TableRow>
          ) : null}
          {!loading
            ? sortedDiagnoses.map((diagnosis) => (
                <TableRow
                  key={diagnosis.id}
                  data-slot="chart-assessment-table-row"
                  className={`${styles.tableRow} group/assessment-row`}
                >
                  <TableCell className={`${styles.bodyCell} ${styles.systemCell}`}>
                    <Badge
                      variant="secondary"
                      size="md"
                      className={styles.systemBadge}
                      title={diagnosis.systemLabel}
                    >
                      <span className={styles.systemBadgeText}>
                        {diagnosis.systemLabel}
                      </span>
                    </Badge>
                  </TableCell>
                  <TableCell className={`${styles.bodyCell} ${styles.diagnosisCell}`}>
                    <EmrTableCellText
                      mode="one-line"
                      fullText={diagnosis.diagnosisText}
                    >
                      {diagnosis.diagnosisText}
                    </EmrTableCellText>
                  </TableCell>
                  <TableCell className={`${styles.bodyCell} ${styles.statusCell}`}>
                    <EmrTableCheckbox
                      aria-label={`${diagnosis.diagnosisText} 주진단`}
                      className={styles.statusCheckbox}
                      checked={diagnosis.isPrimary}
                      checkedTone="brand"
                      disabled={writeDisabled}
                      onCheckedChange={(checked) =>
                        onPrimaryChange(diagnosis.id, Boolean(checked))
                      }
                    />
                  </TableCell>
                  <TableCell className={`${styles.bodyCell} ${styles.statusCell}`}>
                    <EmrTableCheckbox
                      aria-label={`${diagnosis.diagnosisText} 확진`}
                      className={styles.statusCheckbox}
                      checked={diagnosis.diagnosisType === "confirmed"}
                      disabled={writeDisabled}
                      onCheckedChange={(checked) =>
                        onConfirmedChange(diagnosis.id, Boolean(checked))
                      }
                    />
                  </TableCell>
                  <TableCell className={`${styles.bodyCell} ${styles.statusCell}`}>
                    <EmrTableCheckbox
                      aria-label={`${diagnosis.diagnosisText} 종결`}
                      className={styles.statusCheckbox}
                      checked={Boolean(diagnosis.closedAt)}
                      disabled={writeDisabled}
                      onCheckedChange={(checked) =>
                        onClosedChange(diagnosis.id, Boolean(checked))
                      }
                    />
                  </TableCell>
                  <TableCell className={`${styles.bodyCell} ${styles.veterinarianCell}`}>
                    <span className={styles.veterinarianContent}>
                      <EmrTableCellText
                        mode="one-line"
                        fullText={getVeterinarianName(diagnosis.createdByUserId)}
                      >
                        {getVeterinarianName(diagnosis.createdByUserId)}
                      </EmrTableCellText>
                    </span>
                    <span
                      className={styles.deleteOverlay}
                      data-slot="chart-assessment-delete-overlay"
                    >
                      <EmrIconButton
                        aria-label={`${diagnosis.diagnosisText} 삭제`}
                        className={styles.deleteButton}
                        disabled={writeDisabled}
                        iconSize="sm"
                        onClick={() => onRemove(diagnosis.id)}
                      >
                        <CdsActionsTrash2Icon
                          aria-hidden="true"
                          className="size-3.5"
                        />
                      </EmrIconButton>
                    </span>
                  </TableCell>
                </TableRow>
              ))
            : null}
          {empty ? (
            <TableRow className="hover:bg-[var(--emr-surface-panel)]">
              <TableCell
                aria-hidden="true"
                colSpan={6}
                className={`${styles.bodyCell} ${styles.emptyCell}`}
              />
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
      {empty ? (
        <div
          className={styles.emptyViewport}
          data-slot="chart-assessment-empty-viewport"
        >
          {emptyState}
        </div>
      ) : null}
    </div>
  );
}
