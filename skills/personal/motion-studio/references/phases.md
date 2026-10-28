# motion-studio: execution manual

`STUDIO` is the folder the resolver in `SKILL.md` printed (step 0 of "Before anything"). On Windows every command here runs in Git Bash, which Claude Code on Windows uses for its shell, and `engine/py` is the engine's Python on both systems (never call `python3` or a `.venv` path directly). Every path below is relative to it, and `V=videos/<slug>` is the video's folder. The command reference is `engine/README.md`.

---

## Phase 0: Home

1. **Pick a slug** from the request: lowercase and hyphenated, for example `loxa-dusk-post-purchase`. Run `engine/new-video.sh <slug>`. If the slug already exists, ask whether to resume (`--resume`) or use a new slug.
2. **Study the source material before asking anything.** Recommendations are only as good as what you have seen.
   - **An MP4 or video URL.** Copy it into `V/assets/source/` and never move the original. Download a URL with `yt-dlp --js-runtimes node`.
     - Probe it with `ffprobe`.
     - Extract one frame every 0.5s into `V/assets/source-frames/`.
     - Tile them into contact sheets and read them.
     - Write `V/docs/source-notes.md`:
       - the shot list with timestamps;
       - all on-screen copy, verbatim;
       - the UI screens and states shown;
       - the palette, pacing and audio;
       - a baseline score on the 7 critique axes (annex section C).
   - **A product URL.** Use Playwright to capture real screenshots, the logo, colours and fonts into `V/assets/`. List what you found.
   - **A deck, PDF or notes.** Extract the facts and the copy into `V/docs/source-notes.md`.
   - **A brand.** Read `brands/<brand>/brand.md`. If the brand has no kit, the kit becomes a gap to fill in Phase 1.
3. **Read `index.md`.** Earlier videos for the same brand set the house look. Recommend continuity unless the user says otherwise.
4. **For a recreation, find the original build first.** Grep the working folders for a unique on-screen string from the source, such as an order number, a URL or a price: `grep -rl "<string>" ~/Desktop/WORK ~/Downloads`. The original package usually holds:
   - full-resolution screenshots;
   - the config with every fact;
   - a learnings file of approved house rules.

   Copy what you need into `V/assets/real/` and read the rest in place. On the Dusk proof run this was the biggest quality unlock. Never write into another workstream's folder.

## Phase 1: Grill the idea

The goal is the complete Idea Brief (annex section A). The method is the house format: batched multiple-choice rounds.

- **One round is one `AskUserQuestion` call** with up to 4 questions. Each question has exactly 4 options: the recommended option first, labelled `(Recommended)`, then the rest sorted from most to least likely. Each option's `description` says what the video becomes if the user picks it, and what that costs (length, time, money, risk).
- **Recommendations come from evidence,** in this order:
  1. the source material;
  2. the brand kit;
  3. past videos in `index.md`;
  4. the knowledge base (`knowledge/prompt-library.md` lists the patterns that worked);
  5. general craft.

  A recommendation with no evidence behind it is a guess. Say so in its description.
- **Round 1, the idea:**
  - purpose and audience;
  - the one feeling or action at the end;
  - length and format;
  - the story shape.
- **Round 2, the look and the material:**
  - the hook in the first 2 seconds;
  - the look or reference;
  - which real assets to use;
  - the CTA or end card.
- **Round 3, sound and delivery,** only for whatever is still open:
  - music feel and BPM;
  - voice on or off;
  - where it ships and in which extra formats;
  - constraints such as a deadline, must-say lines or must-avoid lines.
- **Skip what is already settled.** Never re-ask something the request, the source or an earlier round already answered. Fold it into the brief as a stated assumption instead.
- **Read answers carefully.** "Other" answers and notes change the next round: follow what they say, not what you expected.
- **Stop when every checklist item has an answer or a stated assumption.** That is usually 2 to 3 rounds. Do not pad rounds to reach a number.
- **Log each round in `V/interview.md`:** the questions, the options as offered, the choice, and any notes.

The annex section B question banks give worked examples per video type. Adapt them; do not paste them.

## Phase 2: Brief

1. **Fill `V/brief.md` from the checklist.** Every on-screen fact gets a source tag: `(source: frame t=00:12)`, `(source: user, round 2)`, or `(source: brand kit)`.
2. **Play it back in 5 lines:**
   - the film in one line;
   - who it is for, and what they feel or do at the end;
   - length, formats and fps;
   - the look;
   - the sound.
3. **Get the OK with one `AskUserQuestion`.** The 4 options are:
   - "Brief is right, build it (Recommended)";
   - "Change the story";
   - "Change the look or sound";
   - "Something is factually wrong".

## Phase 3: Route

