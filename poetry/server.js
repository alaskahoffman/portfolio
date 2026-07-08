import express from "express";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import { readFileSync } from "fs";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
// The whole app is mounted under /squire so it can ride alaskahoffman.com/squire
// as a Vercel rewrite: every absolute path it emits (/squire/app.js, /squire/api/*,
// /squire/vendor/three) stays inside that prefix instead of colliding with the Go site.
app.use("/squire", express.static(path.join(__dirname, "public")));
app.use("/squire/vendor/three", express.static(path.join(__dirname, "node_modules", "three")));

const API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-4.6";
const PORT = process.env.PORT || 3000;

// Reasoning/thinking control for models that support OpenRouter's `reasoning`
// param (e.g. claude-sonnet-5). Poem lines don't need chain-of-thought, and
// reasoning tokens count against max_tokens and add latency.
//   off (default)      -> reasoning: {enabled: false}
//   low|medium|high    -> reasoning: {effort: <level>}
//   anything else      -> model default
const REASONING = (process.env.OPENROUTER_REASONING || "off").toLowerCase();

// Which params the active model accepts. Some models (e.g. router models like
// openrouter/fusion) accept NO extra params and will 500 if you send temperature
// or max_tokens. We discover the supported set once and only send what's allowed.
let MODEL_CAPS = null;

async function loadModelCaps() {
  if (!API_KEY) return;
  try {
    const r = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    if (!r.ok) return;
    const data = await r.json();
    const m = (data?.data || []).find((x) => x.id === MODEL);
    if (m) MODEL_CAPS = new Set(m.supported_parameters || []);
    const caps = MODEL_CAPS ? [...MODEL_CAPS] : [];
    console.log(`     supported params: ${caps.length ? caps.join(", ") : "(none — sending bare requests)"}`);
  } catch {
    /* leave MODEL_CAPS null; we'll send a bare request */
  }
}

const supports = (p) => (MODEL_CAPS === null ? false : MODEL_CAPS.has(p));

async function chat(messages, { maxTokens = 800, temperature = 0.9 } = {}) {
  const body = { model: MODEL, messages };
  if (supports("temperature")) body.temperature = Math.max(0, Math.min(2, Number(temperature) || 0.9));
  if (supports("max_tokens")) body.max_tokens = maxTokens;
  if (supports("reasoning")) {
    if (REASONING === "off") body.reasoning = { enabled: false };
    else if (["low", "medium", "high"].includes(REASONING)) body.reasoning = { effort: REASONING };
  }

  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:" + PORT,
      "X-Title": "Poem Knobs",
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const text = await r.text();
    const e = new Error(`OpenRouter ${r.status}: ${text}`);
    e.status = r.status;
    throw e;
  }
  const data = await r.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

// ---- style knobs -> prose instructions --------------------------------------

function meterInstruction(level) {
  if (level < 20) return "Free verse. Ignore regular meter; let the rhythm fall naturally.";
  if (level < 50) return "A loose, musical rhythm, but no forced metrical pattern.";
  if (level < 80) return "A fairly regular metrical pulse (e.g. a steady iambic feel), with occasional substitutions.";
  return "Strict, regular meter (e.g. iambic pentameter). Lines should scan cleanly read aloud.";
}

function rhymeInstruction(level) {
  if (level < 20) return "Unrhymed. Avoid end-rhyme.";
  if (level < 50) return "Rhyme optional — soft slant-rhyme or assonance welcome, never forced.";
  if (level < 80) return "Favor end-rhyme with a discernible scheme (ABAB, couplets, or similar), rhymes may be slant.";
  return "A clear, consistent rhyme scheme with strong, satisfying end-rhymes.";
}

