# Word sync: when things land

Three modes. The brief picks one (Phase 1, round 3), and the cue plan records it.

| Mode | When | Timing comes from | Sound |
|---|---|---|---|
| **Words only** (`text`) | Proposal, pitch, product or social film with on-screen copy and no voice | Reading pace: each element waits until the previous one has been readable for max(1.5 s, 0.6 s + words / 3.2); board length follows the text; with `--beats`, board starts snap to the next downbeat | Studio music bed + SFX |
| **Voice sync** (`voice`) | Talking-head YouTube, narrated explainer, a walkthrough you recorded | Word timestamps: every element lands on the word that names it | The voice, plus a ducked bed if the brief wants one |
| **Voice + words** (`voice`, `"captions": true`) | Social cuts watched muted, accessibility, a noisy proposal room | Word timestamps, plus a kinetic caption track (phrases up to 6 words, numbers and long words lit in the accent) | Same as voice sync |

## Contents

- Where the voice comes from (voice modes)
- The rules (enforced by `sync_cues.py` and `check_board.mjs`)
- The cue plan (`V/docs/cue-plan.json`)
- Commands (from the studio, `V=videos/<slug>`)

## Where the voice comes from (voice modes)

1. **You record it** (the default for YouTube): a phone memo, a mic take or the talking-head video itself. Edit the
   take first; sync to the **final cut**. Then:
   `engine/py <skill>/scripts/transcribe_words.py "V/assets/source/take.mp4" --out V/sync`
2. **An editor's word export** (Descript, Premiere, Resolve transcript as `start / end / word` TSV):
   `... transcribe_words.py --tsv "final cut words.tsv" --out V/sync`
3. **Generated voice** (studio Phase 4b: Kokoro offline, or Fish Audio): generate the lines, join them into one
   `V/assets/voice/voice.wav`, then transcribe that file exactly as in 1. The Phase 4b line-length timing still
   sets the shot list; the words set the landings inside each shot.

Whisper needs the model once (~1.6 GB). Read the low-confidence words it prints: names and numbers are where it
mishears, and a misheard anchor lands nothing. Fix the TSV (never the script), re-run the sync.

## The rules (enforced by `sync_cues.py` and `check_board.mjs`)

Ported from board-sync's rules, each learned from a real review of a board video:

1. **No board opens empty.** Title and structure are there from the first frame; first content by ~0.9 s.
2. **Named things appear when they are named.** Landing = word start + 0.05 s. Never before the word, never more
   than ~2 s after. Anchors are searched in order, tolerating ad-libs between anchor words and number words vs
   digits ("forty" = 40, "five thousand dollars" = $5000).
3. **A part never appears before its container.** Give the part `"in": "<container cue>"` in the plan: it lands at
   least 0.1 s after the box, and if its word comes first the box is pulled to just before it.
4. **Money is not a count.** Stamps only on spoken money and percent; a count with a stamp is flagged.
5. **Nothing static for more than `max_static`** (5 s default, the studio's "something new every 2-4 s" wants 3).
   Sync lists the gap and the presenter's own words heard in it as filler candidates; over 15 s means a new board.
6. **Nothing moves after it lands** (no pulses, bobs, zoom-ins). Emphasis is size, the accent, or a focus/dim
   on its word.
7. **Readable:** text stays up for its read time; text that lands too late for the board's remaining time is flagged.
8. **Copy that contradicts the voice is flagged, never silently changed.** Fix the board or ask; never edit the
   speaker's words.
9. **Ad-libs stay.** Every spoken word stays in the window it falls in; an ad-lib can carry an element.

## The cue plan (`V/docs/cue-plan.json`)

```json
{
  "mode": "voice",
  "captions": false,
  "max_static": 5.0,
  "boards": [
    {"id": "03", "board": "../boards/03-slope.html", "opens_on": "render time",
     "builds": [
       {"cue": "title", "structure": true},
       {"cue": "axes",  "structure": true},
       {"cue": "slope", "anchor": "took four seconds", "land_on": "took"},
       {"cue": "v4",    "anchor": "four seconds", "land_on": "four", "role": "time", "text": "4 s"},
       {"cue": "x10",   "anchor": "ten times slower", "role": "ratio", "move": "stamp", "text": "10x"}
     ]}
  ]
}
```

- `board` paths are relative to the output folder (`V/sync/`). `cue` matches `data-cue` on the board element.
- `opens_on`: the words that start the board (voice). Boards run until the next board opens.
- `text`: the on-screen words, used for the read-time check and for text-mode timing.
- `in`: the cue of the container this element sits in (a row in its card, a label on its bar).
- Text mode ignores `anchor` and `opens_on`; give `"hold"` (s) per board for a longer final hold.

## Commands (from the studio, `V=videos/<slug>`)

```bash
SK=~/.claude/skills/motion-studio/scripts
engine/py $SK/transcribe_words.py V/assets/source/take.mp4 --out V/sync           # voice modes
python3 $SK/sync_cues.py V/docs/cue-plan.json --out V/sync --words V/sync/words.json  # or --mode text --beats V/assets/beats.json
node $SK/check_board.mjs V/sync/timeline.json --out V/qa                            # --camera off for no-presenter films
node $SK/export_boards.mjs V/sync/timeline.json --audio V/sync/voice.wav -o V/out/check-60s.mp4 --first 60
node $SK/export_boards.mjs V/sync/timeline.json -o V/out/silent.mp4 --workers 6     # picture only, for the mix
```

`V/sync/voice.wav` is 16 kHz mono: timing and watch-through previews only. The final sound always goes through the
studio mix (Phase 5 steps 9-11) with the original full-quality take
(`ffmpeg -i take.mp4 -vn -ac 2 -ar 48000 V/assets/voice/voice.wav`), so loudness, true peak and the QA gate still
apply. A talking-head YouTube master in one pass: add `--camera-video V/assets/source/take.mp4` to the export and
the take fills the camera box (cover-cropped, its own audio unless `--audio` is given). Use the mixed voice as
`--audio` for the final. For an editor round-trip instead, ship `silent.mp4` and composite the take in the editor.

Read `V/sync/sync-report.md` and `V/qa/qa-report.md` before every render; every flag is fixed or explained.
`--first 60` renders the first minute to watch before committing to the full render. A killed render resumes when the
same command is re-run (finished parts are kept).
