const el = (id) => document.getElementById(id);
const ta = el("poem");
const device = el("device");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- mechanical sounds (WebAudio, no assets) -----------------------------------
let actx = null;
function clickSnd(freq = 800, dur = 0.03, vol = 0.05, type = "square") {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, actx.currentTime);
    o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.6), actx.currentTime + dur);
    g.gain.setValueAtTime(vol, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
    o.connect(g);
    g.connect(actx.destination);
    o.start();
    o.stop(actx.currentTime + dur);
  } catch { /* audio unavailable — stay silent */ }
}
const thunk = () => { clickSnd(95, 0.08, 0.17, "triangle"); clickSnd(520, 0.018, 0.04); };
const detent = () => clickSnd(640, 0.01, 0.026);

// real recorded lever clunks — one per piano key (mp3s in public/)
const KEY_SND = {
  undo: "floraphonic-analog-appliance-button-2-185277.mp3",
  copy: "floraphonic-analog-appliance-button-6-185281.mp3",
  clear: "floraphonic-analog-appliance-button-7-185282.mp3",
  fire: "floraphonic-analog-appliance-button-9-185284.mp3",
};
for (const k in KEY_SND) {
  const a = new Audio("/squire/" + KEY_SND[k]);
  a.preload = "auto";
  a.volume = 0.75;
  KEY_SND[k] = a;
}
function keySnd(name) {
  const a = KEY_SND[name];
  if (!a) return;
  a.currentTime = 0;
  a.play().catch(() => { /* pre-interaction autoplay block — stay silent */ });
}

// ---- the machine's voice: synthesized, no samples --------------------------------
// tape-motor loop while a job runs: rotation hum with wow, bearing noise,
// and a fluttering spindle whine
let motorNodes = null;
function motorStart() {
  if (motorNodes) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const t = actx.currentTime;
    const out = actx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.055, t + 0.22); // spin-up
    out.connect(actx.destination);

    const hum = actx.createOscillator();
    hum.type = "sawtooth";
    hum.frequency.value = 56;
    const humLp = actx.createBiquadFilter();
    humLp.type = "lowpass"; humLp.frequency.value = 240; humLp.Q.value = 0.8;
    const humG = actx.createGain(); humG.gain.value = 0.5;
    const wow = actx.createOscillator(); wow.frequency.value = 0.9; // slow speed drift
    const wowG = actx.createGain(); wowG.gain.value = 1.8;
    wow.connect(wowG); wowG.connect(hum.frequency);
    hum.connect(humLp); humLp.connect(humG); humG.connect(out);

    const nbuf = actx.createBuffer(1, actx.sampleRate, actx.sampleRate);
    const nd = nbuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const noise = actx.createBufferSource();
    noise.buffer = nbuf; noise.loop = true;
    const nBp = actx.createBiquadFilter();
    nBp.type = "bandpass"; nBp.frequency.value = 420; nBp.Q.value = 1.2;
    const nG = actx.createGain(); nG.gain.value = 0.35;
    noise.connect(nBp); nBp.connect(nG); nG.connect(out);

    const wh = actx.createOscillator();
    wh.type = "sine"; wh.frequency.value = 1860;
    const whG = actx.createGain(); whG.gain.value = 0.02;
    const flutter = actx.createOscillator(); flutter.frequency.value = 6.3;
    const flG = actx.createGain(); flG.gain.value = 9;
    flutter.connect(flG); flG.connect(wh.frequency);
    wh.connect(whG); whG.connect(out);

    [hum, wow, noise, wh, flutter].forEach((n) => n.start());
    motorNodes = { out, hum, wh, stops: [hum, wow, noise, wh, flutter] };
  } catch { /* audio unavailable */ }
}
function motorStop() {
  if (!motorNodes) return;
  const { out, hum, wh, stops } = motorNodes;
  motorNodes = null;
  const t = actx.currentTime;
  // analog coast-down: the pitch sags over ~2s while the level decays on a
  // slow RC curve that OUTLASTS the pitch drop — the rumble lingers a beat
  // after the reels have all but stopped, then dies into the noise floor
  out.gain.cancelScheduledValues(t);
  out.gain.setValueAtTime(Math.max(out.gain.value, 0.0001), t);
  out.gain.setTargetAtTime(0, t + 0.15, 0.55); // ~2.5s audible tail
  hum.frequency.setValueAtTime(hum.frequency.value, t);
  hum.frequency.exponentialRampToValueAtTime(20, t + 2.1);
  wh.frequency.setValueAtTime(wh.frequency.value, t);
  wh.frequency.exponentialRampToValueAtTime(520, t + 2.1);
  stops.forEach((n) => n.stop(t + 3.2));
  setTimeout(() => out.disconnect(), 3400);
}

