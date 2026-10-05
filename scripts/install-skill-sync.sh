#!/usr/bin/env bash
set -euo pipefail

# Installs two-way skill sync (see sync-skills.sh) on this machine:
#   1. Claude Code hooks in ~/.claude/settings.json
#        SessionStart -> full sync (pull GitHub changes before you work)
#        Stop         -> sync if skills changed (push edits after each turn)
#   2. A background job every 15 minutes (launchd on macOS, cron elsewhere)
#      for edits made outside Claude and GitHub changes while idle.
#
# Re-running is safe: existing entries are replaced, not duplicated.
# Remove everything with: install-skill-sync.sh --uninstall

REPO="$(cd "$(dirname "$0")/.." && pwd)"
SYNC="$REPO/scripts/sync-skills.sh"
SETTINGS="$HOME/.claude/settings.json"
LABEL="com.claude.skill-sync"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
INTERVAL_SECONDS=900 # 15 minutes: fresh enough across devices, light on GitHub

ACTION="${1:-install}"
chmod +x "$SYNC" "$REPO/scripts/link-skills.sh"

# --- Claude Code hooks ------------------------------------------------------
mkdir -p "$(dirname "$SETTINGS")"
[ -f "$SETTINGS" ] && cp "$SETTINGS" "$SETTINGS.bak.$(date +%Y%m%d-%H%M%S)"

python3 - "$SETTINGS" "$SYNC" "$ACTION" <<'PY'
import json, os, sys
path, sync, action = sys.argv[1:4]
data = {}
if os.path.exists(path):
    with open(path) as f:
        text = f.read().strip()
        data = json.loads(text) if text else {}
hooks = data.setdefault("hooks", {})
wanted = {
    "SessionStart": f'"{sync}"',
    "Stop": f'"{sync}" --if-dirty',
}
for event, command in wanted.items():
    groups = [
        g for g in hooks.get(event, [])
        if not any("sync-skills.sh" in h.get("command", "") for h in g.get("hooks", []))
    ]
    if action != "--uninstall":
        groups.append({"hooks": [{"type": "command", "command": command, "timeout": 60}]})
    if groups:
        hooks[event] = groups
    else:
        hooks.pop(event, None)
if not hooks:
    data.pop("hooks", None)
with open(path, "w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
PY

# --- background job ---------------------------------------------------------
if [ "$(uname)" = "Darwin" ]; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"
  if [ "$ACTION" != "--uninstall" ]; then
    mkdir -p "$(dirname "$PLIST")"
    cat >"$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>$SYNC</string></array>
  <key>StartInterval</key><integer>$INTERVAL_SECONDS</integer>
  <key>RunAtLoad</key><true/>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string></dict>
</dict>
</plist>
EOF
    launchctl bootstrap "gui/$(id -u)" "$PLIST"
  fi
elif ! command -v crontab >/dev/null 2>&1; then
  echo "warning: no launchd or crontab found; only the Claude Code hooks were installed." >&2
else
  ( crontab -l 2>/dev/null | grep -v "sync-skills.sh" || true
    [ "$ACTION" != "--uninstall" ] && echo "*/15 * * * * \"$SYNC\" >/dev/null 2>&1"
  ) | crontab -
fi

if [ "$ACTION" = "--uninstall" ]; then
  echo "Skill sync removed (hooks and background job). Settings backup kept next to $SETTINGS."
else
  "$SYNC" || true
  echo "Skill sync installed. Log: ~/.claude/skill-sync.log"
fi
