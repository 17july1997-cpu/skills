#!/usr/bin/env bash
# fetch_library.sh: the full explainer board library (74 boards, previews, the board-sync engine) on demand.
#
# The skill ships 16 hero boards in assets/boards/. This pulls the rest from
# sirioberati/YouTube-AI-Motion-Graphics (MIT, (c) 2026 TEIN AI), pinned to the commit the skill was built against,
# into a cache outside the skill and the studio, so neither grows by 20 MB of GIFs.
#
#   bash fetch_library.sh            # prints the library path (clones once, then reuses)
#   bash fetch_library.sh --update   # re-pin to PIN below after reviewing a newer commit
#
# Library layout: boards/*.html (open in Chrome; codes match references/explainer/board-catalog.md),
# skills/board-sync/ (the full Python sync engine with Resolve/Premiere timeline export).
set -euo pipefail
PIN=52b5b94e063439adf083c2a935dc6f727dd7adc7
REPO=https://github.com/sirioberati/YouTube-AI-Motion-Graphics.git
LIB="${MOTION_STUDIO_LIBRARY:-$HOME/.cache/motion-studio/explainer-library}"

if [ ! -d "$LIB/.git" ]; then
  mkdir -p "$(dirname "$LIB")"
  git clone --quiet --filter=blob:none "$REPO" "$LIB" >&2
fi
if [ "$(git -C "$LIB" rev-parse HEAD)" != "$PIN" ] || [ "${1:-}" = "--update" ]; then
  git -C "$LIB" fetch --quiet origin "$PIN" >&2 || git -C "$LIB" fetch --quiet origin >&2
  git -C "$LIB" -c advice.detachedHead=false checkout --quiet "$PIN" >&2
fi
[ -f "$LIB/boards/index.html" ] || { echo "library incomplete at $LIB" >&2; exit 1; }
echo "$LIB"
