#!/usr/bin/env bash
# setup_3d_tools.sh: install the Blender and Unreal Engine MCP servers for Claude Code (routes F and G).
#
#   bash setup_3d_tools.sh --check            # what is installed, what is missing (changes nothing)
#   bash setup_3d_tools.sh --blender          # Blender: MCP server + Blender add-on
#   bash setup_3d_tools.sh --unreal           # Unreal: MCP server (the editor-side steps are printed)
#   bash setup_3d_tools.sh --all
#
# Servers (both MIT, registered at user scope so every Claude Code session sees them, pinned like every studio tool):
#   blender  uvx mcp-for-blender@2.2.4   github.com/ahujasid/mcp-for-blender (formerly blender-mcp; not by the
#            Blender Foundation). Registered with DISABLE_TELEMETRY=true (its anonymous usage record is on by
#            default) and BLENDER_MCP_SAFE_MODE=1 (scripts are checked before they run: no file, network or process
#            access from generated code).
#   unreal   uvx uemcp@0.1.0             github.com/ATDev-Inc/uemcp. Uses Unreal's built-in Python remote
#            execution: nothing to compile in the project. UE 5.0 to 5.7.
# Safe to re-run: an existing registration is left alone. Never handles API keys.
set -euo pipefail
BLENDER_PKG="mcp-for-blender@2.2.4"
UNREAL_PKG="uemcp@0.1.0"

mode="${1:---check}"
ok()   { printf '  [ok]   %s\n' "$1"; }
miss() { printf '  [miss] %s\n' "$1"; }

find_blender() {
  command -v blender 2>/dev/null && return 0
  for p in /Applications/Blender.app/Contents/MacOS/Blender "$HOME/Applications/Blender.app/Contents/MacOS/Blender" \
           "/c/Program Files/Blender Foundation"/Blender*/blender.exe; do
    [ -x "$p" ] && { printf '%s\n' "$p"; return 0; }
  done
  return 1
}
find_unreal() {
  for p in "/Users/Shared/Epic Games"/UE_5.*/Engine/Binaries/Mac/UnrealEditor.app/Contents/MacOS/UnrealEditor \
           "/c/Program Files/Epic Games"/UE_5.*/Engine/Binaries/Win64/UnrealEditor-Cmd.exe; do
    [ -x "$p" ] && { printf '%s\n' "$p"; return 0; }
  done
  return 1
}
registered() { claude mcp get "$1" >/dev/null 2>&1; }

check() {
  echo "3D tools:"
  command -v uvx >/dev/null && ok "uv/uvx" || miss "uv/uvx (macOS: brew install uv; else https://docs.astral.sh/uv/)"
  command -v claude >/dev/null && ok "claude CLI" || miss "claude CLI"
  if b=$(find_blender); then ok "Blender: $b ($("$b" --version 2>/dev/null | head -1))"; else miss "Blender app"; fi
  if command -v claude >/dev/null && registered blender; then ok "MCP server 'blender'"; else miss "MCP server 'blender'"; fi
  if u=$(find_unreal); then ok "Unreal Editor: $u"; else miss "Unreal Editor (Epic Games Launcher, UE 5.x)"; fi
  if command -v claude >/dev/null && registered unreal; then ok "MCP server 'unreal'"; else miss "MCP server 'unreal'"; fi
}

need_base() {
  command -v uvx >/dev/null || { echo "uv is missing. macOS: brew install uv. Then re-run." >&2; exit 1; }
  command -v claude >/dev/null || { echo "The claude CLI is missing; install Claude Code first." >&2; exit 1; }
}

setup_blender() {
  need_base
  if registered blender; then ok "MCP server 'blender' already registered (left as is)"
  else
    claude mcp add --scope user -e DISABLE_TELEMETRY=true -e BLENDER_MCP_SAFE_MODE=1 blender -- uvx "$BLENDER_PKG"
    ok "MCP server 'blender' registered ($BLENDER_PKG, telemetry off, safe mode on)"
  fi
  if find_blender >/dev/null; then
    DISABLE_TELEMETRY=true uvx "$BLENDER_PKG" install-addon
    cat <<'EOF'
  Next, in Blender: Edit > Preferences > Add-ons > enable "MCP for Blender". The add-on starts its server when
  Blender opens (N panel in the 3D viewport > MCP for Blender > Start MCP Server if it is not running).
  Port 9876 is shared with the official Blender Lab MCP server: run one or the other, never both.
EOF
  else
    miss "Blender app not found: install Blender (blender.org), then run: uvx $BLENDER_PKG install-addon"
  fi
}

setup_unreal() {
  need_base
  if registered unreal; then ok "MCP server 'unreal' already registered (left as is)"
  else
    claude mcp add --scope user unreal -- uvx "$UNREAL_PKG"
    ok "MCP server 'unreal' registered ($UNREAL_PKG)"
  fi
  cat <<'EOF'
  Next, once per Unreal project (about 30 seconds):
    1. Edit > Plugins: enable "Python Editor Script Plugin" and "Movie Render Queue", restart the editor.
    2. Edit > Project Settings > search "Python" > tick "Enable Remote Execution".
    3. Put the project under source control before the first session: the tools can modify and delete content.
  Several editors open: set UEMCP_PROJECT=<ProjectName> in the server's env (claude mcp remove unreal, then re-add
  with -e UEMCP_PROJECT=<name>).
EOF
}

case "$mode" in
  --check)   check ;;
  --blender) setup_blender; echo; check ;;
  --unreal)  setup_unreal; echo; check ;;
  --all)     setup_blender; echo; setup_unreal; echo; check ;;
  *) sed -n '2,20p' "$0"; exit 2 ;;
esac
echo "Restart Claude Code (new session) so newly registered MCP servers load."
