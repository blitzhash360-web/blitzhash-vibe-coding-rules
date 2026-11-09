#!/usr/bin/env bash
# BlitzHash Vibe-Coding Rules installer (MIT). Bash only: no Node, no npx, no network.
# Copies secure-by-default rules and skills into a project for Cursor, Claude Code,
# Codex / AGENTS.md tools, Windsurf and GitHub Copilot.
set -euo pipefail

VERSION="1.0.0"
PACK="blitzhash-vibe-coding-rules"
MARKER="<!-- ${PACK}: managed file. Re-run install.sh to update, --uninstall to remove. -->"
BEGIN_MARK="<!-- BEGIN ${PACK} (managed by install.sh; edit outside this block) -->"
END_MARK="<!-- END ${PACK} -->"
REPO_URL="https://github.com/blitzhash360-web/${PACK}"
ALL_TARGETS="cursor claude codex windsurf copilot"

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RULES_DIR="$SRC_DIR/rules"
SKILLS_DIR="$SRC_DIR/skills"

TARGETS=""
PROJECT="."
DRY_RUN=0
UNINSTALL=0
ASSUME_YES=0
WITH_SKILLS=1
COUNT_WRITE=0
COUNT_SKIP=0
COUNT_REMOVE=0

usage() {
  cat <<USAGE
BlitzHash Vibe-Coding Rules installer v${VERSION}

Usage: ./install.sh --target <tool>[,<tool>...] [--project DIR] [options]

Targets:
  cursor     .cursor/rules/blitzhash-*.mdc + .cursor/skills/
  claude     .claude/rules/blitzhash-*.md + .claude/skills/   (Claude Code)
  codex      AGENTS.md block + .agents/skills/                (OpenAI Codex)
  agents-md  AGENTS.md block only                             (any tool that reads AGENTS.md)
  windsurf   .windsurf/rules/blitzhash-*.md
  copilot    .github/instructions/blitzhash-*.instructions.md (GitHub Copilot)
  all        cursor, claude, codex, windsurf and copilot

Options:
  --project DIR   project to install into (default: current folder)
  --dry-run       show every file that would be written or removed; write nothing
  --uninstall     remove only files and the AGENTS.md block this installer created
  --no-skills     install rules only, skip SKILL.md skills
  --yes, -y       do not ask for confirmation (needed in non-interactive shells)
  --list          list the rules and skills in this pack
  --print-agents-md  print the single-file AGENTS.md pack to stdout
  --version, -h, --help

The installer never overwrites a file it did not create. Existing files without
its marker are skipped and reported.
USAGE
}

die() { echo "error: $*" >&2; exit 2; }