// panel idle voice: NOT a high whine (a 9kHz sine pair was tried and was
// awful) — a soft electronics hiss plus a faint 120Hz supply hum, loudness
// tracking the screen's lit cells (scene.js writes PM.glow)
let whineNodes = null;
function whineStart() {
  if (whineNodes) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const g = actx.createGain();
    g.gain.value = 0.0001;
    g.connect(actx.destination);

    const nbuf = actx.createBuffer(1, actx.sampleRate * 2, actx.sampleRate);
    const nd = nbuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const hiss = actx.createBufferSource();
    hiss.buffer = nbuf; hiss.loop = true;
    const hp = actx.createBiquadFilter();
    hp.type = "highpass"; hp.frequency.value = 900;
    const lp = actx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 3400; // dull, papery hiss
    const hissG = actx.createGain(); hissG.gain.value = 0.55;
    hiss.connect(hp); hp.connect(lp); lp.connect(hissG); hissG.connect(g);

    const hum = actx.createOscillator();
    hum.type = "sine"; hum.frequency.value = 120;
    const humG = actx.createGain(); humG.gain.value = 0.4;
    hum.connect(humG); humG.connect(g);

    hiss.start(); hum.start();
    whineNodes = { g };
  } catch { /* audio unavailable */ }
}
setInterval(() => {
  if (!whineNodes || !actx || actx.state !== "running") return;
  const level = booting ? 0 : 0.0025 + (window.PM?.glow || 0) * 0.006;
  whineNodes.g.gain.linearRampToValueAtTime(level, actx.currentTime + 0.25);
}, 280);

// browsers gate audio behind a gesture: wake the context (and the whine)
// on the first interaction
addEventListener("pointerdown", () => {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === "suspended") actx.resume();
    whineStart();
  } catch { /* stay silent */ }
});

// ---- value display: discrete 0.00 → 1.00 -------------------------------------------
const numLab = (v) => (v / 100).toFixed(2);

// ---- knobs -----------------------------------------------------------------------
// The knobs are 3D meshes (scene.js) — this is only their state. scene.js
// calls PM.knobSet on drag/wheel and reads k.value each frame to rotate the
// mesh. Values are announced on the readout (like volume on a real deck).
// (The LINE dial was retired: lineLength is pinned to its old default.)
const KNOBS = [
  { id: "meter",   label: "METER",  min: 0, max: 100, step: 1, value: 50, def: 50, fmt: numLab },
  { id: "rhyme",   label: "RHYME",  min: 0, max: 100, step: 1, value: 0,  def: 0,  fmt: numLab },
  { id: "terse",   label: "TERSE",  min: 0, max: 100, step: 1, value: 50, def: 50, fmt: numLab },
  { id: "poemLen", label: "LENGTH", min: 0, max: 100, step: 1, value: 0,  def: 0,  fmt: numLab },
];

// the status line is DRAWN on the matrix (bottom row of the glass), not DOM
let roText = "";
function setReadout(text) {
  roText = text;
  renderLCD();
}

let knobAnnounceTimer;
function announceKnob(k) {
  if (busy || booting) return;
  setReadout(`${k.label} ${k.fmt(k.value)}`);
  clearTimeout(knobAnnounceTimer);
  knobAnnounceTimer = setTimeout(updateAction, 1400);
}

function knobSet(k, raw) {
  const stepped = Math.round(raw / k.step) * k.step;
  const next = Math.min(k.max, Math.max(k.min, stepped));
  if (next !== k.value) {
    k.value = next;
    detent();
  }
  announceKnob(k);
}
const knobVal = (id) => KNOBS.find((k) => k.id === id).value;

function knobs() {
  return {
    meter: knobVal("meter"),
    rhyme: knobVal("rhyme"),
    terseness: knobVal("terse"),
    lineLength: 40,
    poemLength: knobVal("poemLen"),
  };
}
// hardline no-input doctrine: the knobs and the poem itself are the whole
// interface — compose/continue/rewrite receive no free-text steering
const inputVal = () => "";

// ---- line geometry ---------------------------------------------------------------
const gutter = el("gutter");
const lines = () => ta.value.split("\n");
let lineMeta = []; // {text,start,end,trimStart,trimEnd,blank,y,h}

// line y-positions come straight from wrapLine() — the same soft-wrap
// replica the LCD renders with — so no DOM mirror is needed (getBoundingClientRect
// would be distorted by the CSS3D transform anyway; layout math is not)
function measureLines() {
  const ls = lines();
  const maxCols = Math.max(1, Math.floor(ta.clientWidth / ADV));
  let off = 0, y = 0;
  lineMeta = ls.map((l) => {
    const start = off;
    off += l.length + 1;
    let a = 0, b = l.length;
    while (a < b && /\s/.test(l[a])) a++;
    while (b > a && /\s/.test(l[b - 1])) b--;
    const h = wrapLine(l, maxCols).length * ROWPX;
    const m = {
      text: l, start, end: start + l.length,
      trimStart: start + a, trimEnd: start + b,
      blank: !l.trim(), y, h,
    };
    y += h;
    return m;
  });
}

