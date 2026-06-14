import Link from "next/link";
import { Badge } from "@/components/ui/badge";
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
  getPlanningFeatureDocs,
  getPlanningMetadata,
  planningItemKindLabels,
  type PrdDocEntry,
} from "@/lib/prd-viewer/registry";

interface PrdPlanningFeatureIndexProps {
  doc: PrdDocEntry;
}

export function PrdPlanningFeatureIndex({ doc }: PrdPlanningFeatureIndexProps) {
  const metadata = getPlanningMetadata(doc);
  const featureDocs = getPlanningFeatureDocs(doc);

  if (!metadata?.feature || featureDocs.length < 2) {
    return null;
  }

  return (
    <Card className="mt-6" size="sm">
      <CardHeader>
        <CardTitle>{metadata.feature}</CardTitle>
        <CardDescription>기능명세, 세부 정책, 현재 구현 상태, Gap, Epic/User Story 인덱스를 같은 기능 묶음에서 확인합니다.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table density="compact" minWidth={720}>
          <TableHeader>
            <TableRow>
              <TableHead>문서</TableHead>
              <TableHead>역할</TableHead>
              <TableHead>타입</TableHead>
              <TableHead>Source</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {featureDocs.map((featureDoc) => {
              const featureMetadata = getPlanningMetadata(featureDoc);
              const itemKind = featureMetadata?.itemKind;

              return (
                <TableRow data-state={featureDoc.slug === doc.slug ? "selected" : undefined} key={featureDoc.slug}>
                  <TableCell>
                    <Link
                      className="font-medium text-foreground underline-offset-4 hover:underline"
                      href={`/docs?doc=${encodeURIComponent(featureDoc.slug)}`}
                    >
                      {featureDoc.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {itemKind ? planningItemKindLabels[itemKind] : featureDoc.docType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{featureDoc.docType}</TableCell>
                  <TableCell className="max-w-[18rem] truncate font-mono text-xs text-muted-foreground">
                    {featureDoc.sourcePath}
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
