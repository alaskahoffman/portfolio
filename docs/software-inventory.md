# Software folder review — 26 September 2026

This is an editorial inventory, not a release certification. Descriptions were
checked against local documentation, application entry points, and source layout.
Projects were not all launched or tested; no release dates were inferred from
folder timestamps. Existing portaltext and andstar release labels come from the
portfolio's established case studies. Prototype labels indicate an implemented
project without an established public release in this review.

The portfolio catalog is `api/software.json`. The Experiments index (`/software`) uses Poetry’s
title-only list layout, preserving the catalog order without visible category
headings or summaries. The sidebar section is labeled Software, with an Experiments link. portaltext,
andstar, ARcH Squire, and DX Research Group remain in the sidebar and are omitted from the
Experiments list. Its new detail pages use the existing third-person, museum-label syntax: a factual
one- or two-sentence description of the work, followed by images and optional
captions. Status lines, separate attribution paragraphs, and subheadings are omitted.
They inherit the original 11px typography, h4 titles, muted project metadata,
and paragraph layout without a separate software-specific stylesheet. No local project source,
models, datasets, API keys, user boards, or game assets are bundled into those
pages. No new external demo or repository URLs were guessed.

## Included

Paths below are relative to Documents.

| Folder | Portfolio entry | Evidence / editorial treatment |
| --- | --- | --- |
| `euwiki` | portaltext | README, runtime, extension, and existing released case study. |
| `andstar` | andstar | README, DSL parser, runtime, editor, and existing released case study. |
| `puller-app` | Puller | README, engine, native shell, package 0.1.1; early desktop build, unsigned distribution remains work. |
| `portaltext-desktop` | Portaltext Desktop | README, native selection/panel/chip modules; macOS prototype. |
| `bible` | The Transcluded Bible | README, reader, server, and reference data; explicitly a local lab, not a public service. |
| `ocrproject` | pdf2tei | README and OCR/TEI/FastAPI modules; local prototype requiring editorial review. |
| `archwebsite/poetry` | ARcH Squire / POEM·MATIC | README and Three.js/textarea frontend; retain existing Squire naming while acknowledging prototype name. |
| `mirandaproject` | The Miranda Project | README, handoff, generator/terrain modules, map/wiki views; MVP. |
| `mud-dle` | mud·dle | README and Next.js game structure; browser-save prototype with optional AI features. |
| `ChatGPT/flyblood` | FLYBLOOD | Both READMEs; use newer `game/` Godot vertical slice, not only the older React prototype. Simplified connectome dynamics; fictional AI voice. |
| `fmvstereo` | Corner Office | README, scene data, browser engine, and media tools; FMV scene prototype. |
| `ChatGPT/meleefolio` | Meleefolio | README; local modification based on doldecomp Melee, with upstream attribution. No game distribution. |
| `itsnow` | itsnow | Marketing UI and server fetching/synthesis/auth/API modules; prototype, current hosting unverified. |
| `terminalpro` | DX Research Group | Existing DXRG case study is the authority for Alaska's role. Do not reframe the team frontend as a solo project. |
| `tpdash` | CEO Bench | App metadata, dashboard, charts, and service routes; related dashboard work, upstream service availability unverified. |
| `shmewieviewer` | Terminal Village | Live DX Terminal NFT collection viewer; Alaska confirms 35,000+ unique sprites sorted and highlighted by market availability. |

## Additional candidates to resolve before featuring

| Folder | Finding / reason held back |
| --- | --- |
| `animalese` | Animal Crossing-style speech generator with Flask and adjustable playback. Origin is under another account; establish Alaska's contribution and preferred attribution before featuring it as her work. |
| `ChatGPT/pufferbalatro` | Substantial Rust simulator and RL/bot toolkit. Documentation identifies a separate upstream project; establish contribution scope and public-disclosure preference before writing a personal case study. |
| `cigaretteman` | Together.ai chat application. README is generic; establish the intended project name and distinctive purpose before featuring. |
| `eliza` | `alaska.py` is an ELIZA-style pattern-matching chat experiment; a possible smaller sketch entry. |
| `acm/poem-collection` | Poetry collection and import materials, potentially a writing/archive project. Attribution and intended public presentation need editorial context. |
| `learn2code` | Small C exercise, rather than a developed portfolio project. |
| `porter`, `promptbenchmark`, `ectopractice` | No developed application found in the inspected folder inventory. |
| `itsnowtest` | No independent software project established. |

## Not software-project entries

`Puller` is application data for Puller, not another source project. `Adobe`,
`Cline`, `junkdrawer`, `dxrg artwork`, and `resend-import` contain application
support, art, or operational material. `emulator` contains game/emulator files,
not an original project. Loose personal documents, photos, recordings, exports,
and contacts were not used as portfolio content.