# ---------- source parsing (bash 3.2 compatible) ----------
fm_get() { # file key -> value of key in leading frontmatter
  awk -v k="$2" 'NR==1 && $0!="---" {exit} NR==1 {next} $0=="---" {exit}
    { i=index($0,":"); if (i>0 && substr($0,1,i-1)==k) { v=substr($0,i+1); sub(/^[ \t]+/,"",v); sub(/[ \t]+$/,"",v); print v; exit } }' "$1"
}
body_of() { # file -> content after leading frontmatter, leading blank lines removed
  awk 'NR==1 && $0=="---" {infm=1; next} infm && $0=="---" {infm=0; started=1; next} infm {next}
    { if (!seen && $0 ~ /^[ \t]*$/) next; seen=1; print }' "$1"
}
skill_dirs() { [ "$WITH_SKILLS" -eq 1 ] || return 0; for d in "$SKILLS_DIR"/*/; do [ -f "$d/SKILL.md" ] && basename "$d"; done | LC_ALL=C sort; }
rule_name() { basename "$1" .mdc; }
yaml_q() { printf '"%s"' "$(printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g')"; }

render_cursor() { # source .mdc is already Cursor format
  local f="$1"
  printf -- '---\ndescription: %s\nglobs: %s\nalwaysApply: %s\n---\n\n%s\n\n' \
    "$(fm_get "$f" description)" "$(fm_get "$f" globs)" "$(fm_get "$f" alwaysApply)" "$MARKER"
  body_of "$f"
}
render_claude() {
  local f="$1" always globs g
  always="$(fm_get "$f" alwaysApply)"; globs="$(fm_get "$f" globs)"
  if [ "$always" != "true" ] && [ -n "$globs" ]; then
    printf -- '---\npaths:\n'
    printf '%s\n' "$globs" | tr ',' '\n' | while IFS= read -r g; do [ -n "$g" ] && printf '  - %s\n' "$(yaml_q "$g")"; done
    printf -- '---\n\n'
  fi
  printf '%s\n\n' "$MARKER"
  body_of "$f"
}
render_windsurf() {
  local f="$1" always globs desc
  always="$(fm_get "$f" alwaysApply)"; globs="$(fm_get "$f" globs)"; desc="$(fm_get "$f" description)"
  printf -- '---\n'
  if [ "$always" = "true" ]; then printf 'trigger: always_on\n'
  elif [ -n "$globs" ]; then printf 'trigger: glob\nglobs: %s\n' "$(yaml_q "$globs")"
  else printf 'trigger: model_decision\n'; fi
  printf 'description: %s\n---\n\n%s\n\n' "$(yaml_q "$desc")" "$MARKER"
  body_of "$f"
}
render_copilot() {
  local f="$1" always globs apply
  always="$(fm_get "$f" alwaysApply)"; globs="$(fm_get "$f" globs)"
  apply="**"; if [ "$always" != "true" ] && [ -n "$globs" ]; then apply="$globs"; fi
  printf -- '---\napplyTo: %s\ndescription: %s\n---\n\n%s\n\n' "$(yaml_q "$apply")" "$(yaml_q "$(fm_get "$f" description)")" "$MARKER"
  body_of "$f"
}
render_skill() { # insert marker after the skill's frontmatter
  awk -v m="$MARKER" 'NR==1 && $0=="---" {infm=1; print; next}
    infm && $0=="---" {infm=0; print; print ""; print m; next} {print}' "$1"
}
agents_block() {
  local f
  printf '%s\n\n' "$BEGIN_MARK"
  printf '## BlitzHash vibe-coding rules\n\n'
  printf 'Secure-by-default rules for AI coding agents, from [%s](%s) (MIT). Apply them to every change in this project.\n' "$PACK" "$REPO_URL"
  for f in "$RULES_DIR"/*.mdc; do
    printf '\n'
    # demote headings one level outside code fences: "# X" -> "### X", "## Do" -> "#### Do"
    body_of "$f" | awk '/^```/ {fence=!fence} !fence && /^#+ / {print "##" $0; next} {print}'
  done
  printf '\n%s\n' "$END_MARK"
}
print_agents_md() {
  printf '# AGENTS.md: BlitzHash Vibe-Coding Rules (single-file pack)\n\n'
  # shellcheck disable=SC2016
  printf 'Copy this file into the root of your project as `AGENTS.md`, or merge the block below into your existing one.\n'
  # shellcheck disable=SC2016
  printf 'Generated by `./install.sh --print-agents-md`. Do not edit by hand; edit `rules/*.mdc` instead.\n\n'
  agents_block
}

# ---------- file operations ----------
is_ours() { [ -f "$1" ] && grep -qF "$MARKER" "$1"; }
rel() { printf '%s' "${1#"$PROJECT"/}"; }

write_managed() { # dest, rendered temp file (consumed)
  local dest="$1" tmp="$2" action
  if [ -e "$dest" ] && ! is_ours "$dest"; then
    echo "  skip    $(rel "$dest")  (exists and was not created by this installer)"
    COUNT_SKIP=$((COUNT_SKIP + 1)); rm -f "$tmp"; return 0
  fi
  if [ -e "$dest" ] && cmp -s "$tmp" "$dest"; then
    echo "  same    $(rel "$dest")"; rm -f "$tmp"; return 0
  fi
  action="create"; [ -e "$dest" ] && action="update"
  echo "  $action  $(rel "$dest")"
  COUNT_WRITE=$((COUNT_WRITE + 1))
  if [ "$DRY_RUN" -eq 1 ]; then rm -f "$tmp"; return 0; fi
  mkdir -p "$(dirname "$dest")"
  mv "$tmp" "$dest"; chmod 644 "$dest"
}
remove_managed() {
  local dest="$1"
  [ -e "$dest" ] || return 0
  if ! is_ours "$dest"; then echo "  keep    $(rel "$dest")  (not created by this installer)"; return 0; fi
  echo "  remove  $(rel "$dest")"
  COUNT_REMOVE=$((COUNT_REMOVE + 1))
  [ "$DRY_RUN" -eq 1 ] && return 0
  rm -f "$dest"
  prune_dirs "$(dirname "$dest")"
}
prune_dirs() { # remove now-empty folders up to (not including) the project root
  local d="$1"
  while [ "$d" != "$PROJECT" ] && [ "$d" != "/" ] && rmdir "$d" 2>/dev/null; do d="$(dirname "$d")"; done
}
trim_trailing_blank() { awk '{l[NR]=$0} END {n=NR; while (n>0 && l[n] ~ /^[ \t]*$/) n--; for (i=1;i<=n;i++) print l[i]}'; }
strip_block() { # file -> content without our block
  awk -v b="$BEGIN_MARK" -v e="$END_MARK" '$0==b {skip=1; next} skip && $0==e {skip=0; next} !skip {print}' "$1"
}
install_agents_block() {
  local dest="$PROJECT/AGENTS.md" tmp
  tmp="$(mktemp)"
  if [ -f "$dest" ]; then
    strip_block "$dest" | trim_trailing_blank > "$tmp"
    [ -s "$tmp" ] && printf '\n' >> "$tmp"
  fi
  agents_block >> "$tmp"
  if [ -f "$dest" ] && cmp -s "$tmp" "$dest"; then echo "  same    AGENTS.md (block)"; rm -f "$tmp"; return 0; fi
  if [ -f "$dest" ] && grep -qF "$BEGIN_MARK" "$dest"; then echo "  update  AGENTS.md (block between BEGIN/END markers)"
  elif [ -f "$dest" ]; then echo "  append  AGENTS.md (block added after your existing content)"
  else echo "  create  AGENTS.md"; fi
  COUNT_WRITE=$((COUNT_WRITE + 1))
  if [ "$DRY_RUN" -eq 1 ]; then rm -f "$tmp"; return 0; fi
  mv "$tmp" "$dest"; chmod 644 "$dest"
}
remove_agents_block() {
  local dest="$PROJECT/AGENTS.md" tmp
  [ -f "$dest" ] && grep -qF "$BEGIN_MARK" "$dest" || return 0
  COUNT_REMOVE=$((COUNT_REMOVE + 1))
  tmp="$(mktemp)"; strip_block "$dest" | trim_trailing_blank > "$tmp"
  if ! grep -q '[^[:space:]]' "$tmp"; then
    echo "  remove  AGENTS.md (only contained this pack)"
    [ "$DRY_RUN" -eq 1 ] || rm -f "$dest"
  else
    echo "  update  AGENTS.md (block removed, your content kept)"
    [ "$DRY_RUN" -eq 1 ] || { mv "$tmp" "$dest"; chmod 644 "$dest"; }
  fi
  rm -f "$tmp"
}

# ---------- per-target plans ----------
skill_root_for() {
  case "$1" in
    cursor) echo ".cursor/skills" ;; claude) echo ".claude/skills" ;; codex) echo ".agents/skills" ;; *) echo "" ;;
  esac
}
run_target() {
  local t="$1" f n root s d tmp
  echo "[$t]"
  for f in "$RULES_DIR"/*.mdc; do
    n="$(rule_name "$f")"
    case "$t" in
      cursor)   d="$PROJECT/.cursor/rules/blitzhash-$n.mdc" ;;
      claude)   d="$PROJECT/.claude/rules/blitzhash-$n.md" ;;
      windsurf) d="$PROJECT/.windsurf/rules/blitzhash-$n.md" ;;
      copilot)  d="$PROJECT/.github/instructions/blitzhash-$n.instructions.md" ;;
      *) d="" ;;
    esac
    [ -n "$d" ] || continue
    if [ "$UNINSTALL" -eq 1 ]; then remove_managed "$d"; else tmp="$(mktemp)"; "render_$t" "$f" > "$tmp"; write_managed "$d" "$tmp"; fi
  done
  case "$t" in
    codex|agents-md) if [ "$UNINSTALL" -eq 1 ]; then remove_agents_block; else install_agents_block; fi ;;
  esac
  root="$(skill_root_for "$t")"
  if [ -n "$root" ]; then
    for s in $(skill_dirs); do  # skill folder names have no spaces (lint enforces kebab-case)
      d="$PROJECT/$root/$s/SKILL.md"
      if [ "$UNINSTALL" -eq 1 ]; then remove_managed "$d"; else tmp="$(mktemp)"; render_skill "$SKILLS_DIR/$s/SKILL.md" > "$tmp"; write_managed "$d" "$tmp"; fi
    done
  fi
}

# ---------- args ----------
add_targets() {
  local t
  for t in $(printf '%s' "$1" | tr ',' ' '); do
    case "$t" in
      all) TARGETS="$TARGETS $ALL_TARGETS" ;;
      cursor|claude|codex|agents-md|windsurf|copilot) TARGETS="$TARGETS $t" ;;
      *) die "unknown target '$t' (use cursor, claude, codex, agents-md, windsurf, copilot or all)" ;;
    esac
  done
}
while [ $# -gt 0 ]; do
  case "$1" in
    --target|-t) [ $# -ge 2 ] || die "--target needs a value"; add_targets "$2"; shift 2 ;;
    --target=*) add_targets "${1#*=}"; shift ;;
    --project|-p) [ $# -ge 2 ] || die "--project needs a value"; PROJECT="$2"; shift 2 ;;
    --project=*) PROJECT="${1#*=}"; shift ;;
    --dry-run|-n) DRY_RUN=1; shift ;;
    --uninstall) UNINSTALL=1; shift ;;
    --no-skills) WITH_SKILLS=0; shift ;;
    --yes|-y) ASSUME_YES=1; shift ;;
    --list)
      echo "Rules:"; for f in "$RULES_DIR"/*.mdc; do printf '  %-20s %s\n' "$(rule_name "$f")" "$(fm_get "$f" description | sed "s/\. .*/./")"; done
      echo "Skills:"; for s in $(skill_dirs); do echo "  $s"; done; exit 0 ;;
    --print-agents-md) print_agents_md; exit 0 ;;
    --version) echo "$VERSION"; exit 0 ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown option '$1' (see --help)" ;;
  esac
