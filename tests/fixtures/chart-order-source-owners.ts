import { readFileSync } from "node:fs";
import ts from "typescript";

export function sourceFunction(path: string, name: string) {
  const file = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const matches: Array<ts.FunctionDeclaration | ts.FunctionExpression> = [];
  const visit = (node: ts.Node) => {
    if ((ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) && node.name?.text === name) matches.push(node);
    ts.forEachChild(node, visit);
  };
  visit(file);
  if (matches.length !== 1 || !matches[0].body) throw new Error(`Expected one source owner: ${path} ${name}`);
  return { file, owner: matches[0], statements: matches[0].body!.statements };
}

export function draftOwnedExpression(name: "commitDraftRows" | "markDraftTouched") {
  const { file, statements } = name === "commitDraftRows"
    ? sourceFunction("src/features/chart/chart-order-draft-save-executor.ts", "createChartOrderDraftSaveExecutor")
    : sourceFunction("src/features/chart/use-chart-order-draft-session.ts", "useChartOrderDraftSession");
  if (name === "commitDraftRows") {
    const returns = statements.filter(ts.isReturnStatement);
    if (returns.length !== 1 || !returns[0].expression || !ts.isArrowFunction(returns[0].expression)) throw new Error("Expected one draft save executor callback");
    return returns[0].expression.getText(file);
  }
  const declarations = statements.flatMap(statement => ts.isVariableStatement(statement) ? [...statement.declarationList.declarations] : [])
    .filter(declaration => ts.isIdentifier(declaration.name) && declaration.name.text === name);
  if (declarations.length !== 1 || !declarations[0].initializer || !ts.isArrowFunction(declarations[0].initializer)) throw new Error("Expected one draft edit callback");
  return declarations[0].initializer.getText(file);
}
