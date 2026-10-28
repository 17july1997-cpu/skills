#!/usr/bin/env python3
"""sync_cues.py: turn a cue plan into landing times for every board element, plus a timeline and a sync report.

The rules are ported from board-sync in sirioberati/YouTube-AI-Motion-Graphics (MIT, (c) 2026 TEIN AI), simplified
for the studio. Standard library only.

Modes (the plan's "mode", or --mode):
  voice  Every element lands on the word that names it: word start + 0.05 s, never before it. Needs words.json
         (scripts/transcribe_words.py, or an editor's word export). Boards open on their "opens_on" words.
  text   No voice. Each element lands after the previous one has been readable for
         max(1.5 s, 0.6 s + words / 3.2); board length follows the text. With --beats, board starts snap forward
         to the next downbeat, so cuts sit on the music.
Captions ("captions": true in voice mode) add a kinetic word track: phrases of up to 6 words, numbers and long
words lit in the accent colour, drawn by cue-player.js bottom-left (clear of the camera).

  python3 sync_cues.py V/docs/cue-plan.json --out V/sync [--words V/sync/words.json] [--beats V/assets/beats.json]

Writes V/sync/timeline.json (for export_boards.mjs) and V/sync/sync-report.md (flags to fix before rendering).
Exit 0 even with flags; the report is the gate. Exit 2 only when an input is missing.

Cue plan (V/docs/cue-plan.json), written from the brief:
{
  "mode": "voice", "captions": false, "max_static": 5.0,
  "boards": [
    {"id": "03", "board": "../boards/03-slope.html", "opens_on": "render time",
     "builds": [
       {"cue": "title", "structure": true},
       {"cue": "v4",  "anchor": "four seconds", "land_on": "four", "role": "time", "text": "4 s"},
       {"cue": "x10", "anchor": "ten times", "role": "ratio", "move": "stamp", "text": "10x"}
     ]}
  ]
}
"""
import argparse
import json
import os
import re
import sys

UNITS = {w: i for i, w in enumerate(
    "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen "
    "seventeen eighteen nineteen".split())}
TENS = {w: 10 * (i + 2) for i, w in enumerate("twenty thirty forty fifty sixty seventy eighty ninety".split())}
SCALES = {"hundred": 100, "thousand": 1000, "million": 1_000_000, "billion": 1_000_000_000}
STOP = set("the a an and or but of to in on at for with is are was were be been it its this that these those you your "
           "i we they he she my our their so just really very about from into then than there here what which who".split())


def norm_token(w):
    w = w.lower().replace("’", "'")
    w = re.sub(r"[^a-z0-9$%'.]", "", w)
    w = w.strip(".'")
    if re.fullmatch(r"\$?[0-9][0-9,]*(\.[0-9]+)?[k%]?", w):
        w = w.replace(",", "")
    return w


def merge_numbers(tokens):
    """['forty', 'two', 'seconds'] -> ['42', 'seconds']; keeps a map back to the first source index."""
    out, idx, i = [], [], 0
    while i < len(tokens):
        t = tokens[i]
        if t in UNITS or t in TENS or (t in SCALES and out and out[-1].isdigit()):
            total, cur, j = 0, 0, i
            while j < len(tokens) and (tokens[j] in UNITS or tokens[j] in TENS or tokens[j] in SCALES
                                       or (tokens[j] == "and" and j + 1 < len(tokens) and tokens[j + 1] in UNITS)):
                w = tokens[j]
                if w in UNITS: cur += UNITS[w]
                elif w in TENS: cur += TENS[w]
                elif w in SCALES:
                    cur = max(cur, 1) * SCALES[w]
                    if SCALES[w] >= 1000: total, cur = total + cur, 0
                j += 1
            out.append(str(total + cur)); idx.append(i); i = j
        else:
            out.append(t); idx.append(i); i += 1
    return out, idx


def tokens_of(text):
    return merge_numbers([t for t in (norm_token(w) for w in text.split()) if t])[0]