function tersenessInstruction(level) {
  // The TERSE dial alone controls diction AND line length: 0.00 → long flowing
  // sentences with conjunctions, ~7–8 words/line; 1.00 → bare 1–2 word fragments,
  // no conjunctions. (There is no separate line-length knob anymore.)
  if (level < 20) return "Long, flowing complete sentences with full grammar — commas, conjunctions (and, or, but), subordinate clauses that run on and enjamb across lines. Lines run long: about 7–8 words each.";
  if (level < 45) return "Mostly complete sentences with connective tissue — commas and the odd conjunction — pared of excess. Lines of about 5–7 words each.";
  if (level < 70) return "Spare. Short clauses, sparing conjunctions, strong nouns and verbs. Lines of about 4–5 words each.";
  if (level < 90) return "Terse. Clipped fragments, most articles and conjunctions dropped. Lines of about 2–3 words each.";
  return "Extreme economy: bare fragments of just 1–2 words per line. NO conjunctions (never 'and', 'or', 'but'), no complete sentences, no connective grammar — single images or words stacked one per line.";
}

function poemLengthInstruction(level) {
  // The LENGTH dial maps 0.00 → a 1–2 line poem, 1.00 → the 19-line ceiling.
  // The screen holds exactly 19 lines, so a poem may never exceed that. The
  // budget below is a TOTAL that counts blank lines between stanzas — models
  // tend to forget those, so it is stated in the harshest possible terms.
  const n = Math.max(1, Math.min(19, Math.round(1 + (level / 100) * 18)));
  if (n <= 2) return "Length: 1–2 lines TOTAL — a single image or utterance. Never write more than 2 lines.";
  const lo = Math.max(2, n - 3);
  return `Length: aim for about ${lo}–${n} lines. ABSOLUTE HARD LIMIT: your entire poem must be ${n} lines or fewer — and never more than 19 lines under any circumstances. Count EVERY line toward this total, INCLUDING the blank line between each stanza. So a poem of four 4-line stanzas is 4+1+4+1+4+1+4 = 19 lines, already at the ceiling. When unsure, write fewer lines and fewer stanzas.`;
}

function styleBlock({ theme, vibe, meter, rhyme, terseness }, composing = false) {
  const parts = [];
  parts.push(theme && theme.trim()
    ? `Subject: ${theme.trim()}.`
    : composing
      ? "Subject: open — choose something concrete and evocative."
      : "Subject: keep to the poem's existing subject and imagery.");
  parts.push(vibe && vibe.length
    ? `Mood: ${vibe.join(", ")}.`
    : "Mood: infer it from the subject, the guidance, and any existing lines; commit to what you find.");
  parts.push(`Meter: ${meterInstruction(meter)}`);
  parts.push(`Rhyme: ${rhymeInstruction(rhyme)}`);
  parts.push(`Diction: ${tersenessInstruction(terseness)}`);
  return parts.join("\n");
}

