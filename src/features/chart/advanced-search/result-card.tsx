"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { EmrStatusBadge } from "@/components/emr/status-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CdsFilesMoreHorizontalIcon } from "@/components/cds-icons/files-and-layout";
import { CdsUtilitiesStarIcon } from "@/components/cds-icons/utilities-and-misc";
import {
  CdsActionsCopyIcon,
  CdsActionsCheckCircleIcon,
} from "@/components/cds-icons/actions-and-controls";
import {
  BuildingIcon,
  CalendarIcon,
  DocumentIcon,
  StethoscopeIcon,
} from "@/components/icons";
import { getOperatingDateFromIso } from "@/lib/emr-domain/demo-date";
import { diagnosisLabels, type SearchChart } from "./contract";
import { evidence, searchWords, speciesLabel } from "./ranking";
import { Highlight, stateText, Thumbnail, type CopyMode } from "./presentation";
import styles from "./workspace.module.css";

export const dateText = (value?: string) =>
  getOperatingDateFromIso(value)?.replaceAll("-", ".") ?? "미기록";
export const diagnosesText = (c: SearchChart) =>
  c.diagnoses
    .map((d) => [diagnosisLabels[d.kind], d.name].filter(Boolean).join(" · "))
    .join(", ");
export const chartTitle = (c: SearchChart) =>
  c.purpose || c.complaint || c.patient + " 진료";