def same(a, b):
    if a == b: return True
    strip = lambda s: s.lstrip("$").rstrip("%k")
    return strip(a) == strip(b) and strip(a) != ""


def find_phrase(words, phrase, lo, hi, gap=2):
    """First match of phrase tokens in words[lo:hi], allowing up to `gap` ad-lib words between tokens.
    Returns the list of matched word indices, or None."""
    want = tokens_of(phrase)
    if not want: return None
    for s in range(lo, hi):
        if not same(words[s]["n"], want[0]): continue
        hit, k = [s], s
        for w in want[1:]:
            nxt = next((j for j in range(k + 1, min(hi, k + 2 + gap)) if same(words[j]["n"], w)), None)
            if nxt is None: break
            hit.append(nxt); k = nxt
        if len(hit) == len(want): return hit
    return None


def load_words(path):
    if path.endswith(".tsv"):
        rows = [l.rstrip("\n").split("\t") for l in open(path, encoding="utf-8")]
        head = rows[0]
        si, ei, wi = head.index("start"), head.index("end"), head.index("word")
        raw = [{"w": r[wi], "t": float(r[si]), "e": float(r[ei])} for r in rows[1:] if len(r) > wi]
    else:
        raw = json.load(open(path, encoding="utf-8"))
    toks = [norm_token(w["w"]) for w in raw]
    merged, idx = merge_numbers(toks)
    words = []
    for m, i in zip(merged, idx):
        if not m: continue
        words.append({"w": raw[i]["w"], "n": m, "t": raw[i]["t"], "e": raw[i]["e"]})
    return words


def read_time(text):
    n = len((text or "").split())
    return max(1.5, 0.6 + n / 3.2)


def captions_for(words, lo, hi, start):
    out, cur = [], []
    def flush():
        if cur:
            out.append({"t": round(cur[0]["t"] - start, 3), "e": round(cur[-1]["e"] - start + 0.25, 3),
                        "words": [{"w": c["w"], "t": round(c["t"] - start, 3),
                                   "hot": bool(re.search(r"\d", c["n"])) or (len(c["n"]) >= 7 and c["n"] not in STOP)}
                                  for c in cur]})
    for k in range(lo, hi):
        w = words[k]
        if cur and (len(cur) >= 6 or w["t"] - cur[-1]["e"] > 0.35 or re.search(r"[.?!,;:]$", cur[-1]["w"])):
            flush(); cur = []
        cur.append(w)
    flush()
    for a, b in zip(out, out[1:]): a["e"] = min(a["e"], b["t"])
    return out


def contain(b, cues, flags):
    """A part never appears before its container ("in": "<container cue>"): it lands >= 0.1 s after the box;
    when the part's word comes first, the box is pulled to 0.1 s before the part (never before 0)."""
    for bu in b.get("builds", []):
        box = bu.get("in")
        if not box or bu["cue"] not in cues: continue
        if box not in cues:
            flags.append(f"board {b['id']}: '{bu['cue']}' is in '{box}', which is not a cue on this board"); continue
        part, cont = cues[bu["cue"]], cues[box]
        if part["t"] < cont["t"] + 0.1:
            cont["t"] = round(max(0.0, part["t"] - 0.1), 3)
            if part["t"] < 0.1: part["t"] = round(cont["t"] + 0.1, 3)
            cont["note"] = f"pulled before its part '{bu['cue']}'"


