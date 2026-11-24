---
name: lean-changes
description: Make the AI coding agent prefer the smallest change that solves the request. Delete before adding, skip speculative abstractions, and keep the diff tight. Use when the user asks for a small fix, says the agent is over-engineering, or wants a senior-style change rather than a rewrite.
license: MIT
metadata:
  origin: BlitzHash
  pack: blitzhash-vibe-coding-rules
---

# Lean changes

The best patch is the one a lazy senior would be willing to review: small, obvious, and done.

## When to use

- The user asked for a focused fix and the obvious path is a two-file change.
- A previous AI edit added helpers, layers or refactors that were not requested.
- The user says the diff is too big or the agent is over-engineering.

## Steps

1. **Restate the request in one sentence.** If it is unclear, ask one question, then stop expanding the scope.
2. **Search for an existing helper or pattern** in the repo before adding a new file.
3. **Propose the smallest diff** that satisfies the sentence. Call out anything you are deliberately not doing (renames, new folders, extra features).
4. **Show the diff and wait for yes** before applying.
5. **Do not "clean up" adjacent files** unless the user asked.

## Output format

One-sentence restatement, the file list, the diff, and a "not in this change" list.

## Safety rules (always)

1. No drive-by refactors, mass renames or library swaps.
2. Do not delete tests or logging "to keep the diff small".
3. If the small fix would hide a security issue, say so and include the safe version instead.
