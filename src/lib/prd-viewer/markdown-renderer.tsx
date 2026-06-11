import path from "node:path";
import Link from "next/link";
import { findDocSlugBySourcePath, slugifyHeading } from "./doc-reader";

interface MarkdownRendererProps {
  markdown: string;
  sourcePath: string;
}

type ListMode = "ordered" | "unordered";

function normalizeDocsPath(href: string, sourcePath: string): string | null {
  const cleanHref = href.split("#")[0]?.trim();
  if (!cleanHref || !cleanHref.endsWith(".md")) return null;

  if (cleanHref.startsWith("docs/product/")) {
    return cleanHref;
  }

  if (cleanHref.startsWith("../") || cleanHref.startsWith("./")) {
    return path
      .normalize(path.join(path.dirname(sourcePath), cleanHref))
      .replace(/\\/g, "/");
  }

  return null;
}

function resolveHref(href: string, sourcePath: string): string {
  const normalized = normalizeDocsPath(href, sourcePath);
  const slug = normalized ? findDocSlugBySourcePath(normalized) : undefined;

  if (slug) {
    return `/prd?doc=${encodeURIComponent(slug)}`;
  }

  return href;
}

function renderInline(text: string, sourcePath: string, keyPrefix: string) {
  const nodes: React.ReactNode[] = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  let cursor = 0;
  let index = 0;

  for (const match of text.matchAll(pattern)) {
    const token = match[0];
    const matchIndex = match.index ?? 0;

    if (matchIndex > cursor) {
      nodes.push(text.slice(cursor, matchIndex));
    }

    if (token.startsWith("`")) {
      nodes.push(
        <code
          className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold text-foreground"
          key={`${keyPrefix}-code-${index}`}
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("**")) {
      nodes.push(<strong key={`${keyPrefix}-strong-${index}`}>{token.slice(2, -2)}</strong>);
    } else {
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (linkMatch) {
        const href = resolveHref(linkMatch[2], sourcePath);
        const isInternal = href.startsWith("/prd");
        nodes.push(
          <Link
            className="font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
            href={href}
            key={`${keyPrefix}-link-${index}`}
            target={isInternal ? undefined : "_blank"}
            rel={isInternal ? undefined : "noreferrer"}
          >
            {linkMatch[1]}
          </Link>
        );
      }
    }

    cursor = matchIndex + token.length;
    index += 1;
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes.length > 0 ? nodes : text;
}

function splitTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableSeparator(line: string) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function isBlockStart(line: string, nextLine?: string) {
  const trimmed = line.trim();
  return (
    trimmed === "" ||
    /^#{1,6}\s+/.test(trimmed) ||
    /^```/.test(trimmed) ||
    /^>\s?/.test(trimmed) ||
    /^[-*]\s+/.test(trimmed) ||
    /^\d+\.\s+/.test(trimmed) ||
    /^---+$/.test(trimmed) ||
    (trimmed.includes("|") && !!nextLine && isTableSeparator(nextLine))
  );
}

export function MarkdownRenderer({ markdown, sourcePath }: MarkdownRendererProps) {
  const lines = markdown.split(/\r?\n/);
  const usedIds = new Map<string, number>();
  const blocks: React.ReactNode[] = [];
  let index = 0;
  let blockIndex = 0;

  const nextHeadingId = (text: string) => {
    const baseId = slugifyHeading(text);
    const count = usedIds.get(baseId) ?? 0;
    usedIds.set(baseId, count + 1);
    return count === 0 ? baseId : `${baseId}-${count + 1}`;
  };

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      blocks.push(<hr className="my-8 border-border" key={`hr-${blockIndex}`} />);
      index += 1;
      blockIndex += 1;
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2].replace(/#+$/, "").trim();
      const id = nextHeadingId(text);
      const content = renderInline(text, sourcePath, `heading-${blockIndex}`);

      if (level === 1) {
        blocks.push(
          <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight text-balance text-foreground" id={id} key={id}>
            {content}
          </h1>
        );
      } else if (level === 2) {
        blocks.push(
          <h2
            className="scroll-m-20 border-b border-border pb-2 pt-10 text-3xl font-semibold tracking-tight text-foreground first:pt-0"
            id={id}
            key={id}
          >
            {content}
          </h2>
        );
      } else {
        blocks.push(
          <h3 className="scroll-m-20 pt-8 text-2xl font-semibold tracking-tight text-foreground" id={id} key={id}>
            {content}
          </h3>
        );
      }

      index += 1;
      blockIndex += 1;
      continue;
    }

    if (/^```/.test(trimmed)) {
      const language = trimmed.replace(/^```/, "").trim();
      const codeLines: string[] = [];
      index += 1;

      while (index < lines.length && !/^```/.test(lines[index].trim())) {
        codeLines.push(lines[index]);
        index += 1;
      }

      if (index < lines.length) index += 1;

      blocks.push(
        <figure
          className="my-6 overflow-hidden rounded-lg border bg-foreground text-background"
          key={`code-${blockIndex}`}
        >
          {language ? (
            <figcaption className="border-b border-background/20 px-4 py-2 text-[11px] uppercase tracking-[0.08em] text-background/70">
              {language}
            </figcaption>
          ) : null}
          <pre className="overflow-x-auto p-4 text-sm leading-7">
            <code>{codeLines.join("\n")}</code>
          </pre>
        </figure>
      );
      blockIndex += 1;
      continue;
    }

    if (trimmed.includes("|") && index + 1 < lines.length && isTableSeparator(lines[index + 1])) {
      const header = splitTableRow(trimmed);
      const rows: string[][] = [];
      index += 2;

      while (index < lines.length && lines[index].trim().includes("|")) {
        rows.push(splitTableRow(lines[index]));
        index += 1;
      }

      blocks.push(
        <div className="my-6 w-full overflow-x-auto rounded-lg border" key={`table-${blockIndex}`}>
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <thead className="bg-muted/50 text-foreground">
              <tr>
                {header.map((cell, cellIndex) => (
                  <th className="border-b px-3 py-2 font-semibold" key={cellIndex}>
                    {renderInline(cell, sourcePath, `table-h-${blockIndex}-${cellIndex}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr className="border-b last:border-b-0" key={rowIndex}>
                  {header.map((_, cellIndex) => (
                    <td className="px-3 py-2 align-top text-muted-foreground" key={cellIndex}>
                      {renderInline(row[cellIndex] ?? "", sourcePath, `table-${blockIndex}-${rowIndex}-${cellIndex}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      blockIndex += 1;
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      const quoteLines: string[] = [];

      while (index < lines.length && /^>\s?/.test(lines[index].trim())) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ""));
        index += 1;
      }

      blocks.push(
        <blockquote
          className="mt-6 border-l-2 bg-muted/30 py-2 pl-6 text-sm leading-7 text-muted-foreground italic"
          key={`quote-${blockIndex}`}
        >
          {quoteLines.map((quoteLine, quoteIndex) => (
            <p key={quoteIndex}>{renderInline(quoteLine, sourcePath, `quote-${blockIndex}-${quoteIndex}`)}</p>
          ))}
        </blockquote>
      );
      blockIndex += 1;
      continue;
    }

    if (/^[-*]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
      const mode: ListMode = /^\d+\.\s+/.test(trimmed) ? "ordered" : "unordered";
      const items: string[] = [];

      while (index < lines.length) {
        const listLine = lines[index].trim();
        const matchesMode =
          mode === "ordered" ? /^\d+\.\s+/.test(listLine) : /^[-*]\s+/.test(listLine);
        if (!matchesMode) break;
        items.push(listLine.replace(mode === "ordered" ? /^\d+\.\s+/ : /^[-*]\s+/, ""));
        index += 1;
      }

      const className = "my-6 flex flex-col gap-2 pl-6 text-sm leading-7 text-muted-foreground";
      const children = items.map((item, itemIndex) => (
        <li key={itemIndex}>{renderInline(item, sourcePath, `list-${blockIndex}-${itemIndex}`)}</li>
      ));

      blocks.push(
        mode === "ordered" ? (
          <ol className={`${className} list-decimal`} key={`list-${blockIndex}`}>
            {children}
          </ol>
        ) : (
          <ul className={`${className} list-disc`} key={`list-${blockIndex}`}>
            {children}
          </ul>
        )
      );
      blockIndex += 1;
      continue;
    }

    const paragraphLines = [trimmed];
    index += 1;

    while (index < lines.length && !isBlockStart(lines[index], lines[index + 1])) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }

    const paragraph = paragraphLines.join(" ");
    blocks.push(
      <p className="leading-7 text-muted-foreground [&:not(:first-child)]:mt-6" key={`p-${blockIndex}`}>
        {renderInline(paragraph, sourcePath, `p-${blockIndex}`)}
      </p>
    );
    blockIndex += 1;
  }

  return <div className="prd-markdown">{blocks}</div>;
}
