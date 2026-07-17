import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = join(root, "dist");
const indexPath = join(dist, "index.html");
const indexHtml = await readFile(indexPath, "utf8");
const contract = await readFile(
  join(root, "src", "report-contract.json"),
  "utf8",
);

const scriptMatch = indexHtml.match(
  /<script[^>]+src="([^"]+)"[^>]*><\/script>/,
);
const styleMatch = indexHtml.match(/<link[^>]+href="([^"]+\.css)"[^>]*>/);

if (!scriptMatch || !styleMatch) {
  throw new Error("Could not find the Vite JS and CSS entries.");
}

const assetPath = (source) => join(dist, source.replace(/^\.?\//, ""));
const [script, style] = await Promise.all([
  readFile(assetPath(scriptMatch[1]), "utf8"),
  readFile(assetPath(styleMatch[1]), "utf8"),
]);
const safeContract = contract.replace(/<\/script/gi, "<\\/script");

const standalone = indexHtml
  .replace(scriptMatch[0], () => `<script type="module">${script}</script>`)
  .replace(styleMatch[0], () => `<style>${style}</style>`)
  .replace(
    "</body>",
    `  <script id="figma-implementation-contract" type="application/json">${safeContract}</script>\n  </body>`,
  );

await writeFile(join(dist, "report.html"), standalone, "utf8");
console.log("dist/report.html created");
