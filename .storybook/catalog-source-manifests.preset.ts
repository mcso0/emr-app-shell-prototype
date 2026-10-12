import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { Parser } from "react-docgen-typescript";
import { storyNameFromExport, toId } from "storybook/internal/csf";
import type { Manifests } from "storybook/internal/types";

const root = fileURLToPath(new URL("../", import.meta.url));
const fixtureNotice = "프로젝트 Storybook 전용 초기 상태 CSF 예시입니다. import 코드와 선택한 snippet을 함께 사용하세요. 기존 preview의 합성 mock·CSS·Next.js shim 설정에서 실행해야 하며 운영 화면에 그대로 붙여 넣는 코드가 아닙니다. 실제 컴포넌트 API는 포함된 함수 본문을 참고하세요. args·render·decorators·fixture hook과 정리 함수는 원본을 보존하며, play 검증은 생략하므로 상호작용 이후 상태를 재현하지 않습니다.";

function unwrap(node: ts.Expression): ts.Expression {
  while (ts.isSatisfiesExpression(node) || ts.isAsExpression(node) || ts.isParenthesizedExpression(node)) node = node.expression;
  return node;
}

const recoverableDocgenErrors = new Set([
  "No component import found",
  "react-docgen-typescript found no component docs",
  "react-docgen-typescript could not match component docs",
]);

