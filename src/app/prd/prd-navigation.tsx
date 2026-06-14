"use client";

import Link from "next/link";
import type { PrdDocEntry, PrdDocNavigationGroup } from "@/lib/prd-viewer/registry";
import { cn } from "@/lib/utils";
import styles from "./prd-viewer.module.css";

interface PrdNavigationProps {
  groups: PrdDocNavigationGroup[];
  activeSlug: string;
}

function PrdNavigationLink({ activeSlug, doc }: { activeSlug: string; doc: PrdDocEntry }) {
  const isActive = doc.slug === activeSlug;

  return (
    <Link
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "block rounded-md px-2 py-2 text-sm leading-5 transition",
        isActive
          ? "bg-muted font-medium text-foreground"
          : "text-foreground hover:bg-accent hover:text-accent-foreground"
      )}
      href={`/docs?doc=${encodeURIComponent(doc.slug)}`}
    >
      {doc.title}
    </Link>
  );
}

export function PrdNavigation({ groups, activeSlug }: PrdNavigationProps) {
  return (
    <nav aria-label="CLAiR Docs documents" className="flex min-h-0 flex-1 flex-col">
      <div className={`${styles.scrollFade} min-h-0 flex-1`}>
        <div className={`${styles.scrollArea} h-full overflow-y-auto py-4 pr-1`} data-testid="prd-doc-navigation-scroll">
          <div className="flex flex-col gap-6">
            {groups.map((group) => (
              <section className="flex flex-col gap-2" key={group.group}>
                <h3 className="px-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {group.group}
                </h3>
                <div className="flex flex-col gap-1">
                  {group.docs.map((doc) => (
                    <PrdNavigationLink activeSlug={activeSlug} doc={doc} key={doc.slug} />
                  ))}
                  {group.children?.map((child) => (
                    <div className="flex flex-col gap-1 pt-2" key={child.group}>
                      <h4 className="px-2 text-xs font-medium text-muted-foreground">{child.group}</h4>
                      <div className="flex flex-col gap-1">
                        {child.docs.map((doc) => (
                          <PrdNavigationLink activeSlug={activeSlug} doc={doc} key={doc.slug} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
