"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { MenuIcon } from "@/components/icons";
import type { PrdDocNavigationGroup } from "@/lib/prd-viewer/registry";
import { cn } from "@/lib/utils";
import { PrdNavigation } from "./prd-navigation";
import styles from "./prd-viewer.module.css";

interface PrdMobileNavigationProps {
  groups: PrdDocNavigationGroup[];
  activeSlug: string;
  areaLabel: string;
}

export function PrdMobileNavigation({ groups, activeSlug, areaLabel }: PrdMobileNavigationProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) return;

    let timeoutId: number | undefined;
    const animationFrameId = window.requestAnimationFrame(() => {
      timeoutId = window.setTimeout(() => {
        if (!document.querySelector('[role="dialog"]')) {
          document.body.style.removeProperty("overflow");
        }
      }, 240);
    });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        aria-label="문서 목록 열기"
        className="lg:hidden"
        data-testid="prd-mobile-nav-trigger"
        onClick={() => setOpen(true)}
        size="icon-sm"
        type="button"
        variant="outline"
      >
        <MenuIcon />
      </Button>
      <SheetContent
        className={cn(styles.prdViewer, "w-[20rem] max-w-[calc(100vw-2rem)] gap-0 border-r-0 p-0")}
        side="left"
      >
        <SheetHeader className="shrink-0 px-4 py-4">
          <SheetTitle>{areaLabel} Docs</SheetTitle>
          <SheetDescription className="sr-only">CLAiR Docs document list</SheetDescription>
        </SheetHeader>
        <div
          className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-4"
          onClick={(event) => {
            if ((event.target as Element).closest("a")) {
              setOpen(false);
            }
          }}
        >
          <PrdNavigation activeSlug={activeSlug} groups={groups} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
