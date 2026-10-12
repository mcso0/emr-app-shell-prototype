import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const options = {};
for (let i = 2; i < process.argv.length; i++) {
  const key = process.argv[i];
  if (key === "--apply-preset") options.applyPreset = true;
  else if (["--manifest", "--index", "--baseline"].includes(key) && process.argv[i + 1]) options[key.slice(2)] = process.argv[++i];
  else throw new Error("Usage: node scripts/check-catalog-mcp-docs.mjs --manifest file-or-local-url --index file-or-local-url [--apply-preset] [--baseline original-manifest.json]");
}
if (!options.manifest || !options.index) throw new Error("Both --manifest and --index are required.");
async function readJson(input) {
  if (!/^https?:/.test(input)) return JSON.parse(readFileSync(resolve(input), "utf8"));
  const url = new URL(input);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) throw new Error("Only local Storybook URLs are permitted.");
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Local Storybook returned HTTP ${response.status}.`);
  return response.json();
}
const original = await readJson(options.manifest);
let manifest = original;
if (options.applyPreset) {
  const preset = await import(pathToFileURL(resolve(root, ".storybook/catalog-source-manifests.preset.ts")).href);
  manifest = preset.experimental_manifests({ components: original }).components;
}
const index = await readJson(options.index);
// Regression set: the original 16 unresolved Props documents plus every local
// meta.component binding discovered below. Validate against TypeScript directly,
// independently of the preset and upstream title-based component matching.
const propsRegressionIds = new Set([
  "design-system-emr-emrcontenthistorylist", "design-system-emr-history-controls",
  "design-system-emr-patientqueue", "design-system-emr-profile-panel",
  "design-system-emr-emrtextsidepanel", "design-system-ui-resizable",
  "design-system-ui-select", "features-chart-soap-blocknote-prototype",
  "features-chart-soap-live-blocknote-figma-prototype", "features-home-home-date-navigator",
  "features-lab-attachment-viewer", "features-lab-result-value-control",
  "features-notifications-personal-delivery", "features-staff-profile-side-panel-v2-content",
  "features-staff-profile-side-panel-v2-header", "design-system-overview",
]);
const baseline = options.baseline ? await readJson(options.baseline) : options.applyPreset ? original : null;
const findings = [];
const check = (condition, id, message) => { if (!condition) findings.push({ id, message }); };
const virtualFiles = new Map();
const entries = Object.values(index.entries).filter((entry) => entry.type === "story");
const entryById = new Map(entries.map((entry) => [entry.id, entry]));
const seenIds = [];
const unwrap = (node) => {
  while (node && (ts.isSatisfiesExpression(node) || ts.isAsExpression(node) || ts.isParenthesizedExpression(node))) node = node.expression;
  return node;
};
const nameOf = (node) => node.name?.text ?? node.name?.getText();
const propertyName = (node) => node.name?.text ?? node.name?.getText();
function tokens(text) {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.JSX, text);
  const output = [];
  for (let kind = scanner.scan(); kind !== ts.SyntaxKind.EndOfFileToken; kind = scanner.scan()) output.push([kind, scanner.getTokenText()]);
  return JSON.stringify(output);
}
function comparablePropType(text) {
  if (typeof text !== "string") return null;
  const source = ts.createSourceFile("prop-type.ts", `type Prop = ${text};`, ts.ScriptTarget.Latest, true);
  const declaration = source.statements[0];
  if (source.parseDiagnostics.length || source.statements.length !== 1 || !declaration || !ts.isTypeAliasDeclaration(declaration)) return tokens(text);
  // TypeScript programs may print equivalent union members in a different order.
  // Sort parsed top-level members, preserving nested types and literal content.
  return ts.isUnionTypeNode(declaration.type)
    ? JSON.stringify(declaration.type.types.map((member) => tokens(member.getText(source))).sort())
    : tokens(text);
}
function declarations(source) {
  const map = new Map();
  for (const statement of source.statements) {
    if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) map.set(nameOf(declaration), declaration);
    else if (statement.name) map.set(nameOf(statement), statement);
  }
  return map;
}
const exported = (node) => node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
let correctedGroups = 0;
let totalBytes = 0;
let sharedPrefixBytes = 0;
for (const [id, component] of Object.entries(manifest.components)) {
  check(!component.error, id, `Unresolved component documentation error: ${component.error?.name}`);
  const path = component.path?.replace(/^\.\//, "");
  check(path?.startsWith("src/") && !path.includes("..") && /\.stories\.[cm]?[jt]sx?$/.test(path), id, "Missing repo-local story source path.");
  if (!path?.startsWith("src/") || path.includes("..")) continue;
  const source = ts.createSourceFile(resolve(root, path), readFileSync(resolve(root, path), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const sourceDeclarations = declarations(source);
  const metaExport = source.statements.find(ts.isExportAssignment);
  const metaName = metaExport?.expression.getText(source);
  const sourceStoryNames = new Set(entries.filter((entry) => entry.importPath.replace(/^\.\//, "") === path).map((entry) => entry.exportName));
  sharedPrefixBytes += Buffer.byteLength(component.import ?? "");
  {
    correctedGroups++;
    check(component.description?.includes("프로젝트 Storybook 전용 초기 상태 CSF"), id, "Missing project-only fixture boundary.");
    const prefix = ts.createSourceFile("prefix.tsx", component.import ?? "", ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const generatedDeclarations = declarations(prefix);
    check(!prefix.statements.some((statement) => ts.isExportAssignment(statement) || ts.isExportDeclaration(statement) || exported(statement)), id, "Shared prefix must not export stories or helpers.");
    for (const statement of source.statements.filter(ts.isImportDeclaration)) {
      const originalSpecifier = statement.moduleSpecifier.text;
      const expectedSpecifier = originalSpecifier.startsWith(".")
        ? `@/${relative(resolve(root, "src"), resolve(dirname(resolve(root, path)), originalSpecifier)).split("\\").join("/")}`
        : originalSpecifier;
      const match = prefix.statements.filter(ts.isImportDeclaration).find((candidate) => candidate.moduleSpecifier.text === expectedSpecifier
        && tokens(candidate.importClause?.getText(prefix) ?? "") === tokens(statement.importClause?.getText(source) ?? ""));
      check(Boolean(match), id, `Source import or binding changed: ${expectedSpecifier}`);
    }
    for (const [name, declaration] of sourceDeclarations) {
      const generated = generatedDeclarations.get(name);
      check(Boolean(generated), id, `Source declaration omitted: ${name}`);
      if (!generated) continue;
      const object = ts.isVariableDeclaration(declaration) && declaration.initializer && unwrap(declaration.initializer);
      if (object && ts.isObjectLiteralExpression(object) && (name === metaName || sourceStoryNames.has(name))) {
        const result = generated.initializer && unwrap(generated.initializer);
        check(result && ts.isObjectLiteralExpression(result), id, `Source CSF object changed: ${name}`);
        if (!result || !ts.isObjectLiteralExpression(result)) continue;
        const expected = object.properties.filter((property) => propertyName(property) !== "play").map((property) => tokens(property.getText(source)));
        const actual = result.properties.map((property) => tokens(property.getText(prefix)));
        check(JSON.stringify(expected) === JSON.stringify(actual), id, `Source args/render/fixture metadata changed: ${name}`);
      } else {
        check(tokens(declaration.getText(source).replace(/^export\s+/, "")) === tokens(generated.getText(prefix)), id, `Source helper/type/data body changed: ${name}`);
      }
    }
  }
  for (const story of component.stories) {
    check(!story.error, story.id, `Unresolved story documentation error: ${story.error?.name}`);
    const entry = entryById.get(story.id);
    seenIds.push(story.id);
    check(Boolean(entry), story.id, "Story is absent from the supplied live index.");
    check(entry?.importPath.replace(/^\.\//, "") === path, story.id, "Story source differs from its index entry.");
    const assembled = `${component.import ?? ""}\n\n${story.snippet ?? ""}\n`;
    totalBytes += Buffer.byteLength(assembled);
    check(Boolean(story.snippet?.trim()), story.id, "Missing snippet.");
    {
      check(!(story.error?.name === "Error" && story.error.message === "Could not generate snippet without component name."), story.id,
        "Repaired source fixture retains the superseded snippet-generation error.");
      const parsed = ts.createSourceFile("example.tsx", assembled, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const defaults = parsed.statements.filter(ts.isExportAssignment);
      const selected = parsed.statements.filter(ts.isExportDeclaration).flatMap((statement) => statement.exportClause && ts.isNamedExports(statement.exportClause)
        ? statement.exportClause.elements.map((element) => element.name.text) : []);
      check(defaults.length === 1 && defaults[0].expression.getText(parsed) === metaName, story.id, "Fixture must export the source meta once.");
      check(selected.length === 1 && selected[0] === entry?.exportName && sourceStoryNames.has(selected[0]), story.id, "Fixture must export exactly the indexed source story.");
    }
    const filename = resolve(root, ".storybook", `__catalog_mcp_${String(story.id).replace(/[^a-z0-9_-]/gi, "_")}.tsx`);
    virtualFiles.set(filename, assembled);
  }
}
check(new Set(seenIds).size === seenIds.length, "catalog", "Duplicate manifest story IDs.");
check(entries.every((entry) => seenIds.includes(entry.id)), "catalog", "Live index has stories missing from the manifest.");

const baselineStoryIds = baseline ? Object.values(baseline.components).flatMap((component) => component.stories.map((story) => story.id)) : [];
check(baselineStoryIds.every((id) => seenIds.includes(id)), "catalog", "Previously indexed story IDs are missing.");

const config = ts.readConfigFile(resolve(root, "tsconfig.json"), ts.sys.readFile);
if (config.error) throw new Error("Cannot read project compiler options.");
const project = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
if (project.errors.length) throw new Error("Cannot parse project compiler configuration.");
const compilerOptions = { ...project.options, noEmit: true, incremental: false };
const host = ts.createCompilerHost(compilerOptions);
const realReadFile = host.readFile.bind(host);
const realFileExists = host.fileExists.bind(host);
const realGetSourceFile = host.getSourceFile.bind(host);
host.readFile = (filename) => virtualFiles.get(filename) ?? realReadFile(filename);
host.fileExists = (filename) => virtualFiles.has(filename) || realFileExists(filename);
host.getSourceFile = (filename, languageVersion, onError, shouldCreateNewSourceFile) => virtualFiles.has(filename)
  ? ts.createSourceFile(filename, virtualFiles.get(filename), languageVersion, true, ts.ScriptKind.TSX)
  : realGetSourceFile(filename, languageVersion, onError, shouldCreateNewSourceFile);
// Compile in the same project context as tsc, including its ambient declarations.
// A partial root graph can change inferred types in transitive app callers.
const regressionPaths = [...propsRegressionIds].flatMap((id) => {
  const component = manifest.components[id];
  check(Boolean(component), id, "Props regression component is missing from the manifest.");
  return component ? [resolve(root, component.path)] : [];
});
const program = ts.createProgram([...project.fileNames, ...virtualFiles.keys(), ...regressionPaths, ...Object.values(manifest.components).map((component) => resolve(root, component.path))], compilerOptions, host);
const checker = program.getTypeChecker();
let checkedProps = 0;
let zeroArgumentComponents = 0;
let localComponentGroups = 0;
for (const id of Object.keys(manifest.components)) {
  const component = manifest.components[id];
  if (!component) continue;
  const source = program.getSourceFile(resolve(root, component.path));
  const metaExport = source?.statements.find(ts.isExportAssignment);
  const meta = metaExport && declarations(source).get(metaExport.expression.getText(source));
  const object = meta?.initializer && unwrap(meta.initializer);
  const binding = object && ts.isObjectLiteralExpression(object)
    ? object.properties.find((property) => ts.isPropertyAssignment(property) && propertyName(property) === "component") : undefined;
  let symbol = binding && checker.getSymbolAtLocation(unwrap(binding.initializer));
  if (symbol?.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
  const declaration = symbol?.valueDeclaration ?? symbol?.declarations?.[0];
  const isLocal = declaration?.getSourceFile() === source;
  if (isLocal) { localComponentGroups++; propsRegressionIds.add(id); }
  if (!propsRegressionIds.has(id)) continue;
  const signatures = declaration && checker.getTypeOfSymbolAtLocation(symbol, declaration).getCallSignatures();
  check(Boolean(signatures?.length), id, "Cannot independently resolve the source component call signature.");
  const doc = component.reactDocgenTypescript;
  check(Boolean(doc?.props && typeof doc.props === "object"), id, "Missing extracted Props metadata.");
  if (!signatures?.length || !doc?.props) continue;
  check(doc.displayName === binding.initializer.getText(source), id, "Props document identifies a different component.");
  check(resolve(root, doc.filePath) === declaration.getSourceFile().fileName, id, "Props document identifies a different source file.");
  if (signatures.every((signature) => signature.parameters.length === 0)) {
    zeroArgumentComponents++;
    check(Object.keys(doc.props).length === 0, id, "Zero-argument component has invented Props metadata.");
    continue;
  }
  const propsParameter = signatures.find((signature) => signature.parameters.length > 0)?.parameters[0];
  const parameterDeclaration = propsParameter?.valueDeclaration;
  check(Boolean(parameterDeclaration), id, "Cannot resolve the source props parameter.");
  if (!parameterDeclaration) continue;
  const sourceProps = checker.getTypeOfSymbolAtLocation(propsParameter, parameterDeclaration).getProperties();
  const sourceNames = new Set(sourceProps.map((prop) => prop.name));
  check(sourceProps.length > 0, id, "Props-bearing component has no independently resolvable properties.");
  check(Object.keys(doc.props).every((name) => sourceNames.has(name)), id, "Props metadata contains properties absent from source.");
  const defaulted = new Set(ts.isParameter(parameterDeclaration) && ts.isObjectBindingPattern(parameterDeclaration.name)
    ? parameterDeclaration.name.elements.filter((element) => element.initializer).map((element) => (element.propertyName ?? element.name).getText()) : []);
  for (const prop of sourceProps) {
    checkedProps++;
    const actual = doc.props[prop.name];
    check(Boolean(actual), id, `Source prop is missing from metadata: ${prop.name}`);
    if (!actual) continue;
    const required = !(prop.flags & ts.SymbolFlags.Optional) && !defaulted.has(prop.name)
      && (prop.declarations ?? []).every((item) => !item.questionToken);
    check(actual.required === required, id, `Incorrect required flag for prop: ${prop.name}`);
    let propType = checker.getTypeOfSymbolAtLocation(prop, parameterDeclaration);
    propType = propType.getConstraint() ?? propType;
    const sourceType = checker.typeToString(propType);
    const expectedType = required ? sourceType : sourceType.replace(/ \| undefined/g, "");
    const actualType = actual.type?.name === "enum" ? actual.type.raw : actual.type?.name;
    check(comparablePropType(actualType) === comparablePropType(expectedType), id, `Incorrect type for prop ${prop.name}: expected ${expectedType}, received ${actualType}`);
    if (actual.type?.name === "enum" && propType.isUnion()) {
      const expectedValues = propType.types.filter((type) => required || !(type.flags & ts.TypeFlags.Undefined))
        .map((type) => checker.typeToString(type)).sort();
      const actualValues = (actual.type.value ?? []).map((item) => String(item.value)).sort();
      check(JSON.stringify(actualValues) === JSON.stringify(expectedValues), id, `Incorrect literal options for prop: ${prop.name}`);
    }
  }
}
const diagnostics = ts.getPreEmitDiagnostics(program);
const errors = diagnostics.filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
const groupsWithErrors = new Set(errors.filter((error) => virtualFiles.has(error.file?.fileName)).map((error) => error.file.fileName));
console.log(JSON.stringify({
  componentGroups: Object.keys(manifest.components).length, sourceFixtureGroups: correctedGroups,
  indexedStories: entries.length, compiledExamples: virtualFiles.size, baselineStoriesRetained: baselineStoryIds.filter((id) => seenIds.includes(id)).length,
  propsRegressionGroups: propsRegressionIds.size, localComponentGroups, checkedProps, zeroArgumentComponents,
  structuralFailures: findings.length, compilerErrors: errors.length, examplesWithCompilerErrors: groupsWithErrors.size,
  retainedComponentDocgenErrors: Object.entries(manifest.components).filter(([, component]) => component.error).map(([id, component]) => ({
    id, name: component.error.name, message: component.error.message.split("\n")[0].replaceAll(root, ""),
  })),
  retainedStoryErrors: Object.values(manifest.components).flatMap((component) => component.stories.filter((story) => story.error).map((story) => ({
    id: story.id, name: story.error.name, message: story.error.message.split("\n")[0].replaceAll(root, ""),
  }))),
  sharedPrefixBytes, assembledExampleBytes: totalBytes,
  findings: findings.slice(0, 20),
  diagnostics: errors.slice(0, 20).map((error) => ({
    file: error.file ? relative(root, error.file.fileName).split("\\").join("/") : null,
    line: error.file && error.start !== undefined ? error.file.getLineAndCharacterOfPosition(error.start).line + 1 : null,
    code: error.code, message: ts.flattenDiagnosticMessageText(error.messageText, " ").replaceAll(root, ""),
  })),
  boundary: "Type/source/identity verification only. CSF examples require this project's Storybook preview, mocks, CSS and shims. play is intentionally omitted; no browser execution is claimed.",
}, null, 2));
if (findings.length || errors.length) process.exitCode = 1;
