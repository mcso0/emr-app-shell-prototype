import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

// Static inventory only. A dependency path is not evidence that a UI state rendered.
const root = fileURLToPath(new URL("../", import.meta.url));
const options = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const name = process.argv[i];
  assert(["--index", "--output", "--baseline"].includes(name) && process.argv[i + 1],
    "Usage: node scripts/audit-storybook-coverage.mjs [--index index.json] [--output inventory.json] [--baseline commit]");
  options[name.slice(2)] = process.argv[i + 1];
}
const posix = (path) => path.split("\\").join("/");
const repoPath = (path) => posix(relative(root, path));
const safePath = (path) => path && !path.startsWith("../") && !path.startsWith("/");
function walk(path) {
  if (!existsSync(resolve(root, path))) return [];
  return readdirSync(resolve(root, path), { withFileTypes: true }).flatMap((entry) => {
    const next = `${path}/${entry.name}`;
    return entry.isDirectory() ? walk(next) : entry.isFile() ? [next] : [];
  }).sort();
}
const allSourcePaths = walk("src");
const infrastructurePaths = walk(".storybook");
const publicPaths = walk("public");
const codePattern = /\.(?:[cm]?[jt]sx?|mdx)$/;
const parsedPaths = [...allSourcePaths, ...infrastructurePaths].filter((path) => codePattern.test(path));
const config = ts.readConfigFile(resolve(root, "tsconfig.json"), ts.sys.readFile);
assert(!config.error, "Cannot read tsconfig.json");
const compilerOptions = ts.convertCompilerOptionsFromJson(config.config.compilerOptions, root).options;
const resolutionCache = ts.createModuleResolutionCache(root, (path) => path, compilerOptions);
const unwrap = (node) => {
  while (node && (ts.isSatisfiesExpression(node) || ts.isAsExpression(node)
    || ts.isParenthesizedExpression(node) || ts.isNonNullExpression(node))) node = node.expression;
  return node;
};
const propertyName = (node) => node?.name && (node.name.text ?? node.name.getText());
const properties = (node) => ts.isObjectLiteralExpression(unwrap(node) ?? {}) ? unwrap(node).properties : [];
const property = (node, name) => properties(node).find((entry) => propertyName(entry) === name)?.initializer;
const keys = (node) => properties(node).map((entry) => propertyName(entry) ?? "...spread");
const hasModifier = (node, kind) => node.modifiers?.some((modifier) => modifier.kind === kind) ?? false;
const isFunction = (node) => ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)
  || ts.isArrowFunction(node) || ts.isMethodDeclaration(node) || ts.isGetAccessorDeclaration(node);
