# Board brief: what goes on each board

> Method adapted from the `explainer-board-brief` skill in sirioberati/YouTube-AI-Motion-Graphics@52b5b94
> (MIT, (c) 2026 TEIN AI). Retargeted: the output is the studio's own files, built in Claude Code, not a Claude
> Design prompt.

The brief decides **what** is on the boards and **which words bring each element on**. The look is decided by the
theme (`tokens-default.md`), the motion by `motion-recipes.md`. The standard, from the creator who commissioned the
original: "would a visual learner have an easy time?", "less is more, needs to be visual", "why is this empty?",
"what is this slide, I do not get it".

## Contents

- Input
- The passes (in order)
- Output (in `V/docs/`)
- Revising an existing set of boards

## Input

- **Voice film:** the words as finally spoken. Transcribe the final cut (`scripts/transcribe_words.py`), never a
  pre-edit script, or ad-libs go missing and cues drift. If only a script exists, say so at the top of the brief.
- **No-voice film (proposal, pitch, product):** the copy deck, notes or doc. Each "line" is one written beat.
- The one-sentence idea, the audience (default: a smart beginner), camera on or off, the honesty rules, and the
  sources behind every claim. Missing values become `[NEED: ...]` at the top, never invented.

## The passes (in order)

1. **Number the lines.** One sentence (or one clause carrying its own idea) per line: L1, L2, ... Chapter headings
   are boundaries, not lines.
2. **Line ledger.** Each line is BOARD, SAME BOARD or CAMERA.
   - BOARD when the line carries something the viewer cannot hold by ear: a term not yet taught, a number or
     comparison, money or data moving between parties, two or more things compared, a process or chain, an exact
     quote, a claim that needs its evidence, an example with a character, the backbone idea.
   - SAME BOARD when it adds a step to the picture already up. Say what changes.
   - CAMERA when it is opinion, a joke, a transition, a story beat with nothing to show. A choice, not a gap.
   - For every BOARD line write **what the viewer must understand after it**, in one sentence. Cannot write it?
     The line is unclear: script note.
3. **Word scan.** Every term, acronym, number, name and unit: where it is first taught, whether a board must show
   it, and its plain-words meaning. This is the glossary; board labels match it exactly, every time.
4. **Group into boards.** One board is one picture; it may build in steps. New picture, new board. Name each
   board's type from `board-types.md` (receipt, comparison bars, anchor diagram, flow, side by side, close read,
   placeholder reveal, character scene, number sticker, evidence, hold) and collect exactly the inputs that type
   needs; a missing input is a `[NEED]`, never a guess.
   - **The anchor:** most explainers have one backbone picture (a ladder, a map, a pipeline, at most two). Build it
     once early, then bring it back at the same position and scale with one part lit (others at 14 % opacity).
   - **Recurring actors** are introduced together on one board before they appear as chips.
   - **Characters** ("This is Kevin") get a name label and one-line role, drawn the same way every time. Fictional
     only: no generated faces.
   - **Examples carry real numbers** from the script or a source. No example in the script? Propose one in script
     notes, tagged EXAMPLE, for the author to approve.
   - **Money and data flows** are arrows between labelled parties, with what moves on each arrow.
5. **Board budget** (YouTube talking head, measured on a 27.5 min reference cut with 34 boards):
   | Section | Minimum |
   |---|---|
   | Hook, first ~60 s | 4-5 boards, none over ~20 s, a new picture at least every ~15 s |
   | Who's talking | 1 board, credentials and stake, from the script only |
   | The map (anchor) | built in the first 3 minutes, returns at every chapter that uses it |
   | Body | a board every 20-60 s of explaining; any board over ~75 s splits or gets a step every ~10 s |
   | Thesis | at most 1 silent board (only the thesis object) |
   | Outro | a closing board that brings the opening object back resolved, then the end screen (holds >= 20 s) |

   Proposal and product films follow the studio's own pacing instead: something new every 2-4 s, scene changes on
   downbeats, a board rarely over 8 s.
6. **Fill every board completely** (format below): lines covered, takeaway title, focal visual as content, every
   exact label and number with its role, the builds with their anchor words, the honesty tag.
   - **Anchors are verbatim.** Copy the exact spoken words that bring each element on; the sync matches them
     against the transcript, so a paraphrased anchor breaks the sync. A named thing lands on its name; a price on its
     number. Use `land_on` when the element should land on a later word of the phrase.
   - **Number roles:** money, percent, count, date, time, ratio, and `recalled` for a number already shown that
     returns as context without being said. Recalled numbers go in the structure. Stamps only on spoken money or
     percent: "five out of thirteen" never shows "$13".
   - **Never static:** structure on screen as the board opens, first content by the first second; plan a build step
     or filler only where more than ~8 s pass with nothing new (sync flags the shorter gaps itself and suggests the
     presenter's own words as fillers).
7. **Checks** (all of them, then write which passed):
   - Stranger test, voice side: at every BOARD line, does the board answer "what is that? how much? who pays whom?"
   - Stranger test, board side: sound off, does each board still say its claim, and the sequence the idea?
   - Never empty: no "diagram here", no TBD, no title over blank space.
   - No orphans: no board without a line, no line that needs a picture without one.
   - Text: the title plus about six words; labels and numbers extra. Never the script sentence as board copy.
   - No repeated furniture (a chapter label on every board, a tag on every board). No duplicate boards.
   - Every fact traces to the script or a listed source. Honesty tags (SEEN, EXAMPLE, MY READ, SIMPLIFIED) only
     where the source supports them. Forbidden names, logos, faces respected.
8. **Script notes.** Missing definitions, examples, bridges: the exact line proposed and where. Never edit the
   script; the author decides.

## Output (in `V/docs/`)

1. `script-marked.md`: every word unchanged, `[▸ BOARD n · title]` before each board's first line and `[CAMERA]`
   where the board drops away. Recordable as a teleprompter script.
2. `brief.md` additions: the glossary, the anchor, the characters, the board list in the compact format, camera
   lines, script notes, `[NEED]` list, checks run.
3. `cue-plan.json`: the machine version of the builds, read by `scripts/sync_cues.py` (format in `word-sync.md`).

Compact board format (one block per board, 80-200 words):

```
### Board 3 · Ten times slower  (L7-L10, slope chart, catalog C111Slope)
Understand: export time per board went from 4 s to 40 s on the same laptop.
Visual: two axes BEFORE / AFTER, one rising line, both values at its ends, a 10x stamp.
Title: "Ten times slower"
Builds: structure: axes, BEFORE, AFTER · line → "took four seconds" (on "took") · "4 s" (time) → "four seconds"
  · "40 s" (time) → "forty seconds" · "10x" (ratio, stamp) → "ten times slower" · note "per board, on a laptop"
  → "per board, on a laptop"
Tag / flags: SEEN (user's own render log, round 2)
```

## Revising an existing set of boards

Map every existing board to lines first, then mark each unchanged, changed (what to add, remove, move), new or cut
(why). Give the counts ("34 boards: 26 unchanged, 3 new, 5 changed") and never renumber silently.
