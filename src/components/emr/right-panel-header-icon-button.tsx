"use client";

import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";

type EmrRightPanelHeaderIconButtonProps = Omit<
  ComponentProps<typeof Button>,
  "children" | "size" | "variant"
> & {
  children: ReactNode;
};

export function EmrRightPanelHeaderIconButton({
  children,
  ...props
}: EmrRightPanelHeaderIconButtonProps) {
  return (
    <Button type="button" variant="ghost" size="icon" {...props}>
      {children}
    </Button>
  );
}
