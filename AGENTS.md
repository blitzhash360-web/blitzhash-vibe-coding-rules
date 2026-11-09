# AGENTS.md: working on this repo

Instructions for AI coding agents editing **this pack** (not the pack itself). Looking for the rules to put in your own project? Use [packs/AGENTS.md](packs/AGENTS.md) or run `./install.sh`.

## Layout

| Path | What it is |
|---|---|
| `rules/*.mdc` | Source of truth. One topic per file, Cursor `.mdc` format (`description`, `globs`, `alwaysApply`). |
| `skills/<name>/SKILL.md` | Agent Skills for Claude Code, Cursor and Codex. |
| `install.sh` | Bash-only installer that converts the rules for each tool. |
| `packs/AGENTS.md` | Generated single-file pack. Rebuild with `npm run build:agents`. |
| `scripts/lint-rules.mjs` | Frontmatter, section, size, banned-claim and secret checks. |
| `scripts/check-links.mjs` | Markdown link and anchor check. |
| `examples/` | Before and after code used in the README. |

## Rules for changes

1. Edit `rules/*.mdc`, never the generated `packs/AGENTS.md`; then run `npm run build:agents`.
2. Keep each rule short and concrete: `## Do`, `## Never`, `## Example` with one code block. Budgets are enforced by the linter.
3. Globs are comma-separated with no spaces, quotes or braces (Cursor, Windsurf and Copilot all read that form).
4. No real keys anywhere, including examples. Use placeholders such as `sk_test_REPLACE_ME`.
5. Use Supabase as one example among many (Firebase, Postgres, Prisma, Next.js, Express, Cloudflare), not the default.
6. Before committing: `npm test`, `npm run lint`, `npm run links`, `npx markdownlint-cli2`, `shellcheck install.sh test/install.test.sh`.
