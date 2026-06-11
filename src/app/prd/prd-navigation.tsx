"use client";

import Link from "next/link";
import type { PrdDocEntry } from "@/lib/prd-viewer/registry";
import { cn } from "@/lib/utils";
import styles from "./prd-viewer.module.css";

interface PrdNavigationProps {
  groups: Array<{ group: string; docs: PrdDocEntry[] }>;
  activeSlug: string;
}

export function PrdNavigation({ groups, activeSlug }: PrdNavigationProps) {
  return (
    <nav aria-label="PRD documents" className="flex min-h-0 flex-1 flex-col">
      <div className={`${styles.scrollFade} min-h-0 flex-1`}>
        <div className={`${styles.scrollArea} h-full overflow-y-auto py-4 pr-1`}>
          <div className="flex flex-col gap-6">
            {groups.map((group) => (
              <section className="flex flex-col gap-2" key={group.group}>
                <h3 className="px-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {group.group}
                </h3>
                <div className="flex flex-col gap-1">
                  {group.docs.map((doc) => {
                    const isActive = doc.slug === activeSlug;

                    return (
                      <Link
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "block rounded-md px-2 py-2 text-sm leading-5 transition",
                          isActive
                            ? "bg-primary font-medium text-primary-foreground"
                            : "text-foreground hover:bg-accent hover:text-accent-foreground"
                        )}
                        href={`/prd?doc=${encodeURIComponent(doc.slug)}`}
                        key={doc.slug}
                      >
                        {doc.title}
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
