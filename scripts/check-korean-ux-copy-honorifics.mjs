import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const sourceRoot = path.join(root, "src");
const sourceExtensions = new Set([".js", ".jsx", ".json", ".ts", ".tsx"]);
const failures = [];

const informalEndingPattern =
  /(?:[가-힣]+(?:아|어)(?=\s*[.!?…])|았어|었어|했어|됐어|돼|해|줘|봐|말아|보여|열어|닫아|찾아|기다려|겹쳐|있어|없어|할게|거야|이야|야|맞아|괜찮아|잖아|하자|보자|가자|할까|할래|하지\s+마)(?=\s*(?:[.!?…,;:]|$))/gu;
const plainDeclarativePattern =
  /(?<!니)다(?=\s*(?:[.!?…,;:]|$))/gu;
const plainDeclarativeAllowedFiles = new Set([
  "src/features/inpatient/data.ts",
]);

function walk(directory) {
  const files = [];

  for (const entry of readdirSync(directory)) {
    const fullPath = path.join(directory, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }

    if (sourceExtensions.has(path.extname(entry))) {
      files.push(fullPath);
    }
  }

  return files;
}

function getScriptKind(file) {
  if (file.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (file.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (file.endsWith(".json")) return ts.ScriptKind.JSON;
  if (file.endsWith(".js")) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function getCopyText(node) {
  if (
    ts.isStringLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node) ||
    ts.isTemplateHead(node) ||
    ts.isTemplateMiddle(node) ||
    ts.isTemplateTail(node)
  ) {
    return node.text;
  }

  if (ts.isJsxText(node)) {
    return node.getText();
  }

  return null;
}

function lineOf(sourceFile, position) {
  return sourceFile.getLineAndCharacterOfPosition(position).line + 1;
}

for (const file of walk(sourceRoot)) {
  const relativeFile = path.relative(root, file);
  const source = readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    getScriptKind(file),
  );

  function visit(node) {
    const copyText = getCopyText(node);

    if (copyText) {
      informalEndingPattern.lastIndex = 0;
      const match = informalEndingPattern.exec(copyText);

      if (match) {
        failures.push({
          file: relativeFile,
          line: lineOf(sourceFile, node.getStart(sourceFile)),
          match: match[0].replace(/\s+/g, " "),
        });
      }

      const shouldCheckPlainDeclarative =
        !file.includes(".stories.") &&
        !plainDeclarativeAllowedFiles.has(relativeFile);

      if (shouldCheckPlainDeclarative) {
        plainDeclarativePattern.lastIndex = 0;
        const plainMatch = plainDeclarativePattern.exec(copyText);

        if (plainMatch) {
          failures.push({
            file: relativeFile,
            line: lineOf(sourceFile, node.getStart(sourceFile)),
            match: plainMatch[0],
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

if (failures.length > 0) {
  console.error("Clear informal Korean product-copy endings found:");
  for (const failure of failures) {
    console.error(`- ${failure.file}:${failure.line} (${failure.match})`);
  }
  console.error(
    "Rewrite product copy in 존댓말 or narrow the source boundary with a documented exception.",
  );
  process.exit(1);
}

console.log("Korean UX copy honorific check: ok");
