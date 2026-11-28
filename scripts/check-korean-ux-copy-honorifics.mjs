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
// Product copy uses 합니다체: facts end in ~습니다/~입니다, requests in ~해 주세요
// and confirmations in ~하시겠습니까?. Flag 해요체 endings (~어요, ~예요, ~할까요?, ~하세요).
const haeyoEndingPattern =
  /[가-힣]요(?=\s*(?:[.!?…,;:)"'”]|$))/gu;
const haeyoAllowedWords = /(?:주세요|아니요|필요|중요|주요|개요)$/;
// Sample clinical records and guardian notes quote what a person wrote or said.
const haeyoAllowedTexts = new Set([
  "어제 저녁부터 오른쪽 앞다리를 들고 걸어요. 식욕은 평소와 같아요.",
  "식후에 1회 1정씩 하루 1회, 3일간 투여하세요.",
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

      const shouldCheckHaeyo =
        !file.includes(".stories.") &&
        !haeyoAllowedTexts.has(copyText.trim());

      if (shouldCheckHaeyo) {
        haeyoEndingPattern.lastIndex = 0;
        let haeyoMatch;

        while ((haeyoMatch = haeyoEndingPattern.exec(copyText))) {
          const preceding = copyText.slice(0, haeyoMatch.index + haeyoMatch[0].length);

          if (haeyoAllowedWords.test(preceding)) continue;

          failures.push({
            file: relativeFile,
            line: lineOf(sourceFile, node.getStart(sourceFile)),
            match: copyText.slice(Math.max(0, haeyoMatch.index - 6), haeyoMatch.index + 2),
          });
          break;
        }
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
    "Rewrite product copy in 합니다체 (~습니다, ~해 주세요, ~하시겠습니까?) or narrow the source boundary with a documented exception.",
  );
  process.exit(1);
}

console.log("Korean UX copy honorific check: ok");