// Upstream manifest discovery only follows imports. Resolve the exact meta
// symbol so local scenario components and imported primitive aliases keep
// their own Props contract instead of borrowing an unrelated component's docs.
function createSourceDocgen(paths: string[]) {
  const config = ts.readConfigFile(resolve(root, "tsconfig.json"), ts.sys.readFile);
  if (config.error) throw new Error("Cannot read catalog TypeScript configuration.");
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  if (parsed.errors.length) throw new Error("Cannot parse catalog TypeScript configuration.");
  const ambientPaths = parsed.fileNames.filter((path) => path.endsWith(".d.ts"));
  const program = ts.createProgram([...paths.map((path) => resolve(root, path)), ...ambientPaths], parsed.options);
  const checker = program.getTypeChecker();
  const parser = new Parser(program, {
    shouldExtractLiteralValuesFromEnum: true,
    shouldRemoveUndefinedFromOptional: true,
    savePropValueAsString: true,
    skipChildrenPropWithoutDoc: false,
    // Select is a direct Base UI alias: excluding node_modules-owned props
    // here would erase its entire real API. Failed entries and local scenario
    // bindings use this path; successful imported-component docs stay intact.
  });
  return (path: string, metaName: string, localOnly: boolean) => {
    const source = program.getSourceFile(resolve(root, path));
    if (!source) return undefined;
    const meta = source.statements.filter(ts.isVariableStatement)
      .flatMap((statement) => [...statement.declarationList.declarations])
      .find((declaration) => ts.isIdentifier(declaration.name) && declaration.name.text === metaName);
    const object = meta?.initializer && unwrap(meta.initializer);
    if (!object || !ts.isObjectLiteralExpression(object)) return undefined;
    const property = object.properties.find((property) => ts.isPropertyAssignment(property)
      && property.name.getText(source) === "component");
    if (!property || !ts.isPropertyAssignment(property)) return undefined;
    const expression = unwrap(property.initializer);
    let symbol = checker.getSymbolAtLocation(expression);
    if (!symbol) return undefined;
    if (symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
    const declaration = symbol.valueDeclaration ?? symbol.declarations?.[0];
    if (!declaration || (localOnly && declaration.getSourceFile() !== source)) return undefined;
    const componentType = checker.getTypeOfSymbolAtLocation(symbol, declaration);
    const signatures = componentType.getCallSignatures();
    if (!signatures.length) {
      if (localOnly) throw new Error(`Cannot resolve local catalog component signature: ${path}/${metaName}`);
      return undefined;
    }
    const doc = parser.getComponentInfo(symbol, declaration.getSourceFile(), () => expression.getText(source));
    if (!doc) {
      // Docgen can omit an imported zero-argument React component without
      // JSDoc. The exact meta symbol and its TypeScript signatures prove that
      // this component has no Props; do not invent a runtime prop interface.
      if (!signatures.every((signature) => signature.parameters.length === 0)) {
        if (localOnly) throw new Error(`Cannot extract local catalog Props: ${path}/${metaName}`);
        return undefined;
      }
      return {
        displayName: expression.getText(source),
        description: ts.displayPartsToString(symbol.getDocumentationComment(checker)),
        props: {},
        filePath: relative(root, declaration.getSourceFile().fileName).split("\\").join("/"),
      };
    }
    // An empty props table is only valid for a proven zero-argument scenario.
    // Missing extraction for a component accepting props must remain an error.
    if (!Object.keys(doc.props).length && signatures.some((signature) => signature.parameters.length > 0)) {
      if (localOnly) throw new Error(`Local catalog Props extraction is empty: ${path}/${metaName}`);
      return undefined;
    }
    // Some ambient declarations use JSDoc @type {string}; docgen retains the
    // braces. Normalize only when the enclosed text equals the actual TS type.
    const parameter = signatures.find((signature) => signature.parameters.length > 0)?.parameters[0];
    const parameterDeclaration = parameter?.valueDeclaration;
    if (parameter && parameterDeclaration) {
      const sourceProps = checker.getTypeOfSymbolAtLocation(parameter, parameterDeclaration).getProperties();
      for (const prop of sourceProps) {
        const extracted = doc.props[prop.name];
        if (!extracted?.type.name.startsWith("{")) continue;
        const sourceType = checker.typeToString(checker.getTypeOfSymbolAtLocation(prop, parameterDeclaration));
        const expected = extracted.required ? sourceType : sourceType.replace(/ \| undefined/g, "");
        if (extracted.type.name === `{${expected}}`) extracted.type.name = expected;
      }
    }
    return { ...doc, filePath: relative(root, doc.filePath).split("\\").join("/") };
  };
}

// Retain source declarations rather than synthesizing closures or component props.
// All story declarations stay local so dependencies such as Coded.args still work.
function sourceFixture(path: string, componentId: string, indexedIds: Set<string>) {
  const filename = resolve(root, path);
  const localPath = relative(root, filename).split("\\").join("/");
  if (!localPath.startsWith("src/") || !/\.stories\.[cm]?[jt]sx?$/.test(localPath)) {
    throw new Error(`Unsupported catalog story source: ${path}`);
  }
  const text = readFileSync(filename, "utf8");
  const source = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  if ((source as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics.length) {
    throw new Error(`Cannot parse catalog story source: ${localPath}`);
  }
  const edits: Array<{ start: number; end: number; value: string }> = [];
  const storyExports = new Map<string, string>();
  const defaultExports = source.statements.filter(ts.isExportAssignment);
  if (defaultExports.length !== 1 || defaultExports[0].isExportEquals || !ts.isIdentifier(defaultExports[0].expression)) {
    throw new Error(`Catalog example requires a named CSF meta declaration: ${localPath}`);
  }
  const metaName = defaultExports[0].expression.text;
  let foundMeta = false;
  function stripPlay(object: ts.ObjectLiteralExpression) {
    for (const property of object.properties) {
      const name = property.name && (ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name)) ? property.name.text : null;
      if (name !== "play") continue;
      let end = property.end;
      if (text[end] === ",") end++;
      edits.push({ start: property.getFullStart(), end, value: "" });
    }
  }
  for (const statement of source.statements) {
    if (ts.isExportAssignment(statement)) {
      edits.push({ start: statement.getFullStart(), end: statement.end, value: "" });
      continue;
    }
    if (ts.isExportDeclaration(statement)) throw new Error(`Review catalog re-export before extracting its fixture: ${localPath}`);
    const exported = ts.canHaveModifiers(statement) && ts.getModifiers(statement)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
    if (exported) {
      for (const modifier of ts.getModifiers(statement) ?? []) {
        if (modifier.kind === ts.SyntaxKind.DefaultKeyword) throw new Error(`Unsupported default declaration in ${localPath}`);
        if (modifier.kind === ts.SyntaxKind.ExportKeyword) edits.push({ start: modifier.getStart(source), end: modifier.end, value: "" });
      }
    }
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name)) {
        if (exported) throw new Error(`Unsupported destructured catalog export in ${localPath}`);
        continue;
      }
      const name = declaration.name.text;
      const value = declaration.initializer && unwrap(declaration.initializer);
      if (name === metaName) {
        if (!value || !ts.isObjectLiteralExpression(value)) throw new Error(`Catalog meta must be a CSF object in ${localPath}`);
        foundMeta = true;
        stripPlay(value);
      } else if (exported && value && ts.isObjectLiteralExpression(value)) {
        const storyId = toId(componentId, storyNameFromExport(name));
        if (indexedIds.has(storyId)) {
          storyExports.set(storyId, name);
          stripPlay(value);
        }
      }
    }
  }
  if (!foundMeta) throw new Error(`Catalog meta declaration is missing in ${localPath}`);
  function normalizeImports(node: ts.Node) {
    let literal: ts.StringLiteralLike | undefined;
    if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) literal = node.moduleSpecifier;
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) literal = node.arguments[0];
    if (literal?.text.startsWith(".")) {
      const target = relative(resolve(root, "src"), resolve(dirname(filename), literal.text)).split("\\").join("/");
      if (target.startsWith("../") || target.startsWith("/")) throw new Error(`Relative catalog import leaves src in ${localPath}`);
      edits.push({ start: literal.getStart(source), end: literal.end, value: JSON.stringify(`@/${target}`) });
    }
    ts.forEachChild(node, normalizeImports);
  }
  normalizeImports(source);
  // A play body may contain a dynamic import; its encompassing removal wins.
  const applied = edits.filter((edit) => !edits.some((outer) => outer !== edit && outer.start <= edit.start && outer.end >= edit.end));
  let prefix = text;
  for (const edit of applied.sort((a, b) => b.start - a.start)) prefix = prefix.slice(0, edit.start) + edit.value + prefix.slice(edit.end);
  return { prefix: `// ${fixtureNotice}\n${prefix.trim()}`, metaName, storyExports };
}

