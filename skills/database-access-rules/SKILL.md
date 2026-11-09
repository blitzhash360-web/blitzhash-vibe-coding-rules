---
name: database-access-rules
description: Design, write and test database access rules so each user can only see and change their own data - Postgres row-level security (including Supabase), Firebase Security Rules, or server-side ownership checks with an ORM (Prisma, Drizzle). Use when the user adds a table or collection, shares data between users or teams, sees "permission denied" errors, or asks if their data is private.
license: MIT
metadata:
  origin: BlitzHash
  pack: blitzhash-vibe-coding-rules
---

# Database access rules

"Logged in" is not "allowed". This skill makes the database enforce who can read and write each row or document.

## When to use

- A new table, collection or storage bucket.
- Multi-user or team features (orgs, shared projects, invites).
- Before launch, or after "can other users see my data?".

## Steps

1. **Map access.** For each table or collection, write a short matrix: who can select, insert, update, delete (anonymous, signed-in, owner, team member, admin). Ask the user to confirm anything public.
2. **Pick the enforcement layer.**
   - Browser talks to the database directly (Supabase, Firebase, PostgREST): rules must live in the database, using RLS policies or Security Rules.
   - Only your server talks to the database (Prisma, Drizzle, SQL): enforce in a data-access layer that always filters by the session user, and give the app a least-privilege database role.
3. **Write the rules.**
   - Postgres: enable RLS on every exposed table; one policy per action; `using` for reads, `with check` for writes; `(select auth.uid())` or your session function; helper `security definer` functions for team membership with a fixed `search_path`; indexes on filtered columns.
   - Firebase: deny by default; match paths; `request.auth.uid == resource.data.ownerId`; validate fields and types on create and update.
   - Storage: private buckets; per-user folders; signed URLs.
4. **Write them as a migration or rules file** in the repo, never only in a dashboard.
5. **Test with real identities.** User A, user B and anonymous: A reads A's rows (allowed), A reads B's rows (denied), anonymous reads (denied unless public), A tries to set `user_id` to B (denied). Use the Firebase emulator rules tests, pgTAP, or a small script with two test accounts on a local or staging database.
6. **Report** the access matrix, the policies, and the test results.

## Output format

Access matrix table, migration or rules file, test file or script, and a pass/fail list from the tests.

## Safety rules (always)

1. Work on local or staging first. Show the migration and wait for an explicit "yes" before applying anything to production.
2. Never disable RLS or open rules "temporarily" to debug. Debug with a test account instead.
3. Admin or service-role credentials only from server environment variables; never print or commit them.
