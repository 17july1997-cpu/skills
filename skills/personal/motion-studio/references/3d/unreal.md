# Route G: Unreal Engine

Cinematic environments in Unreal Engine 5 through the UEMCP server: build the level and a Level Sequence
conversationally, render with Movie Render Queue, bring the frames into the studio. Setup:
`bash SK/scripts/setup_3d_tools.sh --unreal` (server `uemcp@0.1.0`, MIT, Unreal's built-in Python remote
execution, nothing to compile).

## Contents

- When route G wins
- Before the first tool call
- Build (MCP)
- Time it to the beat or the word
- Render
- Into the studio
- Failure modes

## When route G wins

- A world, not an object: an environment fly-through, an architectural walkthrough (a build project, a venue,
  an expo floor), a product in a real-time-lit set, virtual production plates.
- Large scenes or Quixel/Fab assets that Blender would choke on.
- Not route G: a single object or logo (route F is faster), anything the browser can carry (routes A, E,
  Three.js). Unreal is the heaviest route: say so in the route question, with the cost.

## Before the first tool call

1. `bash SK/scripts/setup_3d_tools.sh --check`. Missing `unreal` server: ask once (4 options: install now
   (Recommended), use Blender instead, use pre-rendered footage, skip 3D), then `--unreal`.
2. Per project, once: Python Editor Script Plugin and Movie Render Queue enabled, "Enable Remote Execution" ticked
   (the setup script prints the steps). The editor must be open on the project.
3. The project is under source control before the session (UEMCP can modify and delete content). Withhold
   `ue_save_all` until a checkpoint is reviewed.
4. Real assets only: the client's CAD or scans, the brand's real logo. Sketchfab and AI generation
   (`ue_generate_model`) only for props that represent nothing real, and the brief says so.

## Build (MCP)

- `ue_status`, then `ue_project_info`. Block out with `ue_spawn_actor` and `ue_batch_edit`; check every step with
  `ue_screenshot` from the shot camera (`ue_set_camera`), read as a harsh director.
- Materials (`ue_create_material_instance`, `ue_assign_material`), then light, then the camera move in a Level
  Sequence. `ue_python` covers anything the dedicated tools do not (Sequencer keys, Movie Pipeline settings).
- Distances are centimetres, rotations `[roll, pitch, yaw]` degrees, colours 0 to 1.

## Time it to the beat or the word

Same rule as route F: Sequencer keys sit on frames computed from `V/assets/beats.json` (frame = round(t × fps)) or
from cue times in `V/sync/timeline.json`. Set the sequence's display rate to the brief's fps before keying.

## Render

- `ue_render_sequence` with `output_format: "png"` (or `"prores"` for a dependency-free .mov), the brief's
  resolution and fps. In-editor mode by default; `headless: true` renders in a separate `UnrealEditor-Cmd` process.
- The render tool is marked **experimental** by its authors (not yet exercised against a live editor). Treat the
  first render of every project as a test: check `frame_count` against shot length × fps, read a contact sheet of
  the frames. If it fails, render from the editor's Movie Render Queue window with the same settings and say so.
- Anti-aliasing: temporal sample count of 8 or more for finals (motion blur and no shimmering edges); warm-up
  frames on, so the first frames are not under-exposed.

## Into the studio

As route F: a PNG sequence or ProRes plate, placed by t in route A, or a hero tile in route E. Sound, mix and QA
are the studio's.

## Failure modes

| Failure | Fix |
|---|---|
| `ue_status` cannot find the editor | Remote Execution not ticked, editor not open, or a VPN blocking multicast (UEMCP's troubleshooting doc). |
| Several editors open, wrong project driven | Re-register the server with `-e UEMCP_PROJECT=<name>`. |
| `mp4` output produced only frames | Unreal has no built-in mp4 encoder; use `png` and the studio's ffmpeg, or `prores`. |
| First frames dark or blurred | Enable warm-up frames in the Movie Pipeline config. |
| Content deleted by a tool call | Revert from source control; next time withhold `ue_save_all` until reviewed. |