const lineH = () => parseFloat(getComputedStyle(ta).lineHeight) || ROWPX;

function stanzas() {
  const out = [];
  let s = -1;
  lineMeta.forEach((m, i) => {
    if (!m.blank && s < 0) s = i;
    if (m.blank && s >= 0) { out.push([s, i - 1]); s = -1; }
  });
  if (s >= 0) out.push([s, lineMeta.length - 1]);
  return out;
}

function lineIndexAt(pos) {
  for (let i = 0; i < lineMeta.length; i++) if (pos <= lineMeta[i].end) return i;
  return Math.max(0, lineMeta.length - 1);
}

// ---- the emulated dot-matrix panel -------------------------------------------------
// A true character-matrix display: every glyph is a hand-drawn 5×7 bitmap
// (classic HD44780 hardware-LCD patterns), rendered bit-for-bit as discrete
// cells. The invisible-but-native textarea is retuned to an 18px/30px
// monospace grid so clicks, drags, and scrolling land exactly on the cells.
const lcd = el("lcd");
const lctx = lcd.getContext("2d");
const CELL = 3;        // css px per LCD cell (2 = dense Nokia; 3 = chunky HD44780)
const GAP = 1;         // dark gap inside each cell
const CW = 6;          // cells per character column (5 glyph + 1 spacing)
const ROWS = 10;       // cells per text row (1 pad + 7 glyph + 2 leading)
const ADV = CELL * CW; // 18px char advance
const ROWPX = CELL * ROWS; // 30px line height
let blinkOn = true;
let hoverLine = -1, hoverStanza = -1; // pip/rail hover (hitboxes are invisible DOM)
const tiny = document.createElement("canvas");
let unlitPat = null;

// classic 5×7 column bitmaps (LSB = top row), ASCII 32–126
const FONT = {
  " ": [0,0,0,0,0], "!": [0,0,95,0,0], '"': [0,7,0,7,0], "#": [20,127,20,127,20],
  "$": [36,42,127,42,18], "%": [35,19,8,100,98], "&": [54,73,85,34,80], "'": [0,5,3,0,0],
  "(": [0,28,34,65,0], ")": [0,65,34,28,0], "*": [20,8,62,8,20], "+": [8,8,62,8,8],
  ",": [0,80,48,0,0], "-": [8,8,8,8,8], ".": [0,96,96,0,0], "/": [32,16,8,4,2],
  "0": [62,81,73,69,62], "1": [0,66,127,64,0], "2": [66,97,81,73,70], "3": [33,65,69,75,49],
  "4": [24,20,18,127,16], "5": [39,69,69,69,57], "6": [60,74,73,73,48], "7": [1,113,9,5,3],
  "8": [54,73,73,73,54], "9": [6,73,73,41,30], ":": [0,54,54,0,0], ";": [0,86,54,0,0],
  "<": [8,20,34,65,0], "=": [20,20,20,20,20], ">": [0,65,34,20,8], "?": [2,1,81,9,6],
  "@": [50,73,121,65,62], "A": [126,17,17,17,126], "B": [127,73,73,73,54], "C": [62,65,65,65,34],
  "D": [127,65,65,34,28], "E": [127,73,73,73,65], "F": [127,9,9,1,1], "G": [62,65,65,81,50],
  "H": [127,8,8,8,127], "I": [0,65,127,65,0], "J": [32,64,65,63,1], "K": [127,8,20,34,65],
  "L": [127,64,64,64,64], "M": [127,2,12,2,127], "N": [127,4,8,16,127], "O": [62,65,65,65,62],
  "P": [127,9,9,9,6], "Q": [62,65,81,33,94], "R": [127,9,25,41,70], "S": [70,73,73,73,49],
  "T": [1,1,127,1,1], "U": [63,64,64,64,63], "V": [31,32,64,32,31], "W": [127,32,24,32,127],
  "X": [99,20,8,20,99], "Y": [7,8,112,8,7], "Z": [97,81,73,69,67], "[": [0,127,65,65,0],
  "\\": [2,4,8,16,32], "]": [0,65,65,127,0], "^": [4,2,1,2,4], "_": [64,64,64,64,64],
  "`": [0,1,2,4,0], "a": [32,84,84,84,120], "b": [127,72,68,68,56], "c": [56,68,68,68,32],
  "d": [56,68,68,72,127], "e": [56,84,84,84,24], "f": [8,126,9,1,2], "g": [12,82,82,82,62],
  "h": [127,8,4,4,120], "i": [0,68,125,64,0], "j": [32,64,68,61,0], "k": [127,16,40,68,0],
  "l": [0,65,127,64,0], "m": [124,4,24,4,120], "n": [124,8,4,4,120], "o": [56,68,68,68,56],
  "p": [124,20,20,20,8], "q": [8,20,20,24,124], "r": [124,8,4,4,8], "s": [72,84,84,84,32],
  "t": [4,63,68,64,32], "u": [60,64,64,32,124], "v": [28,32,64,32,28], "w": [60,64,48,64,60],
  "x": [68,40,16,40,68], "y": [12,80,80,80,60], "z": [68,100,84,76,68], "{": [0,8,54,65,0],
  "|": [0,0,127,0,0], "}": [0,65,54,8,0], "~": [8,4,8,16,8],
};
const FONT_FALLBACK = [127,65,65,65,127]; // hollow box
// typographic characters the model emits, mapped onto the matrix
const CHARMAP = {
  "‘": "'", "’": "'", "‚": "'", "“": '"', "”": '"',
  "–": "-", "—": "-", "−": "-", "…": ".", " ": " ",
  "\t": " ", "·": ".",
};
const glyphOf = (ch) => FONT[CHARMAP[ch] ?? ch] || FONT_FALLBACK;