1. Walk the "How the motion-studio skill picks" questions in `knowledge/framework-decision-matrix.md` against the brief. The first decisive answer wins.
2. Write the route, the reason, and the bootstrap commands into `V/brief.md` under "Route decision (and why)".
3. Prefer routes marked "built in studio" or "smoke-tested". A "documented" route is installed now, inside `V/`, never globally, at the pinned version. A "not wired" route (mixed video-model) needs the user's budget and keys first: ask.
4. **Mixed routes are normal.** For example: footage edit (D) with route-A animated inserts; Manim shots inside a route-A branded film.

## Phase 4: Build questions

Ask one more round only if the route created gaps. Typical gaps:

- the track (supplied or synthesized);
- which real screens to use;
- formats beyond the first;
- voice provider availability;
- a budget for paid APIs.

Skip this round when nothing is open.

### 4b: Voice branch (only when voice is on)

1. Write the voiceover script per shot in `V/docs/voice-script.md`, in the brand's voice rules. Show it to the user and get it approved, with 4 options as usual.
2. **Pick the voice route.** Check whether the Fish Audio MCP tools are available (search for them).
   - **The free local route.** If Fish is missing, this always works:

     ```bash
     HYPERFRAMES_PYTHON="$(engine/py -c 'import sys; print(sys.executable)')" HYPERFRAMES_SKIP_SKILLS=1 npx -y hyperframes@<pinned> tts "<line>" -v bf_emma -o V/assets/voice/NN.wav < /dev/null
     ```

     It runs Kokoro TTS offline: British voices `bf_emma`, `bf_isabella` and `bm_george`, US voices `af_*` and `am_*`. It needs `kokoro-onnx` in the engine venv, which `requirements.txt` pins.
   - **Never generate voice in a `while read` loop without `< /dev/null`.** `npx` swallows the loop's stdin and silently stops after the first line.
   - **If Fish is missing and the user wants Fish**, offer:
   - captions instead;
   - no voice;
   - wait while the user connects the connector (Settings, Connectors, add the Fish Audio MCP URL);
   - ElevenLabs, if the user has it.

   Never handle keys.
3. Generate each line, save it to `V/assets/voice/NN.wav`, and measure each duration with `ffprobe`.
4. Build shot timing around the measured line lengths, and do it before the shot list is approved, so nothing is re-cut afterwards.
5. **A talking character.** The proof-run pattern is the brand's own logo brought to life.
   - **The face goes on a free area of the logo,** never over the letterforms, and the logo only moves as a whole: scale, slight tilt and position, with no squash and stretch.
   - **The mouth is driven by an RMS envelope of the placed voice track.** That is one value per frame, written by a small `src/audio.py`; see `videos/loxa-dusk-post-purchase/src/audio.py`.
   - **Seed the blinks.**
   - **A new mascot is a brand decision.** Flag it for sign-off.

## Phase 5: Pipeline

Route A is shown here. Other routes keep the same gates, the same audio and the same QA, and swap only the render step.

1. **Assets.** Everything local in `V/assets/`: real UI crops, logos copied from `brands/`, fonts.
   - Crop UI from source frames at the highest resolution available.
   - Never scale a crop past 1.25x. Frame it smaller instead.
2. **Style guide, `V/docs/style_guide.md`.** It covers:
   - the palette (hex);
   - type (families, weights, tracking);
   - spring feels per element class;
   - shot lengths;
   - transition grammar;
   - texture;
   - how text enters and exits;
   - the banned looks.

   If there is a reference, take its grammar and never its content (see `refs/README.md`).
3. **Beat grid.**
   - **Supplied track:** `engine/py engine/audio/beats.py track.wav > V/assets/beats.json`.
   - **Otherwise:** `node engine/audio/synth.mjs score --bpm <bpm> --bars <n> --plan V/assets/plan.json --dur <sec> --out V/assets/music.wav --beats V/assets/beats.json`.

   Bars at 120 BPM last 2s each, so a 64s film is 32 bars. Choose the BPM so that scene changes fall on downbeats.
4. **Shot list, `V/docs/shotlist.md`** (annex section D). One row per shot, on the beat grid, with:
   - beat, start and end times;
   - what is on screen;
   - the exact copy;
   - the motion;
   - the SFX cue;
   - the source of every fact.

   Show it to the user as a table. **This is the OK gate:** use one `AskUserQuestion` with 4 options (approve; change pacing; change content; change look).
5. **Build `V/src/index.html`** from the scaffolded template.
   - Write scenes as objects in `SCENES`. Write motion with `/engine/lib/motion.js`:
     - `ease()` with a named feel;
     - `track()` for values with several targets;
     - `swapAlpha()` for content inside morphing containers;
     - `sceneAt()` and `pulse()` for beat accents.
   - Declare fonts with `@font-face` pointing at `/brands/<brand>/assets/fonts/...`, and list them in `FONTS`.
   - Keep everything a pure function of `t`.
   - For long films (over about 45s), split scenes into `V/src/scenes/*.js` modules and write `V/docs/ANIMATION_GUIDE.md` first. If you parallelise scene work across subagents, each one reads the guide so the style stays consistent.
