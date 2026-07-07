// Photoreal UI assets via OpenRouter image models.
//   node scripts/gen-photo-assets.mjs [asset ...]
// Saves to public/textures/photo/<name>.png
// Style bible: singular dark machined device, lit only by the amber screen
// above — so every asset is lit faintly from directly above, on pure black.

import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "textures", "photo");
mkdirSync(OUT, { recursive: true });

const KEY = readFileSync(join(ROOT, ".env"), "utf8")
  .split("\n").find((l) => l.startsWith("OPENROUTER_API_KEY="))?.split("=")[1]?.trim();
if (!KEY) { console.error("no OPENROUTER_API_KEY in .env"); process.exit(1); }

const MODELS = [
  "google/gemini-3-pro-image",
  "google/gemini-3.1-flash-image",
  "google/gemini-2.5-flash-image",
];

const STYLE = [
  "Photorealistic studio product photograph, extreme macro detail.",
  "A component of a 1990s Japanese aftermarket car stereo head unit (Alpine / Kenwood / Pioneer style): matte black ABS plastic with fine molded texture, slightly worn from years of night driving, faint dust in the seams.",
  "Lit ONLY by a faint cool ICE-BLUE backlight glow coming from directly above the object — dim, nocturnal, everything else falls to pure black.",
  "Pure black background. Centered composition. Dead straight-on view, zero perspective tilt.",
  "Absolutely no text, no numbers, no labels, no logos, no watermark, no hands, no environment reflections.",
].join(" ");

const KNOB_BASE = "Orthographic top-down photograph looking straight down the rotation axis of a single round rotary control knob from a 1990s Japanese car stereo — the volume knob. Matte black plastic with a rubberized ribbed grip ring around the circumference (fine vertical ribs, not metal knurling), slightly soft-touch surface, subtle mold seam. The knob is a PERFECT CIRCLE centered in a square frame — zero perspective, like a UI sprite. NO indicator mark, NO pointer, NO dot, NO numbers — the face is unmarked and rotationally symmetric. The circle fills 88% of the square frame. ";

const FACEPLATE_BASE = [
  "A complete front fascia (faceplate) of a 1990s Japanese aftermarket car stereo head unit (Alpine / Kenwood / Pioneer style), photographed perfectly straight-on, orthographic, zero perspective, the rectangular faceplate filling the ENTIRE frame edge to edge. Wide landscape composition, roughly 3:2.",
  "It is ONE single injection-molded matte black ABS plastic fascia — every control sits IN the same panel: recessed sockets, molded surrounds, consistent seams. Nothing looks glued on.",
  "LAYOUT, strictly: the LEFT two-thirds is dominated by one large rectangular display window — currently switched OFF, pitch black glass, dead dark, recessed behind a thin molded surround. Down the RIGHT side, a vertical bank of FIVE identical small round rotary knobs with rubberized ribbed grips, evenly spaced in a molded strip, each in its own shallow recessed socket. Along the BOTTOM edge, from left to right: one long thin recessed slot opening (like a tape slot), then one WIDE rectangular push-button, then a tight group of THREE small square push-buttons.",
  "All knobs unmarked (no pointer dots), all buttons blank, all label areas blank.",
  "Lit ONLY by a faint cool ICE-BLUE glow washing down from directly above — dim, nocturnal; the lower parts fall toward pure black. Fine molded plastic grain, slight wear sheen on the buttons, faint dust in seams.",
  "Absolutely no text, no numbers, no logos, no icons, no watermark, no hands, no background — the faceplate IS the image.",
].join(" ");

const ASSETS = {
  "faceplate": FACEPLATE_BASE,
  "faceplate-b": FACEPLATE_BASE,
  "faceplate-c": FACEPLATE_BASE,
  "knob": KNOB_BASE + STYLE,
  "knob-b": KNOB_BASE + "A different unit from the same production run: slightly different wear — the soft-touch coating faintly shiny where thumbs rubbed it, a little dust between two ribs. " + STYLE,
  "knob-c": KNOB_BASE + "The most worn unit of its batch: soft-touch coating polished glossy in patches, one faint scratch across the face, dust in the rib grooves. " + STYLE,
  "panel": "A perfectly flat matte black ABS plastic fascia panel from a 1990s Japanese car stereo, filling the entire frame edge to edge like a texture swatch. Fine molded leather-grain texture, very dark, faint cool blue glow grazing the top edge, sparse dust and one faint scuff. No objects, just the surface. " + STYLE,
  "actuator": "A large wide rectangular push-button from a 1990s Japanese car stereo — the big preset/eject style button. Matte black plastic, slightly convex face, softly rounded edges, sitting in a thin recessed plastic socket, faint thumb-wear sheen in the middle, photographed dead straight-on. The button fills 92% of the frame width and about half the frame height, centered. Blank face. " + STYLE,
  "key": "A small rectangular push-button key from a 1990s Japanese car stereo fascia, matte black plastic, slightly convex, softly rounded edges, faint wear sheen, photographed dead straight-on, filling 80% of the frame, blank face. " + STYLE,
  "bezel": "The rectangular display bezel of a 1990s Japanese car stereo: a thin gloss-black plastic frame with an empty pitch-black display opening in the middle, gently rounded inner corners, a faint cool ice-blue glow catching its top edge, photographed dead straight-on. The frame fills the image. " + STYLE,
};

function findDataUrl(node) {
  if (typeof node === "string") return node.startsWith("data:image/") ? node : null;
  if (Array.isArray(node)) { for (const n of node) { const r = findDataUrl(n); if (r) return r; } return null; }
  if (node && typeof node === "object") { for (const v of Object.values(node)) { const r = findDataUrl(v); if (r) return r; } return null; }
  return null;
}

async function generate(name, prompt) {
  for (const model of MODELS) {
    process.stdout.write(`  ${name} ← ${model} ... `);
    try {
      const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          modalities: ["image", "text"],
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await r.json();
      if (!r.ok) { console.log(`HTTP ${r.status}: ${JSON.stringify(data).slice(0, 120)}`); continue; }
      const url = findDataUrl(data?.choices?.[0]?.message);
      if (!url) { console.log("no image in response"); continue; }
      const b64 = url.slice(url.indexOf(",") + 1);
      const buf = Buffer.from(b64, "base64");
      writeFileSync(join(OUT, `${name}.png`), buf);
      console.log(`OK (${(buf.length / 1024).toFixed(0)} KB)`);
      return true;
    } catch (e) {
      console.log(`error: ${String(e).slice(0, 100)}`);
    }
  }
  console.log(`  !! ${name}: all models failed`);
  return false;
}

const wanted = process.argv.slice(2);
const list = wanted.length ? wanted : Object.keys(ASSETS);
for (const name of list) {
  if (!ASSETS[name]) { console.log(`unknown asset: ${name}`); continue; }
  await generate(name, ASSETS[name]);
}
console.log("done.");
