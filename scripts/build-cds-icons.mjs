#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const assetsRoot = path.join(repoRoot, "src/assets/figma/icons");
const outputRoot = path.join(repoRoot, "src/components/cds-icons");

const categoryPrefixes = {
  "actions-and-controls": "Actions",
  "alerts-and-status": "Alerts",
  "communication-and-media": "Communication",
  "content-and-editor": "Content",
  "files-and-layout": "Files",
  gnb: "Gnb",
  "medical-and-domain": "Medical",
  navigation: "Navigation",
  "people-and-places": "People",
  "utilities-and-misc": "Utilities",
};

const jsxAttrAliases = new Map([
  ["clip-rule", "clipRule"],
  ["fill-rule", "fillRule"],
  ["stroke-dasharray", "strokeDasharray"],
  ["stroke-dashoffset", "strokeDashoffset"],
  ["stroke-linecap", "strokeLinecap"],
  ["stroke-linejoin", "strokeLinejoin"],
  ["stroke-miterlimit", "strokeMiterlimit"],
  ["stroke-width", "strokeWidth"],
  ["clip-path", "clipPath"],
  ["font-family", "fontFamily"],
  ["font-size", "fontSize"],
  ["letter-spacing", "letterSpacing"],
  ["stop-color", "stopColor"],
  ["stop-opacity", "stopOpacity"],
]);

function readArgs() {
  const args = process.argv.slice(2);
  const options = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--figma-json") {
      options.figmaJson = args[index + 1];
      index += 1;
    } else if (arg === "--figma-dir") {
      options.figmaDir = args[index + 1];
      index += 1;
    } else if (arg === "--assets-root") {
      options.assetsRoot = path.resolve(args[index + 1]);
      index += 1;
    } else if (arg === "--output-root") {
      options.outputRoot = path.resolve(args[index + 1]);
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return {
    assetsRoot: options.assetsRoot ?? assetsRoot,
    figmaDir: options.figmaDir ? path.resolve(options.figmaDir) : undefined,
    figmaJson: options.figmaJson ? path.resolve(options.figmaJson) : undefined,
    outputRoot: options.outputRoot ?? outputRoot,
  };
}

function printHelp() {
  console.log(`Usage:
  node scripts/build-cds-icons.mjs [--figma-json /path/to/export.json]

Options:
  --figma-json   Import Figma MCP SVG export JSON into src/assets/figma/icons first.
  --figma-dir    Import Figma SVG exports named "Category=..., name=....svg".
  --assets-root  Override raw SVG icon source directory.
  --output-root  Override generated React component output directory.`);
}

function slug(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/&/g, "-and-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function pascalCase(value) {
  const result = slug(value)
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

  return /^\d/.test(result) ? `_${result}` : result;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function normalizeRawSvg(svg) {
  const inner = extractSvgInner(svg);
  const { width, height, viewBox } = getSvgGeometry(svg);

  return [
    `<svg width="${width}" height="${height}" viewBox="${viewBox}" fill="none" xmlns="http://www.w3.org/2000/svg">`,
    normalizePaints(inner).trim(),
    "</svg>",
    "",
  ].join("\n");
}

function getSvgGeometry(svg) {
  const rootMatch = svg.match(/<svg\b([^>]*)>/i);
  const attrs = rootMatch?.[1] ?? "";
  const width = attrs.match(/\bwidth="([^"]+)"/i)?.[1] ?? "24";
  const height = attrs.match(/\bheight="([^"]+)"/i)?.[1] ?? "24";
  const viewBox = attrs.match(/\bviewBox="([^"]+)"/i)?.[1] ?? `0 0 ${width} ${height}`;

  return { width, height, viewBox };
}

function extractSvgInner(svg) {
  const match = svg.match(/<svg\b[^>]*>([\s\S]*?)<\/svg>/i);
  if (!match) {
    throw new Error("Invalid SVG: missing <svg> root");
  }

  return match[1];
}

function normalizePaints(svg) {
  return svg
    .replace(/\sdata-name="[^"]*"/g, "")
    .replace(/\s(id|mask|clip-path)="url\(#paint[^"]*\)"/g, "")
    .replace(/fill="(?:black|#000|#000000|rgb\(0,\s*0,\s*0\))"/gi, 'fill="currentColor"')
    .replace(/stroke="(?:black|#000|#000000|rgb\(0,\s*0,\s*0\))"/gi, 'stroke="currentColor"')
    .replace(/fill="white"/gi, 'fill="currentColor"')
    .replace(/stroke="white"/gi, 'stroke="currentColor"');
}

function toJsxSvgInner(svg) {
  let inner = extractSvgInner(normalizeRawSvg(svg));

  for (const [svgAttr, jsxAttr] of jsxAttrAliases) {
    inner = inner.replace(new RegExp(`${svgAttr}=`, "g"), `${jsxAttr}=`);
  }

  return inner
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s+xmlns(:\w+)?="[^"]*"/g, "")
    .replace(/\s+class="/g, ' className="')
    .trim();
}

