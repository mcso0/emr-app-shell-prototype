"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { PrdDocEntry } from "@/lib/prd-viewer/registry";
import styles from "./prd-viewer.module.css";

interface PrdHeaderControlsProps {
  groups: Array<{ group: string; docs: PrdDocEntry[] }>;
}

const RECENT_DOCS_STORAGE_KEY = "prd-viewer-recent-docs";
const MAX_RECENT_DOCS = 6;
const DEFAULT_PAGE_SLUGS = [
  "product-prd",
  "design-readme",
  "engineering-readme",
  "epics-readme",
  "features-readme",
  "user-stories-readme",
  "emr-domain-entity-map",
  "decision-log-index",
  "glossary-readme",
];

function flattenDocs(groups: PrdHeaderControlsProps["groups"]) {
  return groups.flatMap((group) => group.docs.map((doc) => ({ ...doc, group: group.group })));
}

function getPreferredDarkMode() {
  if (typeof window === "undefined") return false;

  const storedTheme = window.localStorage.getItem("prd-viewer-theme");
  if (storedTheme) return storedTheme === "dark";

  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function subscribeThemeChange(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener("prd-viewer-theme-change", listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener("prd-viewer-theme-change", listener);
  };
}

function getServerThemeSnapshot() {
  return false;
}

function readRecentDocSlugs() {
  const storedRecentDocs = window.localStorage.getItem(RECENT_DOCS_STORAGE_KEY);
  if (!storedRecentDocs) return [];

  try {
    const parsed = JSON.parse(storedRecentDocs);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 1.5v1.25M8 13.25v1.25M1.5 8h1.25M13.25 8h1.25M3.4 3.4l.9.9M11.7 11.7l.9.9M12.6 3.4l-.9.9M4.3 11.7l-.9.9" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 16 16">
      <path d="M13 10.2A5.2 5.2 0 0 1 5.8 3a5.6 5.6 0 1 0 7.2 7.2Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

export function PrdHeaderControls({ groups }: PrdHeaderControlsProps) {
  const router = useRouter();
  const docs = useMemo(() => flattenDocs(groups), [groups]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recentDocSlugs, setRecentDocSlugs] = useState<string[]>([]);
  const initialHtmlDarkClassRef = useRef<boolean | null>(null);
  const isDarkMode = useSyncExternalStore(subscribeThemeChange, getPreferredDarkMode, getServerThemeSnapshot);

  const normalizedQuery = query.trim().toLowerCase();
  const docsBySlug = useMemo(() => new Map(docs.map((doc) => [doc.slug, doc])), [docs]);
  const filteredDocs = useMemo(() => {
    if (!normalizedQuery) return docs;

    return docs.filter((doc) => {
      const haystack = [
        doc.title,
        doc.area,
        doc.group,
        doc.section,
        doc.docType,
        doc.sourcePath,
        doc.description ?? "",
        ...(doc.tags ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [docs, normalizedQuery]);
  const recentDocs = useMemo(
    () => recentDocSlugs.map((slug) => docsBySlug.get(slug)).filter((doc): doc is PrdDocEntry => Boolean(doc)),
    [docsBySlug, recentDocSlugs]
  );
  const defaultPages = useMemo(
    () => DEFAULT_PAGE_SLUGS.map((slug) => docsBySlug.get(slug)).filter((doc): doc is PrdDocEntry => Boolean(doc)),
    [docsBySlug]
  );
  const filteredGroups = useMemo(() => {
    if (!normalizedQuery) return [];

    return groups
      .map((group) => ({
        ...group,
        docs: group.docs.filter((doc) => filteredDocs.some((filteredDoc) => filteredDoc.slug === doc.slug)),
      }))
      .filter((group) => group.docs.length > 0);
  }, [filteredDocs, groups, normalizedQuery]);

  useEffect(() => {
    initialHtmlDarkClassRef.current ??= document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", isDarkMode);

    return () => {
      document.documentElement.classList.toggle("dark", initialHtmlDarkClassRef.current === true);
    };
  }, [isDarkMode]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openSearch();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function setTheme(nextDarkMode: boolean) {
    document.documentElement.classList.toggle("dark", nextDarkMode);
    window.localStorage.setItem("prd-viewer-theme", nextDarkMode ? "dark" : "light");
    window.dispatchEvent(new Event("prd-viewer-theme-change"));
  }

  function openSearch() {
    setRecentDocSlugs(readRecentDocSlugs());
    setIsSearchOpen(true);
  }

  function openDoc(slug: string) {
    const nextRecentDocSlugs = [slug, ...recentDocSlugs.filter((recentSlug) => recentSlug !== slug)].slice(
      0,
      MAX_RECENT_DOCS
    );
    setRecentDocSlugs(nextRecentDocSlugs);
    window.localStorage.setItem(RECENT_DOCS_STORAGE_KEY, JSON.stringify(nextRecentDocSlugs));
    setIsSearchOpen(false);
    setQuery("");
    router.push(`/docs?doc=${encodeURIComponent(slug)}`);
  }

  function DocCommandContent({ doc, showDescription = false }: { doc: PrdDocEntry; showDescription?: boolean }) {
    return (
      <>
        <span className="text-muted-foreground">→</span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate">{doc.title}</span>
            <Badge className="shrink-0" variant="outline">
              {doc.docType}
            </Badge>
          </span>
          {showDescription ? (
            <span className="truncate text-xs text-muted-foreground">{doc.description ?? doc.sourcePath}</span>
          ) : null}
        </span>
        <span className="ml-auto hidden shrink-0 text-xs text-muted-foreground sm:inline">
          {doc.area} / {doc.section}
        </span>
      </>
    );
  }

  return (
    <>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
        <Button
          aria-label="문서 검색 열기"
          className="hidden w-full max-w-56 justify-between gap-4 rounded-md text-muted-foreground sm:inline-flex"
          data-testid="prd-search-trigger"
          onClick={openSearch}
          size="default"
          type="button"
          variant="outline"
        >
          <span className="flex min-w-0 items-center gap-2">
            <SearchIcon data-icon="inline-start" />
            <span className="truncate">Search documentation...</span>
          </span>
          <span className="rounded border bg-muted px-1 py-0.5 text-xs leading-none text-muted-foreground">
            ⌘K
          </span>
        </Button>
        <Button
          aria-label="문서 검색 열기"
          className="sm:hidden"
          data-testid="prd-search-trigger-mobile"
          onClick={openSearch}
          size="icon"
          type="button"
          variant="outline"
        >
          <SearchIcon />
        </Button>
        <Button
          aria-label={isDarkMode ? "라이트 모드로 전환" : "다크 모드로 전환"}
          data-testid="prd-theme-toggle"
          onClick={() => setTheme(!isDarkMode)}
          size="icon"
          type="button"
          variant="ghost"
        >
          {isDarkMode ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
        </Button>
      </div>

      <Dialog open={isSearchOpen} onOpenChange={(open) => (open ? openSearch() : setIsSearchOpen(false))}>
        <DialogContent className={cn(styles.prdDialogContent, "max-w-2xl overflow-hidden p-0")} showCloseButton={false}>
          <DialogHeader className="sr-only">
            <DialogTitle>문서 검색</DialogTitle>
          </DialogHeader>
          <Command shouldFilter={false}>
            <CommandInput
              autoFocus
              data-testid="prd-search-dialog-input"
              onValueChange={setQuery}
              placeholder="Search documentation..."
              value={query}
            />
            <CommandList className={styles.scrollArea}>
              {normalizedQuery ? (
                <>
                  <CommandEmpty>검색 결과가 없어.</CommandEmpty>
                  {filteredGroups.map((group) => (
                    <CommandGroup heading={group.group} key={group.group}>
                      {group.docs.map((doc) => (
                        <CommandItem
                          key={doc.slug}
                          onSelect={() => openDoc(doc.slug)}
                          value={`${doc.title} ${doc.docType} ${doc.sourcePath} ${doc.description ?? ""} ${(doc.tags ?? []).join(" ")}`}
                        >
                          <DocCommandContent doc={doc} showDescription />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ))}
                </>
              ) : (
                <>
                  <CommandGroup heading="Pages">
                    {defaultPages.map((doc) => (
                      <CommandItem key={doc.slug} onSelect={() => openDoc(doc.slug)} value={doc.title}>
                        <DocCommandContent doc={doc} />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  {recentDocs.length > 0 ? (
                    <>
                      <CommandSeparator />
                      <CommandGroup heading="Recently viewed">
                        {recentDocs.slice(0, 3).map((doc) => (
                          <CommandItem key={doc.slug} onSelect={() => openDoc(doc.slug)} value={`recent ${doc.title}`}>
                            <span className="text-muted-foreground">↳</span>
                            <span className="flex min-w-0 flex-1 items-center gap-2">
                              <span className="truncate">{doc.title}</span>
                              <Badge className="shrink-0" variant="outline">
                                {doc.docType}
                              </Badge>
                            </span>
                            <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">
                              {doc.area} / {doc.section}
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </>
                  ) : null}
                </>
              )}
            </CommandList>
            <div className="flex items-center gap-2 bg-muted/50 px-4 py-3 text-xs text-muted-foreground">
              <span className="rounded bg-background px-2 py-1 text-foreground">↵</span>
              <span>Open document</span>
            </div>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
