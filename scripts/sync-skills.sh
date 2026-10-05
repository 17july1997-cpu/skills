#!/usr/bin/env bash
set -euo pipefail

# Two-way sync between this repo's skills and GitHub.
#
#   local -> GitHub: commits changes under skills/ and pushes main
#   GitHub -> local: pulls main (rebase, autostash) and re-links skills
#
# Also imports any real skill folder in ~/.claude/skills that the repo doesn't
# have yet into skills/in-progress/, so skills created outside the repo get
# tracked too.
#
# Usage:
#   sync-skills.sh            full sync (import, commit, pull, push, link)
#   sync-skills.sh --if-dirty only sync when there are local skill changes;
#                             cheap enough to run after every Claude turn
#
# Only runs on main: a feature branch checked out on purpose is left alone.
# On a rebase conflict it aborts, leaves everything as it was, and notifies.

REPO="$(cd "$(dirname "$0")/.." && pwd)"
SKILLS_HOME="${SKILLS_HOME:-$HOME/.claude/skills}"
LOG="${SKILL_SYNC_LOG:-$HOME/.claude/skill-sync.log}"
BRANCH=main
MODE="${1:-full}"

mkdir -p "$(dirname "$LOG")"
log() { printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >>"$LOG"; }

notify() {
  log "NOTIFY: $1"
  if command -v osascript >/dev/null 2>&1; then
    osascript -e "display notification \"$1\" with title \"Skill sync\"" >/dev/null 2>&1 || true
  elif command -v notify-send >/dev/null 2>&1; then
    notify-send "Skill sync" "$1" >/dev/null 2>&1 || true
  fi
  echo "skill-sync: $1" >&2
}

cd "$REPO"

# One sync at a time: the Stop hook, SessionStart hook and the timer can overlap.
LOCK="$REPO/.git/skill-sync.lock"
if ! mkdir "$LOCK" 2>/dev/null; then
  # A lock older than 10 minutes is left over from a killed run.
  if [ -n "$(find "$LOCK" -maxdepth 0 -mmin +10 2>/dev/null)" ]; then
    rmdir "$LOCK" 2>/dev/null || true
    mkdir "$LOCK" 2>/dev/null || exit 0
  else
    exit 0
  fi
fi
trap 'rmdir "$LOCK" 2>/dev/null || true' EXIT

current="$(git symbolic-ref --short -q HEAD || echo DETACHED)"
if [ "$current" != "$BRANCH" ]; then
  log "skip: on '$current', not '$BRANCH'"
  exit 0
fi

if [ -d "$REPO/.git/rebase-merge" ] || [ -d "$REPO/.git/rebase-apply" ] || [ -f "$REPO/.git/MERGE_HEAD" ]; then
  notify "A rebase or merge is in progress in $REPO. Finish it, then sync resumes."
  exit 1
fi

# --- import skills created outside the repo --------------------------------
imported=()
if [ -d "$SKILLS_HOME" ]; then
  for dir in "$SKILLS_HOME"/*/; do
    dir="${dir%/}"
    [ -L "$dir" ] && continue
    [ -f "$dir/SKILL.md" ] || continue
    name="$(basename "$dir")"
    if find "$REPO/skills" -mindepth 2 -maxdepth 2 -type d -name "$name" | grep -q .; then
      log "skip import: '$name' exists in repo; local copy at $dir left untouched"
      continue
    fi
    dest="$REPO/skills/in-progress/$name"
    cp -a "$dir" "$dest"
    backup="$HOME/.claude/skill-sync-backups/$(date +%Y%m%d-%H%M%S)-$name"
    mkdir -p "$(dirname "$backup")"
    mv "$dir" "$backup"
    ln -s "$dest" "$dir"
    desc="$(sed -n 's/^description:[[:space:]]*//p' "$dest/SKILL.md" | head -1 | cut -c1-200)"
    printf -- '- **[%s](./%s/SKILL.md)** — %s\n' "$name" "$name" "${desc:-Imported by skill sync; add a description.}" \
      >>"$REPO/skills/in-progress/README.md"
    imported+=("$name")
    log "imported '$name' into skills/in-progress (original moved to $backup)"
  done
fi

# --- commit local skill changes ---------------------------------------------
git add -A -- skills
if git diff --cached --quiet; then
  if [ "$MODE" = "--if-dirty" ] && [ -z "$(git log "origin/$BRANCH..$BRANCH" --oneline 2>/dev/null)" ]; then
    exit 0
  fi
else
  changed="$(git diff --cached --name-only -- skills | awk -F/ 'NF>=3 {print $3}' | sort -u | paste -sd, -)"
  git commit -q -m "sync: update ${changed:-skills} from $(hostname -s 2>/dev/null || hostname)" \
    -m "Automatic commit by scripts/sync-skills.sh."
  log "committed: $changed"
fi

# --- pull, then push -------------------------------------------------------
if ! git fetch -q origin "$BRANCH" 2>>"$LOG"; then
  log "fetch failed (offline?); will retry next run"
  exit 0
fi

if ! git pull -q --rebase --autostash origin "$BRANCH" 2>>"$LOG"; then
  git rebase --abort 2>/dev/null || true
  notify "Conflict between local skills and GitHub. Nothing was changed. Resolve in $REPO with: git pull --rebase origin $BRANCH"
  exit 1
fi

if [ -n "$(git log "origin/$BRANCH..$BRANCH" --oneline)" ]; then
  if git push -q origin "$BRANCH" 2>>"$LOG"; then
    log "pushed to origin/$BRANCH"
  else
    notify "Push to GitHub failed. Local commits are kept and will retry next run. See $LOG"
    exit 1
  fi
fi

# --- link any skills that arrived from GitHub ------------------------------
"$REPO/scripts/link-skills.sh" >/dev/null

if [ ${#imported[@]} -gt 0 ]; then
  notify "Imported new skill(s) into the repo: ${imported[*]}"
fi
log "sync ok ($MODE)"