function importFigmaJson(figmaJsonPath, targetRoot) {
  const raw = fs.readFileSync(figmaJsonPath, "utf8");
  const payload = JSON.parse(raw);

  if (!Array.isArray(payload.icons)) {
    throw new Error("--figma-json must contain an icons array");
  }

  ensureDir(targetRoot);

  for (const icon of payload.icons) {
    const categorySlug = icon.categorySlug || slug(icon.category);
    const nameSlug = icon.nameSlug || slug(icon.name);
    const dir = path.join(targetRoot, categorySlug);
    ensureDir(dir);
    fs.writeFileSync(path.join(dir, `${nameSlug}.svg`), normalizeRawSvg(icon.svg));
  }

  console.log(`Imported ${payload.icons.length} raw SVG files into ${path.relative(repoRoot, targetRoot)}`);
}

function importFigmaDirectory(figmaDir, targetRoot) {
  const entries = fs
    .readdirSync(figmaDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".svg"))
    .sort((a, b) => a.name.localeCompare(b.name));

  let count = 0;

  for (const entry of entries) {
    const match = entry.name.match(/^Category=(.+), name=(.+)\.svg$/);
    if (!match) {
      continue;
    }

    const [, category, name] = match;
    const categorySlug = slug(category);
    const nameSlug = slug(name);
    const dir = path.join(targetRoot, categorySlug);
    ensureDir(dir);
    const svg = fs.readFileSync(path.join(figmaDir, entry.name), "utf8");
    fs.writeFileSync(path.join(dir, `${nameSlug}.svg`), normalizeRawSvg(svg));
    count += 1;
  }

  if (count === 0) {
    throw new Error(`No Figma-named SVG files found in ${figmaDir}`);
  }

  console.log(`Imported ${count} raw SVG files into ${path.relative(repoRoot, targetRoot)}`);
}

function collectIcons(sourceRoot) {
  const categories = fs
    .readdirSync(sourceRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  return categories.map((categorySlug) => {
    const categoryDir = path.join(sourceRoot, categorySlug);
    const icons = fs
      .readdirSync(categoryDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".svg"))
      .map((entry) => {
        const nameSlug = entry.name.replace(/\.svg$/, "");
        return {
          componentName: buildComponentName(categorySlug, nameSlug),
          nameSlug,
          svg: fs.readFileSync(path.join(categoryDir, entry.name), "utf8"),
        };
      })
      .sort((a, b) => a.componentName.localeCompare(b.componentName));

    return { categorySlug, icons };
  });
}

function buildComponentName(categorySlug, nameSlug) {
  const prefix = categoryPrefixes[categorySlug] ?? pascalCase(categorySlug);
  return `Cds${prefix}${pascalCase(nameSlug)}Icon`;
}

function generateCategoryFile(categorySlug, icons) {
  const lines = [
    "/* This file is generated by scripts/build-cds-icons.mjs. Do not edit manually. */",
    'import * as React from "react";',
    'import type { AppIconProps } from "@/components/icons";',
    "",
    "type CdsIconProps = AppIconProps;",
    "",
  ];

  for (const icon of icons) {
    lines.push(
      `export const ${icon.componentName} = React.forwardRef<SVGSVGElement, CdsIconProps>(`,
      `  ({ color, size = 16, style, ...props }, ref) => (`,
      `    <svg`,
      `      {...props}`,
      `      ref={ref}`,
      `      width={size}`,
      `      height={size}`,
      `      viewBox="${getSvgGeometry(icon.svg).viewBox}"`,
      `      fill="none"`,
      `      xmlns="http://www.w3.org/2000/svg"`,
      `      style={{ color, ...style }}`,
      `    >`,
      indent(toJsxSvgInner(icon.svg), 6),
      `    </svg>`,
      `  ),`,
      `);`,
      `${icon.componentName}.displayName = "${icon.componentName}";`,
      "",
    );
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

function generateIndexFile(categories) {
  return `${[
    "/* This file is generated by scripts/build-cds-icons.mjs. Do not edit manually. */",
    ...categories.map(({ categorySlug }) => `export * from "./${categorySlug}";`),
    "",
  ].join("\n")}`;
}

function indent(value, spaces) {
  const pad = " ".repeat(spaces);
  return value
    .split("\n")
    .map((line) => (line.trim() ? `${pad}${line}` : line))
    .join("\n");
}

function generateComponents(sourceRoot, targetRoot) {
  const categories = collectIcons(sourceRoot);
  ensureDir(targetRoot);

  for (const category of categories) {
    fs.writeFileSync(
      path.join(targetRoot, `${category.categorySlug}.tsx`),
      generateCategoryFile(category.categorySlug, category.icons),
    );
  }

  fs.writeFileSync(path.join(targetRoot, "index.ts"), generateIndexFile(categories));

  const iconCount = categories.reduce((sum, category) => sum + category.icons.length, 0);
  console.log(`Generated ${iconCount} React icons in ${path.relative(repoRoot, targetRoot)}`);
}

function main() {
  const options = readArgs();

  if (options.figmaJson) {
    importFigmaJson(options.figmaJson, options.assetsRoot);
  }

  if (options.figmaDir) {
    importFigmaDirectory(options.figmaDir, options.assetsRoot);
  }

  if (!fs.existsSync(options.assetsRoot)) {
    throw new Error(`Raw icon directory does not exist: ${options.assetsRoot}`);
  }

  generateComponents(options.assetsRoot, options.outputRoot);
}

main();
