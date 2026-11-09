---
name: secure-api-endpoint
description: Build or fix an API route, server action or backend function so it is secure by default - authentication, ownership checks, schema validation, safe errors, rate limits and tests for the unhappy paths. Use when the user asks to add an endpoint, form handler, server action, cloud function or "backend for this button", or asks whether an existing route is safe.
license: MIT
metadata:
  origin: BlitzHash
  pack: blitzhash-vibe-coding-rules
---

# Secure API endpoint

AI tools write the happy path well. This skill makes sure the other paths exist: the stranger, the wrong user, the bad input, the script that calls it 10,000 times.

## When to use

- Adding a new API route, server action, Firebase or Supabase function, Express or FastAPI handler.
- Reviewing an existing route before launch, or after "it works but is it safe?".

## Steps

1. **Classify the endpoint.** Who may call it (public, signed-in, owner, admin)? What does it read or write? Does it cost money (AI, SMS, email)? Write the answer as a one-line comment above the handler.
2. **Authenticate on the server.** Use the project's existing auth helper (Auth.js `auth()`, Clerk, Supabase `getUser()`, Firebase `verifyIdToken`). Return 401 if missing. Never read identity from the body.
3. **Authorize the exact record.** Load the record, compare its owner or org to the session user, return 403 (or 404 to avoid confirming it exists). For lists, filter by the user in the query itself.
4. **Validate input with a schema** (zod, valibot, pydantic): strict object, lengths, enums, ranges. Pick fields explicitly before writing to the database.
5. **Access data safely.** Parameterized queries or the ORM; least-privilege client; no admin key unless the operation truly needs it, and then still filter by user.
6. **Limit abuse.** If public, auth-related or paid, add a rate limit with a shared store (see `add-rate-limiting`).
7. **Handle errors.** Wrap in a boundary that logs the real error with a request id and returns a generic message. Fail closed.
8. **Test the unhappy paths.** Add tests or a short manual script for: no session (401), other user's id (403/404), invalid body (400), over the limit (429), happy path (200).
9. **Summarize** what the endpoint allows, for whom, and which checks you added.

## Output format

The handler code, the tests, and a 5-line summary: caller, auth check, authorization rule, validation, rate limit.

## Safety rules (always)

1. Never weaken an existing check (auth, CSRF, RLS, CORS) to make a test pass. Ask first.
2. Credentials only from environment variables. Never print, log or commit keys; use placeholders in examples.
3. Do not run migrations or call production APIs while building the endpoint. Use local or staging resources, and show any command that changes data before running it.