export function experimental_manifests(manifests: Manifests): Manifests {
  const original = manifests.components;
  if (!original) return manifests;
  const components = { ...original.components };
  const sourcePaths = Object.values(components).map((component) => component.path);
  const sourceDocgen = sourcePaths.length ? createSourceDocgen(sourcePaths) : undefined;
  for (const [id, component] of Object.entries(components)) {
    const indexedIds = new Set(component.stories.map((story) => (story as typeof story & { id?: string }).id)
      .filter((storyId): storyId is string => Boolean(storyId)));
    const fixture = sourceFixture(component.path, id, indexedIds);
    const recoverable = Boolean(component.error && recoverableDocgenErrors.has(component.error.name));
    // A successful upstream match may still borrow a similarly named import
    // instead of the local meta.component scenario. Resolve local bindings even
    // without an upstream error; do not replace successful imported contracts.
    const recoveredDoc = sourceDocgen?.(component.path, fixture.metaName, !recoverable);
    const stories = component.stories.map((story) => {
      const storyId = (story as typeof story & { id?: string }).id;
      const exportName = storyId && fixture.storyExports.get(storyId);
      if (!exportName) throw new Error(`Cannot match catalog story to its source export: ${storyId ?? `${id}/${story.name}`}`);
      const corrected = {
        ...story,
        snippet: `export default ${fixture.metaName};\nexport { ${exportName} };`,
      };
      // Only this upstream snippet-generation failure is superseded by the
      // source fixture above. Keep unrelated story and component docgen errors.
      if (corrected.error?.name === "Error" && corrected.error.message === "Could not generate snippet without component name.") {
        delete corrected.error;
      }
      return corrected;
    });
    components[id] = {
      ...component,
      ...(recoveredDoc ? { reactDocgenTypescript: recoveredDoc, ...(recoverable ? { error: undefined } : {}) } : {}),
      import: fixture.prefix,
      description: `${component.description ?? recoveredDoc?.description ?? ""}\n\n${fixtureNotice}`.trim(),
      stories,
    };
  }
  return { ...manifests, components: { ...original, components } };
}
