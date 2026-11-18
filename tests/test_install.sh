#!/bin/sh
# Test the installers in a throwaway home: every tool's skill is linked for Claude Code, Codex and Google Antigravity,
# its command is linked in ~/.local/bin, and a second run changes nothing.   Run: sh tests/test_install.sh
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
T="$(mktemp -d "${TMPDIR:-/tmp}/pairlab-install.XXXXXX")"
trap 'rm -rf "$T"' EXIT
run() { env -u PAIRTEX_HOME -u OW_HOME -u PAIRDECK_HOME -u PAIRTALK_HOME -u PAIRPOSTER_HOME HOME="$T" sh "$ROOT/install.sh" >"$T/out.txt" 2>&1; }
run
pass=0
check() { if eval "$1"; then pass=$((pass + 1)); echo "  ok  $2"; else echo "FAIL  $2"; cat "$T/out.txt"; exit 1; fi; }
for tool in pairdeck pairtex pairtalk pairposter; do
  for dir in .claude/skills .agents/skills .gemini/config/skills; do
    check "[ -L \"$T/$dir/$tool\" ] && [ \"\$(cd \"$T/$dir/$tool\" && pwd -P)\" = \"\$(cd \"$ROOT/$tool/skill\" && pwd -P)\" ]" \
      "$tool: skill linked at ~/$dir/$tool"
  done
  check "[ -f \"$T/.gemini/config/skills/$tool/SKILL.md\" ] && head -1 \"$T/.gemini/config/skills/$tool/SKILL.md\" | grep -qx -- '---'" \
    "$tool: Antigravity finds SKILL.md with its frontmatter"
  check "[ -L \"$T/.local/bin/$tool\" ] && [ -x \"$T/.local/bin/$tool\" ]" "$tool: command linked in ~/.local/bin"
done
before="$(cd "$T" && find .claude .agents .gemini .local -print | sort)"
run
after="$(cd "$T" && find .claude .agents .gemini .local -print | sort)"
check "[ \"\$before\" = \"\$after\" ]" "a second run changes nothing"
echo "all $pass install checks passed"
