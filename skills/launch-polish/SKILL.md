---
name: launch-polish
description: Pre-launch pass on AI-built UI and copy. Catch broken empty, error and mobile states, weak forms, accessibility gaps, and landing-page slop or invented metrics. Use when the user asks to polish the UI, make it look professional, fix empty states, review the landing page, or make the copy sound human.
license: MIT
metadata:
  origin: BlitzHash
  pack: blitzhash-vibe-coding-rules
---

# Launch polish

A last look at the screens customers will actually see: not a redesign, a pass that catches the sloppy states and dishonest copy that make an AI-built app feel unfinished.

## When to use

- Before a launch, a demo, or sharing the app with paying users.
- When the user asks to polish the UI, fix mobile layout, write landing copy, or "make it not look AI-made".

## Steps

1. **Walk the real screens (read-only first).** List the landing page, sign-up, sign-in, the main empty state, forms that take money or personal data, and the error paths. Note missing loading, empty and error states, hover-only actions, and overflow on a narrow width.
2. **Check forms and accessibility.** Labels, in-flight submit, field errors, heading order, alt text, and an accessible name on icon buttons.
3. **Check the words.** Flag invented metrics, fake logos, filler phrases and vague heroes. Propose replacement copy in the founder's voice, with no made-up proof.
4. **Propose a small diff.** Prefer the existing design system. Do not add a new UI kit or rewrite the marketing site unless the user asked for that.
5. **Apply only after yes.** Show the diff, wait for an explicit "yes", then apply and re-check the same screens.

## Output format

A table of screens with Pass / Fix, the exact copy or state that is missing, and a short patch list ordered by user impact.

## Safety rules (always)

1. Do not invent testimonials, logos, user counts or awards.
2. Do not widen the change into a brand or framework rewrite.
3. Never commit secrets or disable a security or accessibility check to "make the page look cleaner".