6. **Stills and contact sheet.** For the fastest pass, run `node engine/render.mjs --page V/src/index.html --stills t1,t2,... --out-dir <scratch>`, which writes one PNG per time, and tile them with PIL. This ffmpeg build has no `drawtext`, so put labels on with PIL. Otherwise do a fast draft (`--fps 30 --sub 1`) and run `engine/qa/critique.sh` on it. The contact sheet is the stills pass. For one exact frame, use `ffmpeg -ss <t> -i V/out/draft.mp4 -frames:v 1 V/out/still-<t>.png`. `--probe` is only a purity check: it prints hashes, not images.
7. **Critique loop** (annex section C), at least 3 rounds, until every axis scores 8 or above.
   - **Draft each round fast:** `node engine/render.mjs --page V/src/index.html --fps 30 --sub 1 --out V/out/draft.mp4`.
   - **Then sheet it:** `engine/qa/critique.sh V/out/draft.mp4 --strip-at <fastest move>`.
   - **Read the sheets with the Read tool** (`contact.png`, `strip.png`, `phone.png`), as a harsh motion director, not a proud author.
   - **Log the round** in `V/docs/review_log.md` (annex section E): the scores, the 3 biggest problems with timestamps, and the fixes.
   - **Hunt specifically for:**
     - text overlapping during swaps;
     - anything sliding instead of easing;
     - corner labels and frame borders;
     - centered-on-gradient shots;
     - blurry scaled text;
     - a dead beat with nothing happening;
     - unreadable text at 360px;
     - a stutter at the loop seam;
     - any frame where the copy contradicts the source.
   - **If a round improves nothing,** change the approach, not the numbers. After 2 flat rounds below 8, stop and show the user the blocking frame with 4 options.
8. **Full render.** Budget the time:
   - capture runs at about 10 frames per second of 1080p DOM;
   - a 67s draft (30fps, `--sub 1`) takes about 3.5 min;
   - the final (60fps, `--sub 6`) takes about 107 min single-process, because of six captures plus a JS decode and average per frame.

   Use `render-parallel.mjs` for finals: 6 workers turned a projected 107-minute render into 10 minutes on the Dusk proof run. The command: `node engine/render-parallel.mjs --page V/src/index.html --workers 6 --fps <fps> --sub <4 to 8> --out V/out/silent.mp4`. Long renders run in the background; use the Bash tool's `run_in_background`.
9. **Sound pass.**
   - Write `V/assets/cues.json`: hits on beats and downbeats, a click on every cursor press, a whoosh on every container change, a thump on the logo.
   - Render the SFX: `node engine/audio/synth.mjs sfx V/assets/cues.json --out V/assets/sfx.wav --dur <sec>`.
   - Verify placement on the isolated stem: `engine/py engine/audio/beats.py V/assets/sfx.wav --onsets-only`. Compare against the cues and fix any that are more than 1 frame off.
10. **Mix:** `engine/audio/mix.sh V/out/silent.mp4 V/assets/music.wav V/assets/sfx.wav <voice.wav or -> V/out/final.mp4`.
11. **QA:** `engine/qa/critique.sh V/out/final.mp4 --manifest V/out/silent.render.json`. Check:
    - the duration, fps and resolution against the brief;
    - integrated loudness of -14 LUFS, plus or minus 1;
    - true peak at or below -1 dBTP;
    - determinism PASS.

    Read the final sheets once more.

## Phase 6: Ship

1. **Write the deliverables:**
   - `V/out/final.mp4`;
   - `V/out/contact.png`, copied from `critique/`;
   - `V/out/poster.png`, the strongest frame, from `ffmpeg -ss <t> -i final.mp4 -frames:v 1`;
   - `V/out/before-after.png`, the source contact sheet stacked over the new one, for a recreation.
2. **Fill `V/ARTIFACT-MAP.md`** if anything beyond the default list was retained.
3. **Add a row** to the Videos table in `index.md`.
4. **Open it:** `open "V/out/final.mp4"` (and `before-after.png` for a recreation).
5. **Get the verdict** with one `AskUserQuestion`: "Ship it (Recommended)", "Fix motion", "Fix copy or facts", "Fix sound". Anything other than ship loops back to the critique loop with the user's note as round N+1's first problem.
6. **Write the report** in the shape set out in `SKILL.md` Output.
7. **Formats beyond the first** come from the same timeline. Re-render with `layout('9:16')` and the other formats, and reframe rather than crop.
