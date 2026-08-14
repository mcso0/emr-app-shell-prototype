"use client";

import type { ComponentProps } from "react";
import { EmrTableWorkspaceHeader } from "@/components/emr/table-workspace-header";

type CustomerListHeaderProps = Omit<
  ComponentProps<typeof EmrTableWorkspaceHeader>,
  "countSkeletonTestId" | "searchAriaLabel" | "searchClearAriaLabel" | "testId"
>;

export function CustomerListHeader(props: CustomerListHeaderProps) {
  return (
    <EmrTableWorkspaceHeader
      {...props}
      countSkeletonTestId="customer-page-header-count-skeleton"
      searchAriaLabel="고객관리 검색"
      searchClearAriaLabel="고객관리 검색어 초기화"
      testId="customer-page-header"
    />
  );
}
