# Before and after examples

Small, readable examples of what the rules change. **Before** shows patterns AI coding tools often produce when nothing tells them otherwise (written by us to illustrate, not copied from any tool's output). **After** is the same feature written the way the rules ask for.

| Example | Before | After | Rule |
|---|---|---|---|
| Stripe webhook (Next.js) | [before.ts](stripe-webhook/before.ts) | [after.ts](stripe-webhook/after.ts) | [stripe-webhooks](../rules/stripe-webhooks.mdc) |
| Update-order API route | [before.ts](api-route/before.ts) | [after.ts](api-route/after.ts) | [input-validation](../rules/input-validation.mdc), [auth-and-sessions](../rules/auth-and-sessions.mdc) |
| Search query (Node + Postgres) | [before.js](sql-query/before.js) | [after.js](sql-query/after.js) | [database-access](../rules/database-access.mdc) |

These files are examples, not a runnable app. Helper functions such as `requireUser` and `db` stand in for your project's own.
