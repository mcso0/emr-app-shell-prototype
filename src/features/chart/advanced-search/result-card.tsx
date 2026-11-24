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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CdsNavigationExternalLinkIcon } from "@/components/cds-icons/navigation";
import { CdsPeopleUserIcon } from "@/components/cds-icons/people-and-places";
import { CdsFilesFilePlusIcon, CdsFilesMoreHorizontalIcon } from "@/components/cds-icons/files-and-layout";
import { CdsUtilitiesStarIcon } from "@/components/cds-icons/utilities-and-misc";
import {
  CdsActionsCopyIcon,
  CdsActionsCheckCircleIcon,
} from "@/components/cds-icons/actions-and-controls";
import {
  BuildingIcon,
  DocumentIcon,
  StethoscopeIcon,
} from "@/components/icons";
import { getOperatingDateFromIso } from "@/lib/emr-domain/demo-date";
import { diagnosisLabels, type ChartHistoryContent, type SearchChart } from "./contract";
import { evidence, searchWords, speciesLabel } from "./ranking";
import { Highlight, stateText, Thumbnail, type CopyMode } from "./presentation";
import { CdsMedicalClipboardPenIcon, CdsMedicalStethoscopeIcon } from "@/components/cds-icons/medical-and-domain";
import { ResultExcerpt, ResultReader } from "./result-reader";
import { ResultFooter } from "./result-footer";
import styles from "./workspace.module.css";

export const dateText = (value?: string) =>
  getOperatingDateFromIso(value)?.replaceAll("-", ".") ?? "미기록";
export const diagnosesText = (c: Pick<ChartHistoryContent, "diagnoses">) =>
  c.diagnoses
    .map((d) => [diagnosisLabels[d.kind], d.name].filter(Boolean).join(" · "))
    .join(", ");
export const chartTitle = (c: Pick<ChartHistoryContent, "purpose" | "complaint" | "patient">) =>
  c.purpose || c.complaint || c.patient + " 진료";
