# Route F: Blender

Real 3D through the Blender MCP server: build and check the scene conversationally, render the frames
deterministically from the command line, then bring them into the studio as a plate. Setup:
`bash SK/scripts/setup_3d_tools.sh --blender` (server `mcp-for-blender@2.2.4`, MIT, not by the Blender Foundation;
registered with telemetry off and safe mode on).

## Contents

- When route F wins
- Before the first tool call
- Build (MCP)
- Time it to the beat or the word
- Render (command line, not MCP)
- Into the studio
- Failure modes

## When route F wins

- A product, object or logo must look physically real: PBR materials, glass, metal, soft shadows, depth of field.
- A 3D title or hero sequence (the source repo's P202 "3D chrome title" final pass), an isometric scene, an exploded
  view of a physical thing, an abstract loop with real lighting.
- Not route F: flat or UI motion (route A), information boards (route E), a 3D look the browser can carry
  (Three.js is lighter and already deterministic in the studio), large walkable worlds (route G, Unreal).

## Before the first tool call

1. `bash SK/scripts/setup_3d_tools.sh --check`. If the `blender` server is missing, ask once (4 options: install
   now (Recommended), use Three.js instead, use the official Blender Lab server, skip 3D), then run `--blender` and
   tell the user to open Blender and restart Claude Code.
2. Blender must be open with the add-on server running (N panel > MCP for Blender). Only one Blender MCP server at
   a time: the official Blender Lab server uses the same port, 9876.
3. Every scene lives in `V/3d/<scene>.blend`. Save before every `execute_blender_code` call that changes more than
   one object: generated code runs inside Blender, and undo history does not survive a crash.
4. Real assets only, as everywhere in the studio: the product's own CAD or photogrammetry, the brand's logo as
   SVG (import and extrude), never an AI-generated stand-in for a real product. Poly Haven HDRIs and textures
   are fine for environment and surfaces; asset generators (Meshy, Tripo, Rodin) only for props that represent
   nothing real, and the brief says so.

## Build (MCP)

- Block out first: camera, the hero object, one key light, the ground. Check with a viewport screenshot from the
  shot's own camera before any material work.
- Materials and light next; then the camera move. Read every screenshot as a harsh director, exactly as in the
  critique loop (annex C): composition, readability of any text at 360 px, brand accuracy of colours.
- Set the scene up for the brief before any keyframe: `scene.render.fps` = brief fps, resolution = the format,
  frame range = shot length × fps, colour management Filmic/AgX as the style guide says, `film_transparent = True`
  when the shot is composited over a studio background.

## Time it to the beat or the word

Keyframes come from the same timing files as every other route, never from eyeballing:

- Beat grid: frame = round(beat_time × fps) + 1 (Blender frames start at 1). Camera moves start on a downbeat and
  land on the next.
- Word sync: a cue time from `V/sync/timeline.json` (board start + cue) becomes the frame where the element
  arrives. "Never before the word" holds in 3D too.
- Eases: Blender's default Bezier ease is the studio's "power2.inOut" feel; for springs use the studio's
  closed-form values baked as keys, not physics.

## Render (command line, not MCP)

The final frames come from Blender's command line, so a render is reproducible and never depends on a live chat:

```bash
blender -b V/3d/<scene>.blend -o "V/3d/frames/<scene>_####" -F PNG -x 1 -s 1 -e <N> -a
```

- Cycles for realism (fixed seed, no animated noise seed), EEVEE for speed; the style guide says which.
- `-F PNG` with an alpha film for compositing; `OPEN_EXR` only when grading later.
- Check: the frame count equals the shot length × fps; read a contact sheet of every 10th frame.
- Draft first at 50 % resolution and low samples; the final only after the critique loop passes.

## Into the studio

- Route A: the PNG sequence is a plate; place it in `V/src/index.html` as an image sequence keyed to t
  (frame = floor(t × fps)), so the page stays a pure function of t. Or encode it first:
  `ffmpeg -framerate <fps> -i frames/<scene>_%04d.png -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le plate.mov`.
- Route E: a 3D object can be a board's hero tile (a video tile seeked by cue-player).
- Sound, mix and QA are the studio's, unchanged.

## Failure modes

| Failure | Fix |
|---|---|
| Safe mode blocks a script that writes the render | Save and render from the command line instead; safe mode is right for scene edits. |
| Renders differ run to run | Fixed Cycles seed, no denoiser change between draft and final, same Blender version. |
| A crash loses the scene | Save before every multi-object code call; keep `V/3d/*.blend1` backups. |
| Text in 3D unreadable on a phone | Set it in the studio over the plate, not in Blender. |
| Port 9876 busy | Another Blender MCP server (often the official one) is running: stop one. |