// retune the invisible textarea to the LCD grid: char advance exactly 18px,
// rows exactly 30px — so native caret/selection/click geometry === drawn cells
function initMetrics() {
  const probe = document.createElement("canvas").getContext("2d");
  probe.font = '100px "Courier New", monospace';
  const ratio = probe.measureText("0".repeat(50)).width / 50 / 100; // advance per font-px
  const fs = ADV / ratio;
  ta.style.fontFamily = '"Courier New", monospace';
  ta.style.fontSize = fs + "px";
  ta.style.lineHeight = ROWPX + "px";
  ta.style.letterSpacing = "0";
  ta.style.overflowWrap = "break-word";
}

// replicate the browser's greedy soft-wrap so grid rows match textarea rows
function wrapLine(text, maxCols) {
  if (text.length <= maxCols) return [{ start: 0, text }];
  const rows = [];
  let start = 0;
  while (text.length - start > maxCols) {
    let brk = -1;
    for (let i = start + maxCols; i > start; i--) {
      if (text[i] === " ") { brk = i; break; }
    }
    if (brk <= start) { // one unbreakable run — hard break
      rows.push({ start, text: text.slice(start, start + maxCols) });
      start += maxCols;
    } else {
      rows.push({ start, text: text.slice(start, brk) });
      start = brk + 1; // the space hangs at the end of the row
    }
  }
  rows.push({ start, text: text.slice(start) });
  return rows;
}

function makeUnlitPattern(ctx) {
  const p = document.createElement("canvas");
  p.width = CELL; p.height = CELL;
  const pc = p.getContext("2d");
  pc.fillStyle = "rgba(77,184,255,.07)";
  pc.fillRect(0, 0, CELL - GAP, CELL - GAP);
  return ctx.createPattern(p, "repeat");
}

const LIT = "#9fdcff";
const DIM = "rgba(130,195,240,.55)";
const SELBLOCK = "#5ec1ff";
const DARK = "#02070c";

