"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { PrdDocEntry } from "@/lib/prd-viewer/registry";

interface PrdNavigationProps {
  groups: Array<{ group: string; docs: PrdDocEntry[] }>;
  activeSlug: string;
}

export function PrdNavigation({ groups, activeSlug }: PrdNavigationProps) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();

  const filteredGroups = useMemo(() => {
    if (!normalizedQuery) return groups;

    return groups
      .map((group) => ({
        ...group,
        docs: group.docs.filter((doc) => {
          const haystack = `${doc.title} ${doc.group} ${doc.sourcePath} ${doc.description ?? ""}`.toLowerCase();
          return haystack.includes(normalizedQuery);
        }),
      }))
      .filter((group) => group.docs.length > 0);
  }, [groups, normalizedQuery]);

  return (
    <nav aria-label="PRD documents" className="flex min-h-0 flex-1 flex-col">
      <label className="mb-2 text-[12px] font-medium text-zinc-600" htmlFor="prd-doc-search">
        문서 검색
      </label>
      <input
        className="mb-4 h-9 rounded-md border border-zinc-200 bg-white px-3 text-[13px] outline-none transition focus:border-zinc-500"
        id="prd-doc-search"
        onChange={(event) => setQuery(event.target.value)}
        placeholder="PRD, domain, role..."
        type="search"
        value={query}
      />
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {filteredGroups.length > 0 ? (
          filteredGroups.map((group) => (
            <section className="mb-5" key={group.group}>
              <h2 className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                {group.group}
              </h2>
              <div className="space-y-1">
                {group.docs.map((doc) => {
                  const isActive = doc.slug === activeSlug;

                  return (
                    <Link
                      aria-current={isActive ? "page" : undefined}
                      className={`block rounded-md px-2 py-2 text-[13px] leading-5 transition ${
                        isActive
                          ? "bg-zinc-950 font-medium text-white"
                          : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950"
                      }`}
                      href={`/prd?doc=${encodeURIComponent(doc.slug)}`}
                      key={doc.slug}
                    >
                      {doc.title}
                    </Link>
                  );
                })}
              </div>
            </section>
          ))
        ) : (
          <p className="rounded-md border border-dashed border-zinc-200 px-3 py-4 text-[13px] leading-5 text-zinc-500">
            검색 결과가 없어.
          </p>
        )}
      </div>
    </nav>
  );
}
