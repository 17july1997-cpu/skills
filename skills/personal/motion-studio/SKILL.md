---
name: motion-studio
description: "The director for every motion graphics video the user makes. Grills the idea out in rounds of up to 4 multiple-choice questions (4 options, recommended first), writes the brief, picks the render route itself (owned seek(t) engine, explainer boards, Remotion, HyperFrames, Manim, hand-drawn, Three.js, video-model mix, footage edit), then builds it in the Motion Graphics studio through gated stages with a critique loop to 8+, synthesized sound and a -14 LUFS mix. Explainer boards (diagrams, charts, numbers, comparisons) land on the words that name them, synced to a recorded or generated voice, or timed at reading pace with no voice. Use whenever the user wants a video, motion graphics, animation, YouTube explainer, talking-head boards, launch film, product reel, proposal or pitch video, showreel, promo or social clip; wants visuals synced to their voice; wants a video recreated, improved or re-cut; or says make a video, animate this, turn this into a video. Not for editing the studio engine itself."
---

# motion-studio

`STUDIO` is the studio folder. Find it with the resolver below (step 0 of "Before anything"): `$MOTION_STUDIO` if it is set (no fallback, so a wrong value fails loudly), otherwise the first of `~/Desktop/WORK/SKILLS/Motion Graphics` (the maintainer's studio) and `~/loxa-agent-resources/motion-studio` (where the team install puts it, per the Loxa packaging standard). A folder counts only if `engine/render.mjs` exists and `engine/README.md` carries `ENGINE_VERSION=`.

The prompt is 10% of a video. The other 90% is the harness, and the harness lives in the studio:

- a deterministic `seek(t)` render engine;
- closed-form springs;
- a beat grid;
- sound synthesized in code;
- a critique loop where you look at your own frames until every score is 8 or above;
- for explainers, a board system where every element lands on the word that names it (route E, shipped inside this
  skill, so it works even before the studio knows about it).

Your job is to get the idea out of the user's head, choose the route, and build the video well. The user does not need to know which framework fits a video.

## Before anything

0. **Find the studio.** Run the resolver and use the path it prints for every `$STUDIO` below:

```bash
ms_find() { if [ -n "${MOTION_STUDIO:-}" ]; then set -- "$MOTION_STUDIO"; else set -- "$HOME/Desktop/WORK/SKILLS/Motion Graphics" "$HOME/loxa-agent-resources/motion-studio"; fi; for d; do [ -f "$d/engine/render.mjs" ] && grep -q '^ENGINE_VERSION=' "$d/engine/README.md" 2>/dev/null && { printf '%s\n' "$d"; return 0; }; done; return 1; }; STUDIO="$(ms_find)"; echo "STUDIO=$STUDIO"
```

   If it prints an empty path, stop. Tell the user the studio is not installed and give them the install line from annex section R.
1. **Read `$STUDIO/index.md`, then `$STUDIO/CLAUDE.md`, then this skill's `checks.md`.** The house rules and the
   taste file bind every video. `SK` below is this skill's own folder (where this `SKILL.md` lives).
2. **Check the studio is intact.** `$STUDIO/engine/README.md` must contain `ENGINE_VERSION=1.0.0` or later. If the check fails, stop and give the install and relocation steps in `references/annex.md` (section R).
3. **Load references only when needed.** `references/phases.md` is the execution manual: load it now. Load `references/annex.md` when you write questions, the brief, the shot list or the review log. Load `references/explainer/route-e.md` when route E is a candidate (Phase 3), and the files it points to only at the step that needs them.

## Route E files (read each only at the step named)

| File | Read when |
|---|---|
| `references/explainer/route-e.md` | Phase 3, deciding the route; then as the route-E manual (E1-E8) |
| `references/explainer/brief-method.md` | E1, planning boards from a transcript or copy deck |
| `references/explainer/board-catalog.md` | E3, matching a line to a board ("say it when" tags) |
| `references/explainer/tokens-default.md` | E2, theming boards from the brand kit or the style step |
| `references/explainer/layout.md` | E4, canvas, camera zone, formats, end screen |
| `references/explainer/components.md`, `charts.md`, `motion-recipes.md` | E4, building a specific component, chart or move |
| `references/explainer/word-sync.md` | 4c and E5-E7, sync modes, the cue plan, every command |
| `checks.md` | Before every build and every contact sheet; append every correction |
| `THIRD_PARTY.md` | Before redistributing the skill (MIT attribution) |

Scripts live in `SK/scripts/` (`transcribe_words.py`, `sync_cues.py`, `check_board.mjs`, `export_boards.mjs`,
`fetch_library.sh`); the Python and Node scripts print their usage with `--help` or no arguments.

## The flow (detail in `references/phases.md`)

| Phase | What happens | Gate |
|---|---|---|
| 0 Home | Scaffold `videos/<slug>/` with `engine/new-video.sh`. Study any source material first: a URL, MP4, deck or screenshots. | None |
| 1 Grill the idea | Rounds of up to 4 questions per `AskUserQuestion` call, 4 options each, the recommended option first and sorted. Infer recommendations from the source, the brand kit and past videos. Keep going until the Idea Brief checklist is complete, usually in 2 to 3 rounds. Log every round in `interview.md`. | Checklist complete |
| 2 Brief | Write `brief.md` and play it back in 5 lines. | The user says OK |
| 3 Route | Check route E (`references/explainer/route-e.md`, "When route E wins") first, then the studio's `knowledge/framework-decision-matrix.md`. Write the decision and the reason into the brief. | Explicit, never the model's default |
| 4 Build questions | One more round, only for gaps the route created. 4b: if voice is on, write the script and generate the voice before the shot list. 4c: pick the sync mode (words only, voice sync, voice + words). | None |
| 5 Pipeline | Assets, then `style_guide.md`, then `beats.json`, then `shotlist.md` on the beat grid. The user approves the shot list. Then stills and contact sheet, the critique loop until every axis is 8+, a draft render, the full render, the sound pass, and the mix and QA. Route E swaps the shot list for the board brief and cue plan, and adds sync and board QA (steps E1-E8). | Shot list (or board list) OK; sync and QA reports clean; critique 8+ |
| 6 Ship | `out/final.mp4`, `contact.png`, `poster.png`. Add a row to `index.md`, open the final, and name the next improvement. The user's viewing is the verdict. | The user's verdict |

## Hard rules

- **Ask in the house format.** Every question goes through `AskUserQuestion`: up to 4 questions per call, exactly 4 options each, the recommended option first and labelled `(Recommended)`, sorted from most to least likely, and each option's `description` stating what happens and what it costs. Never write your own "Other" option. Ask everything a round needs in one call, never one question at a time.
- **Ask, don't guess.** If an answer would change the video and you cannot infer it, ask it. If you can infer it, recommend it, and still let the user confirm it inside a round.
- **Every correction becomes a rule.** When the user fixes anything, add it to `checks.md` as a DO or DON'T before moving on, and check later frames against it.
- **Land on the word.** In a synced film nothing appears before the word that names it, and nothing sits still for more than 5 seconds while the voice talks.
- **Never ship a template look.** The default board theme is a scaffold; theme it from the brand kit or the style step.
- **Never invent facts.** No product fact, price, rate or claim on screen unless it comes from the source material or from the user.
- **Never redraw a real product UI.** Use real screenshots, the source video's frames, and the real logos from `brands/`.
- **Choose the route explicitly.** Always pick it from the matrix and say why.
- **Look before you show.** Read the contact sheet, the strip and the phone sheet before you present anything. Scores are working notes. Plateaus get surfaced, never inflated.
- **Be honest about audio.** You cannot hear. Say the mix needs the user's ears, and verify SFX placement by onset detection on the isolated stem.
- **No em dashes, anywhere.** Not on screen, not in files.
- **Never touch credentials.** Voice runs through the Fish Audio MCP, which the user connects themselves. Never type or paste API keys.
- **Keep every file inside `videos/<slug>/`.** Studio-wide changes (engine, brands, knowledge) need the studio owner's go-ahead.
- **This skill is the front door for video.** The studio's installed framework skills (`hyperframes`, `remotion-*`, `product-launch-video` and the rest) are tools you call after the route decision, even when they describe themselves as the mandatory entry point.

## Output

At the end, write one short report. It covers:

- where the final is, and that it was opened;
- the last round's scores (with the Sync axis for synced films);
- what the critique loop fixed;
- what still needs the user's eyes or ears;
- the one improvement you would make next.
