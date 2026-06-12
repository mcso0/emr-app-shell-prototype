"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { MenuIcon } from "@/components/icons";
import type { PrdDocEntry } from "@/lib/prd-viewer/registry";
import { PrdNavigation } from "./prd-navigation";

interface PrdMobileNavigationProps {
  groups: Array<{ group: string; docs: PrdDocEntry[] }>;
  activeSlug: string;
}

export function PrdMobileNavigation({ groups, activeSlug }: PrdMobileNavigationProps) {
  const [open, setOpen] = useState(false);

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
      <SheetContent className="w-[20rem] max-w-[calc(100vw-2rem)] gap-0 border-r-0 p-0" side="left">
        <SheetHeader className="px-4 py-4">
          <SheetTitle>Docs</SheetTitle>
          <SheetDescription className="sr-only">CLAiR Docs document list</SheetDescription>
        </SheetHeader>
        <div
          className="min-h-0 flex-1 px-4 pb-4"
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