function renderLCD() {
  const w = lcd.offsetWidth, h = lcd.offsetHeight;
  if (!w || !h) return;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  if (lcd.width !== Math.round(w * dpr) || lcd.height !== Math.round(h * dpr)) {
    lcd.width = Math.round(w * dpr);
    lcd.height = Math.round(h * dpr);
    unlitPat = null;
  }

  const ox = ta.offsetLeft - lcd.offsetLeft;
  const oy = ta.offsetTop - lcd.offsetTop;
  const tw = ta.clientWidth, th = ta.clientHeight;
  if (!tw || !th) return;
  const maxCols = Math.max(1, Math.floor(tw / ADV));
  const scroll = ta.scrollTop;
  const selS = ta.selectionStart ?? 0, selE = ta.selectionEnd ?? 0;
  const hasSel = selE > selS;
  const focused = document.activeElement === ta;

  const c = lctx;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, w, h);
  if (!booting) { // pre-boot the panel is dead glass, no idle cells
    unlitPat = unlitPat || makeUnlitPattern(c);
    c.fillStyle = unlitPat;
    c.fillRect(0, 0, w, h);
  }

  // bloom buffer: 1px per cell, panel-absolute
  const gw = Math.ceil(w / CELL), gh = Math.ceil(h / CELL);
  if (tiny.width !== gw || tiny.height !== gh) { tiny.width = gw; tiny.height = gh; }
  const tc = tiny.getContext("2d");
  tc.clearRect(0, 0, gw, gh);
  tc.fillStyle = LIT;

  const cell = (xPx, yPx) => {
    c.fillRect(xPx, yPx, CELL - GAP, CELL - GAP);
    tc.fillRect(Math.round(xPx / CELL), Math.round(yPx / CELL), 1, 1);
  };
  // draw one glyph's bits with its top-left at (xPx, yPx of row) + 1-cell pad
  const drawGlyph = (ch, xPx, rowPx) => {
    const g = glyphOf(ch);
    for (let col = 0; col < 5; col++) {
      const bits = g[col];
      if (!bits) continue;
      for (let r = 0; r < 7; r++) {
        if (bits >> r & 1) cell(xPx + col * CELL, rowPx + (r + 1) * CELL);
      }
    }
  };

  const drawRow = (str, absStart, rowPx, dim) => {
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      const xPx = ox + i * ADV;
      if (xPx > tw + ox) break;
      const inSel = hasSel && absStart + i >= selS && absStart + i < selE;
      if (inSel) {
        // inverted char cell: lit 6×9 block with the glyph punched out dark
        c.fillStyle = SELBLOCK;
        for (let r = 0; r < 9; r++) {
          for (let col = 0; col < CW; col++) {
            cell(xPx + col * CELL, rowPx + r * CELL);
          }
        }
        c.fillStyle = DARK;
        const g = glyphOf(ch);
        for (let col = 0; col < 5; col++) {
          const bits = g[col];
          if (!bits) continue;
          for (let r = 0; r < 7; r++) {
            if (bits >> r & 1) c.fillRect(xPx + col * CELL, rowPx + (r + 1) * CELL, CELL - GAP, CELL - GAP);
          }
        }
      } else if (ch !== " ") {
        c.fillStyle = dim ? DIM : LIT;
        drawGlyph(ch, xPx, rowPx);
      }
    }
  };

  if (booting) {
    // dark glass: nothing but the status line below
  } else if (!ta.value) {
    // empty page: just the blinking cell — that's the whole invitation
    if (blinkOn && !busy) {
      c.fillStyle = LIT;
      for (let col = 0; col < 5; col++) cell(ox + col * CELL, oy + 8 * CELL);
    }
  } else {
    lineMeta.forEach((m) => {
      const baseY = m.y - scroll;
      if (baseY + m.h < 0 || baseY > th) return;
      const rows = wrapLine(m.text, maxCols);
      rows.forEach((row, ri) => {
        const rowPx = oy + baseY + ri * ROWPX;
        if (rowPx + ROWPX < oy || rowPx > oy + th) return;
        drawRow(row.text, m.start + row.start, rowPx, false);
      });
    });
    // caret: classic underline, one char cell wide
    if (focused && !hasSel && blinkOn && !busy) {
      const li = lineIndexAt(selS);
      const m = lineMeta[li];
      const rel = Math.max(0, selS - m.start);
      const rows = wrapLine(m.text, maxCols);
      let ri = rows.length - 1, col = rows[ri].text.length;
      for (let i = 0; i < rows.length; i++) {
        const end = rows[i].start + rows[i].text.length;
        if (rel <= end) { ri = i; col = rel - rows[i].start; break; }
      }
      const xPx = ox + Math.min(col, maxCols - 1) * ADV;
      const rowPx = oy + m.y - scroll + ri * ROWPX;
      c.fillStyle = LIT;
      for (let cc = 0; cc < 5; cc++) cell(xPx + cc * CELL, rowPx + 8 * CELL);
    }
  }

  // ---- margin pips & stanza rails: matrix cells, same phosphor ----
  if (!booting && ta.value) {
    const tgt = detectTarget();
    const onLine = (i) =>
      (tgt.kind === "line" && i === tgt.line) ||
      ((tgt.kind === "stanza" || tgt.kind === "poem") && i >= tgt.start && i <= tgt.end);
    const pipCol = Math.round((ox - 36) / CELL);
    const railCol = Math.round((ox - 52) / CELL);
    lineMeta.forEach((m, i) => {
      if (m.blank) return;
      const cy = oy + m.y - scroll + ROWPX / 2;
      if (cy < oy + 6 || cy > oy + th - 6) return;
      const row = Math.round(cy / CELL) - 1;
      const active = onLine(i);
      for (let dy = 0; dy < 3; dy++) {
        for (let dx = 0; dx < 3; dx++) {
          if (!active && dx !== 1 && dy !== 1) continue; // idle pip = plus shape
          if (active) {
            c.fillStyle = LIT;
            cell((pipCol + dx) * CELL, (row + dy) * CELL); // blooms
          } else {
            c.fillStyle = hoverLine === i ? "rgba(140,210,255,.6)" : "rgba(77,184,255,.22)";
            c.fillRect((pipCol + dx) * CELL, (row + dy) * CELL, CELL - GAP, CELL - GAP);
          }
        }
      }
    });
    stanzas().forEach(([s, e], si) => {
      let y1 = oy + lineMeta[s].y - scroll + 4;
      let y2 = oy + lineMeta[e].y + lineMeta[e].h - scroll - 4;
      y1 = Math.max(y1, oy + 2);
      y2 = Math.min(y2, oy + th - 2);
      if (y2 - y1 < 12) return;
      const active = tgt.kind === "poem" || (tgt.kind === "stanza" && tgt.start === s);
      const r1 = Math.ceil(y1 / CELL), r2 = Math.floor(y2 / CELL);
      for (let r = r1; r <= r2; r += active ? 1 : 2) { // idle rail = dashed
        if (active) {
          c.fillStyle = LIT;
          cell(railCol * CELL, r * CELL);
        } else {
          c.fillStyle = hoverStanza === si ? "rgba(140,210,255,.55)" : "rgba(77,184,255,.16)";
          c.fillRect(railCol * CELL, r * CELL, CELL - GAP, CELL - GAP);
        }
      }
    });
  }

  // ---- status line: matrix row at the glass bottom ----
  // (the guidance input lives in its own tiny window on the plastic now)
  if (roText) drawRow(roText.toUpperCase(), -1e9, h - 34, false);

  // phosphor bloom
  c.globalCompositeOperation = "lighter";
  c.globalAlpha = 0.3;
  c.filter = "blur(7px)";
  c.drawImage(tiny, 0, 0, gw * CELL, gh * CELL);
  c.filter = "none";
  c.globalAlpha = 1;
  c.globalCompositeOperation = "source-over";

  if (window.PM) PM.lcdDirty = true; // scene.js re-uploads the canvas texture
}

