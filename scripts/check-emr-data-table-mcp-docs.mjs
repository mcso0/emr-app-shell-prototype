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
} else {
  manifest = JSON.parse(readFileSync(resolve(input), "utf8"));
}

const component = manifest.components["design-system-emr-emrdatatable"];
assert.equal(component.name, "EmrDataTable");
assert.equal(component.stories.length, 25);
assert(!component.import.includes("emr-app-shell-prototype"), "Imports must resolve to source modules.");

function unwrap(node) {
  while (ts.isSatisfiesExpression(node) || ts.isAsExpression(node) || ts.isParenthesizedExpression(node)) node = node.expression;
  return node;
}
function literal(node) {
  if (ts.isStringLiteral(node)) return node.text;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  throw new Error(`Expected a literal story argument: ${node.getText()}`);
}
function objectArgs(node) {
  const args = unwrap(node).properties.find((property) => property.name?.getText() === "args");
  if (!args) return {};
  return Object.fromEntries(args.initializer.properties.map((property) => [property.name.getText(), literal(property.initializer)]));
}

const storyPath = resolve(root, "src/components/emr/emr-data-table.stories.tsx");
const source = ts.createSourceFile(storyPath, readFileSync(storyPath, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const storyArgs = new Map();
let defaults;
for (const statement of source.statements) {
  if (!ts.isVariableStatement(statement)) continue;
  for (const declaration of statement.declarationList.declarations) {
    if (declaration.name.getText() === "meta") defaults = objectArgs(declaration.initializer);
    else if (statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
      storyArgs.set(declaration.name.getText(), objectArgs(declaration.initializer));
    }
  }
}
assert(defaults);
assert.equal(storyArgs.size, 25);

const virtualFiles = new Map();
const covered = new Set();
for (const story of component.stories) {
  const filename = resolve(root, ".storybook", `__mcp-check-${story.id}.tsx`);
  const text = `${component.import}\n\n${story.snippet}\n`;
  const parsed = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let actualApi;
  let exampleArgs;
  let exportName;
  let boundedFrame = false;
  const visit = (node) => {
    if (ts.isVariableDeclaration(node)) exportName = node.name.getText();
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      const name = node.tagName.getText();
      if (name === "div") {
        boundedFrame ||= node.attributes.properties.some((attribute) => ts.isJsxAttribute(attribute)
          && attribute.name.getText() === "className"
          && attribute.initializer?.getText().includes("h-[420px]"));
      }
      if (name === "EmrDataTable") actualApi = node;
      if (name === "EmrDataTableApiExample") {
        exampleArgs = Object.fromEntries(node.attributes.properties.map((attribute) => {
          assert(ts.isJsxAttribute(attribute), "Demo arguments must be explicit.");
          const value = attribute.initializer;
          return [attribute.name.getText(), value ? literal(ts.isJsxExpression(value) ? value.expression : value) : true];
        }));
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  assert(actualApi, `${story.id}: actual API example is missing.`);
  assert(boundedFrame, `${story.id}: fill mode requires the story's bounded frame.`);
  assert(exampleArgs, `${story.id}: configured example is missing.`);
  const attributes = actualApi.attributes.properties.filter(ts.isJsxAttribute).map((attribute) => attribute.name.getText());
  assert.deepEqual(attributes.sort(), ["aria-label", "table", "viewportMode"].sort(), "Demo-only props must not appear on EmrDataTable.");
  assert(storyArgs.has(exportName), `${story.id}: unknown story export ${exportName}.`);
  assert.deepEqual(exampleArgs, { ...defaults, ...storyArgs.get(exportName) }, `${story.id}: documented arguments differ from the executed story.`);
  covered.add(exportName);
  virtualFiles.set(filename, text);
}
assert.equal(covered.size, storyArgs.size, "Each story must have exactly one documented example.");

// Compile emitted snippets against real source and dependencies without writing
// generated files into the repository. String assertions alone cannot prove API validity.
const configPath = resolve(root, "tsconfig.json");
const config = ts.readConfigFile(configPath, ts.sys.readFile);
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
const program = ts.createProgram([...ambientFiles, ...virtualFiles.keys()], options, host);
const diagnostics = ts.getPreEmitDiagnostics(program);
if (diagnostics.length) {
  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (file) => file,
    getCurrentDirectory: () => root,
    getNewLine: () => "\n",
  }));
  process.exitCode = 1;
} else {
  console.log("PASS: 25 MCP examples match story arguments and typecheck against the real EmrDataTable API.");
}
