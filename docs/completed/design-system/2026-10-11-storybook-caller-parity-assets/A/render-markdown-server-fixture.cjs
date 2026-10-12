// Reconstructed after the machine reboot. This is an equivalent generator;
// the original /private/tmp generator and output logs were lost.
// Coordinator may execute this with the already-installed Node dependencies.
// No private Markdown read, production-source transform, API or provider call.
// Keep the archived .cjs entry point while using import() for Node built-ins.
async function main() {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const crypto = await import('node:crypto');
  const { Module, createRequire } = await import('node:module');
  const ROOT = '/Users/iseung-ug/.codex/worktrees/storybook-main-alignment/emr-app-shell-prototype';
  const req = createRequire(path.join(ROOT, 'package.json'));
  const out = __dirname;
  const sourcePath = 'docs/product/synthetic-reference.md';
  const markdown = [
    '# 합성 문서', '', '본문 **합성 강조**와 `local-code`입니다.', '',
    '## 반복 제목', '', '첫 번째 절입니다.', '',
    '## 반복 제목', '', '두 번째 절입니다.', '',
    '- 합성 항목 A', '- 합성 항목 B', '',
    '| 항목 | 상태 |', '| --- | --- |', '| 합성 표 | 준비 |', '',
    '[합성 내부 경로](/docs?doc=synthetic-reference)', '',
    '```text', 'synthetic code <safe>', '```', '',
    '```mermaid', 'graph TD', ' A[합성 입력] --> B[합성 출력]', '```',
  ].join('\n');
  const sha = value => crypto.createHash('sha256').update(value).digest('hex');
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('Unexpected network during synthetic original Markdown SSR'); };
  try {
    const bundle = path.join(out, 'markdown-server-bundle.cjs');
    req('esbuild').buildSync({ entryPoints: [path.join(ROOT, 'src/lib/prd-viewer/markdown-renderer.tsx')], outfile: bundle, bundle: true, platform: 'node', format: 'cjs', packages: 'external', jsx: 'automatic', absWorkingDir: ROOT, logLevel: 'silent' });
    // The bundle is outside node_modules; resolve external originals from ROOT.
    process.env.NODE_PATH = [path.join(ROOT, 'node_modules'), process.env.NODE_PATH].filter(Boolean).join(path.delimiter);
    Module._initPaths();
    const React = req('react');
    const { renderToStaticMarkup } = req('react-dom/server');
    const { MarkdownRenderer } = req(bundle);
    const html = renderToStaticMarkup(React.createElement(MarkdownRenderer, { markdown, sourcePath }));
    const fixture = fs.readFileSync(path.join(ROOT, 'src/stories/prd-viewer-caller-parity.stories.fixture.tsx'), 'utf8');
    const literal = /const serverRenderedSyntheticHtml = ("(?:[^"\\]|\\.)*");/.exec(fixture)?.[1];
    if (!literal) throw new Error('Missing original saved server HTML literal');
    const embeddedHtml = JSON.parse(literal);
    const sourceHashes = Object.fromEntries(['src/lib/prd-viewer/markdown-renderer.tsx','src/lib/prd-viewer/doc-reader.ts','src/lib/prd-viewer/registry.ts','src/lib/prd-viewer/mermaid-diagram.tsx'].map(file => [file, sha(fs.readFileSync(path.join(ROOT,file)))]));
    const proof = { method: 'Actual original MarkdownRenderer export plus original private helpers/Next Link/Mermaid server fallback; Node esbuild bundle, ReactDOM.renderToStaticMarkup', executedAfterReboot: true, nodeVersion: process.version, sourcePath, syntheticMarkdown: markdown, sourceHashes, htmlBytes: Buffer.byteLength(html), htmlSha256: sha(html), currentEmbeddedHtmlSha256: sha(embeddedHtml), exactCurrentFixtureMatch: html === embeddedHtml, historicalHtmlSha256: '20d8bad8ade5784a3a7daea97d38fcb54f919e2a6f6bdf07a442b8922b300de4', privateDocumentReads: 0, liveMermaidClientEffectExecuted: false, reactHydration: false };
    fs.writeFileSync(path.join(out,'markdown-server-regenerated.html'),html);
    fs.writeFileSync(path.join(out,'markdown-server-regeneration-result.json'),JSON.stringify(proof,null,2)+'\n');
    console.log(JSON.stringify({ htmlBytes: proof.htmlBytes, htmlSha256: proof.htmlSha256, exactCurrentFixtureMatch: proof.exactCurrentFixtureMatch }));
    if (!proof.exactCurrentFixtureMatch) process.exitCode = 1;
  } finally { globalThis.fetch = previousFetch; }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
