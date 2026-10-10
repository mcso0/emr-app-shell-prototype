import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const input = process.argv[2] ?? "http://127.0.0.1:6007/manifests/components.json";
let manifest;
if (/^https?:/.test(input)) {
  const url = new URL(input);
  assert(["127.0.0.1", "localhost", "[::1]"].includes(url.hostname), "Use a local Storybook manifest.");
  const response = await fetch(url);
  assert(response.ok, `Manifest returned HTTP ${response.status}.`);
  manifest = await response.json();
} else manifest = JSON.parse(readFileSync(resolve(input), "utf8"));

const cases = [
  ["design-system-emr-emrrightpanel", "EmrRightPanel", "EmrRightPanelExample", "src/components/emr/right-panel.stories.tsx", 5],
  ["design-system-emr-emrtablefilterbuilder", "EmrTableFilterBuilder", "TableFilterBuilderExample", "src/components/emr/table-filter-builder.stories.tsx", 2],
  ["design-system-ui-table", "Table", "TableExample", "src/components/ui/table.stories.tsx", 7],
];
function unwrap(node) {
  while (ts.isSatisfiesExpression(node) || ts.isAsExpression(node) || ts.isParenthesizedExpression(node)) node = node.expression;
  return node;
}
function property(node, name) {
  return unwrap(node).properties.find((entry) => entry.name?.getText() === name)?.initializer;
}
function literal(node) {
  if (ts.isStringLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  throw new Error(`Expected a literal story argument: ${node.getText()}`);
}
function argsOf(node) {
  const args = property(node, "args");
  return args ? Object.fromEntries(args.properties.map((entry) => [entry.name.getText(), literal(entry.initializer)])) : {};
}
function canonical(node, args) {
  if (!node) return null;
  node = unwrap(node);
  if (ts.isPropertyAccessExpression(node) && node.expression.getText() === "args") {
    assert(Object.hasOwn(args, node.name.text), `Unknown render argument ${node.name.text}.`);
    return args[node.name.text];
  }
  if (ts.isStringLiteral(node) || ts.isNumericLiteral(node) || [ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword].includes(node.kind)) return literal(node);
  if (ts.isJsxExpression(node)) return canonical(node.expression, args);
  if (ts.isJsxAttribute(node)) return [node.name.getText(), node.initializer ? canonical(node.initializer, args) : true];
  if (ts.isJsxText(node)) return node.text.replace(/\s+/g, " ").trim() || null;
  if (ts.isIdentifier(node)) return ["Identifier", node.text];
  const children = [];
  ts.forEachChild(node, (child) => {
    const value = canonical(child, args);
    if (value !== null) children.push(value);
  });
  return [ts.SyntaxKind[node.kind], ...children];
}

const virtualFiles = new Map();
let count = 0;
for (const [id, apiName, exampleName, path, expectedCount] of cases) {
  const component = manifest.components[id];
  assert.equal(component.name, apiName);
  assert.equal(component.stories.length, expectedCount);
  assert(!component.import.includes("emr-app-shell-prototype"));
  assert(!component.import.includes("storybook/test"));
  const sourcePath = resolve(root, path);
  const source = ts.createSourceFile(sourcePath, readFileSync(sourcePath, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let defaults;
  const stories = new Map();
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      const name = declaration.name.getText();
      if (name === "meta") defaults = argsOf(declaration.initializer);
      else if (statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) stories.set(name, declaration.initializer);
    }
  }
  assert(defaults);
  assert.equal(stories.size, expectedCount);
  const seen = new Set();
  for (const story of component.stories) {
    const filename = resolve(root, ".storybook", `__mcp-check-${story.id}.tsx`);
    const text = `${component.import}\n\n${story.snippet}\n`;
    const parsed = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const declaration = parsed.statements.filter(ts.isVariableStatement).at(-1).declarationList.declarations[0];
    const name = declaration.name.getText();
    assert(stories.has(name), `Unknown story ${name}.`);
    assert.equal(story.id, `${id}--${name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()}`);
    const expected = { ...defaults, ...argsOf(stories.get(name)) };
    const body = unwrap(declaration.initializer.body);
    const customRender = property(stories.get(name), "render");
    if (customRender) {
      assert.deepEqual(canonical(body, {}), canonical(customRender.body, expected), `${story.id}: custom render changed.`);
    } else {
      assert(ts.isJsxSelfClosingElement(body));
      assert.equal(body.tagName.getText(), exampleName);
      const args = Object.fromEntries(body.attributes.properties.map((attribute) => {
        assert(ts.isJsxAttribute(attribute));
        return [attribute.name.getText(), attribute.initializer ? canonical(attribute.initializer, {}) : true];
      }));
      assert.deepEqual(args, expected, `${story.id}: documented arguments differ from the executed story.`);
    }
    seen.add(name);
    virtualFiles.set(filename, text);
    count++;
  }
  assert.equal(seen.size, stories.size);
}

// Compile every emitted example, including Table's custom renders,
// against the actual APIs. Keep generated files virtual and preserve source.
const config = ts.readConfigFile(resolve(root, "tsconfig.json"), ts.sys.readFile);
assert(!config.error);
const parsedConfig = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
const options = { ...parsedConfig.options, incremental: false, noEmit: true };
const host = ts.createCompilerHost(options);
const originalGetSourceFile = host.getSourceFile.bind(host);
const originalFileExists = host.fileExists.bind(host);
const originalReadFile = host.readFile.bind(host);
host.fileExists = (file) => virtualFiles.has(file) || originalFileExists(file);
host.readFile = (file) => virtualFiles.get(file) ?? originalReadFile(file);
host.getSourceFile = (file, languageVersion, ...rest) => virtualFiles.has(file)
  ? ts.createSourceFile(file, virtualFiles.get(file), languageVersion, true, ts.ScriptKind.TSX)
  : originalGetSourceFile(file, languageVersion, ...rest);
const ambientFiles = parsedConfig.fileNames.filter((file) => file.endsWith(".d.ts"));
const diagnostics = ts.getPreEmitDiagnostics(ts.createProgram([...ambientFiles, ...virtualFiles.keys()], options, host));
if (diagnostics.length) {
  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (file) => file,
    getCurrentDirectory: () => root,
    getNewLine: () => "\n",
  }));
  process.exitCode = 1;
} else console.log(`PASS: ${count} MCP examples match story arguments/custom renders and typecheck against the real APIs.`);
