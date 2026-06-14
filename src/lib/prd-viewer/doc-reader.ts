import { readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import {
  defaultPrdDocSlug,
  getDefaultPrdDoc,
  getPrdDocBySlug,
  prdDocRegistry,
  type ClairDocsArea,
  type PrdDocEntry,
} from "./registry";

export interface PrdTocItem {
  id: string;
  text: string;
  level: 1 | 2 | 3;
}

export interface LoadedPrdDoc {
  entry: PrdDocEntry;
  markdown: string;
  toc: PrdTocItem[];
}

const allowedDocsRoots = [
  path.join(process.cwd(), "docs", "product"),
  path.join(process.cwd(), "docs", "design"),
  path.join(process.cwd(), "docs", "engineering"),
];

export function slugifyHeading(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[`*_~[\]()]/g, "")
    .replace(/[^a-z0-9\u3131-\uD79D]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "section";
}

export function stripFrontmatter(markdown: string): string {
  if (!markdown.startsWith("---")) return markdown;

  const lines = markdown.split(/\r?\n/);
  const closingIndex = lines.findIndex((line, index) => index > 0 && line.trim() === "---");

  if (closingIndex < 0) return markdown;

  return lines.slice(closingIndex + 1).join("\n").trimStart();
}

export function extractToc(markdown: string): PrdTocItem[] {
  const usedIds = new Map<string, number>();
  const toc: PrdTocItem[] = [];

  for (const line of markdown.split(/\r?\n/)) {
    const match = /^(#{1,3})\s+(.+)$/.exec(line.trim());
    if (!match) continue;

    const level = match[1].length as 1 | 2 | 3;
    const text = match[2].replace(/#+$/, "").trim();
    const baseId = slugifyHeading(text);
    const count = usedIds.get(baseId) ?? 0;
    usedIds.set(baseId, count + 1);

    toc.push({
      id: count === 0 ? baseId : `${baseId}-${count + 1}`,
      text,
      level,
    });
  }

  return toc;
}

function resolveSafeSourcePath(entry: PrdDocEntry) {
  const fullPath = path.resolve(process.cwd(), entry.sourcePath);
  const isAllowedPath = allowedDocsRoots.some((root) => fullPath === root || fullPath.startsWith(`${root}${path.sep}`));

  if (!isAllowedPath) {
    throw new Error(`CLAiR Docs registry entry points outside allowed docs roots: ${entry.sourcePath}`);
  }

  return fullPath;
}

export const loadPrdDoc = cache(async (slug: string | undefined, area?: ClairDocsArea): Promise<LoadedPrdDoc | null> => {
  const entry = getPrdDocBySlug(slug) ?? (slug ? undefined : getDefaultPrdDoc(area));

  if (!entry) return null;

  const raw = await readFile(resolveSafeSourcePath(entry), "utf8");
  const markdown = stripFrontmatter(raw);

  return {
    entry,
    markdown,
    toc: extractToc(markdown),
  };
});

export function getResolvedPrdSlug(slug: string | undefined, area?: ClairDocsArea): string {
  return getPrdDocBySlug(slug)?.slug ?? (slug ? slug : area ? getDefaultPrdDoc(area).slug : defaultPrdDocSlug);
}

export function findDocSlugBySourcePath(sourcePath: string): string | undefined {
  return prdDocRegistry.find((doc) => doc.sourcePath === sourcePath)?.slug;
}