## Follow-up editing

- Confirm which prototypes have public demos or releases and add only their actual URLs.
- Add screenshots selected for public display to richer case studies as desired.
- Confirm authorship for the held-back candidates before including them.
- Keep `State` current as prototypes become releases; do not replace uncertainty with guessed completion percentages.

Truthbrary, fishmonger, Avve, and Jev Playground were removed from the portfolio at Alaska’s request. Their source folders were not changed. itsnow appears under Reading and language. The now-empty Research and discovery section was removed.

## Screenshot coverage — 26 September 2026

All 16 remaining entries have images on their project pages. The new captures
use the original interfaces, with no generated replacement screens. The image
links open the full-resolution PNGs. Captions use the existing muted metadata
style; the index, typography, and third-person descriptions are retained.

- portaltext and andstar: existing screenshots from their case studies.
- DX Research Group: existing paper screenshot.
- FLYBLOOD: `game/docs/screenshots/fruit-rebuild-app.png`, showing the native build.
- Terminal Village: Alaska’s supplied 2970×1720 screenshot of the live collection viewer at `https://village.terminal.markets/`, showing market availability in shopping view.
- Meleefolio: captured from the running gallery in Dolphin, using its existing launcher and separate profile.
- Miranda: closer local frontend capture of Miranda Hook’s streets, buildings, and harbour from the existing saved territory; no world generation was run. The description records its cycle of deepening places before outward expansion.
- The Bible reader: catena and paired John 1:1 / Genesis 1:1 passages, with their existing connection analysis served from the local SQLite cache in read-only mode.
- Portaltext Desktop: its reading-panel webview, with nested Hypertext → Ted Nelson → Project Xanadu references. A local fixture supplies illustrative summary text; no model calls or settings screen are used.
- pdf2tei: the existing completed job `dbe919b01861`, showing The Orestean Trilogy scan, facsimile zones, and transcription. A read-only local server served the original saved job and page images; no conversion or model call was run.
- Corner Office: the office and telephone scenes in a temporary copy of the game, built with its own `tools/build_from_stills.sh` and existing scene artwork. Original source assets and placeholder videos were not overwritten.
- Puller: the existing `ui/workspace-test.html` offline fixture, expanded through its interface to show connected entities and quoted evidence. The fictional entities and sources are identified both in the interface and in the portfolio caption. No real board data or model requests were used.
- Squire: its actual writing interface with an excerpt from the published poem “the necessities,” entered manually. No AI generation was run.
- mud·dle: the local game in its opening diner.
- itsnow: its interface using a temporary copy of the saved news cache, with AI synthesis paused. Its application database was not used or modified.
- CEO Bench: an isolated temporary copy populated with fictional scoreboards, performance histories, messages, and activity. The image and caption explicitly identify illustrative data, not benchmark results. The original tpdash source and services were not changed.

The project images are in `api/public/images/software`. The portfolio tests
check that each catalog entry displays its screenshot and that every image URL
serves an image. New software assets are additionally decoded as PNGs to verify
the file format. Content hashes in image URLs invalidate stale browser caches. Removed Truthbrary and fishmonger routes return 404.

The revised captures replace empty start screens, the settings panel, and the malformed pdf2tei crop. Chrome captures were checked at their exported dimensions. The reading interfaces and CEO Bench were rendered at twice their normal CSS scale in temporary previews; viewport-relative dimensions and floating-panel placement were normalized for that scale. Corner Office’s temporary videos were rebuilt at 1280×960 using the original artwork and grain effects. No portfolio stylesheet or source application was changed for these captures. Additional views use the same image and caption styles as the existing pages.

Replacement image dimensions: Portaltext Desktop 1280×960; The Transcluded Bible 2560×1600; CEO Bench 2560×2650; pdf2tei 1920×2450; Corner Office (both views) 1568×1214. Other existing captures retain their source dimensions, including the 800×628 Meleefolio emulator capture.

## Authorial framing

The descriptions for Puller, The Transcluded Bible, pdf2tei, itsnow, The Miranda Project, mud·dle, FLYBLOOD, and Meleefolio follow Alaska’s stated conceptual framing: AI knowledge and documentary evidence; nonlinear textual analysis; computational philology; an agent-first internet; simulation and simulacrum; aleatoric authorship and AI repetition; connectomes and the ontology of simulated life; and historical code reuse. These are concise statements of artistic and research intent, supplied by the author, rather than additional claims of validated technical outcomes.

Corner Office’s revised framing follows Alaska’s account of its use of early generative video’s short duration alongside 1990s FMV game techniques, including period video and audio codecs.