def plan_voice(plan, words, flags, max_static, end_of_audio):
    boards = plan["boards"]
    # 1. Board windows: each board opens on its opens_on words, searched in order.
    starts, cursor = [], 0
    for b in boards:
        hit = find_phrase(words, b.get("opens_on", ""), cursor, len(words)) if b.get("opens_on") else None
        if hit:
            starts.append(max(0.0, words[hit[0]]["t"] - 0.1)); cursor = hit[0]
        else:
            if b.get("opens_on"): flags.append(f"board {b['id']}: opens_on '{b['opens_on']}' not heard; starts where the previous ends")
            starts.append(None)
    for i, s in enumerate(starts):
        if s is None: starts[i] = 0.0 if i == 0 else starts[i - 1] + 0.01
    ends = starts[1:] + [end_of_audio]
    out = []
    for b, s, e in zip(boards, starts, ends):
        lo = next((k for k, w in enumerate(words) if w["t"] >= s), len(words))
        hi = next((k for k, w in enumerate(words) if w["t"] >= e), len(words))
        cues, land_word, last_t, n_struct = {}, lo, 0.0, 0
        for bu in b.get("builds", []):
            if bu.get("structure") or not bu.get("anchor"):
                if not bu.get("structure"):
                    flags.append(f"board {b['id']}: '{bu['cue']}' has no anchor; it opens with the structure")
                t = 0.0 if n_struct == 0 and bu.get("cue") == "title" else 0.45 + 0.12 * n_struct
                n_struct += 1
                cues[bu["cue"]] = {"t": round(t, 3), "anchor": None}
                continue
            hit = find_phrase(words, bu["anchor"], land_word, hi) or find_phrase(words, bu["anchor"], lo, hi)
            if not hit:
                t = last_t + 0.2
                flags.append(f"board {b['id']}: anchor '{bu['anchor']}' for '{bu['cue']}' not heard in its window; "
                             f"cascades at {t:.2f} s. Fix the anchor in the plan (verbatim words) or the board window.")
                cues[bu["cue"]] = {"t": round(t, 3), "anchor": bu["anchor"], "flag": "anchor not found"}
                last_t = t
                continue
            target = hit[0]
            if bu.get("land_on"):
                want = tokens_of(bu["land_on"])
                target = next((j for j in hit if want and same(words[j]["n"], want[0])), hit[0])
            t = words[target]["t"] - s + 0.05
            siblings = [c["t"] for c in cues.values() if c.get("word_idx") == target]
            if siblings:
                t = max(siblings) + 0.1                    # several elements on one word land 0.1 s apart
            if bu.get("role") == "count" and bu.get("move") == "stamp":
                flags.append(f"board {b['id']}: '{bu['cue']}' is a count but stamps; stamps are for money and percent only")
            cues[bu["cue"]] = {"t": round(t, 3), "anchor": bu["anchor"], "word": words[target]["w"], "word_idx": target}
            land_word, last_t = target, max(last_t, t)
        # 2. Dead stretches: nothing new lands for more than max_static while the voice keeps going.
        times = sorted([0.0] + [c["t"] for c in cues.values()] + [e - s])
        for a, z in zip(times, times[1:]):
            if z - a > max_static:
                spoken = [w for w in words[lo:hi] if a + s <= w["t"] < z + s]
                cand = [w["w"].strip(".,!?;:") for w in spoken if re.search(r"\d", w["n"]) or (len(w["n"]) >= 5 and w["n"] not in STOP)]
                kind = "propose a new board" if z - a > 15 else "add a build step or a filler note"
                flags.append(f"board {b['id']}: {z - a:.1f} s static from {a:.1f} to {z:.1f} s; {kind}. "
                             f"Filler words heard there: {', '.join(cand[:6]) or 'none'}")
        # 3. Read time: text that lands too late to be read before the board leaves.
        for bu in b.get("builds", []):
            c = cues.get(bu["cue"])
            if c and bu.get("text") and (e - s) - c["t"] < read_time(bu["text"]):
                flags.append(f"board {b['id']}: '{bu['cue']}' is on screen {(e - s) - c['t']:.1f} s, needs "
                             f"{read_time(bu['text']):.1f} s to read; land it earlier or carry it onto the next board")
        contain(b, cues, flags)
        for c in cues.values(): c.pop("word_idx", None)
        entry = {"id": b["id"], "board": b["board"], "start": round(s, 3), "end": round(e, 3), "cues": cues}
        if plan.get("captions"): entry["captions"] = captions_for(words, lo, hi, s)
        out.append(entry)
    return out


