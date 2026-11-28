// DEMO-DATA-PR-003. Schematic, fictional clinical images for the Cheongdam
// past charts. Nothing here comes from a real patient or a real device. Every
// image carries a "SYNTHETIC · CLAiR DEMO" mark so it cannot be mistaken for a
// clinical record. `variant` (0 or 1) gives two different pictures per key.
import sharp from "sharp";

const W = 960;
const H = 720;
const mark = (light) =>
  `<text x="${W - 24}" y="${H - 22}" text-anchor="end" font-family="Helvetica, Arial" font-size="20" letter-spacing="3" fill="${light ? "#ffffff" : "#000000"}" fill-opacity="0.45">SYNTHETIC · CLAiR DEMO</text>`;

// Seeded pseudo-random numbers keep every render stable.
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

function speckle(seed, count, area, color, max = 3) {
  const r = rng(seed);
  let out = "";
  for (let i = 0; i < count; i++) {
    const x = area.x + r() * area.w, y = area.y + r() * area.h;
    out += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(0.6 + r() * max).toFixed(1)}" fill="${color}" fill-opacity="${(0.15 + r() * 0.5).toFixed(2)}"/>`;
  }
  return out;
}

const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${body}</svg>`;

const film = (body, seed, side = "R") => svg(`
  <defs>
    <radialGradient id="bg" cx="50%" cy="50%" r="70%"><stop offset="0" stop-color="#2b2b2b"/><stop offset="1" stop-color="#050505"/></radialGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="6"/></filter>
    <filter id="bone"><feGaussianBlur stdDeviation="2.2"/></filter>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  ${speckle(seed, 900, { x: 0, y: 0, w: W, h: H }, "#ffffff", 1.2)}
  ${body}
  <text x="28" y="44" font-family="Helvetica, Arial" font-size="24" fill="#ffffff" fill-opacity="0.7">${side}</text>
  ${mark(true)}`);

const scan = (body, seed, label) => svg(`
  <defs><clipPath id="fan"><path d="M480 60 L880 620 Q480 760 80 620 Z"/></clipPath><filter id="b"><feGaussianBlur stdDeviation="1.4"/></filter></defs>
  <rect width="100%" height="100%" fill="#000"/>
  <g clip-path="url(#fan)" filter="url(#b)">
    <rect width="100%" height="100%" fill="#1d1d1d"/>
    ${speckle(seed, 5200, { x: 60, y: 60, w: 840, h: 640 }, "#d8d8d8", 2.2)}
    ${body}
  </g>
  <g font-family="Helvetica, Arial" font-size="18" fill="#bbb"><text x="24" y="40">${label}</text><text x="24" y="66">GAIN 52</text></g>
  ${mark(true)}`);

const draw = {
  "xray-stifle": () => film(`
    <g filter="url(#soft)" fill="#6f6f6f" fill-opacity="0.55"><ellipse cx="480" cy="360" rx="170" ry="330"/></g>
    <g filter="url(#bone)" fill="#e9e9e9" fill-opacity="0.85">
      <path d="M430 40 L520 40 L540 300 Q545 345 500 355 L455 355 Q410 345 415 300 Z"/>
      <path d="M440 395 Q430 380 470 372 L530 372 Q565 382 552 410 L535 690 L455 690 Z"/>
      <ellipse cx="560" cy="350" rx="24" ry="34" transform="rotate(-18 560 350)"/>
    </g>`, 11, "L"),
  "xray-hip": () => film(`
    <g filter="url(#bone)" fill="#e6e6e6" fill-opacity="0.85">
      <path d="M380 80 L580 80 L620 260 Q640 330 560 360 L400 360 Q320 330 340 260 Z" fill-opacity="0.55"/>
      <circle cx="330" cy="380" r="58"/><circle cx="630" cy="380" r="58"/>
      <path d="M300 420 L360 420 L380 700 L300 700 Z"/><path d="M600 420 L660 420 L660 700 L580 700 Z"/>
      <rect x="455" y="60" width="50" height="300" rx="18" fill-opacity="0.7"/>
    </g>
    <g fill="none" stroke="#ffffff" stroke-opacity="0.35" stroke-width="3"><circle cx="330" cy="380" r="74"/><circle cx="630" cy="380" r="74"/></g>`, 12),
  // variant 0: mild narrowing at one space; variant 1: longer body, narrowing further cranial.
  "xray-spine": (variant) => {
    const narrow = variant ? 3 : 5, count = variant ? 10 : 9, step = variant ? 84 : 92, y = variant ? 300 : 330;
    return film(`
    <g filter="url(#soft)" fill="#5a5a5a" fill-opacity="0.5"><rect x="60" y="${y - 80}" width="840" height="300" rx="140"/></g>
    <g filter="url(#bone)" fill="#e5e5e5" fill-opacity="0.85">
      ${Array.from({ length: count }, (_, i) => `<rect x="${80 + i * step + (i > narrow ? -8 : 0)}" y="${y + (i % 2) * 4}" width="${step - 14}" height="${variant ? 62 : 70}" rx="12"/>`).join("")}
      ${Array.from({ length: count }, (_, i) => `<path d="M${100 + i * step} ${y} L${128 + i * step} ${y - 80} L${150 + i * step} ${y} Z" fill-opacity="0.6"/>`).join("")}
      ${variant ? Array.from({ length: 4 }, (_, i) => `<path d="M${110 + i * step} ${y + 62} Q${90 + i * step} ${y + 220} ${150 + i * step} ${y + 330}" stroke="#e5e5e5" stroke-width="12" fill="none" stroke-opacity="0.45"/>`).join("") : ""}
    </g>`, 13 + variant * 40);
  },
  // variant 1: larger cardiac silhouette and a narrower airway line.
  "xray-thorax": (variant) => film(`
    <g filter="url(#soft)" fill="#3a3a3a" fill-opacity="0.9"><ellipse cx="500" cy="380" rx="${variant ? 340 : 360}" ry="${variant ? 250 : 230}"/></g>
    <g filter="url(#bone)" fill="#e5e5e5" fill-opacity="0.7">
      ${Array.from({ length: 10 }, (_, i) => `<path d="M${200 + i * 62} 150 Q${230 + i * 62} 380 ${190 + i * 62} 610" stroke="#e5e5e5" stroke-width="14" fill="none" stroke-opacity="0.55"/>`).join("")}
      <rect x="120" y="120" width="760" height="40" rx="18"/>
      <ellipse cx="${variant ? 520 : 540}" cy="420" rx="${variant ? 185 : 150}" ry="${variant ? 160 : 130}" fill="#cfcfcf" fill-opacity="0.55"/>
      <path d="M150 260 Q400 ${variant ? 235 : 250} 470 ${variant ? 300 : 330}" stroke="#bdbdbd" stroke-width="${variant ? 18 : 26}" fill="none" stroke-opacity="0.5"/>
    </g>`, 14 + variant * 40),
  "xray-tarsus": () => film(`
    <g filter="url(#soft)" fill="#666" fill-opacity="0.5"><path d="M380 0 L560 0 L600 720 L360 720 Z"/></g>
    <g filter="url(#bone)" fill="#e8e8e8" fill-opacity="0.85">
      <path d="M430 0 L520 0 L530 300 L440 300 Z"/>
      ${Array.from({ length: 6 }, (_, i) => `<rect x="${420 + (i % 2) * 54}" y="${320 + Math.floor(i / 2) * 58}" width="50" height="50" rx="14"/>`).join("")}
      <path d="M430 500 L470 500 L480 720 L430 720 Z"/><path d="M490 500 L530 500 L540 720 L495 720 Z"/>
      ${speckle(7, 40, { x: 400, y: 300, w: 160, h: 200 }, "#ffffff", 4)}
    </g>`, 15),
  // variant 0: layered wall of a hollow organ; variant 1: round fluid-filled sac with dependent echoes.
  "us-abdomen": (variant) => variant
    ? scan(`
      <path d="M150 240 Q480 180 810 260 L810 330 Q480 250 150 310 Z" fill="#8c8c8c" fill-opacity="0.35"/>
      <ellipse cx="520" cy="430" rx="105" ry="140" fill="#040404" transform="rotate(18 520 430)"/>
      <path d="M440 520 Q520 560 590 505 Q560 470 450 490 Z" fill="#a9a9a9" fill-opacity="0.75"/>
      <ellipse cx="520" cy="430" rx="108" ry="143" fill="none" stroke="#e6e6e6" stroke-width="4" stroke-opacity="0.6" transform="rotate(18 520 430)"/>`, 61, "ABD  8.0MHz")
    : scan(`
      <ellipse cx="470" cy="420" rx="210" ry="96" fill="none" stroke="#e0e0e0" stroke-width="7" stroke-opacity="0.65"/>
      <ellipse cx="470" cy="420" rx="196" ry="82" fill="none" stroke="#3a3a3a" stroke-width="9"/>
      <ellipse cx="470" cy="420" rx="182" ry="68" fill="#070707"/>
      <ellipse cx="430" cy="440" rx="90" ry="20" fill="#9a9a9a" fill-opacity="0.6"/>
      <path d="M260 250 Q480 215 700 255" stroke="#e0e0e0" stroke-width="5" fill="none" stroke-opacity="0.6"/>`, 21, "ABD  7.5MHz"),
  // variant 0: darker debris with mild redness; variant 1: brighter redness with more debris.
  "otoscope-ear": (variant) => svg(`
    <defs><radialGradient id="c" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${variant ? "#f6a394" : "#f3b9aa"}"/><stop offset="0.55" stop-color="${variant ? "#dd5f52" : "#d98a7c"}"/><stop offset="1" stop-color="${variant ? "#8f2d27" : "#86463c"}"/></radialGradient><filter id="s"><feGaussianBlur stdDeviation="4"/></filter></defs>
    <rect width="100%" height="100%" fill="#000"/>
    <circle cx="480" cy="360" r="300" fill="url(#c)"/>
    <g filter="url(#s)">
      <ellipse cx="${variant ? 455 : 500}" cy="${variant ? 350 : 380}" rx="${variant ? 70 : 90}" ry="${variant ? 85 : 70}" fill="#4a2414" fill-opacity="0.85"/>
      ${variant
        ? `<path d="M560 250 Q640 330 610 450" stroke="#7a3d1c" stroke-width="36" fill="none" stroke-opacity="0.75"/><path d="M330 430 Q400 500 500 500" stroke="#6b3a1c" stroke-width="22" fill="none" stroke-opacity="0.6"/>`
        : `<path d="M330 300 Q420 250 520 300" stroke="#6b3a1c" stroke-width="30" fill="none" stroke-opacity="0.7"/>`}
    </g>
    ${speckle(31 + variant * 9, variant ? 220 : 120, { x: 360, y: 280, w: 260, h: 200 }, "#3a1a0a", 5)}
    ${mark(true)}`),
  "skin-erythema": () => svg(`
    <defs><filter id="s"><feGaussianBlur stdDeviation="18"/></filter></defs>
    <rect width="100%" height="100%" fill="#f1d9c8"/>
    ${speckle(41, 700, { x: 0, y: 0, w: W, h: H }, "#ffffff", 2)}
    <g filter="url(#s)"><ellipse cx="460" cy="360" rx="260" ry="170" fill="#e0675a" fill-opacity="0.55"/><ellipse cx="620" cy="300" rx="120" ry="90" fill="#d1453e" fill-opacity="0.4"/></g>
    ${speckle(42, 90, { x: 260, y: 230, w: 460, h: 260 }, "#b8302c", 6)}
    ${mark(false)}`),
  "skin-hotspot": () => svg(`
    <defs><filter id="s"><feGaussianBlur stdDeviation="10"/></filter></defs>
    <rect width="100%" height="100%" fill="#f4f1ea"/>
    ${((r) => Array.from({ length: 220 }, () => { const x = r() * W, y = r() * H; return `<path d="M${x.toFixed(0)} ${y.toFixed(0)} q ${(r() * 40 - 20).toFixed(0)} ${(30 + r() * 30).toFixed(0)} ${(r() * 30).toFixed(0)} ${(60 + r() * 30).toFixed(0)}" stroke="#d9c9a8" stroke-width="5" fill="none" stroke-opacity="0.9"/>`; }).join(""))(rng(500))}
    <g filter="url(#s)"><ellipse cx="480" cy="370" rx="200" ry="150" fill="#d55a4c" fill-opacity="0.8"/><ellipse cx="470" cy="360" rx="120" ry="90" fill="#e9c08a" fill-opacity="0.55"/></g>
    ${mark(false)}`),
  // variant 0: upper arch (crowns point down); variant 1: lower arch (crowns point up), heavier deposit.
  "dental-photo": (variant) => svg(`
    <defs><filter id="s"><feGaussianBlur stdDeviation="3"/></filter></defs>
    <rect width="100%" height="100%" fill="#2a0e0e"/>
    <g${variant ? ` transform="translate(0 ${H}) scale(1 -1)"` : ""}>
      <path d="M0 260 Q480 140 960 260 L960 420 Q480 330 0 420 Z" fill="${variant ? "#cf6470" : "#d9707a"}"/>
      <g filter="url(#s)">
        ${Array.from({ length: variant ? 5 : 6 }, (_, i) => { const step = variant ? 150 : 125, x = (variant ? 110 : 120) + i * step, w = variant ? 126 : 110; return `<path d="M${x} 300 q ${w / 2} -40 ${w} 0 l -12 170 q -${w / 2 - 12} 30 -${w - 24} 0 Z" fill="#f1ead8"/><path d="M${x + 8} ${variant ? 360 : 420} q ${w / 2 - 8} 25 ${w - 16} 0 l -6 ${variant ? 90 : 40} q -${w / 2 - 14} 20 -${w - 28} 0 Z" fill="#b98b3e" fill-opacity="${variant ? 0.9 : 0.8}"/>`; }).join("")}
      </g>
      <path d="M0 470 Q480 400 960 470" stroke="#c0404c" stroke-width="18" fill="none" stroke-opacity="0.8"/>
    </g>
    ${mark(true)}`),
};

export const imageKeys = Object.keys(draw);

export async function renderImage(key, variant = 0) {
  if (!draw[key]) throw new Error(`unknown image key: ${key}`);
  return sharp(Buffer.from(draw[key](variant)), { density: 72 }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
}
