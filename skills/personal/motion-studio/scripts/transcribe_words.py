#!/usr/bin/env python3
"""transcribe_words.py: a timestamp for every spoken word, for word-synced boards.

  python3 transcribe_words.py V/assets/source/take.mp4 --out V/sync          # your recording (any audio or video)
  python3 transcribe_words.py --tsv "final cut words.tsv" --out V/sync       # an editor's word export instead

Writes V/sync/words.json ([{"w": "It", "t": 0.00, "e": 0.18, "c": 0.97}, ...], seconds on the audio),
V/sync/words.tsv (same, for editors) and V/sync/voice.wav (16 kHz mono, the audio the times refer to).

Uses faster-whisper (large-v3-turbo, word_timestamps on, VAD off so pauses keep their real length). Install it in
the studio's Python once: `engine/py -m pip install faster-whisper` (the first run downloads the model, ~1.6 GB).
Timing is only as good as the take you transcribe: transcribe the FINAL cut, never a pre-edit take, or every cue
after the first cut drifts.
"""
import argparse
import json
import os
import subprocess
import sys


def write(words, out):
    os.makedirs(out, exist_ok=True)
    with open(os.path.join(out, "words.json"), "w", encoding="utf-8") as f:
        json.dump(words, f, indent=0)
    with open(os.path.join(out, "words.tsv"), "w", encoding="utf-8") as f:
        f.write("start\tend\tword\tconfidence\n")
        for w in words:
            f.write(f"{w['t']:.3f}\t{w['e']:.3f}\t{w['w']}\t{w.get('c', 1.0):.2f}\n")
    print(f"{len(words)} words, {words[-1]['e'] if words else 0:.1f} s -> {out}/words.json")


def from_tsv(path):
    rows = [l.rstrip("\n").split("\t") for l in open(path, encoding="utf-8")]
    h = rows[0]
    si, ei, wi = h.index("start"), h.index("end"), h.index("word")
    ci = h.index("confidence") if "confidence" in h else None
    return [{"w": r[wi], "t": float(r[si]), "e": float(r[ei]), "c": float(r[ci]) if ci is not None else 1.0}
            for r in rows[1:] if len(r) > wi and r[wi].strip()]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("media", nargs="?", help="audio or video file of the final take")
    ap.add_argument("--tsv", help="use an editor's word export instead of transcribing")
    ap.add_argument("--out", required=True)
    ap.add_argument("--model", default="large-v3-turbo")
    ap.add_argument("--language", default="en")
    a = ap.parse_args()

    if a.tsv:
        return write(from_tsv(a.tsv), a.out)
    if not a.media:
        ap.error("give a media file or --tsv")
    os.makedirs(a.out, exist_ok=True)
    wav = os.path.join(a.out, "voice.wav")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", a.media, "-vn", "-ac", "1", "-ar", "16000", wav], check=True)
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print("faster-whisper is not installed. In the studio: engine/py -m pip install faster-whisper", file=sys.stderr)
        sys.exit(2)
    model = WhisperModel(a.model, device="auto", compute_type="auto")
    segs, _ = model.transcribe(wav, language=a.language, word_timestamps=True, vad_filter=False)
    words = [{"w": w.word.strip(), "t": round(w.start, 3), "e": round(w.end, 3), "c": round(w.probability, 2)}
             for s in segs for w in (s.words or []) if w.word.strip()]
    low = [w for w in words if w["c"] < 0.5]
    if low:
        print(f"{len(low)} low-confidence words (check names and numbers): "
              + ", ".join(f"{w['w']}@{w['t']:.1f}" for w in low[:12]))
    write(words, a.out)


if __name__ == "__main__":
    main()
