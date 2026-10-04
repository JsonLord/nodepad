#!/usr/bin/env bash
# product-eval: install the skills for Claude Code and Codex (user scope).
# This is the no-marketplace path. It symlinks each skill into the tools' skill
# directories, so a later `git pull` keeps every skill current automatically.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS="$HERE/skills"
[ -d "$SKILLS" ] || { echo "error: skills/ not found next to install.sh" >&2; exit 1; }

link_into() {
  local dest="$1" n=0
  mkdir -p "$dest"
  for skill in "$SKILLS"/*/; do
    [ -f "${skill}SKILL.md" ] || continue
    ln -sfn "${skill%/}" "$dest/$(basename "$skill")"
    n=$((n + 1))
  done
  printf '  linked %d skills -> %s\n' "$n" "$dest"
}

echo "Installing product-eval skills (user scope)..."
link_into "$HOME/.claude/skills"   # Claude Code
link_into "$HOME/.agents/skills"   # Codex (documented cross-tool skills path)
link_into "$HOME/.codex/skills"    # Codex (alternate path some builds scan)

echo
echo "Done. Start a new Claude Code or Codex session to load them."
echo "In Codex, invoke a skill explicitly with \$<skill-name>, for example \$start."
