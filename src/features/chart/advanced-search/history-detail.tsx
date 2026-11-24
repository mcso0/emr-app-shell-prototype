import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CdsActionsCopyIcon } from "@/components/cds-icons/actions-and-controls";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";
import { diagnosisLabels, orderDescription, sectionNames, type ChartHistoryContent, type SearchMedia, type SearchParagraph } from "./contract";
import { SourceMedia } from "./presentation";
import { chartTitle, ChartStaff, diagnosesText } from "./result-card";

type SoapGroup = { paragraphs: SearchParagraph[]; media: SearchMedia[] };

export function ChartSummary({
  chart,
  visitType,
}: {
  chart: ChartHistoryContent;
  visitType: string | null;
}) {
  const diagnosis = diagnosesText(chart);
  const systems = [
    ...new Set(chart.diagnoses.map((item) => item.system).filter(Boolean)),
  ];
  return (
    <div className="grid min-w-0 gap-[var(--clair-spacing-10)]">
      {visitType || chart.extraTags?.length ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {visitType && (
            <Badge
              variant="secondary"
              size="sm"
              data-chart-tag={visitType}
              className="rounded-md px-1.5"
            >
              {visitType}
            </Badge>
          )}
          {chart.extraTags?.map((tag) => (
            <Badge
              key={tag.label}
              variant="secondary"
              size="sm"
              data-chart-tag={tag.label}
              className="rounded-md px-1.5"
            >
              {tag.label}
            </Badge>
          ))}
        </div>
      ) : null}
      <div className="grid min-w-0 gap-1.5">
        <h3 className="emr-text-dialog-title wrap-anywhere font-semibold">
          {chartTitle(chart)}
        </h3>
        <p className="emr-text-body font-medium text-muted-foreground">
          {[...systems, diagnosis].filter(Boolean).join(" · ") || "진단 미기록"}
        </p>
      </div>
    </div>
  );
}

function SoapNote({ text }: { text: string }) {
  const lines = text.trim().split("\n");
  if (lines.every((line) => line.startsWith("- "))) {
    return (
      <ul className="list-disc pl-5">
        {lines.map((line, index) => (
          <li key={index}>{line.slice(2)}</li>
        ))}
      </ul>
    );
  }
  return <p>{text}</p>;
}

