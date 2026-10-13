// Builds the TAVI icon set and the email wordmark from the logo picture.
//
//   public/icons/tavi-stamp.png   the logo: the stamp with TAVI on its body (512 px, master)
//
// Run `npm run brand:build` after replacing either picture. It writes:
//   public/icons/icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png
//   public/favicon.ico             (16, 32 and 48 px; linked from the root layout, not a file convention)
//   public/icons/favicon-32.png, favicon-48.png   the same tile as PNG, for tabs that skip the ICO
//   public/icons/tavi-email-wordmark.png   the TAVI wordmark alone, on a white plate, for HTML
//                                          email (mail clients can't draw SVG, so it is a PNG
//                                          served from the app)
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

// --- Email wordmark ---------------------------------------------------------
// The wordmark alone: no stamp or mascot beside it (the same rule as the PDF and customer links).
// The wordmark: Geist SemiBold TA, the V drawn as the brand's check mark, then I (same drawing as <Wordmark>).
// It sits inline after "Sent with" in a 12px line, so it is drawn for a 15px letter size and
// made at 3x that, which stays sharp on 3x phone screens. src/modules/notifications/domain/email.ts
// shows it at a third of the pixel size (a test keeps the two in step).
const SCALE = 3;
const font = fontkit.openSync("src/components/document/pdf/fonts/Geist-SemiBold.ttf");
const fontSize = 15 * SCALE;
const k = fontSize / font.unitsPerEm;
const glyph = (ch) => font.layout(ch).glyphs[0];
const T = glyph("T");
const A = glyph("A");
const I = glyph("I");
const checkSize = fontSize * 0.8;
const baseline = Math.round(fontSize * 0.82); // y of the text baseline in the wordmark
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
const below = Math.round(fontSize * 0.08); // a little air under the baseline, for the check mark's point
const textHeight = baseline + below;
const pad = 2 * SCALE; // white plate around the wordmark so it reads on a dark-mode mail background too
// The picture's sides are whole multiples of SCALE, so showing it at 1/SCALE size never smears a pixel.
const roundUp = (n) => Math.ceil(n / SCALE) * SCALE;
const plateWidth = roundUp(wordWidth + pad * 2);
const plateHeight = roundUp(textHeight + pad * 2);
const wordmark = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${wordWidth}" height="${textHeight}" viewBox="0 0 ${wordWidth} ${textHeight}">${parts.join("")}</svg>`,
);
const plate = await sharp({
  create: { width: plateWidth, height: plateHeight, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
})
  // Any rounding spare goes above the letters, so the gap under the baseline stays `below + pad`.
  .composite([{ input: wordmark, left: pad, top: plateHeight - textHeight - pad }])
  .png({ compressionLevel: 9 })
  .toBuffer({ resolveWithObject: true });
await writeFile("public/icons/tavi-email-wordmark.png", plate.data);
const drop = (below + pad) / SCALE;
console.log(`email wordmark ${plate.info.width}x${plate.info.height}, shown ${plate.info.width / SCALE}x${plate.info.height / SCALE}, baseline ${drop}px above the picture's bottom edge`);
