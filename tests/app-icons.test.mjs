import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as obra from "obra-icons-react";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../src/components/icons.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
});
const exports = {};
runInNewContext(outputText, {
  exports,
  require: (name) => name === "obra-icons-react" ? obra : require(name),
});
const { ChevronDownIcon, SearchIcon } = exports;

function renderSearch(props) {
  return renderToStaticMarkup(React.createElement(SearchIcon, props));
}

function strokeWidths(markup) {
  return [...markup.matchAll(/stroke-width="([^"]+)"/g)].map((match) => match[1]);
}

test("app icons render the 1.5 default when strokeWidth is omitted or undefined", () => {
  for (const props of [{}, { strokeWidth: undefined }]) {
    assert.deepEqual(strokeWidths(renderSearch(props)), ["1.5", "1.5"]);
  }
});

test("app icons preserve explicit stroke widths including zero", () => {
  for (const strokeWidth of [0, 1, 2]) {
    assert.deepEqual(strokeWidths(renderSearch({ strokeWidth })), [
      String(strokeWidth),
      String(strokeWidth),
    ]);
  }
});

test("app icons preserve SVG geometry, size, color, and accessibility props", () => {
  const markup = renderSearch({
    size: 20,
    color: "#123456",
    className: "size-5",
    "aria-label": "검색",
    role: "img",
  });
  const original = renderToStaticMarkup(React.createElement(obra.IconSearch, {
    size: 20,
    color: "#123456",
    strokeWidth: 1.5,
    className: "size-5",
    "aria-label": "검색",
    role: "img",
  }));

  assert.equal(markup, original);
  assert.match(markup, /width="20" height="20" viewBox="0 0 24 24"/);
  assert.match(markup, /aria-label="검색" role="img"/);
});

test("app icons forward the SVG ref and normalize SVG prop aliases", () => {
  const ref = React.createRef();
  const element = ChevronDownIcon.render({ size: 14 }, ref);

  assert.equal(element.type, "svg");
  assert.equal(element.props.ref, ref);
  assert.equal(element.props.width, 14);
  const group = element.props.children;
  const paths = React.Children.toArray(group.props.children);
  assert.equal(paths[0].props.strokeWidth, 1.5);
  assert.equal(paths[0].props.strokeLinecap, "round");
  assert.equal(paths[0].props.strokeLinejoin, "round");
  assert.equal(paths[0].props.strokeMiterlimit, "10");
  assert.equal(paths[0].props["stroke-miterlimit"], undefined);
});
