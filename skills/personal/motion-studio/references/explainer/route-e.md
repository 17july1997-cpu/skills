# Route E: explainer boards

Animated information boards (diagrams, charts, numbers, steps, comparisons) that land element by element on the
words that name them, spoken or written. Built from the board system in sirioberati/YouTube-AI-Motion-Graphics
(MIT, (c) 2026 TEIN AI; `THIRD_PARTY.md`), rebuilt to run inside the studio: same gates, same critique loop, same
sound and QA. `SK` below is this skill's folder; `V=videos/<slug>`.

## Contents

- When route E wins (check this before the studio matrix)
- The path (each step names its studio gate)
- Mixed routes

## When route E wins (check this before the studio matrix)

Route E when the film's job is to **make an idea understood**, and most shots are a diagram, chart, number, list,
comparison or process:

- a talking-head YouTube explainer, tutorial or breakdown (camera on, voice sync);
- a narrated explainer or walkthrough with no presenter on screen (camera off, voice sync);
- a proposal, pitch, case-study or results film carried by on-screen copy (camera off, words only);
- the information beats inside a route-A brand film (mixed route: E boards as inserts).

Not route E: a UI journey through real screens (route A or footage edit), pure brand mood or kinetic logo work
(route A), maths derivations (Manim), 3D (Three.js). When in doubt, write both options into the route question.

## The path (each step names its studio gate)

| Step | What | Read | Gate |
|---|---|---|---|
| E1 Brief | Line ledger, glossary, anchor, boards, builds with verbatim anchors | `brief-method.md`, `board-types.md` | Board list approved (replaces the shot-list OK) |
| E2 Theme | `V/boards/board-theme.css` from the brand kit, or the 3-direction style step | `tokens-default.md` | Part of the brief OK |
| E3 Pick | One catalog board per picture, by its "say it when" tags | `board-catalog.md` | None |
| E4 Build | Each board on `SK/assets/boards/board-shell.html` | `layout.md`, `components.md`, `charts.md`, `motion-recipes.md`, `do-dont.md` | Stills + contact sheet |
| E5 Sync | Voice: transcribe, then sync. Words only: reading pace (+ beat snap) | `word-sync.md` | `sync-report.md` clean |
| E6 QA | `check_board.mjs`, then the studio critique loop on a draft | `checks.md`, `do-dont.md`, annex C | QA clean, every axis 8+ |
| E7 Render + sound | `export_boards.mjs` (`--first 60`, then full), studio mix | `word-sync.md` | Studio QA (LUFS, peak, frames) |
| E8 Ship | Studio Phase 6, plus the extras below | | The user's verdict |

### E1 Brief

Run `brief-method.md` on the transcript (voice) or the copy deck (words only). Write `script-marked.md`, the brief
sections, and `V/docs/cue-plan.json`. Play the board list back as a table (board, lines, catalog pick, what lands on
which words) and get the OK with one 4-option question: approve; change the boards; change the look; something is
factually wrong. This replaces the shot-list gate for route-E shots.

### E2 Theme

Never ship the default Clean minimal theme by accident: it is what every clone of the source repo looks like.
Follow `tokens-default.md`: brand kit to `board-theme.css`, or the style step with 3 directions.

### E3 Pick, E4 Build

1. Copy `SK/assets/boards/{board-shell.html,brand.css,cue-player.js}` into `V/boards/`; one board per file,
   `NN-short-name.html`.
2. Open the catalog board in Chrome (★ local in `SK/assets/boards/`, the rest via `bash SK/scripts/fetch_library.sh`)
   and rebuild its layout and motion on the shell with the brief's content. Do not paste catalog files into the
   video: their timing is a preview loop and their copy is placeholder.
3. The contract: one `.ebs` root; every placed element absolute in board pixels; each element that lands has
   `data-move` (pop, rise, card, stamp, fade, title, marker, write, draw, wipe, wipe-left, grow-x, grow-y, count,
   dim, focus) and `data-cue` matching the plan; structure has neither and is there from frame 0. Motion on a
   wrapper, never on an element with its own transform. Complex recipes go in `window.seekExtra(t, cueTime)`.
4. Map recipes to moves: motion tokens M30 are built in (pop, rise, card, stamp, title + marker, write, draw).
   Premium and component recipes (P194-P237, C238-C254) are GSAP values: implement them in `seekExtra` as pure
   functions of t, or as a paused GSAP timeline built at the cue times. Keep one hero effect per board.
5. Stills: `node SK/scripts/check_board.mjs V/boards/NN-name.html --out V/qa/NN` writes a sheet at every landing.
   Read it before syncing.

### E5 Sync, E6 QA, E7 Render

All commands are in `word-sync.md`. Order: sync, read the sync report, fix, QA, read the QA report, fix,
`--first 60` render, watch it, full render, studio sound pass and mix, studio QA.

Critique loop for route E adds one axis to annex C, **Sync** (8+: every element lands within 0.05-2 s after its
word, nothing before, no dead stretch over `max_static`). Hunt specifically for: a title that gives the punchline
away before the voice says it, a board that opens empty, two elements fighting for the same beat, text that leaves
before it can be read, captions colliding with notes.

### E8 Ship extras

- **YouTube:** chapter list from the chapter boards' start times (`timeline.json`) for the description; the end
  board holds 20 s or more with nothing new in the last 5 s; a 1280 x 720 thumbnail from the strongest board (face +
  one big word or number, 3 words max, checked at 160 px wide; never a generated face).
- **Proposal and pitch films:** a 9:16 or 1:1 cut from the same cue plan (rebuild boards at the new size, reflow);
  `poster.png` from the payoff board; the source of every number listed in `V/docs/` for whoever presents it.

## Mixed routes

Route-E boards slot into a route-A film as scenes: the studio engine renders `V/src/index.html`; a board page
exposes the same `window.seek(t)`, so it can be loaded as an iframe scene or rendered separately with
`export_boards.mjs` and cut in on a downbeat. Check `engine/README.md` for the engine's page contract before
choosing; when in doubt, render boards separately and join them in the mix step.