export function SoapGroups({
  chart,
  query,
  print = false,
}: {
  chart: ChartHistoryContent;
  query: string;
  print?: boolean;
}) {
  const groups = new Map<string, SoapGroup>();
  function group(scope: string): SoapGroup {
    const label = scope === "기본 SOAP" ? "기본" : scope;
    const existing = groups.get(label);
    if (existing) return existing;
    const created: SoapGroup = { paragraphs: [], media: [] };
    groups.set(label, created);
    return created;
  }

  for (const entry of chart.paragraphs) {
    if (entry.section === "subjective" || entry.section === "objective") {
      group(entry.scope || "기본").paragraphs.push(entry);
    }
  }
  for (const media of chart.media) {
    const scope = media.scope || "첨부 자료";
    group(scope).media.push(media);
  }

  if (groups.size === 0) {
    return (
      <Card className="border py-3 ring-0">
        <CardContent>기록 없음</CardContent>
      </Card>
    );
  }

  return (
    <div className="grid min-w-0 gap-[var(--clair-spacing-10)]">
      {[...groups].map(([scope, record]) => (
        <Card
          key={scope}
          data-record-scope={scope}
          className="gap-0 py-0 ring-0"
        >
          <CardHeader className="flex min-h-11 items-center border-b">
            <CardTitle className="text-xs leading-[14px] font-bold">
              {scope}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid min-w-0 gap-[var(--clair-spacing-10)] py-3 text-xs leading-normal font-medium whitespace-pre-wrap wrap-anywhere">
            {record.paragraphs.map((entry, index) => print ? (
              <div key={index} data-history-paragraph>
                {entry.section && <strong data-print-paragraph-label>{sectionNames[entry.section]}</strong>}
                <SoapNote text={entry.text} />
              </div>
            ) : <SoapNote key={index} text={entry.text} />)}
            {record.media.length > 0 && (
              <SourceMedia
                chart={{ media: record.media }}
                query={query}
              />
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export const visitLabel = (c: { visitType?: string }) =>
  c.visitType === "walk_in"
    ? "외래"
    : c.visitType === "appointment"
      ? "예약"
      : null;
export function documentSections(c: ChartHistoryContent, print = false) {
  const blocks = (records: SearchParagraph[]) =>
    records.map((p) =>
      [p.scope, p.section && sectionNames[p.section], p.text]
        .filter(Boolean)
        .join(" · "),
    );
  return [
    {
      title: "Subjective/Objective",
      lines: blocks(
        c.paragraphs.filter(
          (p) => p.section === "subjective" || p.section === "objective",
        ),
      ),
    },
    ...(!c.paragraphs.some((p) => !p.section)
      ? []
      : [
          {
            title: "자유 기록",
            lines: blocks(c.paragraphs.filter((p) => !p.section)),
          },
        ]),
    {
      title: "Assessment",
      lines: [
        ...(print ? c.diagnoses.map(d => [d.system, diagnosisLabels[d.kind], d.name, d.primary && "주진단"].filter(Boolean).join(" · "))
          : [diagnosesText(c)]),
        ...blocks(c.paragraphs.filter((p) => p.section === "assessment")),
      ].filter(Boolean),
    },
    {
      title: "Plan",
      lines: [
        ...blocks(c.paragraphs.filter((p) => p.section === "plan")),
        ...(!print ? c.orders.map(orderDescription) : []),
      ],
    },
    ...(print ? [{ title: "처방·오더", lines: c.orders.map(o => `${orderDescription(o)} · 수량 ${o.quantity}`) }] : []),
  ];
}

/** The expanded history card body; print uses the same structure without controls. */
export function ChartHistoryRecord({ chart, id, visitType, query = "", onCopySection, print = false, children }: {
  chart: ChartHistoryContent; id?: string; visitType: string | null; query?: string;
  onCopySection?: (lines: string[]) => void; print?: boolean; children?: ReactNode;
}) {
  return (
    <CardContent id={id} data-record-body className="emr-text-body grid min-w-0 gap-4 border-t py-6">
      <ChartSummary chart={chart} visitType={visitType} />
      <div data-chart-people className="min-w-0 pb-2"><ChartStaff chart={chart} /></div>
      {documentSections(chart, print).map(section => (
        <ChartHistorySection key={section.title} title={section.title} action={onCopySection && (
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground"
            disabled={!section.lines.length} aria-label={chartTitle(chart) + " " + section.title + " 전체 복사"}
            onClick={() => onCopySection(section.lines)}><CdsActionsCopyIcon />전체 복사</Button>
        )}>
          {section.title === "Subjective/Objective" ? <SoapGroups chart={chart} query={query} print={print} /> : (
            <ChartHistoryTextCard lines={section.lines} />
          )}
        </ChartHistorySection>
      ))}
      {children}
    </CardContent>
  );
}
export function ChartHistorySection({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section data-history-section className="grid min-w-0 gap-[var(--clair-spacing-10)] border-t pt-4 pb-1.5">
      <div data-history-section-heading className="flex min-h-8 flex-wrap items-center justify-between gap-2">
        <h4 className="emr-text-section font-semibold">{title}</h4>
        {action}
      </div>
      {children}
    </section>
  );
}
export function ChartHistoryTextCard({ lines, keepTogether = false }: { lines: string[]; keepTogether?: boolean }) {
  return (
    <Card className="border py-3 ring-0" data-history-keep-together={keepTogether || undefined}>
      <CardContent className="grid gap-2 text-xs leading-normal font-medium whitespace-pre-wrap wrap-anywhere">
        {lines.length ? lines.map((line, i) => <p key={i}>{line}</p>) : "기록 없음"}
      </CardContent>
    </Card>
  );
}