setInterval(() => { blinkOn = !blinkOn; renderLCD(); }, 530);
ta.addEventListener("focus", renderLCD);
ta.addEventListener("blur", renderLCD);

// ---- gutter lamps / rails ---------------------------------------------------------
function buildGutter() {
  measureLines();
  gutter.innerHTML = "";
  const gTop = gutter.offsetTop;
  const gLeft = gutter.offsetLeft;
  const baseY = ta.offsetTop - gTop - ta.scrollTop;
  const viewTop = ta.offsetTop - gTop;
  const viewBot = viewTop + ta.clientHeight;
  const lh = lineH();
  const dotX = ta.offsetLeft - gLeft - 34;
  const barX = ta.offsetLeft - gLeft - 52;

  lineMeta.forEach((m, i) => {
    if (m.blank) return;
    const cy = baseY + m.y + lh / 2;
    if (cy < viewTop + 4 || cy > viewBot - 4) return;
    const d = document.createElement("div");
    d.className = "gline";
    d.style.top = (cy - 8) + "px";
    d.style.left = (dotX - 4) + "px";
    d.title = "Target this line";
    d.dataset.line = i;
    d.addEventListener("mousedown", (ev) => { ev.preventDefault(); toggleSpan(m.trimStart, m.trimEnd); });
    d.addEventListener("mouseenter", () => { hoverLine = i; renderLCD(); });
    d.addEventListener("mouseleave", () => { hoverLine = -1; renderLCD(); });
    gutter.appendChild(d);
  });

  stanzas().forEach(([s, e], si) => {
    let y1 = baseY + lineMeta[s].y + 5;
    let y2 = baseY + lineMeta[e].y + lineMeta[e].h - 5;
    y1 = Math.max(y1, viewTop + 2);
    y2 = Math.min(y2, viewBot - 2);
    if (y2 - y1 < 10) return;
    const bar = document.createElement("div");
    bar.className = "gstanza";
    bar.style.top = y1 + "px";
    bar.style.left = (barX - 4) + "px";
    bar.style.height = (y2 - y1) + "px";
    bar.title = "Target this stanza";
    bar.dataset.start = s;
    bar.dataset.end = e;
    bar.addEventListener("mousedown", (ev) => {
      ev.preventDefault();
      toggleSpan(lineMeta[s].trimStart, lineMeta[e].trimEnd);
    });
    bar.addEventListener("mouseenter", () => { hoverStanza = si; renderLCD(); });
    bar.addEventListener("mouseleave", () => { hoverStanza = -1; renderLCD(); });
    gutter.appendChild(bar);
  });

  updateAction();
  renderLCD();
}

let scrollTick = false;
ta.addEventListener("scroll", () => {
  if (scrollTick) return;
  scrollTick = true;
  requestAnimationFrame(() => { scrollTick = false; buildGutter(); });
});

function toggleSpan(a, b) {
  if (busy) return;
  clickSnd(430, 0.025, 0.05);
  if (ta.selectionStart === a && ta.selectionEnd === b) ta.setSelectionRange(b, b); // toggle off
  else ta.setSelectionRange(a, b);
  ta.focus();
  updateAction();
  renderLCD();
}

