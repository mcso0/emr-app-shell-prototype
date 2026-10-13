import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import sharp from "sharp";

const root = new URL("../", import.meta.url);
const check = process.argv.includes("--check");
const source = JSON.parse(await readFile(new URL("logo/app-icon-source.json", root), "utf8"));
const master = await readFile(new URL("logo/app-icon-master-1024.png", root));
const maskable = await readFile(new URL("logo/app-icon-maskable-master-1024.png", root));
const masterHash = createHash("sha256").update(master).digest("hex");

if (masterHash !== source.masterSha256) {
  throw new Error("The app-icon master differs from its approved source record.");
}
if (createHash("sha256").update(maskable).digest("hex") !== source.maskableMasterSha256) {
  throw new Error("The maskable master differs from its approved source record.");
}

for (const bytes of [master, maskable]) {
  const meta = await sharp(bytes).metadata();
  if (meta.width !== 1024 || meta.height !== 1024) {
    throw new Error("App-icon masters must be 1024x1024.");
  }
}

const maskableStats = await sharp(maskable).stats();
if (maskableStats.channels[3]?.min !== 255) {
  throw new Error("The maskable source must have an opaque, full-bleed background.");
}

const resize = (bytes, size) => sharp(bytes)
  .resize(size, size, { kernel: "lanczos3" })
  .png({ compressionLevel: 9 })
  .toBuffer();

const outputs = new Map([
  ["public/pwa-icon-192.png", await resize(master, 192)],
  ["public/pwa-icon-512.png", await resize(master, 512)],
  ["public/pwa-icon-1024.png", master],
  ["public/apple-touch-icon.png", await resize(master, 180)],
  ["public/pwa-maskable-512.png", await sharp(maskable).resize(512, 512, { kernel: "lanczos3" }).removeAlpha().png({ compressionLevel: 9 }).toBuffer()],
]);

const faviconSizes = [16, 32, 48, 64, 128, 256];
const frames = await Promise.all(faviconSizes.map(size => resize(master, size)));
const header = Buffer.alloc(6 + 16 * frames.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(frames.length, 4);
let offset = header.length;
for (const [index, bytes] of frames.entries()) {
  const pos = 6 + index * 16;
  const size = faviconSizes[index];
  header[pos] = size === 256 ? 0 : size;
  header[pos + 1] = size === 256 ? 0 : size;
  header.writeUInt16LE(1, pos + 4);
  header.writeUInt16LE(32, pos + 6);
  header.writeUInt32LE(bytes.length, pos + 8);
  header.writeUInt32LE(offset, pos + 12);
  offset += bytes.length;
}
outputs.set("src/app/favicon.ico", Buffer.concat([header, ...frames]));

for (const [relative, bytes] of outputs) {
  const file = new URL(relative, root);
  if (check) {
    const current = await readFile(file);
    if (!current.equals(bytes)) throw new Error(`Regenerate ${relative} from the approved masters.`);
  } else {
    await writeFile(file, bytes);
  }
}

console.log(`${check ? "Verified" : "Generated"} ${outputs.size} app-icon assets from ${fileURLToPath(root)}logo/.`);
