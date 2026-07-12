"use client";

import {
  emrTableDensityOptions,
  type EmrTableDensity,
} from "@/components/emr/table-density";
import { ChevronDownIcon } from "@/components/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type EmrTableDensitySelectorProps = {
  value: EmrTableDensity;
  onValueChange: (value: EmrTableDensity) => void;
  className?: string;
  label?: string;
};

function TableDensityIcon({ density }: { density: EmrTableDensity }) {
  const rowClassName = {
    compact: "h-0.5",
    standard: "h-0.5",
    comfortable: "h-0.5",
  }[density];
  const gapClassName = {
    compact: "gap-0.5",
    standard: "gap-1",
    comfortable: "gap-1.5",
  }[density];

  return (
    <span
      aria-hidden="true"
      className={cn("flex h-4 w-4 flex-col justify-center", gapClassName)}
    >
      <span className={cn("block rounded-full bg-current", rowClassName)} />
      <span className={cn("block rounded-full bg-current", rowClassName)} />
      <span className={cn("block rounded-full bg-current", rowClassName)} />
    </span>
  );
}

export function EmrTableDensitySelector({
  value,
  onValueChange,
  className,
  label = "테이블 보기 밀도",
}: EmrTableDensitySelectorProps) {
  const selectedOption = emrTableDensityOptions.find(
    (option) => option.value === value,
  );

  if (!selectedOption) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="xs"
            aria-label={`${label}: ${selectedOption.label}`}
            className={cn("shrink-0 bg-card", className)}
          >
            <TableDensityIcon density={value} />
            {selectedOption.label}
            <ChevronDownIcon data-icon="inline-end" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-28">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(nextValue) =>
            onValueChange(nextValue as EmrTableDensity)
          }
        >
          {emrTableDensityOptions.map((option) => {
            return (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                <TableDensityIcon density={option.value} />
                {option.label}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