const sortUnique = (values) => [...new Set(values)].sort();
const counts = (values) => Object.fromEntries(sortUnique(values).map((value) => [value, values.filter((entry) => entry === value).length]));
const files = [];
const internal = new Map();
for (const path of parsedPaths) {
  const role = path.startsWith(".storybook/") ? "infrastructure"
    : /\.stories\./.test(path) || path.endsWith(".mdx") ? "story"
      : /\.(?:test|spec)\./.test(path) ? "test" : "runtime";
  const record = {
    path, role, extension: extname(path), imports: [], exports: [], components: [], jsx: [], reactElements: [],
    directCallerFiles: [], jsxCallerFiles: [], storyCoverage: {}, parseDiagnostics: [],
  };
  files.push(record);
  if (path.endsWith(".mdx")) {
    record.parseDiagnostics.push({ line: 1, message: "MDX is inventoried but requires a separate MDX parser for JSX attribution." });
    continue;
  }
  const source = ts.createSourceFile(resolve(root, path), readFileSync(resolve(root, path), "utf8"),
    ts.ScriptTarget.Latest, true, /\.[jt]sx$/.test(path) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  record.contentSha256 = createHash("sha256").update(source.text).digest("hex");
  const line = (node) => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
  const state = { record, source, localImports: new Map(), exportMap: new Map(), functions: new Map(), variables: new Map(), allJsxNodes: 0 };
  internal.set(path, state);
  record.parseDiagnostics = source.parseDiagnostics.map((diagnostic) => ({
    line: source.getLineAndCharacterOfPosition(diagnostic.start ?? 0).line + 1,
    message: ts.flattenDiagnosticMessageText(diagnostic.messageText, " "),
  }));
  function modulePath(specifier) {
    const found = ts.resolveModuleName(specifier, source.fileName, compilerOptions, ts.sys, resolutionCache).resolvedModule;
    const local = found && repoPath(found.resolvedFileName);
    if (local && safePath(local) && !local.startsWith("node_modules/")) return local;
    // TypeScript does not resolve styles, MDX, or all static asset imports.
    if (specifier.startsWith(".") || specifier.startsWith("@/")) {
      const asset = specifier.startsWith("@/") ? resolve(root, "src", specifier.slice(2)) : resolve(dirname(source.fileName), specifier);
      if (existsSync(asset) && safePath(repoPath(asset))) return repoPath(asset);
    }
    return null;
  }
  function addImport(node, specifier, kind, bindings = [], typeOnly = false) {
    const entry = { specifier, kind, line: line(node), resolvedPath: modulePath(specifier), typeOnly, bindings };
    record.imports.push(entry);
    for (const binding of bindings) state.localImports.set(binding.local, { ...binding, resolvedPath: entry.resolvedPath, specifier });
    return entry;
  }
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const clause = statement.importClause;
      const bindings = [];
      if (clause?.name) bindings.push({ imported: "default", local: clause.name.text, typeOnly: clause.isTypeOnly });
      if (clause?.namedBindings) {
        if (ts.isNamespaceImport(clause.namedBindings)) bindings.push({ imported: "*", local: clause.namedBindings.name.text, typeOnly: clause.isTypeOnly });
        else for (const element of clause.namedBindings.elements) bindings.push({
          imported: element.propertyName?.text ?? element.name.text, local: element.name.text, typeOnly: clause.isTypeOnly || element.isTypeOnly,
        });
      }
      addImport(statement, statement.moduleSpecifier.text, "import", bindings,
        Boolean(clause?.isTypeOnly || (bindings.length && bindings.every((binding) => binding.typeOnly))));
    }
    if (ts.isExportDeclaration(statement)) {
      const specifier = statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier) ? statement.moduleSpecifier.text : null;
      const target = specifier ? addImport(statement, specifier, "re-export", [], statement.isTypeOnly).resolvedPath : null;
      if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) {
          const entry = { name: element.name.text, local: element.propertyName?.text ?? element.name.text, line: line(element),
            resolvedPath: target, typeOnly: statement.isTypeOnly || element.isTypeOnly };
          record.exports.push(entry);
          state.exportMap.set(entry.name, entry);
        }
      } else if (!statement.exportClause) record.exports.push({ name: "*", local: "*", line: line(statement), resolvedPath: target, typeOnly: statement.isTypeOnly });
    }
    if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) {
      state.variables.set(declaration.name.getText(source), declaration.initializer);
      if (hasModifier(statement, ts.SyntaxKind.ExportKeyword)) {
        const entry = { name: declaration.name.getText(source), local: declaration.name.getText(source), line: line(declaration), resolvedPath: null, typeOnly: false };
        record.exports.push(entry);
        state.exportMap.set(entry.name, entry);
      }
    }
    if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && hasModifier(statement, ts.SyntaxKind.ExportKeyword)) {
      const entry = { name: hasModifier(statement, ts.SyntaxKind.DefaultKeyword) ? "default" : statement.name?.text,
        local: statement.name?.text ?? "default", line: line(statement), resolvedPath: null, typeOnly: false };
      record.exports.push(entry);
      state.exportMap.set(entry.name, entry);
    }
    if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
      const entry = { name: "default", local: statement.expression.getText(source), line: line(statement), resolvedPath: null, typeOnly: false };
      record.exports.push(entry);
      state.exportMap.set("default", entry);
    }
  }
  function functionName(node) {
    if (node.name) return propertyName(node);
    for (let ancestor = node.parent; ancestor && !isFunction(ancestor); ancestor = ancestor.parent) {
      if (ts.isVariableDeclaration(ancestor) || ts.isPropertyAssignment(ancestor)) return propertyName(ancestor);
      if (ts.isExportAssignment(ancestor)) return "default";
    }
    return `inline@${line(node)}`;
  }
  function visit(node, owner = null) {
    if (isFunction(node) && node.body) {
      owner = { id: `${path}:${line(node)}:${node.getStart(source)}`, name: functionName(node), line: line(node),
        endLine: source.getLineAndCharacterOfPosition(node.end).line + 1,
        syntax: ts.SyntaxKind[node.kind], jsxCount: 0, createElementCount: 0, renderApiCallCount: 0, hasDirectJsxReturn: false };
      state.functions.set(node, owner);
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && ts.isStringLiteral(node.arguments[0] ?? {})) {
      addImport(node, node.arguments[0].text, "dynamic-import");
    }
    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      const imported = ts.isIdentifier(expression) ? state.localImports.get(expression.text)
        : ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.expression)
          ? state.localImports.get(expression.expression.text) : null;
      const isReactElement = imported?.specifier === "react" && !imported.typeOnly
        && (ts.isIdentifier(expression) ? imported.imported === "createElement"
          : expression.name.text === "createElement" && ["*", "default"].includes(imported.imported));
      if (isReactElement) {
        if (owner) owner.createElementCount++;
        const element = node.arguments[0];
        const literal = element && ts.isStringLiteralLike(element);
        const named = element && (ts.isIdentifier(element) || ts.isPropertyAccessExpression(element));
        record.reactElements.push({ tag: literal ? element.text : named ? element.getText(source) : "<dynamic-expression>",
          kind: literal ? "intrinsic" : named ? "custom" : "dynamic", line: line(node),
          column: source.getLineAndCharacterOfPosition(node.getStart(source)).character + 1, ownerId: owner?.id ?? null });
      }
    }
    if (ts.isCallExpression(node) && /^(?:ReactDOM\.)?(?:useRender|createPortal)$/.test(node.expression.getText(source)) && owner) owner.renderApiCallCount++;
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) {
      const tag = ts.isJsxFragment(node) ? "<>" : node.tagName.getText(source);
      record.jsx.push({ tag, kind: tag === "<>" ? "fragment" : /^[a-z]/.test(tag) && !tag.includes(".") ? "intrinsic" : "custom",
        line: line(node), column: source.getLineAndCharacterOfPosition(node.getStart(source)).character + 1,
        ownerId: owner?.id ?? null });
      state.allJsxNodes++;
      if (owner) owner.jsxCount++;
    }
    ts.forEachChild(node, (child) => visit(child, owner));
  }
  visit(source);
  function containsJsx(node) {
    if (!node || isFunction(node)) return false;
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) return true;
    let result = false;
    ts.forEachChild(node, (child) => { if (containsJsx(child)) result = true; });
    return result;
  }
  for (const [node, component] of state.functions) {
    if (!component.jsxCount && !component.createElementCount && !component.renderApiCallCount) continue;
    function findReturns(child) {
      if (isFunction(child)) return;
      if (ts.isReturnStatement(child) && containsJsx(child.expression)) component.hasDirectJsxReturn = true;
      ts.forEachChild(child, findReturns);
    }
    if (!ts.isBlock(node.body)) component.hasDirectJsxReturn = containsJsx(node.body);
    else findReturns(node.body);
    component.kind = /^[A-Z]/.test(component.name) ? "component-candidate" : component.name.startsWith("inline@") ? "inline-render-function" : "jsx-bearing-function";
    component.exportedAs = record.exports.filter((entry) => entry.local === component.name).map((entry) => entry.name);
    component.storyCoverage = {};
    record.components.push(component);
  }
  // Preserve factory/alias-defined UI candidates, including components in .ts without JSX.
  const usedTagRoots = new Set(record.jsx.filter((entry) => entry.kind === "custom").map((entry) => entry.tag.split(".")[0]));
  for (const [name, initializer] of state.variables) {
    if (!/^[A-Z]/.test(name) || !initializer || record.components.some((entry) => entry.name === name)) continue;
    const value = unwrap(initializer);
    const exportedAlias = /[a-z]/.test(name) && record.exports.some((entry) => entry.local === name)
      && (ts.isIdentifier(value) || ts.isPropertyAccessExpression(value));
    if (!usedTagRoots.has(name) && !exportedAlias
      && !(ts.isCallExpression(value) && /(?:forwardRef|memo|create.*(?:Icon|Component))$/.test(value.expression.getText(source)))) continue;
    record.components.push({ id: `${path}:${line(initializer)}:${initializer.getStart(source)}`, name, line: line(initializer),
      endLine: source.getLineAndCharacterOfPosition(initializer.end).line + 1, syntax: ts.SyntaxKind[value.kind],
      kind: "factory-or-alias-candidate", jsxCount: 0, createElementCount: 0, renderApiCallCount: 0, hasDirectJsxReturn: false,
      exportedAs: record.exports.filter((entry) => entry.local === name).map((entry) => entry.name), storyCoverage: {} });
  }
  record.jsxCounts = { total: record.jsx.length, ...counts(record.jsx.map((entry) => entry.kind)) };
  record.jsxTags = [...new Set(record.jsx.map((entry) => entry.tag))].sort().map((tag) => ({
    tag, count: record.jsx.filter((entry) => entry.tag === tag).length,
    lines: record.jsx.filter((entry) => entry.tag === tag).map((entry) => entry.line),
  }));
  assert.equal(record.jsx.length, state.allJsxNodes);
}

