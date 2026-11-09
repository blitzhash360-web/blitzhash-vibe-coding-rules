# How each tool loads the rules

One source (`rules/*.mdc`) becomes the native format of each tool. Each rule says when it should apply: one short **always-on** baseline (`00-secure-defaults`) plus seven **topic rules** that attach when the AI touches matching files (API routes, webhooks, migrations and so on), or when the tool decides the description is relevant.

| Tool | Installed files | Always-on baseline | Topic rules attach by |
|---|---|---|---|
| Cursor | `.cursor/rules/blitzhash-*.mdc`, `.cursor/skills/*/SKILL.md` | `alwaysApply: true` | `globs` + `description` (agent-requested) |
| Claude Code | `.claude/rules/blitzhash-*.md`, `.claude/skills/*/SKILL.md` | rule without `paths` (loads at session start) | `paths:` list (loads when Claude reads or edits a matching file) |
| OpenAI Codex | `AGENTS.md` block, `.agents/skills/*/SKILL.md` | whole block is always read | n/a (all rules in one file, about 19 KB, under Codex's 32 KiB default) |
| Any `AGENTS.md` tool | `AGENTS.md` block | whole block is always read | n/a |
| Windsurf | `.windsurf/rules/blitzhash-*.md` | `trigger: always_on` | `trigger: glob` + `globs` |
| GitHub Copilot | `.github/instructions/blitzhash-*.instructions.md` | `applyTo: "**"` | `applyTo` globs |

Notes:

- **Windsurf** also reads `AGENTS.md`, and newer builds prefer `.devin/rules/`; `.windsurf/rules/` is still read. If you use the `codex` target as well, Windsurf sees the rules twice. Pick one.
- **Copilot** reads `.github/instructions/*.instructions.md` in supported editors and on github.com. Support varies by editor and Copilot feature; if a rule does not show up in a chat's references, check your editor's Copilot instruction settings.
- **Skills** are installed only for tools that support the `SKILL.md` format in a project folder (Claude Code, Cursor, Codex). Skills load on demand, so they cost almost nothing until used.
- Every installed file carries a marker comment. The installer only updates or removes files with that marker, and only the `AGENTS.md` lines between its `BEGIN` and `END` markers.

## Without bash

On Windows without WSL or Git Bash, copy files by hand:

- Cursor: copy `rules/*.mdc` into `.cursor/rules/`.
- Codex, Windsurf or any `AGENTS.md` tool: copy [packs/AGENTS.md](../packs/AGENTS.md) to your project root as `AGENTS.md` (or paste its block into yours).
- Claude Code: copy [packs/AGENTS.md](../packs/AGENTS.md) to `CLAUDE.md`, or copy the `skills/` folders into `.claude/skills/`.