// ---- target detection --------------------------------------------------------------
function currentSelection() {
  let s = ta.selectionStart ?? 0, e = ta.selectionEnd ?? 0;
  if (e <= s) return null;
  const v = ta.value;
  while (s < e && /\s/.test(v[s])) s++;
  while (e > s && /\s/.test(v[e - 1])) e--;
  return e > s ? { s, e } : null;
}

function detectTarget() {
  const hasText = lineMeta.some((m) => !m.blank);
  if (!hasText) return { kind: "compose" };
  const sel = currentSelection();
  if (!sel) return { kind: "continue" };

  const first = lineMeta.findIndex((m) => !m.blank);
  let last = lineMeta.length - 1;
  while (last >= 0 && lineMeta[last].blank) last--;
  if (sel.s <= lineMeta[first].trimStart && sel.e >= lineMeta[last].trimEnd) {
    return { kind: "poem", start: 0, end: lineMeta.length - 1 };
  }

  const li1 = lineIndexAt(sel.s);
  const li2 = lineIndexAt(Math.max(sel.s, sel.e - 1));
  if (li1 === li2 && sel.s === lineMeta[li1].trimStart && sel.e === lineMeta[li1].trimEnd) {
    return { kind: "line", line: li1, start: li1, end: li1 };
  }
  const si = stanzas().findIndex(([a, b]) =>
    a === li1 && b === li2 && sel.s === lineMeta[a].trimStart && sel.e === lineMeta[b].trimEnd);
  if (si >= 0) {
    const [a, b] = stanzas()[si];
    return { kind: "stanza", n: si + 1, start: a, end: b };
  }
  return { kind: "selection", sel };
}

// ---- the red button (a mesh — scene.js raycasts into PM.fire) ------------------------
let booting = true;

function updateAction() {
  if (busy || booting) return;
  const t = detectTarget();
  const readouts = {
    compose: "COMPOSE", continue: "CONTINUE",
    line: "REWRITE", stanza: "REWRITE", poem: "REWRITE", selection: "REWRITE",
  };
  setReadout(readouts[t.kind]);

  renderLCD(); // pip/rail active states are drawn on the matrix
}

["keyup", "click", "select", "focus", "mouseup"].forEach((ev) => ta.addEventListener(ev, updateAction));
document.addEventListener("selectionchange", () => {
  if (document.activeElement === ta) { updateAction(); renderLCD(); }
});
ta.addEventListener("input", () => buildGutter());
addEventListener("resize", () => buildGutter());

