"use client";

import type * as React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type HomePanelCardProps = React.ComponentProps<typeof Card>;

export function HomePanelCard({ className, size = "sm", ...props }: HomePanelCardProps) {
  return (
    <Card
      size={size}
      className={cn(
        "rounded-[var(--clair-radius-md)] border-border bg-card text-card-foreground",
        className
      )}
      {...props}
    />
  );
}