const byPath = new Map(files.map((file) => [file.path, file]));
function resolveSymbol(path, name, seen = new Set()) {
  const key = `${path}:${name}`;
  if (seen.has(key)) return null;
  seen.add(key);
  const state = internal.get(path);
  if (!state) return null;
  const own = state.record.components.find((component) => component.name === name || component.exportedAs.includes(name));
  if (own) return { path, name: own.name, componentId: own.id };
  const imported = state.localImports.get(name);
  if (imported?.resolvedPath && !imported.typeOnly) return resolveSymbol(imported.resolvedPath, imported.imported, seen);
  const exported = state.exportMap.get(name);
  if (exported && !exported.typeOnly) {
    if (exported.resolvedPath) return resolveSymbol(exported.resolvedPath, exported.local, seen);
    if (exported.local !== name) return resolveSymbol(path, exported.local, seen);
  }
  if (name.includes(".")) {
    const [namespace, ...rest] = name.split(".");
    const binding = state.localImports.get(namespace);
    if (binding?.imported === "*" && binding.resolvedPath) return resolveSymbol(binding.resolvedPath, rest.join("."), seen);
  }
  for (const entry of state.record.exports.filter((entry) => entry.name === "*" && entry.resolvedPath && !entry.typeOnly)) {
    const resolved = resolveSymbol(entry.resolvedPath, name, seen);
    if (resolved) return resolved;
  }
  return null;
}
for (const file of files) {
  for (const entry of file.imports) if (byPath.has(entry.resolvedPath)) byPath.get(entry.resolvedPath).directCallerFiles.push(file.path);
  for (const entry of [...file.jsx, ...file.reactElements].filter((entry) => entry.kind === "custom")) {
    entry.resolvedComponent = resolveSymbol(file.path, entry.tag);
    if (entry.resolvedComponent && entry.resolvedComponent.path !== file.path) byPath.get(entry.resolvedComponent.path).jsxCallerFiles.push(file.path);
  }
}
let index = null;
if (options.index) {
  // Accept a file only; do not fetch remote or private URLs.
  assert(!/^https?:/.test(options.index), "--index accepts a saved local index.json file.");
  index = JSON.parse(readFileSync(resolve(options.index), "utf8"));
}
const indexEntries = Object.values(index?.entries ?? {}).map((entry) => ({
  id: entry.id, title: entry.title, name: entry.name, type: entry.type, exportName: entry.exportName ?? null,
  importPath: entry.importPath?.replace(/^\.\//, ""), componentPath: entry.componentPath?.replace(/^\.\//, "") ?? null,
}));
for (const entry of indexEntries) assert(safePath(entry.importPath) && (!entry.componentPath || safePath(entry.componentPath)), "Index must use repo-relative source paths.");
const stories = [];
for (const file of files.filter((entry) => entry.role === "story")) {
  const state = internal.get(file.path);
  const defaultExport = state?.exportMap.get("default");
  const exportAssignment = state?.source.statements.find(ts.isExportAssignment);
  const meta = unwrap(state?.variables.get(defaultExport?.local) ?? exportAssignment?.expression);
  const titleNode = property(meta, "title");
  const componentNode = property(meta, "component");
  const indexed = indexEntries.filter((entry) => entry.importPath === file.path);
  const componentName = componentNode?.getText(state.source) ?? null;
  const story = { path: file.path, title: titleNode && ts.isStringLiteralLike(titleNode) ? titleNode.text : indexed[0]?.title ?? null,
    metaComponent: componentName, resolvedMetaComponent: componentName ? resolveSymbol(file.path, componentName) : null,
    metaArgs: keys(property(meta, "args")), argTypes: keys(property(meta, "argTypes")),
    metaPlay: Boolean(property(meta, "play")), exports: [], indexEntries: indexed, dependencyPaths: [] };
  for (const entry of file.exports.filter((entry) => entry.name !== "default" && !entry.typeOnly)) {
    const initializer = state?.variables.get(entry.local);
    story.exports.push({ name: entry.name, line: entry.line, args: keys(property(initializer, "args")),
      hasPlay: Boolean(property(initializer, "play")), hasRender: Boolean(property(initializer, "render")),
      indexed: indexed.some((indexEntry) => indexEntry.type === "story" && indexEntry.exportName === entry.name) });
  }
  const reached = new Set();
  function follow(path) {
    if (reached.has(path)) return;
    reached.add(path);
    for (const edge of byPath.get(path)?.imports ?? []) if (edge.resolvedPath && !edge.typeOnly && byPath.has(edge.resolvedPath)) follow(edge.resolvedPath);
  }
  follow(file.path);
  story.dependencyPaths = [...reached].filter((path) => path !== file.path).sort();
  stories.push(story);
}
for (const file of files) {
  file.directCallerFiles = sortUnique(file.directCallerFiles);
  file.jsxCallerFiles = sortUnique(file.jsxCallerFiles);
  const documented = stories.filter((story) => story.resolvedMetaComponent?.path === file.path
    || story.indexEntries.some((entry) => entry.componentPath === file.path));
  const directJsx = stories.filter((story) => [...byPath.get(story.path).jsx, ...byPath.get(story.path).reactElements].some((entry) => entry.resolvedComponent?.path === file.path));
  const dependency = stories.filter((story) => story.dependencyPaths.includes(file.path));
  file.storyCoverage = { classification: file.role !== "runtime" ? file.role : documented.length ? "documented"
    : directJsx.length ? "composed-in-story" : dependency.length ? "dependency-only" : "no-story-candidate",
    documentedBy: documented.map((story) => story.path), composedBy: directJsx.map((story) => story.path),
    dependencyOf: dependency.map((story) => story.path), visuallyVerified: false };
  for (const component of file.components) {
    const direct = stories.filter((story) => story.resolvedMetaComponent?.componentId === component.id);
    const explicit = stories.filter((story) => [...byPath.get(story.path).jsx, ...byPath.get(story.path).reactElements].some((entry) => entry.resolvedComponent?.componentId === component.id));
    component.storyCoverage = { classification: file.role !== "runtime" ? file.role : direct.length ? "documented"
      : explicit.length ? "composed-in-story" : dependency.length ? "dependency-only" : "no-story-candidate",
      documentedBy: direct.map((story) => story.path), composedBy: explicit.map((story) => story.path), visuallyVerified: false };
    component.jsxCallerFiles = files.filter((caller) => [...caller.jsx, ...caller.reactElements].some((entry) => entry.resolvedComponent?.componentId === component.id)).map((caller) => caller.path);
  }
}
const sourceFiles = files.filter((entry) => entry.path.startsWith("src/"));
const runtimeUi = sourceFiles.filter((entry) => entry.role === "runtime" && (entry.components.length || entry.jsx.length || entry.reactElements.length));
const assetPaths = allSourcePaths.filter((path) => !codePattern.test(path));
const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const baseline = options.baseline ?? head;
assert(/^[0-9a-f]{7,40}$/.test(baseline), "--baseline must be a commit SHA.");
const output = {
  schemaVersion: 1, baselineSha: baseline, checkoutHeadSha: head,
  sourceSnapshot: "current working tree; local edits may differ from baselineSha",
  scope: { root: "src", infrastructureRoot: ".storybook", sourceExtensions: [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs", ".mdx"],
    excludedRoots: ["node_modules", ".next", ".git", "storybook-static", "docs", "scripts", "tests", "supabase", "lottie-ai-chart-writing"],
    exclusionReason: "Application source denominator is src. Storybook infrastructure and public assets are counted separately. Build outputs, docs, automation, backend SQL and standalone animation workspace are outside that denominator.",
    symlinks: "Not followed; dependency trees and linked workspaces excluded.",
    jsxCounting: "One occurrence per opening/self-closing JSX element or fragment. Closing tags are not counted again. Every occurrence has a source line and column. Anonymous JSX callbacks are separate owners.",
    reactElementCounting: "Calls to createElement imported from react, including named aliases and default/namespace property calls. Separate from JSX counts. document.createElement is excluded.",
    coverageMeaning: { documented: "Story meta.component resolves to this component (file coverage also uses index componentPath).",
      "composed-in-story": "An explicit JSX tag in a story resolves to this component/file.",
      "dependency-only": "A runtime import/re-export path is reachable from a story. It does not prove component or state rendering.",
      "no-story-candidate": "No static Storybook link was found; not automatically a defect." } },
  summary: { allSourceFiles: allSourcePaths.length, sourceByExtension: counts(allSourcePaths.map(extname)),
    parsedSourceFiles: sourceFiles.length, sourceRoles: counts(sourceFiles.map((entry) => entry.role)),
    runtimeUiFiles: runtimeUi.length, runtimeUiCoverage: counts(runtimeUi.map((entry) => entry.storyCoverage.classification)),
    componentAndRenderFunctionCandidates: sourceFiles.reduce((sum, file) => sum + file.components.length, 0),
    runtimeComponentAndRenderFunctionCandidates: runtimeUi.reduce((sum, file) => sum + file.components.length, 0),
    jsxOccurrences: sourceFiles.reduce((sum, file) => sum + file.jsx.length, 0),
    jsxKinds: counts(sourceFiles.flatMap((file) => file.jsx.map((entry) => entry.kind))),
    reactCreateElementOccurrences: sourceFiles.reduce((sum, file) => sum + file.reactElements.length, 0),
    reactCreateElementKinds: counts(sourceFiles.flatMap((file) => file.reactElements.map((entry) => entry.kind))),
    storyFiles: stories.length, storyExportCandidates: stories.reduce((sum, story) => sum + story.exports.length, 0),
    storiesWithPlay: stories.reduce((sum, story) => sum + story.exports.filter((entry) => entry.hasPlay).length, 0),
    index: index ? { supplied: true, version: index.v, totalEntries: indexEntries.length, byType: counts(indexEntries.map((entry) => entry.type)),
      unlocatedSourceEntries: indexEntries.filter((entry) => !byPath.has(entry.importPath)) } : { supplied: false },
    sourceParseDiagnostics: sourceFiles.reduce((sum, file) => sum + file.parseDiagnostics.length, 0),
    infrastructureFiles: infrastructurePaths.length, infrastructureByExtension: counts(infrastructurePaths.map(extname)),
    supportingSourceAssets: assetPaths.length, supportingSourceAssetsByExtension: counts(assetPaths.map(extname)),
    publicAssets: publicPaths.length, publicAssetsByExtension: counts(publicPaths.map(extname)) },
  limitations: [
    "Static inventory is not visual, interaction, responsive, accessibility, permission or live-data verification.",
    "Components are syntax candidates: JSX-bearing functions, anonymous callbacks, createElement/useRender/createPortal functions and aliases/factories. They are not all independent public React components.",
    "Factory components without JSX, local tag use or recognized factory naming can require manual review. Runtime dynamic tag selection and external package internals are not expanded.",
    "Transitive import reachability includes barrels and unused runtime imports. It is deliberately classified dependency-only, never visual coverage.",
    "Controls/args/play fields report declared property names and presence, not semantic correctness or test success. Object spreads and computed metadata need manual review.",
    "MDX files, when present, remain in the denominator with an explicit unsupported-parser diagnostic.",
    "App route/layout and inline fragment contexts require manual state-matrix review; no-story-candidate does not mandate a separate story.",
  ],
  allSourcePaths, supportingAssets: assetPaths, publicAssetPaths: publicPaths,
  files, stories,
};
assert.equal(sourceFiles.length + assetPaths.length, allSourcePaths.length);
assert.equal(new Set(sourceFiles.flatMap((file) => file.jsx.map((entry) => `${file.path}:${entry.line}:${entry.column}`))).size,
  output.summary.jsxOccurrences, "JSX occurrence locations must be unique.");
const json = `${JSON.stringify(output, null, 2)}\n`;
if (options.output) writeFileSync(resolve(options.output), json);
else process.stdout.write(json);
