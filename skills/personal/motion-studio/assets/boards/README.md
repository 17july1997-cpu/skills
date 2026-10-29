# Boards

- `board-shell.html`, `cue-player.js`: the starting point and runtime for every route-E board (written for the studio).
- `brand.css`: the default "Clean minimal" theme. Override it per video with `board-theme.css`; never ship it as the look.
- The other 16 `.html` files are catalog boards from sirioberati/YouTube-AI-Motion-Graphics (MIT, see
  `LICENSE-TEIN-AI.txt`): open them in Chrome to see the layout and motion, then rebuild on the shell. Their camera
  box points at `assets/camera.mp4`, which is not shipped; it renders as the empty dark box.
- The remaining 58 boards: `bash ../../scripts/fetch_library.sh`.
