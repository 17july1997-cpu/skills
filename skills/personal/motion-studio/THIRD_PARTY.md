# Third-party material

Route E (explainer boards) is built on **YouTube AI Motion Graphics** by Sirio Berati / TEIN AI,
https://github.com/sirioberati/YouTube-AI-Motion-Graphics, commit `52b5b94e063439adf083c2a935dc6f727dd7adc7`,
MIT licence (full text in `assets/boards/LICENSE-TEIN-AI.txt`).

| Here | From | Changes |
|---|---|---|
| `assets/boards/*.html` (16 boards except `board-shell.html`), `assets/boards/brand.css` | `boards/`, `skills/explainer-board-system/assets/brand.css` | none |
| `references/explainer/motion-recipes.md`, `charts.md`, `components.md`, `board-types.md`, `do-dont.md` | `skills/explainer-board-system/references/` | attribution header |
| `references/explainer/layout.md`, `tokens-default.md`, `board-catalog.md` | same | studio additions on top, catalog marks and proposal section |
| `references/explainer/brief-method.md`, `word-sync.md` | `skills/explainer-board-brief/`, `skills/board-sync/references/rules.md` | condensed and retargeted at the studio |
| `scripts/export_boards.mjs` | `tools/export.py` | ported to Node; cue injection, camera compositing, resumable parts kept |
| `scripts/sync_cues.py`, `scripts/check_board.mjs` | the rules of `skills/board-sync/` | new code implementing a subset of the rules |
| `checks.md` | `checks.md` | format kept, rules rewritten for this studio |

Written for this skill (not from the source): `assets/boards/cue-player.js`, `assets/boards/board-shell.html`,
`scripts/transcribe_words.py`, `scripts/fetch_library.sh`, `references/explainer/route-e.md`.

## Installed, not vendored

`scripts/setup_3d_tools.sh` registers two MCP servers at user scope; their code is fetched by `uvx` at the pinned
version and is not part of this skill:

| Server | Package | Source | Licence |
|---|---|---|---|
| `blender` | `mcp-for-blender@2.2.4` | https://github.com/ahujasid/mcp-for-blender (not affiliated with the Blender Foundation) | MIT |
| `unreal` | `uemcp@0.1.0` | https://github.com/ATDev-Inc/uemcp | MIT |
