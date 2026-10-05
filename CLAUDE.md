Skills are organized into bucket folders under `skills/`:

- `engineering/` — daily code work
- `productivity/` — daily non-code workflow tools
- `misc/` — kept around but rarely used
- `personal/` — tied to my own setup, not promoted
- `in-progress/` — drafts not yet ready to ship
- `deprecated/` — no longer used

Every skill in `engineering/`, `productivity/`, or `misc/` must have a reference in the top-level `README.md` and an entry in `.claude-plugin/plugin.json`. Skills in `personal/`, `in-progress/`, and `deprecated/` must not appear in either.

Each skill entry in the top-level `README.md` must link the skill name to its `SKILL.md`.

Each bucket folder has a `README.md` that lists every skill in the bucket with a one-line description, with the skill name linked to its `SKILL.md`.

## Skill sync

`scripts/sync-skills.sh` keeps this repo and GitHub in two-way sync on `main`; `scripts/install-skill-sync.sh` wires it into Claude Code hooks (SessionStart pulls, Stop pushes skill changes) plus a 15-minute background job. Skills in `~/.claude/skills/` are symlinks into this repo, so edit skills here or through those links. A real skill folder created directly in `~/.claude/skills/` is imported into `skills/in-progress/` on the next sync; move it to its proper bucket (and update READMEs/`plugin.json` per the rules above) when it's ready. On a conflict, sync stops and notifies; resolve with `git pull --rebase origin main`. Log: `~/.claude/skill-sync.log`.