function cleanPoem(raw) {
  if (!raw) return "";
  // trim only blank LINES at the edges — never horizontal whitespace, or we'd
  // destroy field-composition indentation (O'Hara-style leading spaces on a line)
  let t = raw.replace(/^\s*\n/g, "").replace(/\n\s*$/g, "");
  t = t.replace(/^[ \t]*```[a-z]*[ \t]*\n?/i, "").replace(/\n?[ \t]*```[ \t]*$/, ""); // code fences
  t = t.replace(/^["'“”]+|["'“”]+$/g, "");
  // drop a leading "Title:" or markdown-heading line if the model adds one
  t = t.replace(/^(?:#+\s+.*|Title:\s*.*)\n+/i, "");
  return t.replace(/^\n+/, "").replace(/\n+$/, "");
}

// Router models like openrouter/fusion sometimes return their whole multi-model
// deliberation transcript with the real answer at the end. We ask every prompt to
// wrap the final output in <verse></verse> and extract the LAST such block
// (panelist drafts may carry their own tags; the final synthesis comes last).
const VERSE_RULE = "Wrap your final output between <verse> and </verse> tags. Output nothing after the closing tag.";

// Sonnet 5 takes no temperature on OpenRouter, so identical compose prompts
// converge on nearly the same poem. Every compose therefore rolls a fresh
// entropy seed: an approach, two glancing anchor images, and a vantage —
// enough to force a different draw without steering the voice.
const SEED_WORDS = [
  "rust", "brine", "wax", "antler", "mildew", "chrome", "gasoline", "psalm",
  "sinew", "static", "frost", "roe", "tallow", "vinegar", "moth", "marrow",
  "gravel", "neon", "incense", "tin", "lichen", "cistern", "hornet", "votive",
  "asphalt", "pollen", "freezer", "cassette", "thistle", "iodine", "ash",
  "ivory", "kerosene", "sturgeon", "velvet", "solder", "chalk", "amber",
  "transmission tower", "riverbed", "scaffold", "organ pipe", "ozone", "milk",
];
const SEED_MOVES = [
  "begin mid-action, with no scene-setting",
  "address a creature or an object directly",
  "a first-person confession in plain speech",
  "a catalogue that decays as it goes",
  "fix on one small object and never look away",
  "an elegy for something unworthy of elegy",
  "instructions or imperatives throughout",
  "a memory interrupted by the present tense",
  "describe a place by what is missing from it",
  "circle back to the first line at the end, changed",
  "third person, watching someone work with their hands",
  "a praise poem for something rotten or broken",
  "a scene the speaker refuses to fully explain",
  "one long held moment, time barely moving",
];
// a poem TYPE to hit — this, not the exemplars, sets each compose's subject,
// so the machine stops drifting back to the same one or two themes
const GENRES = [
  "an aubade — dawn, waking, the parting at morning",
  "a nocturne — night, sleeplessness, the dark",
  "an elegy — mourning a person, an animal, or a thing",
  "a pastoral — land, weather, herds, the work of the fields",
  "an ekphrasis — a poem about a single artwork or object",
  "an ode of praise, addressed directly to its subject",
  "a still life — objects in a room, arranged and unmoving",
  "a devotional or psalm — the sacred, the liturgical, the prayer",
  "a complaint — a grievance, what is owed and left unpaid",
  "a blazon — cataloguing a body or an object part by part",
  "an invocation — calling on a power, a creature, a force",
  "a georgic — the how-to of labor: fishing, forging, mending, tending",
  "a war poem — the field, the armor, the soldier, the aftermath",
  "a travel poem — driving, roads, the arriving and the leaving",
  "a bestiary entry — one animal, closely and strangely seen",
  "a convalescence poem — the body failing, or slowly mending",
  "a myth retelling — gods, saints, monsters, a transformation",
  "a domestic poem — the kitchen, the family, the house's quiet debris",
  "a city poem — pavement, wire, signage, the machinery of a street",
  "an inventory of a place by everything absent from it",
];
function composeSeed() {
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const w1 = pick(SEED_WORDS);
  let w2 = pick(SEED_WORDS);
  while (w2 === w1) w2 = pick(SEED_WORDS);
  return [
    `Entropy for this draw (roll #${1000 + Math.floor(Math.random() * 9000)}):`,
    `- GENRE — commit to this fully; IT sets this poem's whole subject: write ${pick(GENRES)}.`,
    `- Approach: ${pick(SEED_MOVES)}.`,
    `- Let these two things appear somewhere, glancing, never central: ${w1}; ${w2}.`,
    "Do NOT fall back on your usual poetic subjects, and do NOT borrow the recurring themes of the voice-reference poems — the genre above is the assignment. Never mention this seed, its number, or these instructions.",
  ].join("\n");
}

// The owner's own poems (exemplars.txt) ride along as a voice compass.
// Parse into individual poems (separated by 2+ blank lines) so compose can
// show a fresh RANDOM SUBSET each request instead of all of them at once —
// otherwise the strongest recurring themes dominate every draw.
const ALL_EXEMPLARS = (() => {
  try {
    const raw = readFileSync(path.join(__dirname, "exemplars.txt"), "utf8").replace(/\r/g, "");
    return raw.split(/\n[ \t]*\n[ \t]*\n+/).map((p) => p.trim()).filter(Boolean);
  } catch { return []; /* no exemplars file — write unaided */ }
})();

// build the framed voice block from a given set of poems. `subjectFromExamples`
// true (revise/continue): inherit sensibility incl. subject families, to match
// existing work. false (compose): inherit VOICE/FORM only — the genre sets subject.
function voiceBlock(poems, { subjectFromExamples = true } = {}) {
  if (!poems || !poems.length) return null;
  const guidance = subjectFromExamples
    ? "Absorb the sensibility of these poems and write as a kindred voice: their subject matter (the sacred fouled and the foul made sacred; animals, rot, religious iconography, bodies, family debris); their syntax (compressed noun-stacked fragments beside plain confessional run-ons; lowercase lines; heavy enjambment); their punctuation habits (ampersands for 'and', sparse commas, occasional multiple-space caesuras inside a line, periods rare and final)."
    : "Take from these ONLY the poet's VOICE and FORMAL habits — never their subjects: compressed noun-stacked fragments beside plain confessional run-ons; lowercase lines; heavy enjambment; ampersands for 'and'; sparse commas; occasional multiple-space caesuras inside a line; periods rare and final; concrete sensory nouns over abstraction. Do NOT reuse the recurring themes or images of these examples — this poem's subject is set by the genre in the instructions, and you must commit to it.";
  return [
    "VOICE REFERENCE — poems written by the poet who owns this machine:",
    "════",
    poems.join("\n\n\n"),
    "════",
    guidance,
    "These are a compass, not a source: NEVER quote, reuse, or lightly rework any line, phrase, or invented image from them, and never write about them." +
      (subjectFromExamples ? " When revising or continuing an existing poem, the poem on the screen always outranks these exemplars." : ""),
  ].join("\n");
}

function pickN(arr, n) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, Math.min(n, a.length));
}

// continue / rewrite see the full set (matching existing work); compose sees a
// fresh random 4 with subject-steering off.
const EXEMPLAR_BLOCK = voiceBlock(ALL_EXEMPLARS);
const composeVoiceBlock = () => voiceBlock(pickN(ALL_EXEMPLARS, 8), { subjectFromExamples: false });

function extractVerse(raw) {
  if (!raw) return "";
  const matches = [...raw.matchAll(/<verse>([\s\S]*?)<\/verse>/gi)];
  if (matches.length) return cleanPoem(matches[matches.length - 1][1]);
  // fallback: unmarked deliberation transcript — take the text after the last
  // markdown heading block if one exists, else the whole thing
  return cleanPoem(raw);
}

// ---- rewrite anchoring ----------------------------------------------------------
// Repeated rewrites of the same passage drift (e.g. +1 word per pass) because
// each rewrite re-anchors on the previous attempt. The client remembers the
// ORIGINAL text of a rewrite chain and every re-roll anchors on that — an
// independent draw against the original (free to be longer or shorter than it),
// with the rejected attempts listed so the dice don't land on a repeat.
function anchorBlock(original, avoid) {
  const parts = [];
  if (original && original.trim()) {
    parts.push(
      "What currently sits in this spot is only one of many possibilities — the poet's first version was:",
      `«${original}»`,
      "Do not treat that as source material to reword. Fill the spot with a DIFFERENT possibility that does not share its specific meaning or images.",
    );
  }
  const tried = (avoid || []).filter((a) => a && a.trim()).slice(-6);
  if (tried.length) {
    parts.push("These fillings were already tried and rejected — go somewhere different from every one of them:");
    tried.forEach((a, i) => parts.push(`${i + 1}) «${a.replace(/\n/g, " / ")}»`));
  }
  return parts.length ? parts.join("\n") : null;
}

// ---- routes ------------------------------------------------------------------

app.post("/squire/api/poem", async (req, res) => {
  if (!API_KEY) return res.status(500).json({ error: "No OPENROUTER_API_KEY set. Copy .env.example to .env and add your key." });
  const {
    theme = "", vibe = [], temperature = 0.9,
    meter = 30, rhyme = 30, terseness = 40, poemLength = 40,
  } = req.body || {};

  if (MODEL_CAPS === null) await loadModelCaps();

  const messages = [
    {
      role: "system",
      content: [
        "You are a poet. Write one complete, original poem to the given specifications.",
        composeVoiceBlock(), // a fresh random subset each request
        "Output ONLY the poem text: no title, no commentary, no quotation marks, no markdown.",
        "Separate stanzas with a single blank line.",
        VERSE_RULE,
      ].filter(Boolean).join("\n"),
    },
    {
      role: "user",
      content: `${styleBlock(req.body || {}, true)}\nLength: ${poemLengthInstruction(poemLength)}\n\n${composeSeed()}\n\nWrite the poem now.`,
    },
  ];

  try {
    const raw = await chat(messages, { maxTokens: 3000, temperature });
    const poem = extractVerse(raw);
    if (!poem) return res.status(502).json({ error: "Model returned an empty poem." });
    return res.json({ poem });
  } catch (err) {
    return res.status(err.status || 500).json({ error: String(err?.message || err) });
  }
});

// Continue a poem the user has begun: keep their lines untouched, generate
// only the lines that follow, bringing the poem to a satisfying close.
app.post("/squire/api/continue", async (req, res) => {
  if (!API_KEY) return res.status(500).json({ error: "No OPENROUTER_API_KEY set." });
  const {
    lines = [], instruction = "", temperature = 0.9, poemLength = 40,
  } = req.body || {};

  const opening = (Array.isArray(lines) ? lines.join("\n") : "").replace(/\s+$/, "");
  if (!opening.trim()) {
    return res.status(400).json({ error: "Write a line or two first — or use Compose." });
  }

  if (MODEL_CAPS === null) await loadModelCaps();

  const guidance = instruction && instruction.trim()
    ? `Guidance from the poet: ${instruction.trim()}`
    : "No specific guidance was given.";

  const messages = [
    {
      role: "system",
      content: [
        "You are a poet. The poet has written the opening of a poem and wants you to continue it forward to a satisfying completion.",
        EXEMPLAR_BLOCK,
        "Your continuation is a STYLE TRANSFER of the opening itself. Before writing anything, silently profile the opening:",
        "- capitalization (all lowercase? sentence case? odd internal caps?) and its exact punctuation habits — commas, periods, dashes, ampersands, multi-space caesuras, or the absence of all of these. Copy those habits precisely.",
        "- HORIZONTAL SPACING / PAGE FIELD. This is a real, load-bearing feature, not noise. If the opening indents some lines far to the right, drops big runs of spaces mid-line, or scatters text across the page (Frank O'Hara / Charles Olson 'field composition' / 'breath' spacing), your continuation MUST do the same — vary indentation line to line, open wide interior gaps, let some lines start deep in the margin. Preserve the exact leading spaces and interior gaps as literal space characters. Never left-justify a poem that was composed across the field.",
        "- line length (words per line), enjambment vs end-stopped lines, stanza size and shape.",
        "- diction register (plain, ornate, archaic, clinical), concrete vs abstract, and the image families already in play.",
        "- grammar: tense, person, full sentences vs fragments.",
        "- meter and rhyme, if any.",
        "Then write new lines indistinguishable from the poet's own — as if the same hand had kept going. WHERE THE OPENING'S STYLE DISAGREES WITH THE EXEMPLARS OR THE DIALS, THE OPENING WINS.",
        "In particular: do NOT import the exemplars' surface habits (lowercase line-starts, '&' for 'and', multi-space caesuras, fragments) unless the opening itself uses them. If the opening capitalizes its lines and writes 'and' in full, every one of your lines must too.",
        "The seam between the opening and your continuation must be invisible.",
        "Output ONLY the continuation — the new lines that come after the opening. Never repeat, quote, or revise the opening lines.",
        "If a stanza break belongs between the opening and your first new line, make the very first line of your output exactly: ***",
        "No title, no commentary, no quotation marks, no markdown.",
        VERSE_RULE,
      ].filter(Boolean).join("\n"),
    },
    {
      role: "user",
      content: [
        guidance,
        `Stylistic dials (apply ONLY where the opening itself is silent — the opening's own style always wins):`,
        styleBlock(req.body || {}),
        `Overall length: ${poemLengthInstruction(poemLength)} That target counts the opening lines too.`,
        "",
        "The poem so far:",
        "----",
        opening,
        "----",
        "",
        "Continue the poem to its end now.",
      ].join("\n"),
    },
  ];

  try {
    const raw = await chat(messages, { maxTokens: 3000, temperature });
    let text = extractVerse(raw);
    if (!text) return res.status(502).json({ error: "Model returned nothing." });
    // "***" first line = the model wants a stanza break before its first line
    if (/^\*{3}\s*(\n|$)/.test(text)) text = "\n" + text.replace(/^\*{3}\s*\n?/, "");
    return res.json({ text });
  } catch (err) {
    return res.status(err.status || 500).json({ error: String(err?.message || err) });
  }
});

// Rewrite a passage of the poem: a single line, a stanza, or the whole thing.
// The client sends the full poem as an array of lines plus [start, end] line
// indices (inclusive) marking the passage; we return replacement text.
app.post("/squire/api/rewrite", async (req, res) => {
  if (!API_KEY) return res.status(500).json({ error: "No OPENROUTER_API_KEY set." });
  const {
    lines = [], start = 0, end = 0, scope = "line", instruction = "",
    temperature = 0.9, original = null, avoid = [],
  } = req.body || {};

  // scope "selection": an arbitrary highlighted span, by character offsets
  if (scope === "selection") return rewriteSelection(req, res);

  if (!Array.isArray(lines) || !lines.some((l) => l && l.trim())) {
    return res.status(400).json({ error: "Nothing to rewrite yet — compose a poem first." });
  }
  const s = Math.max(0, Math.min(lines.length - 1, start | 0));
  const e = Math.max(s, Math.min(lines.length - 1, end | 0));

  if (MODEL_CAPS === null) await loadModelCaps();

  const wholePoem = scope === "poem" || (s === 0 && e === lines.length - 1);
  const guidance = instruction && instruction.trim()
    ? `Revision guidance from the poet: ${instruction.trim()}`
    : "No specific guidance was given — improve the passage: sharpen the imagery, tighten the language, keep what already works.";
  // line/stanza is SLOT-FILLING, not rewording — a different default
  const slotGuidance = instruction && instruction.trim()
    ? `Direction from the poet: ${instruction.trim()}`
    : "No specific direction — surprise: put something here the poem doesn't already have.";

  let messages;
  if (wholePoem) {
    messages = [
      {
        role: "system",
        content: [
          "You are a poet revising your own work. Rewrite the poem you are given.",
          EXEMPLAR_BLOCK,
          "Keep it recognizably the same poem — same subject and emotional core — unless the guidance says otherwise.",
          "Output ONLY the rewritten poem text: no title, no commentary, no quotation marks, no markdown.",
          VERSE_RULE,
        ].filter(Boolean).join("\n"),
      },
      {
        role: "user",
        content: [
          guidance,
          anchorBlock(original, avoid),
          "",
          `Style to maintain:\n${styleBlock(req.body || {})}`,
          "",
          `Poem:\n----\n${lines.join("\n")}\n----`,
          "",
          "Rewrite it now.",
        ].filter((p) => p !== null).join("\n"),
      },
    ];
  } else {
    const before = lines.slice(0, s).join("\n");
    const target = lines.slice(s, e + 1).join("\n");
    const after = lines.slice(e + 1).join("\n");
    const kind = scope === "stanza" ? "stanza" : "line";
    messages = [
      {
        role: "system",
        content: [
          `You are a poet. The poem below has one ${kind} marked between >>> and <<<. That ${kind} is a SLOT — an opening in the poem you are filling fresh.`,
          EXEMPLAR_BLOCK,
          `Write a NEW ${kind} for that slot. It need NOT keep the meaning, images, or subject of what currently sits there — treat that as only one of many things that could go in the space. What matters is that your ${kind} fits the SPACE: it must follow naturally from the lines before it and lead naturally into the lines after, matching their voice, tense, rhythm, and any rhyme scheme, so the seam is invisible.`,
          `Think of what ELSE could live in this spot — not a paraphrase of what's there. (If the slot is "a green ribbon", a red ribbon, a thin ribbon, or a borrowed ribbon are all fair game — the space wants filling, not the word rewording.)`,
          kind === "line"
            ? "Output exactly ONE line. Nothing else."
            : "Output only the replacement stanza (roughly the same number of lines). Nothing else.",
          "No quotation marks, no markers, no commentary.",
          VERSE_RULE,
        ].filter(Boolean).join("\n"),
      },
      {
        role: "user",
        content: [
          slotGuidance,
          anchorBlock(original, avoid),
          "",
          "Style to maintain:",
          styleBlock(req.body || {}),
          "",
          "Poem:",
          "----",
          before,
          ">>>",
          target,
          "<<<",
          after,
          "----",
          "",
          `Rewrite the marked ${kind} now.`,
        ].filter((p) => p !== null).join("\n"),
      },
    ];
  }

  try {
    const raw = await chat(messages, { maxTokens: wholePoem ? 3000 : 1500, temperature });
    let text = extractVerse(raw);
    // strip stray markers if the model echoed them
    text = text.replace(/^>{2,}\s*\n?/, "").replace(/\n?\s*<{2,}$/, "").trim();
    if (!text) return res.status(502).json({ error: "Model returned nothing." });
    if (scope === "line" && !wholePoem) {
      text = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)[0] || "";
      if (!text) return res.status(502).json({ error: "Model returned an empty line." });
    }
    return res.json({ text });
  } catch (err) {
    return res.status(err.status || 500).json({ error: String(err?.message || err) });
  }
});

// Rewrite an arbitrary highlighted fragment — a word, a phrase, part of a line,
// or a span across lines. The client sends the full poem text plus character
// offsets; we mark the fragment inline with ⟦ ⟧ and ask for a drop-in splice.
async function rewriteSelection(req, res) {
  const {
    text = "", selStart = 0, selEnd = 0, instruction = "", temperature = 0.9,
    original = null, avoid = [],
  } = req.body || {};

  const s = Math.max(0, Math.min(text.length, selStart | 0));
  const e = Math.max(s, Math.min(text.length, selEnd | 0));
  const fragment = text.slice(s, e);
  if (!fragment.trim()) return res.status(400).json({ error: "Highlight some text first." });

  if (MODEL_CAPS === null) await loadModelCaps();

  const multiline = fragment.includes("\n");
  const fragLines = fragment.split("\n").length;
  const fragWords = fragment.trim().split(/\s+/).filter(Boolean).length;
  const guidance = instruction && instruction.trim()
    ? `Direction from the poet: ${instruction.trim()}`
    : "No specific direction — put something in this spot the poem doesn't already have.";

  // length budget scaled to the fragment. A 1–2 word selection must come back
  // as ~1–2 words, not a whole clause — otherwise the splice reads as if more
  // than the selection changed (the exact bug this guards against).
  let lengthRule;
  if (multiline) {
    lengthRule = `The marked span covers ${fragLines} lines. Keep the same number of lines, preserving the poem's lineation.`;
  } else if (fragWords <= 4) {
    const lo = Math.max(1, fragWords - 1), hi = fragWords + 1;
    lengthRule = `The marked span is only ${fragWords} word${fragWords === 1 ? "" : "s"} long. Return about ${lo}–${hi} words of the SAME grammatical shape (a noun phrase for a noun phrase, a verb for a verb). Do NOT return a whole clause, sentence, or line — only enough words to fill the marked slot.`;
  } else {
    lengthRule = "The marked span sits inside a single line. Your replacement must be roughly the same length with NO line breaks — never a full line unless the span was one.";
  }

  const messages = [
    {
      role: "system",
      // NB: the big exemplar voice-block is intentionally omitted here — for a
      // surgical 1–2 word swap it just pressures the model to write a full
      // stylized line. The surrounding poem is the only style reference needed.
      content: [
        "You are a poet. The poem below has one span marked between ⟦ and ⟧. That span is a SLOT — an opening you are filling fresh, not a phrase to reword.",
        "Fill the slot with something NEW. It need NOT keep the meaning of the words currently there — they are just one possibility. What you write must fit the SPACE: spliced into that exact spot it has to read seamlessly with the words on either side (grammar, tense, rhythm, tone, any rhyme).",
        "Think of what ELSE could go here. If the marked span were ⟦green⟧ in 'she wore a ⟦green⟧ ribbon', then 'red', 'thin', 'torn', or 'borrowed' are all fair game — you are choosing what fills the slot, not finding a synonym for the word.",
        lengthRule,
        "CRITICAL: everything before ⟦ and everything after ⟧ stays in the poem UNCHANGED. Your output replaces only the marked span. Never include any word that already sits just before or just after the markers, and never return a longer stretch of text than the marked span.",
        "Output ONLY the words that fill the slot: no ⟦ ⟧ markers, no quotation marks, no commentary. Do not return the original words unchanged.",
        VERSE_RULE,
      ].filter(Boolean).join("\n"),
    },
    {
      role: "user",
      content: [
        guidance,
        anchorBlock(original, avoid),
        "",
        "Poem:",
        "----",
        text.slice(0, s) + "⟦" + fragment + "⟧" + text.slice(e),
        "----",
        "",
        "Fill the marked slot now.",
      ].filter((p) => p !== null).join("\n"),
    },
  ];

  try {
    // generous ceiling: reasoning models spend tokens thinking before emitting
    // content, and max_tokens covers both — too low yields empty content
    const raw = await chat(messages, { maxTokens: 1500, temperature });
    let out = extractVerse(raw);
    out = out.replace(/[⟦⟧]/g, "").trim();
    if (!out) return res.status(502).json({ error: "Model returned nothing." });
    // a single-line fragment must stay a single line
    if (!multiline) out = out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).join(" ");
    return res.json({ text: out });
  } catch (err) {
    return res.status(err.status || 500).json({ error: String(err?.message || err) });
  }
}

app.get("/squire/api/health", (_req, res) => {
  res.json({
    ok: true,
    model: MODEL,
    hasKey: Boolean(API_KEY),
    supportsTemperature: supports("temperature"),
  });
});

// On Vercel the platform invokes the exported app per request — there is no port
// to listen on. Locally we still listen so `npm start` works as before.
if (!process.env.VERCEL) {
  app.listen(PORT, async () => {
    console.log(`\n  ✒️  Poem Knobs running at http://localhost:${PORT}/squire`);
    console.log(`     model: ${MODEL}`);
    if (!API_KEY) console.log("     ⚠️  no OPENROUTER_API_KEY yet — add it to .env");
    await loadModelCaps();
    console.log("");
  });
}

export default app;
