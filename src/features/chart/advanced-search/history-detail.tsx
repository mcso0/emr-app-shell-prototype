import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SearchChart, SearchMedia } from "./contract";
import { SourceMedia } from "./presentation";
import { chartTitle, diagnosesText } from "./result-card";

type SoapGroup = { paragraphs: string[]; media: SearchMedia[] };

export function ChartSummary({
  chart,
  visitType,
}: {
  chart: SearchChart;
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
}: {
  chart: SearchChart;
  query: string;
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
      group(entry.scope || "기본").paragraphs.push(entry.text);
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
            {record.paragraphs.map((text, index) => (
              <SoapNote key={index} text={text} />
            ))}
            {record.media.length > 0 && (
              <SourceMedia
                chart={{ ...chart, media: record.media }}
                query={query}
              />
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