export function ChartActions({
  label,
  favorite,
  onFavorite,
  onCopy,
  menu,
  onCopyText,
  onViewHistoryChart,
  showFavorite = true,
  copyFirst = false,
}: {
  label: string;
  favorite: boolean;
  onFavorite: () => void;
  onCopy: (mode: CopyMode) => void;
  menu: ReactNode;
  onCopyText?: () => void;
  onViewHistoryChart?: () => void;
  showFavorite?: boolean;
  copyFirst?: boolean;
}) {
  const size = onViewHistoryChart ? "icon-sm" : "icon";
  const moreMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size={size}
            aria-label={label + " 더보기"}
            title="더보기"
          >
            <CdsFilesMoreHorizontalIcon />
          </Button>
        }
      />
      <DropdownMenuContent align="end">{menu}</DropdownMenuContent>
    </DropdownMenu>
  );
  return (
    <div data-chart-actions className="relative flex shrink-0 items-center gap-1">
      {!copyFirst && moreMenu}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size={size}
              aria-label={label + " 복사"}
              title="차트 복사"
            >
              <CdsActionsCopyIcon />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-max whitespace-nowrap">
          {onCopyText && (
            <DropdownMenuItem onClick={onCopyText}>
              {onViewHistoryChart && <CdsActionsCopyIcon />}
              텍스트 전체 복사하기
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => onCopy("existing")}>
            {onViewHistoryChart && <CdsMedicalClipboardPenIcon />}
            {onViewHistoryChart ? "기존 차트에 복사하기" : "기존 차트에 복사"}
          </DropdownMenuItem>
          {onViewHistoryChart && <DropdownMenuSeparator />}
          <DropdownMenuItem onClick={() => onCopy("new")}>
            {onViewHistoryChart && <CdsFilesFilePlusIcon />}
            새 차트로 만들기
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {onViewHistoryChart && (
        <Button variant="ghost" size={size} aria-label={label + " 차트 보러가기"} title="차트 보러가기" onClick={onViewHistoryChart}>
          <CdsNavigationExternalLinkIcon />
        </Button>
      )}
      {copyFirst && moreMenu}
      {showFavorite && (
        <Button
          variant={favorite ? "secondary" : "ghost"}
          size={size}
          aria-pressed={favorite}
          aria-label={label + " 즐겨찾기 " + (favorite ? "해제" : "추가")}
          title={favorite ? "즐겨찾기 해제" : "즐겨찾기 추가"}
          onClick={onFavorite}
        >
          <CdsUtilitiesStarIcon />
        </Button>
      )}
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
export function ChartStaff({ chart }: { chart: Pick<ChartHistoryContent, "primaryVet" | "doctor" | "taskStatuses"> }) {
  return (
    <dl className="grid min-w-0 content-start gap-1">
      <InfoLine icon={<CdsMedicalStethoscopeIcon />} label="주치의">
        {chart.primaryVet || "미배정"}
      </InfoLine>
      <InfoLine icon={<CdsPeopleUserIcon />} label="진료의">
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
export type OpenChartProfile = (profile: { type: "patient" | "guardian"; id: string }) => void;

export function ChartRow({
  chart,
  onOpenProfile,
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
  onOpenProfile?: OpenChartProfile;
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
  const paragraphs = (sections: string[]) =>
    chart.paragraphs
      .filter((p) => p.section && sections.includes(p.section))
      .map((p) => p.text);
  const so = [chart.complaint, ...paragraphs(["subjective", "objective"])]
    .filter(Boolean)
    .join("\n");
  const diagnoses = [...chart.diagnoses].sort(
    (a, b) => Number(b.primary) - Number(a.primary),
  );
  const diagnosisName = (d: SearchChart["diagnoses"][number]) =>
    d.name +
    (diagnosisLabels[d.kind] ? "(" + diagnosisLabels[d.kind] + ")" : "");
  const words = searchWords(query);
  const matches = (name: string) =>
    words.some((word) => name.toLocaleLowerCase().includes(word));
  const sortedOrders = [...chart.orders].sort(
    (a, b) => Number(matches(b.name)) - Number(matches(a.name)),
  );
  const vetNames = [
    chart.doctor,
    ...(chart.additionalVets ?? [])
      .filter((v) => v.id !== chart.doctorId)
      .map((v) => v.name),
  ].filter(Boolean);
  const profile = (
    type: "patient" | "guardian",
    name: string,
    id?: string | null,
    text = name,
  ) =>
    id && name && onOpenProfile ? (
      <Button
        size="xs"
        variant="ghost"
        className={styles.profileLink}
        aria-label={
          name + (type === "patient" ? " 환자 프로필" : " 보호자 프로필")
        }
        onClick={() => onOpenProfile({ type, id })}
      >
        {text}
      </Button>
    ) : (
      text
    );
  return (
    <Card
      data-chart-id={chart.id}
      aria-current={active || undefined}
      data-active={active}
      data-checked={checked}
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
            <span>{dateText(chart.visitAt ?? chart.clinicalAt)}</span>
            <span>
              {profile(
                "patient",
                chart.patient,
                chart.patientId,
                chart.patient + (chart.age != null ? " (" + chart.age + "세)" : ""),
              )}
            </span>
            <span>
              {[speciesLabel(chart.species), chart.breed]
                .filter(Boolean)
                .join(" · ")}
            </span>
            {chart.guardian && (
              <span>
                {profile("guardian", chart.guardian, chart.guardianId)}
              </span>
            )}
          </div>
          <div className={styles.visitGroup}>
            <ResultExcerpt
              value={chartTitle(chart)}
              label="방문목적"
              query={query}
              openOriginal={onOpen}
              originalLabel={chart.patient + " 차트 원본 열기"}
            />
            <div className={styles.diagnoses} aria-label="진단">
              {diagnoses.slice(0, 3).map((d) => (
                <Badge key={d.id} size="sm" variant="secondary">
                  <span className={styles.ellipsis} title={diagnosisName(d)}>
                    <Highlight query={query} value={diagnosisName(d)} />
                  </span>
                </Badge>
              ))}
              {diagnoses.length === 0 && (
                <span className={styles.missing}>등록된 진단 없음</span>
              )}
              {diagnoses.length > 3 && (
                <ResultReader
                  label="진단명"
                  action={"외 " + (diagnoses.length - 3) + "개"}
                >
                  <ul>
                    {diagnoses.map((d) => (
                      <li key={d.id}>
                        <Highlight query={query} value={diagnosisName(d)} />
                      </li>
                    ))}
                  </ul>
                </ResultReader>
              )}
            </div>
          </div>
          <div>
            {hit && (
              <div className={styles.match}>
                <span>검색 일치 · {hit.label}</span>
                <ResultExcerpt
                  label="검색 일치 내용"
                  value={hit.text}
                  query={query}
                />
              </div>
            )}
            <div className={styles.clinical}>
              <dl>
                <InfoLine icon={<StethoscopeIcon />} label="주치의">
                  {chart.primaryVet || (
                    <span className={styles.missing}>미배정</span>
                  )}
                </InfoLine>
                <InfoLine icon={<BuildingIcon />} label="진료의">
                  {vetNames[0] || (
                    <span className={styles.missing}>미배정</span>
                  )}
                  {vetNames.length > 1 && (
                    <ResultReader
                      label="진료의"
                      action={"외 " + (vetNames.length - 1) + "명"}
                    >
                      {vetNames.join("\n")}
                    </ResultReader>
                  )}
                </InfoLine>
                <InfoLine icon={<CdsActionsCheckCircleIcon />} label="진행상태">
                  <EmrStatusBadge
                    marker="none"
                    label={stateText(chart.status)}
                  />
                </InfoLine>
              </dl>
              <dl>
                <InfoLine icon={<DocumentIcon />} label="S/O 소견">
                  <ResultExcerpt label="S/O 소견" value={so} query={query} />
                </InfoLine>
                <InfoLine icon={<StethoscopeIcon />} label="진단 소견">
                  <ResultExcerpt
                    label="진단 소견"
                    value={paragraphs(["assessment"]).join("\n")}
                    query={query}
                  />
                </InfoLine>
                <InfoLine
                  icon={<CdsMedicalClipboardPenIcon />}
                  label="오더 내역"
                >
                  <ResultExcerpt
                    label="전체 오더"
                    query={query}
                    value={sortedOrders
                      .slice(0, 2)
                      .map((o) => o.name)
                      .join(" · ")}
                    empty="등록된 오더 없음"
                    overflowAction={
                      sortedOrders.length <= 2
                        ? undefined
                        : {
                            action: "외 " + (sortedOrders.length - 2) + "건",
                            content: (
                              <ul>
                                {chart.orders.map((o) => (
                                  <li key={o.id}>
                                    <Highlight value={o.name} query={query} />
                                  </li>
                                ))}
                              </ul>
                            ),
                          }
                    }
                  />
                </InfoLine>
              </dl>
            </div>
          </div>
          <ResultFooter chart={chart} />
        </div>
        <div className={styles.rowActions}>
          <ChartActions
            label={chart.patient + " 차트"}
            copyFirst
            showFavorite={false}
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
