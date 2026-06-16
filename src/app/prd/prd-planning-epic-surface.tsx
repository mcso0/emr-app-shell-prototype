import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getPlanningEpicDocs,
  getPlanningMetadata,
  getPlanningParentDoc,
  type PrdDocEntry,
} from "@/lib/prd-viewer/registry";
import { cn } from "@/lib/utils";

interface PrdPlanningEpicSurfaceProps {
  doc: PrdDocEntry;
}

const statusLabels = {
  draft: "Draft",
  review: "Review",
  approved: "Approved",
  deferred: "Deferred",
} as const;

function getEpicPurpose(doc: PrdDocEntry) {
  return doc.description ?? "에픽 상세 문서에서 목적, 범위, 사용자 스토리, 완료 기준을 확인합니다.";
}

export function PrdPlanningEpicSurface({ doc }: PrdPlanningEpicSurfaceProps) {
  const metadata = getPlanningMetadata(doc);
  const parentDoc = getPlanningParentDoc(doc);
  const epicDocs = getPlanningEpicDocs(doc);

  if (parentDoc) {
    return (
      <div className="mt-6">
        <Link
          className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
          href={`/docs?doc=${encodeURIComponent(parentDoc.slug)}`}
        >
          Epic Index로 돌아가기
        </Link>
      </div>
    );
  }

  if (metadata?.itemKind !== "epic-index" || epicDocs.length === 0) {
    return null;
  }

  return (
    <Card className="mt-6" size="sm">
      <CardHeader>
        <CardTitle>{metadata.feature} Epic Index</CardTitle>
        <CardDescription>
          이 기능 패키지의 큰 작업 단위를 확인하고, 각 Epic 상세 문서로 이동합니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table density="compact" minWidth={760}>
          <TableHeader>
            <TableRow>
              <TableHead>Epic</TableHead>
              <TableHead>상태</TableHead>
              <TableHead>우선순위</TableHead>
              <TableHead>목적</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {epicDocs.map((epicDoc) => {
              const epicMetadata = getPlanningMetadata(epicDoc);
              const record = epicMetadata?.record;

              return (
                <TableRow key={epicDoc.slug}>
                  <TableCell>
                    <Link
                      className="font-medium text-foreground underline-offset-4 hover:underline"
                      href={`/docs?doc=${encodeURIComponent(epicDoc.slug)}`}
                    >
                      {record?.id ? `${record.id} · ` : ""}
                      {epicDoc.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{record ? statusLabels[record.status] : "Draft"}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{record?.priority ?? "P1"}</TableCell>
                  <TableCell className="max-w-[26rem] truncate text-muted-foreground">
                    {getEpicPurpose(epicDoc)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
