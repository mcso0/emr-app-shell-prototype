"use client";

import { useEffect, useId, useState } from "react";
import mermaid from "mermaid";

interface MermaidDiagramProps {
  chart: string;
}

export function MermaidDiagram({ chart }: MermaidDiagramProps) {
  const reactId = useId();
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const diagramId = `clair-docs-mermaid-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "base",
      themeVariables: {
        background: "#ffffff",
        primaryColor: "#f4f4f5",
        primaryTextColor: "#18181b",
        primaryBorderColor: "#d4d4d8",
        lineColor: "#71717a",
        tertiaryColor: "#ffffff",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
      },
    });

    mermaid
      .render(diagramId, chart)
      .then(({ svg: renderedSvg }) => {
        if (!cancelled) {
          setSvg(renderedSvg);
          setError(null);
        }
      })
      .catch((renderError: unknown) => {
        if (!cancelled) {
          setSvg(null);
          setError(renderError instanceof Error ? renderError.message : "Unable to render Mermaid diagram.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [chart, reactId]);

  if (error) {
    return (
      <figure className="my-6 overflow-hidden rounded-lg border bg-foreground text-background">
        <figcaption className="border-b border-background/20 px-4 py-2 text-[11px] uppercase tracking-[0.08em] text-background/70">
          Mermaid render error
        </figcaption>
        <pre className="overflow-x-auto p-4 text-sm leading-7">
          <code>{chart}</code>
        </pre>
      </figure>
    );
  }

  return (
    <figure className="my-6 overflow-x-auto rounded-lg border bg-white p-4 text-zinc-950">
      {svg ? (
        <div
          className="min-w-[640px] [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
          data-testid="prd-mermaid-diagram"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <div className="flex min-h-64 min-w-[640px] items-center justify-center text-sm text-zinc-500">
          Rendering diagram...
        </div>
      )}
    </figure>
  );
}
