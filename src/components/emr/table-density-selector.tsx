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
            size="sm"
            aria-label={`${label}: ${selectedOption.label}`}
            className={cn(
              "h-8 min-h-8 shrink-0 rounded-lg bg-[var(--clair-color-atomic-common-100)] px-3 py-1.5 shadow-[var(--clair-shadow-xs)]",
              className,
            )}
          >
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
                {option.label}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