def plan_text(plan, beats, flags):
    out, t_board = [], 0.0
    downbeats = sorted(beats.get("downbeats", [])) if beats else []
    for b in plan["boards"]:
        if downbeats:
            snap = next((d for d in downbeats if d >= t_board - 1e-6), None)
            if snap is not None and snap - t_board < 1.0:
                if out: out[-1]["end"] = round(snap, 3)          # the previous board holds until the downbeat
                t_board = snap
        cues, t, prev_read, n_struct = {}, 0.0, 0.0, 0
        for bu in b.get("builds", []):
            if bu.get("structure"):
                cues[bu["cue"]] = {"t": round(0.0 if bu.get("cue") == "title" else 0.45 + 0.12 * n_struct, 3), "anchor": None}
                n_struct += 1
                continue
            t = max(0.9, t + prev_read) if cues else 0.9
            cues[bu["cue"]] = {"t": round(t, 3), "word": "reading pace"}
            prev_read = max(0.6, read_time(bu.get("text", "")) if bu.get("text") else 0.8)
        contain(b, cues, flags)
        length = max(3.0, t + prev_read + float(b.get("hold", 1.5)))
        if length > 5 and len([c for c in cues.values() if c["t"] > 0]) < 2:
            flags.append(f"board {b['id']}: {length:.1f} s with one landing; split it or add a build step")
        out.append({"id": b["id"], "board": b["board"], "start": round(t_board, 3),
                    "end": round(t_board + length, 3), "cues": cues})
        t_board += length
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("plan")
    ap.add_argument("--out", required=True)
    ap.add_argument("--words", help="words.json or an editor words.tsv (voice mode)")
    ap.add_argument("--beats", help="beats.json from the studio beat grid (text mode snaps board starts to downbeats)")
    ap.add_argument("--mode", choices=["voice", "text"])
    ap.add_argument("--audio-end", type=float, help="audio length in seconds (default: last word end + 1 s)")
    a = ap.parse_args()

    plan = json.load(open(a.plan, encoding="utf-8"))
    mode = a.mode or plan.get("mode", "voice")
    max_static = float(plan.get("max_static", 5.0))
    flags = []
    if mode == "voice":
        wpath = a.words or plan.get("words")
        if not wpath or not os.path.exists(wpath):
            print("voice mode needs --words (run transcribe_words.py first)", file=sys.stderr); sys.exit(2)
        words = load_words(wpath)
        end = a.audio_end or (words[-1]["e"] + 1.0 if words else 0.0)
        timeline = plan_voice(plan, words, flags, max_static, end)
    else:
        beats = json.load(open(a.beats)) if a.beats else None
        timeline = plan_text(plan, beats, flags)

    os.makedirs(a.out, exist_ok=True)
    with open(os.path.join(a.out, "timeline.json"), "w", encoding="utf-8") as f:
        json.dump(timeline, f, indent=1)
    lines = [f"# Sync report ({mode} mode)", "",
             f"{len(timeline)} boards, {timeline[-1]['end'] if timeline else 0:.2f} s total. "
             f"{len(flags)} flag(s). Fix every flag, re-run, then render.", "",
             "| Board | Start | End | Element | Lands (board s) | On word |", "|---|---|---|---|---|---|"]
    for e in timeline:
        for k, c in e["cues"].items():
            lines.append(f"| {e['id']} | {e['start']:.2f} | {e['end']:.2f} | {k} | {c['t']:.2f} | "
                         f"{c.get('word') or ('structure' if c.get('anchor') is None else c.get('flag', ''))} |")
    lines += ["", "## Flags", ""] + ([f"- {f}" for f in flags] or ["- none"])
    with open(os.path.join(a.out, "sync-report.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print(f"{mode}: {len(timeline)} boards, {len(flags)} flag(s) -> {a.out}/timeline.json, sync-report.md")


if __name__ == "__main__":
    main()
