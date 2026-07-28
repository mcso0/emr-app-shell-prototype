"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

type CustomerDataTableFooterProps = {
  loading?: boolean;
  totalCount: number;
};

export function CustomerDataTableFooter({
  loading = false,
  totalCount,
}: CustomerDataTableFooterProps) {
  return (
    <footer
      className="flex min-h-16 shrink-0 flex-wrap items-center gap-6 bg-[#fcfcfc] px-12 py-3.5 text-[14px] font-normal leading-5 text-muted-foreground"
      data-emr-table-workspace-footer="true"
      data-testid="customer-table-footer"
    >
      <span className="min-w-0 flex-1">
        {loading ? "총 불러오는 중" : `총 ${totalCount}건`}
      </span>
      <div className="flex shrink-0 flex-wrap items-center gap-4">
        <span>{loading ? "-/- 페이지" : "1/1 페이지"}</span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 min-h-8 rounded-lg bg-[var(--clair-color-atomic-common-100)] px-3 py-1.5"
            disabled
          >
            <ChevronLeftIcon data-icon="inline-start" />
            이전
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 min-h-8 rounded-lg bg-[var(--clair-color-atomic-common-100)] px-3 py-1.5"
            disabled
          >
            다음
            <ChevronRightIcon data-icon="inline-end" />
          </Button>
        </div>
      </div>
    </footer>
  );
}
