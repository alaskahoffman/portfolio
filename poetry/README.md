# POEM·MATIC

> **The interface is a cel-shaded 3D handheld alone in a dark room** —
> Game Boy / fishfinder DNA, flat toon shading with no outlines, rendered in
> Three.js (`scene.js`) and lit almost entirely by its own ice-blue screen:
> the LCD canvas doubles as an emissive texture *and* is sampled to drive a
> real point light, so typing makes light move on the plastic. Heavy bloom,
> faint camera drift, an unlabeled **glowing red dome button** that fires
> every action, and four faceted knobs whose ribs really spin when dragged.
> The DOM face (invisible textarea, LCD canvas, margin lamps, printed
> legends) rides a `CSS3DObject` with the same camera, so text stays
> natively clickable while the body is true 3D.
> The display is a **true emulated character-matrix LCD**: an
> invisible native textarea drives a canvas that renders every glyph from a
> classic HD44780 5×7 bitmap font, bit-for-bit as discrete cells — selection
> inverts the cells, the caret is a blinking underline. Cell size is one
> constant (`CELL` in app.js: 2 = dense Nokia, 3 = chunky pocket terminal).
> Long poems scroll *inside the glass*; the margin lamps track the scroll.
> Knobs: drag vertically, scroll to step, double-click to reset — the value
> reads out on the screen like volume on a stereo. One guidance line on the
> glass feeds both composition subject and revision steering. Boots with a
> 2s phosphor warm-up. Mechanical sounds are WebAudio. Three.js is served
> from `/vendor/three` (an express.static route over `node_modules/three`).

A poetry writer (via [OpenRouter](https://openrouter.ai)) driven by **one
context-aware red button** (the screen's status line tells you what's armed):

- Empty page → **Compose** (a whole poem from the knobs).
- Your own lines on the page → **Continue** (they stay untouched; the model
  studies their voice, meter, and rhyme and writes only what follows).
- Something targeted → **Rewrite line 4 / stanza 2 / selection / whole poem**.

Targeting is direct: click a **dot** in the margin to pick a line, the **bar**
to pick its stanza, highlight any span of words to rewrite exactly that, or
⌘A for the whole poem. Click a dot again to untarget. There is deliberately
**no free-text input** — the knobs and the poem itself are the whole
interface (the machine infers subject and mood from what's on the glass).

The poem itself is a plain editable page — type, delete, repunctuate freely
(browser undo works). **Undo AI** separately reverts model changes.

## Setup

1. Add your key:
   ```bash
   cp .env.example .env
   # then open .env and paste your OpenRouter key
   ```
2. Run it:
   ```bash
   npm install
   npm start
   ```
3. Open http://localhost:3000

## Knobs

| Knob | What it does |
|------|--------------|
| **Meter** | Free verse ↔ strict regular meter. |
| **Rhyme** | No rhyme ↔ clear rhyme scheme required. |
| **Terse** | Lush ↔ severe economy. |
| **Length** | Brief ↔ extended. |

(Mood is inferred from the subject, guidance, and existing lines; line length
is left to the poem. The old RANDOM knob is gone — Sonnet 5 on OpenRouter
doesn't accept `temperature` anyway.)

The knobs apply to Compose *and* to every rewrite (the rewrite is told to
maintain the style), so nudging a knob then rewriting a stanza steers just
that stanza.

## How it works

The browser never sees your API key. `server.js` exposes:

- `POST /api/poem` — knobs → a complete poem.
- `POST /api/continue` — the user's opening lines + knobs + optional
  instruction → only the new lines that follow (a leading `***` from the model
  marks "start a new stanza first" and becomes a blank line).
- `POST /api/rewrite` — full poem + `[start,end]` line range + scope
  (`line` / `stanza` / `poem`) + optional instruction → replacement text.
  The passage is marked with `>>> <<<` inside the prompt so the model rewrites
  only that span and keeps it seamless with its surroundings.
  Scope `selection` instead takes the raw text + character offsets of the
  highlight (whitespace-snapped client-side), marks the fragment inline with
  `⟦ ⟧`, and returns a drop-in splice — single-line fragments are forced to
  stay single-line.
  Re-rolling the same passage **anchors on the original**: the client remembers
  the chain's first text plus rejected attempts (`original` / `avoid` fields),
  so each rewrite is a fresh draw against the original rather than a revision
  of the previous roll — this stops the +1-word-per-pass length creep. A manual
  edit to the passage starts a new chain; Undo AI stays inside the old one.
- `GET /api/health` — model name + capability flags for the UI.

Model is set by `OPENROUTER_MODEL` in `.env`. The server discovers each model's
supported parameters at boot and only sends what's allowed (router models like
`openrouter/fusion` reject `temperature`/`max_tokens`). Because Fusion can return
its whole multi-model deliberation transcript, every prompt asks for the final
answer wrapped in `<verse>` tags and the server extracts the last such block.

The current model is `anthropic/claude-sonnet-5` (fast — a few seconds per
call). Note: on OpenRouter, Sonnet 5 does not accept `temperature`, so the
Randomness knob shows *n/a*; it re-enables automatically on models that do.

Sonnet 5 is a reasoning model, but poem generation doesn't need chain-of-thought,
so the server sends `reasoning: {enabled: false}` by default — set
`OPENROUTER_REASONING` in `.env` to `low`/`medium`/`high` to re-enable at a
given effort (only sent to models whose `supported_parameters` include
`reasoning`).
`openrouter/fusion` also works but takes ~30–90s per call (it runs a
multi-model panel with the deliberation-transcript quirk handled via `<verse>`
tag extraction).
