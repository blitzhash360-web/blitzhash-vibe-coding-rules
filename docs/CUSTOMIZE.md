# Customize the rules

The rules are short on purpose: every line costs context in every chat. Fit them to your stack instead of adding more.

## Change a rule

1. Fork or clone this repo and edit `rules/<topic>.mdc`.
2. Run `npm test` (needs Node 18.17+). The linter checks frontmatter, required sections and size budgets.
3. Re-run `./install.sh --target <tool> --project <your-app> --yes`. Changed rules update in place; unchanged ones are left alone.

## Good edits

- Replace examples with your real helpers: `requireUser()`, your ORM, your rate-limit client.
- Narrow `globs` to your folders, for example `app/api/**,src/server/**`.
- Delete topics you do not use (no payments? remove `stripe-webhooks.mdc`) and remove its name from the list at the end of `00-secure-defaults.mdc`.

## Add a rule

Copy an existing file, keep the `## Do`, `## Never` and `## Example` sections, give it a distinct `# Title`, and add its file name (without `.mdc`) to the list at the end of `00-secure-defaults.mdc`. Then run `npm run build:agents` to refresh `packs/AGENTS.md`.

## Keep your own rules separate

Put team rules in your own files (for example `.cursor/rules/team.mdc`). The installer never touches files it did not create.
