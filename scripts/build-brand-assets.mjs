// Builds the TAVI icon set and the email lockup from the two source pictures.
//
//   public/icons/tavi-stamp.png   the logo: the stamp with TAVI on its body (512 px, master)
//   docs/brand/stamp-mascot.png   the plain stamp, used beside the wordmark in emails
//
// Run `npm run brand:build` after replacing either picture. It writes:
//   public/icons/icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png
//   public/favicon.ico             (16, 32 and 48 px; linked from the root layout, not a file convention)
//   public/icons/favicon-32.png, favicon-48.png   the same tile as PNG, for tabs that skip the ICO
//   public/icons/tavi-email-lockup.png   the stamp and the TAVI wordmark side by side, on a
//                                        transparent ground, for HTML email (mail clients
//                                        can't draw SVG, so it is a PNG served from the app)
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import sharp from "sharp";

const require = createRequire(import.meta.url);
const fontkit = require("fontkit");

const BG = { r: 244, g: 245, b: 249 }; // the pictures' paper ground
const INK = "#1f2130";
const STAMP_VIOLET = "#4b3aa8"; // brand.emailColors.accent

const master = await readFile("public/icons/tavi-stamp.png");
const square = (size) => sharp(master).resize(size, size, { kernel: "lanczos3" }).png();

await writeFile("public/icons/icon-512.png", await square(512).toBuffer());
await writeFile("public/icons/icon-192.png", await square(192).toBuffer());
await writeFile("public/icons/apple-touch-icon.png", await square(180).toBuffer());

// Maskable: the artwork shrunk into the 80% safe zone on the same ground, so no launcher crop cuts the stamp.
const inner = await sharp(master).resize(384, 384, { kernel: "lanczos3" }).png().toBuffer();
await writeFile(
  "public/icons/icon-maskable-512.png",
  await sharp({ create: { width: 512, height: 512, channels: 3, background: BG } })
    .composite([{ input: inner, left: 64, top: 64 }])
    .png()
    .toBuffer(),
);

// favicon.ico: an ICO container holding PNG images. A tab shows 16 px, where the full
// canvas (mostly margin) turns to mush, so the small sizes use the mascot cropped
// tight to its outline on a transparent background and fill the whole square.
const sizes = [16, 32, 48];
const faviconSource = await (async () => {
  const { data, info } = await sharp(master).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const bg = [data[0], data[1], data[2]];
  const near = (i) => Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) < 24;
  // Flood-fill the backdrop from the edges to transparent, so only the mascot remains.
  const seen = new Uint8Array(info.width * info.height);
  const stack = [];
  for (let x = 0; x < info.width; x++) { stack.push(x, x + (info.height - 1) * info.width); }
  for (let y = 0; y < info.height; y++) { stack.push(y * info.width, y * info.width + info.width - 1); }
  while (stack.length > 0) {
    const pixel = stack.pop();
    if (seen[pixel] || !near(pixel * 4)) continue;
    seen[pixel] = 1;
    data[pixel * 4 + 3] = 0;
    const x = pixel % info.width;
    if (x > 0) stack.push(pixel - 1);
    if (x < info.width - 1) stack.push(pixel + 1);
    if (pixel >= info.width) stack.push(pixel - info.width);
    if (pixel < info.width * (info.height - 1)) stack.push(pixel + info.width);
  }
  const cut = sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } });
  const tight = await cut.png().toBuffer();
  return sharp(tight).trim({ threshold: 1 }).png().toBuffer();
})();
const faviconPng = async (size) => {
  // A solid violet tile behind the mascot, so the white head reads on light and dark tabs.
  const pad = Math.max(1, Math.round(size * 0.1));
  const mascot = await sharp(faviconSource)
    .resize(size - pad * 2, size - pad * 2, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: "lanczos3" })
    .toBuffer();
  const radius = Math.round(size * 0.22);
  const tile = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" fill="${STAMP_VIOLET}"/></svg>`
  );
  return sharp(tile).composite([{ input: mascot, gravity: "centre" }]).ensureAlpha().png();
};
// Next reads each PNG in an ICO as RGBA, so these carry an alpha channel.
await writeFile("public/icons/favicon-32.png", await (await faviconPng(32)).toBuffer());
await writeFile("public/icons/favicon-48.png", await (await faviconPng(48)).toBuffer());
const pngs = await Promise.all(sizes.map(async (s) => (await faviconPng(s)).toBuffer()));
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
sizes.forEach((size, i) => {
  const at = 6 + i * 16;
  header.writeUInt8(size, at);
  header.writeUInt8(size, at + 1);
  header.writeUInt16LE(1, at + 4);
  header.writeUInt16LE(32, at + 6);
  header.writeUInt32LE(pngs[i].length, at + 8);
  header.writeUInt32LE(offset, at + 12);
  offset += pngs[i].length;
});
await writeFile("public/favicon.ico", Buffer.concat([header, ...pngs]));

