#!/usr/bin/env bash
# End-to-end installer tests. Everything happens in temp folders.
set -euo pipefail
cd "$(dirname "$0")/.."
PASS=0
ok() { PASS=$((PASS + 1)); echo "ok $PASS - $*"; }
fail() { echo "not ok - $*" >&2; exit 1; }
tmp() { mktemp -d "${TMPDIR:-/tmp}/bhvcr.XXXXXX"; }

# 1. dry run writes nothing, for every target
for t in cursor claude codex agents-md windsurf copilot all; do
  p="$(tmp)"
  out="$(./install.sh --target "$t" --project "$p" --dry-run)"
  grep -q "DRY RUN: nothing was written." <<<"$out" || fail "dry run banner missing for $t"
  [ -z "$(ls -A "$p")" ] || fail "dry run wrote files for $t"
done
ok "dry run writes nothing for every target"

# 2. non-interactive write without --yes is refused
p="$(tmp)"
if ./install.sh --target cursor --project "$p" </dev/null >/dev/null 2>&1; then fail "wrote without --yes"; fi
[ -z "$(ls -A "$p")" ] || fail "files written without --yes"
ok "refuses to write in a non-interactive shell without --yes"

# 3. bad input
if ./install.sh --target vscode --project "$p" --dry-run >/dev/null 2>&1; then fail "accepted unknown target"; fi
if ./install.sh --target cursor --project "$p/nope" --dry-run >/dev/null 2>&1; then fail "accepted missing project"; fi
if ./install.sh --project "$p" --dry-run >/dev/null 2>&1; then fail "ran without a target"; fi
ok "rejects unknown target, missing project and missing --target"

# 4. full install loads in every tool format
p="$(tmp)"
printf '# Team notes\n\nUse pnpm.\n' > "$p/AGENTS.md"
mkdir -p "$p/.cursor/rules" && echo "my own rule" > "$p/.cursor/rules/blitzhash-rate-limits.mdc"
out="$(./install.sh --target all --project "$p" --yes)"
grep -q "skip    .cursor/rules/blitzhash-rate-limits.mdc" <<<"$out" || fail "did not report skipped user file"
[ "$(cat "$p/.cursor/rules/blitzhash-rate-limits.mdc")" = "my own rule" ] || fail "overwrote a user file"
rm "$p/.cursor/rules/blitzhash-rate-limits.mdc"
./install.sh --target cursor --project "$p" --yes >/dev/null
node scripts/lint-rules.mjs --installed "$p" >/dev/null || { node scripts/lint-rules.mjs --installed "$p"; fail "installed pack does not load"; }
grep -q "^Use pnpm.$" "$p/AGENTS.md" || fail "lost existing AGENTS.md content"
ok "install --target all loads for Cursor, Claude Code, Codex, AGENTS.md, Windsurf, Copilot; user files kept"

# 5. idempotent
out="$(./install.sh --target all --project "$p" --yes)"
grep -q "Written: 0 " <<<"$out" || fail "second install changed files"
[ "$(grep -c "BEGIN blitzhash-vibe-coding-rules" "$p/AGENTS.md")" = 1 ] || fail "AGENTS.md block duplicated"
ok "re-running is idempotent (no duplicate AGENTS.md block)"

# 6. a rule update propagates
pack="$(tmp)"; cp -R rules skills install.sh "$pack/"
printf '\n- Extra line for test.\n' >> "$pack/rules/rate-limits.mdc"
out="$("$pack/install.sh" --target windsurf --project "$p" --yes)"
grep -q "update  .windsurf/rules/blitzhash-rate-limits.md" <<<"$out" || fail "changed rule was not updated"
grep -q "Extra line for test." "$p/.windsurf/rules/blitzhash-rate-limits.md" || fail "update not written"
ok "changed rules update their installed copies"

# 7. --no-skills
q="$(tmp)"
./install.sh --target claude --project "$q" --yes --no-skills >/dev/null
[ ! -e "$q/.claude/skills" ] || fail "--no-skills installed skills"
[ -f "$q/.claude/rules/blitzhash-00-secure-defaults.md" ] || fail "--no-skills skipped rules"
ok "--no-skills installs rules only"

# 8. uninstall removes only ours
echo "keep me" > "$p/.cursor/rules/team.mdc"
./install.sh --target all --project "$p" --yes --uninstall >/dev/null
[ "$(cat "$p/.cursor/rules/team.mdc")" = "keep me" ] || fail "uninstall touched a user file"
grep -q "BEGIN blitzhash" "$p/AGENTS.md" && fail "uninstall left the AGENTS.md block"
[ "$(cat "$p/AGENTS.md")" = "$(printf '# Team notes\n\nUse pnpm.')" ] || fail "uninstall changed user AGENTS.md content"
left="$(find "$p" -type f ! -path "$p/AGENTS.md" ! -path "$p/.cursor/rules/team.mdc")"
[ -z "$left" ] || fail "uninstall left files: $left"
ok "uninstall removes only installer files and the AGENTS.md block"

# 9. packs/AGENTS.md is up to date
diff -u packs/AGENTS.md <(./install.sh --print-agents-md) >/dev/null || fail "packs/AGENTS.md is stale: run ./install.sh --print-agents-md > packs/AGENTS.md"
ok "packs/AGENTS.md matches the rules"

echo "# $PASS installer tests passed"