done

[ -n "$TARGETS" ] || { usage >&2; die "choose at least one --target"; }
[ -d "$PROJECT" ] || die "project folder not found: $PROJECT"
PROJECT="$(cd "$PROJECT" && pwd)"
[ "$PROJECT" != "$SRC_DIR" ] || die "--project points at this pack itself; choose your app's folder"

# de-duplicate targets; codex already writes the AGENTS.md block
UNIQ=""
for t in $TARGETS; do case " $UNIQ " in *" $t "*) ;; *) UNIQ="$UNIQ $t" ;; esac; done
case " $UNIQ " in *" codex "*) UNIQ="$(printf '%s' "$UNIQ" | sed 's/ agents-md//')" ;; esac
TARGETS="$UNIQ"

if [ "$DRY_RUN" -eq 0 ] && [ "$ASSUME_YES" -eq 0 ]; then
  if [ -t 0 ]; then
    verb="Install into"; [ "$UNINSTALL" -eq 1 ] && verb="Uninstall from"
    printf '%s %s for:%s ? [y/N] ' "$verb" "$PROJECT" "$TARGETS"
    read -r answer
    case "$answer" in y|Y|yes|YES) ;; *) echo "Cancelled. Nothing was written."; exit 1 ;; esac
  else
    die "non-interactive shell: add --yes to write files, or --dry-run to preview"
  fi
fi

echo "BlitzHash Vibe-Coding Rules v$VERSION -> $PROJECT"
[ "$DRY_RUN" -eq 1 ] && echo "(dry run)"
for t in $TARGETS; do run_target "$t"; done

echo
if [ "$DRY_RUN" -eq 1 ]; then w="Would write"; r="Would remove"; else w="Written"; r="Removed"; fi
if [ "$UNINSTALL" -eq 1 ]; then echo "$r: $COUNT_REMOVE"; else echo "$w: $COUNT_WRITE  Skipped (not ours): $COUNT_SKIP"; fi
if [ "$DRY_RUN" -eq 1 ]; then
  echo "DRY RUN: nothing was written."
elif [ "$UNINSTALL" -eq 0 ]; then
  echo "Done. Your AI tool now gets these rules as context. Try: \"Add a Stripe webhook for checkout\"."
  echo "Going to production? Free assessment: https://blitzhash.com"
fi