export function ChartActions({
  label,
  favorite,
  onFavorite,
  onCopy,
  menu,
  onCopyText,
}: {
  label: string;
  favorite: boolean;
  onFavorite: () => void;
  onCopy: (mode: CopyMode) => void;
  menu: ReactNode;
  onCopyText?: () => void;
}) {
  return (
    <div className="relative flex shrink-0 items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label={label + " 더보기"}
              title="더보기"
            >
              <CdsFilesMoreHorizontalIcon />
            </Button>
          }
        />
        <DropdownMenuContent align="end">{menu}</DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label={label + " 복사"}
              title="차트 복사"
            >
              <CdsActionsCopyIcon />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          {onCopyText && (
            <DropdownMenuItem onClick={onCopyText}>
              텍스트 전체 복사하기
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => onCopy("existing")}>
            기존 차트에 복사
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onCopy("new")}>
            새 차트로 만들기
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        variant={favorite ? "secondary" : "ghost"}
        size="icon"
        aria-pressed={favorite}
        aria-label={label + " 즐겨찾기 " + (favorite ? "해제" : "추가")}
        title={favorite ? "즐겨찾기 해제" : "즐겨찾기 추가"}
        onClick={onFavorite}
      >
        <CdsUtilitiesStarIcon />
      </Button>
    </div>
  );
}
export function InfoLine({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.infoLine}>
      <dt>
        {icon}
        {label}
      </dt>
      <dd>{children}</dd>
    </div>
  );
}
const taskLabels: Record<string, string> = {
  pending: "대기중",
  in_progress: "진행중",
  paused: "일시중지",
  partial_complete: "부분 완료",
  complete: "완료",
  cancelled: "취소",
};
export function ChartStaff({ chart }: { chart: SearchChart }) {
  return (
    <dl className="grid min-w-0 content-start gap-1">
      <InfoLine icon={<StethoscopeIcon />} label="주치의">
        {chart.primaryVet || "미배정"}
      </InfoLine>
      <InfoLine icon={<BuildingIcon />} label="진료의">
        {chart.doctor || "미배정"}
      </InfoLine>
      <InfoLine icon={<CdsActionsCheckCircleIcon />} label="Task 상태">
        {chart.taskStatuses?.length
          ? chart.taskStatuses.map((s) => (
              <EmrStatusBadge key={s} label={taskLabels[s] ?? s} />
            ))
          : "없음"}
      </InfoLine>
    </dl>
  );
}
export function ChartRow({
  chart,
  query,
  active,
  checked,
  favorite,
  onOpen,
  onCheck,
  onFavorite,
  onCopy,
  onViewChart,
}: {
  chart: SearchChart;
  query: string;
  active: boolean;
  checked: boolean;
  favorite: boolean;
  onOpen: () => void;
  onCheck: () => void;
  onFavorite: () => void;
  onCopy: (mode: CopyMode) => void;
  onViewChart: () => void;
}) {
  const hit = evidence(chart, searchWords(query)).matches[0];
  const title =
    hit &&
    (["진단", "오더"].includes(hit.label) ||
      /^(현장 접수|방문|내원|진료|재진|초진)$/.test(chart.purpose))
      ? hit.text
      : chartTitle(chart);
  const text = (value: string) => (
    <Highlight value={value || "미기록"} query={query} />
  );
  const so = [
    chart.complaint,
    ...chart.paragraphs
      .filter((p) => p.section === "subjective" || p.section === "objective")
      .map((p) => p.text),
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <Card
      data-chart-id={chart.id}
      aria-current={active || undefined}
      data-active={active}
      className={styles.resultCard}
      onClick={(event) => {
        if (
          !event.currentTarget.contains(event.target as Node) ||
          (event.target as HTMLElement).closest(
            "button,a,input,label,video,[role=checkbox],[data-media]",
          ) ||
          window.getSelection()?.toString()
        )
          return;
        onOpen();
      }}
    >
      <CardContent className={styles.resultContent}>
        <Checkbox
          aria-label={chart.patient + " 차트 선택"}
          checked={checked}
          onCheckedChange={onCheck}
        />
        <div data-media="">
          <Thumbnail
            key={chart.id + query + chart.version}
            chart={chart}
            query={query}
          />
        </div>
        <div className={styles.chartMain}>
          <div className={styles.metadata}>
            <span>{dateText(chart.createdAt)}</span>
            <span>
              {chart.patient}
              {chart.age != null && " (" + chart.age + "세)"}
            </span>
            <span>{chart.guardian}</span>
            <span>
              {[speciesLabel(chart.species), chart.breed]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
          <div className="grid gap-1 py-2">
            <Button
              className={styles.chartTitle}
              variant="ghost"
              aria-label={chart.patient + " 차트 원본 열기"}
              aria-expanded={active}
              onClick={onOpen}
            >
              {text(title)}
            </Button>
            <div className="flex min-w-0 items-center gap-3 text-muted-foreground">
              <span className="truncate">{text(diagnosesText(chart))}</span>
              <EmrStatusBadge label={stateText(chart.status)} />
            </div>
          </div>
          <div className={styles.clinical}>
            <ChartStaff chart={chart} />
            <dl className="grid min-w-0 content-start gap-1">
              <InfoLine icon={<DocumentIcon />} label="S/O 내용">
                {text(so)}
              </InfoLine>
              <InfoLine icon={<StethoscopeIcon />} label="진단 내용">
                {text(diagnosesText(chart))}
              </InfoLine>
              <InfoLine icon={<CalendarIcon />} label="Plan 내용">
                {text(
                  chart.paragraphs
                    .filter((p) => p.section === "plan")
                    .map((p) => p.text)
                    .join(" "),
                )}
              </InfoLine>
            </dl>
          </div>
          <div className="flex min-h-9 flex-wrap items-center justify-between gap-2 py-2">
            <div className="flex flex-wrap gap-1">
              {chart.orders.map((o) => (
                <Badge key={o.id} variant="secondary">
                  {text(o.name)}
                </Badge>
              ))}
            </div>
            <span className="emr-text-metadata text-muted-foreground">
              진료 {dateText(chart.visitAt ?? chart.clinicalAt)} · 작성{" "}
              {chart.author || "미기록"}
            </span>
          </div>
        </div>
        <div className={styles.rowActions}>
          <ChartActions
            label={chart.patient + " 차트"}
            favorite={favorite}
            onFavorite={onFavorite}
            onCopy={onCopy}
            menu={
              <>
                <DropdownMenuItem onClick={onOpen}>원본 보기</DropdownMenuItem>
                <DropdownMenuItem onClick={onViewChart}>
                  차트로 바로가기
                </DropdownMenuItem>
              </>
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}
