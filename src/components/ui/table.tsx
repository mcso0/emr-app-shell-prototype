"use client"

import * as React from "react"

import {
  defaultEmrTableDensity,
  defaultEmrTableLayout,
  type EmrTableDensity,
  type EmrTableLayout,
} from "@/components/emr/table-density"
import { cn } from "@/lib/utils"

type TableProps = React.ComponentProps<"table"> & {
  containerClassName?: string
  density?: EmrTableDensity
  layout?: EmrTableLayout
  minWidth?: number | string
}

function toTableWidth(value: number | string | undefined) {
  if (typeof value === "number") {
    return `${value}px`
  }

  return value
}

function Table({
  className,
  containerClassName,
  density = defaultEmrTableDensity,
  layout = defaultEmrTableLayout,
  minWidth,
  style,
  ...props
}: TableProps) {
  const tableMinWidth = toTableWidth(minWidth)

  return (
    <div
      data-slot="table-container"
      data-emr-layout={layout}
      className={cn(
        "relative w-full",
        layout === "scroll" ? "emr-table-scroll-container overflow-x-auto" : "overflow-x-auto",
        containerClassName
      )}
    >
      <table
        data-slot="table"
        data-emr-density={density}
        data-emr-layout={layout}
        className={cn("emr-table-surface w-full caption-bottom text-sm", className)}
        style={{
          minWidth: tableMinWidth,
          ...style,
        }}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-[var(--emr-surface-muted)] font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-[var(--emr-state-hover)] has-aria-expanded:bg-[var(--emr-state-hover)] data-[state=selected]:bg-[var(--emr-state-selected)]",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
