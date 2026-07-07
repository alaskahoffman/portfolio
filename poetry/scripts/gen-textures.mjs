// Procedural texture generator — writes PNGs with zero dependencies
// (hand-rolled PNG encoder over node:zlib, tileable value-noise fBm).
//
//   node scripts/gen-textures.mjs
//
// Outputs to public/textures/:
//   rust-panel.png    1024x1024  tileable rusted steel plate
//   brushed-metal.png  512x512   tileable brushed gunmetal
//   screen-grime.png   512x512   RGBA grime/scratch overlay for the display glass

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "textures");
mkdirSync(OUT, { recursive: true });

// ---------- PNG encoder ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function writePNG(path, w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  writeFileSync(path, png);
  console.log(`  wrote ${path} (${(png.length / 1024).toFixed(0)} KB)`);
}

// ---------- tileable value noise ----------
function hash(x, y, o, seed) {
  let h = (seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(o + 1, 2246822519)) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const smooth = (t) => t * t * (3 - 2 * t);
// u,v in [0,1); px,py integer lattice periods (tileable)
function vnoise(u, v, px, py, o, seed) {
  const x = u * px, y = v * py;
  const xi = Math.floor(x), yi = Math.floor(y);
  const sx = smooth(x - xi), sy = smooth(y - yi);
  const w = (a, b) => hash(((a % px) + px) % px, ((b % py) + py) % py, o, seed);
  const v00 = w(xi, yi), v10 = w(xi + 1, yi), v01 = w(xi, yi + 1), v11 = w(xi + 1, yi + 1);
  return v00 + (v10 - v00) * sx + (v01 - v00) * sy + (v00 - v10 - v01 + v11) * sx * sy;
}
function fbm(u, v, fx, fy, octaves, seed) {
  let amp = 0.5, sum = 0, norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * vnoise(u, v, fx << o, fy << o, o, seed);
    norm += amp;
    amp *= 0.5;
  }
  return sum / norm;
}
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;

// ---------- rust-panel.png ----------
{
  const W = 1024, H = 1024;
  const px = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) {
    const v = y / H;
    for (let x = 0; x < W; x++) {
      const u = x / W;
      // brushed gunmetal base: smooth along x, streaky across y
      const brush = fbm(u, v, 3, 96, 4, 11);
      const mottle = fbm(u, v, 20, 20, 3, 22);
      let base = 0.115 + 0.05 * brush + 0.025 * mottle;
      let r = base * 0.96, g = base * 1.0, b = base * 1.07;

      // rust patches: low-freq mask, edges roughened by high-freq noise
      const low = fbm(u, v, 4, 4, 4, 33);
      const rough = fbm(u, v, 28, 28, 3, 44);
      const m = sstep(0.60, 0.80, low + (rough - 0.5) * 0.25);
      if (m > 0) {
        // vertical drip streaking below patch cores
        const streak = fbm(u, v, 48, 5, 3, 55);
        const tone = fbm(u, v, 12, 12, 3, 66);
        const rr = mix(0.26, 0.47, tone) * (0.75 + 0.5 * rough);
        const rg = mix(0.13, 0.24, tone) * (0.75 + 0.4 * rough);
        const rb = mix(0.07, 0.11, tone) * (0.7 + 0.3 * rough);
        const wear = clamp01(m * (0.75 + 0.35 * streak));
        r = mix(r, rr, wear);
        g = mix(g, rg, wear);
        b = mix(b, rb, wear);
      }

      // pitting
      const pit = fbm(u, v, 90, 90, 2, 77);
      if (pit > 0.78) { const d = 1 - (pit - 0.78) * 2.4; r *= d; g *= d; b *= d; }
      // sparse worn glints
      if (hash(x, y, 9, 88) > 0.9985) { r += 0.10; g += 0.10; b += 0.11; }

      const i = (y * W + x) * 4;
      px[i] = clamp01(r) * 255;
      px[i + 1] = clamp01(g) * 255;
      px[i + 2] = clamp01(b) * 255;
      px[i + 3] = 255;
    }
  }
  writePNG(join(OUT, "rust-panel.png"), W, H, px);
}

// ---------- brushed-metal.png ----------
{
  const W = 512, H = 512;
  const px = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) {
    const v = y / H;
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const brush = fbm(u, v, 2, 128, 4, 101);
      const mottle = fbm(u, v, 16, 16, 3, 102);
      const base = 0.145 + 0.055 * brush + 0.02 * mottle;
      const i = (y * W + x) * 4;
      px[i] = clamp01(base * 0.97) * 255;
      px[i + 1] = clamp01(base * 1.0) * 255;
      px[i + 2] = clamp01(base * 1.06) * 255;
      px[i + 3] = 255;
    }
  }
  writePNG(join(OUT, "brushed-metal.png"), W, H, px);
}

// ---------- screen-grime.png (RGBA overlay) ----------
{
  const W = 512, H = 512;
  const px = Buffer.alloc(W * H * 4); // starts transparent
  for (let y = 0; y < H; y++) {
    const v = y / H;
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const i = (y * W + x) * 4;
      // smudge clouds — dark oily brown
      const cloud = clamp01((fbm(u, v, 3, 3, 4, 201) - 0.52) * 1.4);
      let a = cloud * 0.28;
      let r = 22, g = 15, b = 10;
      // pale dust specks
      const d = hash(x, y, 3, 202);
      if (d > 0.9962) { r = 190; g = 186; b = 172; a = Math.max(a, 0.10 + (d - 0.9962) * 18); }
      // dark flecks
      else if (d < 0.002) { r = 5; g = 4; b = 3; a = Math.max(a, 0.16); }
      px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = clamp01(a) * 255;
    }
  }
  // scratches: thin pale strokes at shallow angles
  let s = 707;
  const rnd = () => (s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296;
  for (let n = 0; n < 16; n++) {
    let x = rnd() * W, y = rnd() * H;
    const ang = rnd() * Math.PI;
    const len = 50 + rnd() * 260;
    const dx = Math.cos(ang), dy = Math.sin(ang);
    const alpha = 0.05 + rnd() * 0.06;
    for (let t = 0; t < len; t++) {
      const xi = Math.round(x) & (W - 1), yi = Math.round(y) & (H - 1);
      const i = (yi * W + xi) * 4;
      px[i] = 200; px[i + 1] = 198; px[i + 2] = 188;
      px[i + 3] = Math.max(px[i + 3], alpha * 255 * (0.6 + 0.4 * Math.sin((t / len) * Math.PI)));
      x += dx; y += dy;
    }
  }
  writePNG(join(OUT, "screen-grime.png"), W, H, px);
}

console.log("done.");
