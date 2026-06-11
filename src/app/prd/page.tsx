import type { Metadata } from "next";
import Link from "next/link";
import { MarkdownRenderer } from "@/lib/prd-viewer/markdown-renderer";
import { getPrdDocGroups, type PrdDocEntry } from "@/lib/prd-viewer/registry";
import { getResolvedPrdSlug, loadPrdDoc } from "@/lib/prd-viewer/doc-reader";
import { PrdNavigation } from "./prd-navigation";

export const metadata: Metadata = {
  title: "PRD Viewer",
  description: "Read-only viewer for canonical CLAiR EMR product Markdown.",
};

interface PrdPageProps {
  searchParams: Promise<{
    doc?: string | string[];
  }>;
}

function normalizeDocParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function SourcePath({ doc }: { doc: PrdDocEntry }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-[12px] text-zinc-600">
      Source: <code className="font-mono text-[12px] text-zinc-800">{doc.sourcePath}</code>
    </div>
  );
}

export default async function PrdPage({ searchParams }: PrdPageProps) {
  const params = await searchParams;
  const requestedSlug = normalizeDocParam(params.doc);
  const loadedDoc = await loadPrdDoc(requestedSlug);
  const resolvedSlug = loadedDoc?.entry.slug ?? getResolvedPrdSlug(requestedSlug);
  const groups = getPrdDocGroups();

  return (
    <main className="min-h-screen bg-white text-zinc-950">
      <div className="flex h-screen overflow-hidden">
        <aside className="flex w-[292px] shrink-0 flex-col border-r border-zinc-200 bg-zinc-50/70 px-5 py-5">
          <Link className="mb-6 block" href="/prd">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">CLAiR EMR</p>
            <h1 className="mt-1 text-[18px] font-semibold leading-6 text-zinc-950">PRD Viewer</h1>
          </Link>
          <PrdNavigation activeSlug={resolvedSlug} groups={groups} />
        </aside>

        <section className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto grid max-w-[1180px] grid-cols-[minmax(0,1fr)_220px] gap-10 px-10 py-8">
            <article className="min-w-0">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-4">
                <div>
                  <p className="text-[12px] font-medium text-zinc-500">Read-only product docs</p>
                  <p className="mt-1 text-[13px] leading-5 text-zinc-600">
                    Markdown remains canonical in <code className="font-mono">docs/product</code>.
                  </p>
                </div>
                <Link
                  className="rounded-md border border-zinc-200 px-3 py-2 text-[13px] font-medium text-zinc-700 transition hover:border-zinc-400 hover:text-zinc-950"
                  href="/login"
                >
                  앱으로 돌아가기
                </Link>
              </div>

              {loadedDoc ? (
                <>
                  <SourcePath doc={loadedDoc.entry} />
                  <div className="mt-8">
                    <MarkdownRenderer markdown={loadedDoc.markdown} sourcePath={loadedDoc.entry.sourcePath} />
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-6 py-10">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-zinc-500">Document not found</p>
                  <h2 className="mt-2 text-[22px] font-semibold text-zinc-950">등록되지 않은 PRD 문서야.</h2>
                  <p className="mt-3 max-w-[560px] text-[14px] leading-6 text-zinc-600">
                    `/prd`는 registry에 등록된 <code className="font-mono">docs/product</code> Markdown만 읽어.
                    임의 파일 경로는 열지 않는다.
                  </p>
                  <Link
                    className="mt-6 inline-flex rounded-md bg-zinc-950 px-4 py-2 text-[13px] font-medium text-white"
                    href="/prd"
                  >
                    기본 PRD로 이동
                  </Link>
                </div>
              )}
            </article>

            <aside className="sticky top-8 hidden h-[calc(100vh-4rem)] overflow-y-auto border-l border-zinc-200 pl-5 lg:block">
              <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.1em] text-zinc-500">On this page</h2>
              {loadedDoc && loadedDoc.toc.length > 0 ? (
                <nav aria-label="Table of contents" className="space-y-1">
                  {loadedDoc.toc.map((item) => (
                    <a
                      className={`block rounded-md py-1.5 text-[12px] leading-5 text-zinc-600 hover:text-zinc-950 ${
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
                <p className="text-[12px] leading-5 text-zinc-500">표시할 목차가 없어.</p>
              )}
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
