import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { MarkdownRenderer } from "@/lib/prd-viewer/markdown-renderer";
import { getResolvedPrdSlug, loadPrdDoc } from "@/lib/prd-viewer/doc-reader";
import {
  clairDocsAreas,
  getPrdDocAreaBySlug,
  getPrdDocGroups,
  getPrdDocNavigationGroupsByArea,
  normalizeClairDocsArea,
  type ClairDocsArea,
  type PrdDocEntry,
} from "@/lib/prd-viewer/registry";
import { PrdHeaderControls } from "../prd/prd-header-controls";
import { PrdMobileNavigation } from "../prd/prd-mobile-navigation";
import { PrdNavigation } from "../prd/prd-navigation";
import { PrdPlanningEpicSurface } from "../prd/prd-planning-epic-surface";
import styles from "../prd/prd-viewer.module.css";

export const metadata: Metadata = {
  title: "CLAiR Docs",
  description: "Read-only viewer for canonical CLAiR EMR product Markdown.",
};

interface ClairDocsPageProps {
  searchParams: Promise<{
    area?: string | string[];
    doc?: string | string[];
  }>;
}

function normalizeDocParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function SourcePath({ doc }: { doc: PrdDocEntry }) {
  return (
    <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
      Source: <code className="font-mono text-xs text-foreground">{doc.sourcePath}</code>
    </div>
  );
}

function getAreaLabel(area: ClairDocsArea) {
  return clairDocsAreas.find((entry) => entry.area === area)?.label ?? "기획";
}

function getAreaRoot(area: ClairDocsArea) {
  if (area === "design") return "docs/design";
  if (area === "development") return "docs/engineering";
  if (area === "study") return "docs/study";
  return "docs/product";
}

function ClairMark() {
  return (
    <div aria-hidden="true" className="grid size-7 place-items-center rounded-md bg-black">
      <Image alt="" height={19} priority src="/clair-logo-mark.svg" width={15} />
    </div>
  );
}

export default async function ClairDocsPage({ searchParams }: ClairDocsPageProps) {
  const params = await searchParams;
  const requestedSlug = normalizeDocParam(params.doc);
  const requestedArea = normalizeClairDocsArea(normalizeDocParam(params.area));
  const activeArea = getPrdDocAreaBySlug(requestedSlug) ?? requestedArea;
  const loadedDoc = await loadPrdDoc(requestedSlug, activeArea);
  const resolvedSlug = loadedDoc?.entry.slug ?? getResolvedPrdSlug(requestedSlug, activeArea);
  const resolvedArea = loadedDoc?.entry.area ?? activeArea;
  const areaGroups = getPrdDocNavigationGroupsByArea(resolvedArea);
  const searchGroups = getPrdDocGroups();
  const areaLabel = getAreaLabel(resolvedArea);
  const areaRoot = getAreaRoot(resolvedArea);

  return (
    <main className={`${styles.prdViewer} min-h-screen bg-background text-foreground`}>
      <header className="sticky top-0 z-20 h-14 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div className="flex h-full items-center justify-between gap-4 px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-8">
            <Link className="flex min-w-0 items-center gap-2" href="/docs">
              <ClairMark />
              <span className="whitespace-nowrap text-sm font-semibold">CLAiR Docs</span>
            </Link>
            <nav aria-label="CLAiR Docs top navigation" className="hidden items-center gap-2 text-sm text-muted-foreground md:flex">
              {clairDocsAreas.map((area) => {
                const isActive = area.area === resolvedArea;

                return (
                  <Link
                    aria-current={isActive ? "page" : undefined}
                    className={`inline-flex h-[var(--clair-control-height-md)] items-center rounded-md px-3 transition-colors hover:text-foreground ${
                      isActive ? "bg-muted font-medium text-foreground" : ""
                    }`}
                    href={`/docs?area=${area.area}`}
                    key={area.area}
                  >
                    {area.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex min-w-0 justify-end gap-2">
            <PrdMobileNavigation activeSlug={resolvedSlug} areaLabel={areaLabel} groups={areaGroups} />
            <PrdHeaderControls groups={searchGroups} />
          </div>
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-3.5rem)] lg:grid-cols-[17rem_minmax(0,1fr)] xl:grid-cols-[17rem_minmax(0,1fr)_15rem]">
        <aside className="hidden min-h-0 px-4 py-6 lg:flex lg:max-h-[calc(100vh-3.5rem)] lg:flex-col">
          <PrdNavigation activeSlug={resolvedSlug} groups={areaGroups} />
        </aside>

        <section className={`${styles.scrollArea} min-w-0 overflow-y-auto lg:max-h-[calc(100vh-3.5rem)]`}>
          <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
            <article className="min-w-0">
              <div className="mb-10 flex flex-col gap-3 border-b pb-8">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Link className="hover:text-foreground" href="/docs">
                    Docs
                  </Link>
                  <span>/</span>
                  <span>{areaLabel}</span>
                </div>
                <p className="text-base leading-7 text-muted-foreground">
                  Markdown remains canonical in <code className="font-mono text-foreground">{areaRoot}</code>.
                </p>
              </div>

              {loadedDoc ? (
                <>
                  <SourcePath doc={loadedDoc.entry} />
                  <PrdPlanningEpicSurface doc={loadedDoc.entry} />
                  <div className="mt-8">
                    <MarkdownRenderer markdown={loadedDoc.markdown} sourcePath={loadedDoc.entry.sourcePath} />
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-dashed bg-muted/30 px-6 py-10">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Document not found
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold">등록되지 않은 CLAiR Docs 문서입니다.</h2>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                    `/docs`는 registry에 등록된 curated Markdown만 표시합니다.
                    임의 파일 경로는 열지 않습니다.
                  </p>
                  <Link
                    className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                    href="/docs"
                  >
                    기본 문서로 이동
                  </Link>
                </div>
              )}
            </article>
          </div>
        </section>

        <aside className="hidden max-h-[calc(100vh-3.5rem)] px-5 py-8 xl:block">
          <div className={`${styles.scrollFade} h-full`}>
            <div className={`${styles.scrollArea} h-full overflow-y-auto py-4`}>
              <h2 className="mb-4 text-sm font-medium">On this page</h2>
              {loadedDoc && loadedDoc.toc.length > 0 ? (
                <nav aria-label="Table of contents" className="flex flex-col gap-2">
                  {loadedDoc.toc.map((item) => (
                    <a
                      className={`block text-sm leading-5 text-muted-foreground transition-colors hover:text-foreground ${
                        item.level === 1 ? "pl-0 font-medium" : item.level === 2 ? "pl-3" : "pl-6"
                      }`}
                      href={`#${item.id}`}
                      key={item.id}
                    >
                      {item.text}
                    </a>
                  ))}
                </nav>
              ) : (
                <p className="text-xs leading-5 text-muted-foreground">표시할 목차가 없습니다.</p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