// ---- toast --------------------------------------------------------------------------
let toastTimer;
function toast(msg, ms = 4200) {
  const t = el("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), ms);
}

// ---- busy state -----------------------------------------------------------------------
let busy = false;
let elapsedTimer = null;
function setBusy(b, verb = "working") {
  busy = b;
  if (b) motorStart(); else motorStop(); // the transport runs while it writes
  lcd.classList.toggle("working", b);
  ta.readOnly = b;
  clearInterval(elapsedTimer);
  if (b) {
    const t0 = Date.now();
    const tick = () => {
      const s = Math.round((Date.now() - t0) / 1000);
      const bar = "#".repeat(1 + (s % 4)).padEnd(4, "-");
      setReadout(`${verb.toUpperCase()} [${bar}] ${s}S`);
    };
    tick();
    elapsedTimer = setInterval(tick, 1000);
  } else {
    updateAction();
  }
}

// ---- undo stack for machine changes ----------------------------------------------------
const undoStack = [];
function pushUndo() {
  undoStack.push(ta.value);
  if (undoStack.length > 30) undoStack.shift();
}
function doUndo() {
  if (busy || !undoStack.length) return;
  ta.value = undoStack.pop();
  buildGutter();
}

// ---- rewrite chain anchor --------------------------------------------------------------
let chain = null; // { scope, original, attempts: [] }

function chainFor(scope, targetText) {
  const inChain = chain && chain.scope === scope &&
    (chain.original === targetText || chain.attempts.includes(targetText));
  if (!inChain) chain = { scope, original: targetText, attempts: [] };
  return chain;
}

function chainPayload(scope, targetText) {
  const c = chainFor(scope, targetText);
  return {
    original: targetText !== c.original ? c.original : null,
    avoid: c.attempts.slice(-6),
  };
}

function chainRecord(result) {
  if (!chain) return;
  chain.attempts.push(result);
  if (chain.attempts.length > 8) chain.attempts.shift();
}

// ---- API ---------------------------------------------------------------------------------
// Every endpoint lives under /squire (see server.js) so the app works when mounted
// at alaskahoffman.com/squire; the base is stripped for none of the callers below.
const API_BASE = "/squire";
async function post(path, payload) {
  const res = await fetch(API_BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

async function compose() {
  setBusy(true, "composing");
  try {
    const data = await post("/api/poem", { ...knobs(), theme: inputVal() });
    if (ta.value.trim()) pushUndo();
    ta.value = data.poem;
    ta.scrollTop = 0;
    buildGutter();
  } catch (e) {
    toast("⚠ " + e.message);
  } finally {
    setBusy(false);
  }
}

async function continuePoem() {
  const ls = lines();
  if (!ls.some((l) => l.trim())) { toast("Type a line first."); return; }
  setBusy(true, "continuing");
  try {
    const data = await post("/api/continue", {
      ...knobs(),
      theme: "",
      lines: ls,
      instruction: inputVal(),
    });
    pushUndo();
    const opening = ta.value.replace(/\s+$/, "");
    ta.value = opening + "\n" + data.text;
    buildGutter();
    ta.focus();
    ta.setSelectionRange(opening.length + 1, ta.value.length);
    ta.scrollTop = ta.scrollHeight;
    updateAction();
  } catch (e) {
    toast("⚠ " + e.message);
  } finally {
    setBusy(false);
  }
}

async function rewrite(scope, start, end) {
  const ls = lines();
  const targetText = ls.slice(start, end + 1).join("\n");
  setBusy(true, "rewriting");
  try {
    const data = await post("/api/rewrite", {
      ...knobs(),
      theme: "",
      lines: ls,
      start, end, scope,
      instruction: inputVal(),
      ...chainPayload(scope, targetText),
    });
    pushUndo();
    chainRecord(data.text);
    const replacement = data.text.split("\n");
    const next = [...ls.slice(0, start), ...replacement, ...ls.slice(end + 1)];
    ta.value = next.join("\n");
    buildGutter();
    const before = next.slice(0, start).join("\n");
    const pos = start === 0 ? 0 : before.length + 1;
    ta.focus();
    ta.setSelectionRange(pos, pos + data.text.length);
    updateAction();
  } catch (e) {
    toast("⚠ " + e.message);
  } finally {
    setBusy(false);
  }
}

async function rewriteSel(sel) {
  const fragment = ta.value.slice(sel.s, sel.e);
  setBusy(true, "rewriting");
  try {
    const data = await post("/api/rewrite", {
      ...knobs(),
      theme: "",
      scope: "selection",
      text: ta.value,
      selStart: sel.s,
      selEnd: sel.e,
      instruction: inputVal(),
      ...chainPayload("selection", fragment),
    });
    pushUndo();
    chainRecord(data.text);
    ta.value = ta.value.slice(0, sel.s) + data.text + ta.value.slice(sel.e);
    buildGutter();
    ta.focus();
    ta.setSelectionRange(sel.s, sel.s + data.text.length);
    updateAction();
  } catch (e) {
    toast("⚠ " + e.message);
  } finally {
    setBusy(false);
  }
}

function fire() {
  if (busy || booting) return;
  keySnd("fire");
  const t = detectTarget();
  if (t.kind === "compose") compose();
  else if (t.kind === "continue") continuePoem();
  else if (t.kind === "selection") rewriteSel(t.sel);
  else rewrite(t.kind === "poem" ? "poem" : t.kind, t.start, t.end);
}

// ---- utility keys (meshes — scene.js raycasts into these) ---------------------------------
async function doCopy() {
  if (!ta.value.trim()) { toast("Nothing to copy yet."); return; }
  try {
    await navigator.clipboard.writeText(ta.value);
    toast("Poem copied.");
  } catch {
    toast("⚠ Couldn't copy — select and copy manually.");
  }
}
function doClear() {
  if (busy) return;
  if (ta.value.trim()) pushUndo(); // undo-able instead of a confirm dialog
  ta.value = "";
  buildGutter();
}

// ---- boot: phosphor warm-up -------------------------------------------------------------------
async function boot() {
  await sleep(420);
  setReadout("POWER");
  clickSnd(46, 0.5, 0.09, "sine");
  await sleep(520);
  setReadout("PHOSPHOR WARM-UP");
  device.classList.remove("booting");
  device.classList.add("warming");
  clickSnd(120, 0.14, 0.045, "triangle");
  await sleep(1100);
  device.classList.remove("warming");
  booting = false;
  updateAction();
}

// ---- bridge to the 3D scene ---------------------------------------------------------------------
window.PM = {
  KNOBS,
  lcd,                 // the LCD canvas — scene.js uses it as an emissive texture
  lcdDirty: true,      // set true whenever the canvas repaints
  knobSet,             // (knob, rawValue) — stepping, detent, readout announce
  fire, doUndo, doCopy, doClear,
  detent, thunk, clickSnd, keySnd,
  motorStart, motorStop, // exposed for debugging the transport loop
  glow: 0,               // scene.js writes the screen's brightness here
  status: () => ({ busy, booting, canUndo: undoStack.length > 0 }),
};

// ---- ignition ----------------------------------------------------------------------------------
initMetrics();
buildGutter();
boot();