// --- Email lockup ---------------------------------------------------------
// The plain stamp with its paper ground cut away (flood fill from the corners, so the white
// head inside the outline stays), then the wordmark beside it.
const { data, info } = await sharp("docs/brand/stamp-mascot.png").ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: w, height: h } = info;
const near = (i) => Math.hypot(data[i] - BG.r, data[i + 1] - BG.g, data[i + 2] - BG.b) <= 10;
const outside = new Uint8Array(w * h);
const queue = [];
const push = (x, y) => {
  const p = y * w + x;
  if (x < 0 || y < 0 || x >= w || y >= h || outside[p] || !near(p * 4)) return;
  outside[p] = 1;
  queue.push(p);
};
for (let x = 0; x < w; x++) {
  push(x, 0);
  push(x, h - 1);
}
for (let y = 0; y < h; y++) {
  push(0, y);
  push(w - 1, y);
}
while (queue.length) {
  const p = queue.pop();
  const x = p % w;
  const y = (p / w) | 0;
  push(x + 1, y);
  push(x - 1, y);
  push(x, y + 1);
  push(x, y - 1);
}
for (let p = 0; p < w * h; p++) {
  if (outside[p]) {
    data[p * 4 + 3] = 0;
    continue;
  }
  // A soft edge: pixels touching the cut-away ground fade by how far they are from it.
  const x = p % w;
  const y = (p / w) | 0;
  const touches = [p - 1, p + 1, p - w, p + w].some((q, k) => (k < 2 ? (k === 0 ? x > 0 : x < w - 1) : k === 2 ? y > 0 : y < h - 1) && outside[q]);
  if (touches) {
    const d = Math.hypot(data[p * 4] - BG.r, data[p * 4 + 1] - BG.g, data[p * 4 + 2] - BG.b);
    data[p * 4 + 3] = Math.min(255, Math.round(d * 7));
  }
}
const cut = sharp(data, { raw: { width: w, height: h, channels: 4 } });
const stampHeight = 104; // 2x of a 52 px tall lockup
const stamp = await cut.clone().trim({ threshold: 1 }).resize({ height: stampHeight }).png().toBuffer({ resolveWithObject: true });

// The wordmark: Geist SemiBold TA, the V drawn as the brand's check mark, then I (same drawing as <Wordmark>).
const font = fontkit.openSync("src/components/document/pdf/fonts/Geist-SemiBold.ttf");
const fontSize = 62;
const k = fontSize / font.unitsPerEm;
const glyph = (ch) => font.layout(ch).glyphs[0];
const T = glyph("T");
const A = glyph("A");
const I = glyph("I");
const checkSize = fontSize * 0.8;
const baseline = 82; // y of the text baseline in the lockup
let x = 0;
const parts = [];
const place = (g) => {
  parts.push(`<path transform="translate(${x.toFixed(2)} ${baseline}) scale(${k} ${-k})" d="${g.path.toSVG()}" fill="${INK}"/>`);
  x += g.advanceWidth * k;
};
place(T);
place(A);
x += fontSize * 0.01;
parts.push(
  `<svg x="${x.toFixed(2)}" y="${(baseline - checkSize + fontSize * 0.005).toFixed(2)}" width="${checkSize}" height="${checkSize}" viewBox="0 0 24 24"><path d="M2.5 9.5 L9.5 22 L22 1.5" fill="none" stroke="${STAMP_VIOLET}" stroke-width="4.2" stroke-linecap="square" stroke-linejoin="miter"/></svg>`,
);
x += checkSize + fontSize * 0.01;
place(I);
const wordWidth = Math.ceil(x);
const gap = 22;
const total = stamp.info.width + gap + wordWidth;
const pad = 14; // white plate around the lockup so it reads on a dark-mode mail background too
const wordmark = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${wordWidth}" height="${stampHeight}" viewBox="0 0 ${wordWidth} ${stampHeight}">${parts.join("")}</svg>`,
);
const lockup = await sharp({
  create: { width: total + pad * 2, height: stampHeight + pad * 2, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
})
  .composite([
    { input: stamp.data, left: pad, top: pad },
    { input: wordmark, left: pad + stamp.info.width + gap, top: pad },
  ])
  .png({ compressionLevel: 9 })
  .toBuffer({ resolveWithObject: true });
await writeFile("public/icons/tavi-email-lockup.png", lockup.data);
console.log(`email lockup ${lockup.info.width}x${lockup.info.height}`);
